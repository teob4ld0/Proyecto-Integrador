const { randomUUID } = require('crypto');
const { z } = require('zod');
const redis = require('../config/redis');
const authenticate = require('../middleware/auth');

const ROOM_TTL = 7200; // seconds
const PUBLIC_ROOMS_KEY = 'rooms:public';
const MAX_PUBLIC_LIST = 50;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createRoomSchema = z.object({
  name: z.string().min(3).max(30).trim(),
  map: z.string().trim().default('classic'),
  maxPlayers: z.number().int().min(2).max(20).default(8),
  password: z.string().max(64).optional(),
  isPublic: z.boolean().default(true),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitise a plain object to only keep the allowed room fields.
 * This prevents prototype pollution / unexpected keys from ending up in Redis.
 */
function sanitiseRoom(data) {
  return {
    id: data.id,
    name: data.name,
    hostId: data.hostId,
    map: data.map,
    maxPlayers: data.maxPlayers,
    players: data.players,
    hasPassword: data.hasPassword,
    isPublic: data.isPublic,
    createdAt: data.createdAt,
  };
}

function roomKey(roomId) {
  return `room:${roomId}`;
}

function roomCode(roomId) {
  return roomId.slice(0, 6).toUpperCase();
}

function roomCodeKey(code) {
  return `room:code:${code}`;
}

// ── Plugin ───────────────────────────────────────────────────────────────────

async function roomRoutes(fastify) {
  /**
   * POST /api/rooms
   * Create a new ephemeral room (authenticated).
   */
  fastify.post('/rooms', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Validation error', errors: parsed.error.flatten() });
    }

    const { name, map, maxPlayers, password, isPublic } = parsed.data;
    const hostId = request.user.id;
    const id = randomUUID();
    const hasPassword = Boolean(password);
    const createdAt = new Date().toISOString();

    const room = sanitiseRoom({
      id,
      name,
      hostId,
      map,
      maxPlayers,
      players: 1,
      hasPassword,
      isPublic,
      createdAt,
    });

    const pipeline = redis.pipeline();
    pipeline.set(roomKey(id), JSON.stringify(room), 'EX', ROOM_TTL);
    pipeline.set(roomCodeKey(roomCode(id)), id, 'EX', ROOM_TTL);

    if (hasPassword) {
      // Store password separately so it never leaks through the room object
      pipeline.set(`room:${id}:pwd`, password, 'EX', ROOM_TTL);
    }

    if (isPublic && !hasPassword) {
      pipeline.zadd(PUBLIC_ROOMS_KEY, Date.now(), id);
    }

    await pipeline.exec();

    return reply.status(201).send(room);
  });

  /**
   * GET /api/rooms
   * List up to 50 most-recent public rooms (unauthenticated).
   */
  fastify.get('/rooms', async (_request, reply) => {
    const ids = await redis.zrevrange(PUBLIC_ROOMS_KEY, 0, MAX_PUBLIC_LIST - 1);

    if (!ids.length) {
      return reply.send([]);
    }

    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(roomKey(id));
    }

    const results = await pipeline.exec();

    const rooms = results
      .map(([err, raw]) => {
        if (err || !raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return reply.send(rooms);
  });

  /**
   * GET /api/rooms/:roomId
   * Get a single room's details (unauthenticated).
   */
  fastify.get('/rooms/:roomId', async (request, reply) => {
    const { roomId } = request.params;

    if (!/^[0-9a-f-]{36}$/i.test(roomId)) {
      return reply.status(400).send({ message: 'Invalid roomId' });
    }

    const raw = await redis.get(roomKey(roomId));
    if (!raw) {
      return reply.status(404).send({ message: 'Room not found' });
    }

    try {
      return reply.send(JSON.parse(raw));
    } catch {
      return reply.status(500).send({ message: 'Corrupted room data' });
    }
  });

  /**
   * GET /api/rooms/by-code/:code
   * Resolve a 6-char lobby code to a room.
   */
  fastify.get('/rooms/by-code/:code', async (request, reply) => {
    const normalizedCode = String(request.params.code || '').trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return reply.status(400).send({ message: 'Invalid room code' });
    }

    const roomId = await redis.get(roomCodeKey(normalizedCode));
    if (!roomId) {
      return reply.status(404).send({ message: 'Room not found' });
    }

    const raw = await redis.get(roomKey(roomId));
    if (!raw) {
      return reply.status(404).send({ message: 'Room not found' });
    }

    try {
      return reply.send(JSON.parse(raw));
    } catch {
      return reply.status(500).send({ message: 'Corrupted room data' });
    }
  });

  // ── Join schema ─────────────────────────────────────────────────────────────

  const joinRoomSchema = z.object({
    password: z.string().max(64).optional(),
  });

  /**
   * POST /api/rooms/:roomId/join
   * Validate password and check capacity before the WebSocket join.
   * Returns the room object on success; the client then sends `join-room` via WS.
   */
  fastify.post('/rooms/:roomId/join', { preHandler: authenticate }, async (request, reply) => {
    const { roomId } = request.params;

    if (!/^[0-9a-f-]{36}$/i.test(roomId)) {
      return reply.status(400).send({ message: 'Invalid roomId' });
    }

    const parsed = joinRoomSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Validation error', errors: parsed.error.flatten() });
    }

    const raw = await redis.get(roomKey(roomId));
    if (!raw) {
      return reply.status(404).send({ message: 'Room not found' });
    }

    let room;
    try {
      room = JSON.parse(raw);
    } catch {
      return reply.status(500).send({ message: 'Corrupted room data' });
    }

    if (room.hostId === request.user.id) {
      return reply.status(400).send({ message: 'You are the host — use the host-room WebSocket message instead' });
    }

    if (room.hasPassword) {
      const storedPwd = await redis.get(`room:${roomId}:pwd`);
      if (!storedPwd || parsed.data.password !== storedPwd) {
        return reply.status(403).send({ message: 'Incorrect room password' });
      }
    }

    if (room.players >= room.maxPlayers) {
      return reply.status(409).send({ message: 'Room is full' });
    }

    return reply.send({ room });
  });

  /**
   * DELETE /api/rooms/:roomId
   * Delete a room — only the host may do this (authenticated).
   */
  fastify.delete('/rooms/:roomId', { preHandler: authenticate }, async (request, reply) => {
    const { roomId } = request.params;

    // Basic UUID format guard to avoid Redis key injection
    if (!/^[0-9a-f-]{36}$/i.test(roomId)) {
      return reply.status(400).send({ message: 'Invalid roomId' });
    }

    const raw = await redis.get(roomKey(roomId));
    if (!raw) {
      return reply.status(404).send({ message: 'Room not found' });
    }

    let room;
    try {
      room = JSON.parse(raw);
    } catch {
      return reply.status(500).send({ message: 'Corrupted room data' });
    }

    if (room.hostId !== request.user.id) {
      return reply.status(403).send({ message: 'Only the host can delete this room' });
    }

    const pipeline = redis.pipeline();
    pipeline.del(roomKey(roomId));
    pipeline.del(roomCodeKey(roomCode(roomId)));
    pipeline.zrem(PUBLIC_ROOMS_KEY, roomId);
    await pipeline.exec();

    return reply.send({ success: true });
  });
}

module.exports = roomRoutes;
