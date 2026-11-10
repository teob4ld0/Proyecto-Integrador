'use strict';

const redis = require('../config/redis');

const PLAYER_ROOM_KEY = (userId) => `player:${userId}:room`;
const CHARACTER_ROLES = ['Tank', 'Support', 'DPS', 'Special_Attack'];

function getRandomCharacterRole(excludeRole = '') {
  const normalizedExclude = String(excludeRole || '');
  const available = CHARACTER_ROLES.filter((role) => role !== normalizedExclude);
  const pool = available.length > 0 ? available : CHARACTER_ROLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getAvailableCharacterRole(takenRoles = [], excludeRole = '') {
  const takenSet = new Set(Array.isArray(takenRoles) ? takenRoles.filter(Boolean) : []);
  const normalizedExclude = String(excludeRole || '');
  const free = CHARACTER_ROLES.filter((role) => !takenSet.has(role) && role !== normalizedExclude);
  if (free.length > 0) {
    return free[0];
  }
  const anyFree = CHARACTER_ROLES.filter((role) => !takenSet.has(role));
  if (anyFree.length > 0) {
    return anyFree[0];
  }
  return getRandomCharacterRole(normalizedExclude);
}

function syncPlayerReady(room) {
  if (!room.playerReady || typeof room.playerReady !== 'object') {
    room.playerReady = {};
  }

  const validPlayers = new Set(Array.isArray(room.players) ? room.players : []);

  for (const playerId of validPlayers) {
    if (typeof room.playerReady[playerId] !== 'boolean') {
      room.playerReady[playerId] = false;
    }
  }

  for (const playerId of Object.keys(room.playerReady)) {
    if (!validPlayers.has(playerId)) {
      delete room.playerReady[playerId];
    }
  }
}

function syncPlayerCharacters(room) {
  if (!room.playerCharacters || typeof room.playerCharacters !== 'object') {
    room.playerCharacters = {};
  }

  const validPlayers = new Set(Array.isArray(room.players) ? room.players : []);
  const assignedRoles = new Set();

  for (const playerId of validPlayers) {
    const existing = room.playerCharacters[playerId];
    if (existing && CHARACTER_ROLES.includes(existing) && !assignedRoles.has(existing)) {
      assignedRoles.add(existing);
    } else {
      const nextRole = getAvailableCharacterRole([...assignedRoles]);
      room.playerCharacters[playerId] = nextRole;
      assignedRoles.add(nextRole);
    }
  }

  for (const playerId of Object.keys(room.playerCharacters)) {
    if (!validPlayers.has(playerId)) {
      delete room.playerCharacters[playerId];
    }
  }
}

/**
 * Add a userId to the room's players array in Redis.
 * Idempotent — won't add duplicates.
 * Automatically removes the player from their previous room if they were in one.
 * Returns the updated room object, or null if the room doesn't exist.
 */
async function addPlayer(roomId, userId) {
  try {
    // Evict from previous room first
    const prevRoomId = await redis.get(PLAYER_ROOM_KEY(userId));
    if (prevRoomId && prevRoomId !== roomId) {
      await removePlayer(prevRoomId, userId);
    }

    const raw = await redis.get(`room:${roomId}`);
    if (!raw) return null;
    const room = JSON.parse(raw);
    if (!Array.isArray(room.players)) room.players = [];
    if (!room.players.includes(userId)) room.players.push(userId);
    syncPlayerCharacters(room);
    syncPlayerReady(room);
    room.playersCount = room.players.length;

    const pipeline = redis.pipeline();
    pipeline.set(`room:${roomId}`, JSON.stringify(room), 'KEEPTTL');
    pipeline.set(PLAYER_ROOM_KEY(userId), roomId, 'EX', 7200);
    await pipeline.exec();

    return room;
  } catch (err) {
    console.error('[roomUtils] Failed to add player to room', roomId, err.message);
    return null;
  }
}

/**
 * Remove a userId from the room's players array in Redis.
 * Also deletes the player→room index key.
 * Returns the updated room object, or null if the room doesn't exist.
 */
async function removePlayer(roomId, userId) {
  try {
    const raw = await redis.get(`room:${roomId}`);
    if (!raw) {
      // Room gone but clean up the index anyway
      await redis.del(PLAYER_ROOM_KEY(userId));
      return null;
    }
    const room = JSON.parse(raw);
    if (!Array.isArray(room.players)) return null;
    room.players = room.players.filter((id) => id !== userId);
    syncPlayerCharacters(room);
    syncPlayerReady(room);
    room.playersCount = room.players.length;

    const pipeline = redis.pipeline();
    pipeline.set(`room:${roomId}`, JSON.stringify(room), 'KEEPTTL');
    pipeline.del(PLAYER_ROOM_KEY(userId));
    await pipeline.exec();

    return room;
  } catch (err) {
    console.error('[roomUtils] Failed to remove player from room', roomId, err.message);
    return null;
  }
}

/**
 * Set a player's ready state in the room.
 */
async function setPlayerReadyState(roomId, userId, isReady = true) {
  try {
    const raw = await redis.get(`room:${roomId}`);
    if (!raw) return null;
    const room = JSON.parse(raw);
    if (!Array.isArray(room.players) || !room.players.includes(userId)) return null;

    syncPlayerReady(room);
    room.playerReady[userId] = Boolean(isReady);

    await redis.set(`room:${roomId}`, JSON.stringify(room), 'KEEPTTL');
    return room;
  } catch (err) {
    console.error('[roomUtils] Failed to set ready state for', userId, roomId, err.message);
    return null;
  }
}

/**
 * Get the roomId the player is currently in, or null.
 */
async function getPlayerRoom(userId) {
  return redis.get(PLAYER_ROOM_KEY(userId));
}

module.exports = {
  addPlayer,
  removePlayer,
  setPlayerReadyState,
  getPlayerRoom,
  syncPlayerReady,
  syncPlayerCharacters,
  CHARACTER_ROLES,
  getRandomCharacterRole,
  getAvailableCharacterRole,
};
