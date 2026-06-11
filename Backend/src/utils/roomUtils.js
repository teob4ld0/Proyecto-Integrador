'use strict';

const redis = require('../config/redis');

const PLAYER_ROOM_KEY = (userId) => `player:${userId}:room`;

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
 * Get the roomId the player is currently in, or null.
 */
async function getPlayerRoom(userId) {
  return redis.get(PLAYER_ROOM_KEY(userId));
}

module.exports = { addPlayer, removePlayer, getPlayerRoom };
