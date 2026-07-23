/**
 * Signaling server – µWebSockets.js
 *
 * Runs on a dedicated port (WS_PORT, default 9001).
 * Handles room coordination between host and joining players.
 *
 * Message protocol (JSON):
 *   Client → Server:
 *     { type: "host-room",  roomId: "<uuid>" }
 *     { type: "join-room",  roomId: "<uuid>" }
 *     { type: "ping" }
 *
 *   Server → Client:
 *     { type: "error",              message: "..." }
 *     { type: "room-hosted",        roomId: "..." }
 *     { type: "room-joined",        roomId: "..." }
 *     { type: "player-join-request", userId: "..." }
 *     { type: "host-disconnected" }
 *     { type: "pong" }
 */

'use strict';

const uWS = require('uWebSockets.js');
const { setupGameRoute } = require('./ws/gameServer');
const redis = require('./config/redis');
const lucia = require('./config/auth');
const {
  addPlayer,
  removePlayer,
  CHARACTER_COLORS,
  getRandomCharacterColor,
} = require('./utils/roomUtils');

const WS_PORT = parseInt(process.env.WS_PORT || '9001', 10);
const HEARTBEAT_INTERVAL_MS = 30_000;
const ALLOWED_CHARACTER_COLORS = new Set(CHARACTER_COLORS);

// roomId → Set<WebSocket>
const rooms = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, payload) {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // socket already closed – ignore
  }
}

function sendError(ws, message) {
  send(ws, { type: 'error', message });
}

function broadcast(roomId, payload, exclude = null) {
  const peers = rooms.get(roomId);
  if (!peers) return;
  for (const peer of peers) {
    if (peer !== exclude) send(peer, payload);
  }
}

function getHost(roomId) {
  const peers = rooms.get(roomId);
  if (!peers) return null;
  for (const peer of peers) {
    if (peer.isHost) return peer;
  }
  return null;
}

function roomCodeFromRoomId(roomId) {
  return String(roomId || '')
    .replace(/-/g, '')
    .slice(0, 6)
    .toUpperCase();
}

async function cleanupRoom(roomId) {
  const roomCode = roomCodeFromRoomId(roomId);
  const pipeline = redis.pipeline();
  pipeline.del(`room:${roomId}`);
  pipeline.del(`room:${roomId}:pwd`);
  pipeline.del(`room:code:${roomCode}`);
  pipeline.zrem('rooms:public', roomId);
  await pipeline.exec().catch((err) =>
    console.error('[Signal] Redis cleanup error for room', roomId, err.message),
  );
  rooms.delete(roomId);
}

/**
 * Validate a Lucia session token.
 * Returns the userId string or null.
 */
async function validateToken(token) {
  try {
    const { session, user } = await lucia.validateSession(token);
    return session ? user.id : null;
  } catch {
    return null;
  }
}

// ── µWebSockets app ──────────────────────────────────────────────────────────

const app = uWS.App();

app.ws('/signal', {
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 4 * 1024, // 4 KB – more than enough for signaling messages
  idleTimeout: 120,

  /**
   * Upgrade handler – authenticate before the WS handshake completes.
   */
  upgrade: async (res, req, context) => {
    // Collect query params before async work (uWS requirement: read before await)
    const query = req.getQuery();
    const secKey = req.getHeader('sec-websocket-key');
    const secProto = req.getHeader('sec-websocket-protocol');
    const secExt = req.getHeader('sec-websocket-extensions');

    let aborted = false;
    res.onAborted(() => {
      aborted = true;
    });

    // Parse ?token=...
    const params = new URLSearchParams(query);
    const token = params.get('token') || '';

    const userId = token ? await validateToken(token) : null;

    if (aborted) return;

    if (!userId) {
      res.writeStatus('401 Unauthorized').end('Unauthorized');
      return;
    }

    res.upgrade(
      { userId }, // userData attached to the ws object
      secKey,
      secProto,
      secExt,
      context,
    );
  },

  /**
   * Open handler – initialise per-socket state.
   */
  open: (ws) => {
    ws.isHost = false;
    ws.roomId = null;
    ws.lastPing = Date.now();
    console.info('[Signal] Connected userId=%s', ws.userId);
  },

  /**
   * Message handler.
   */
  message: async (ws, rawMsg, _isBinary) => {
    let msg;
    try {
      msg = JSON.parse(Buffer.from(rawMsg).toString('utf8'));
    } catch {
      return sendError(ws, 'Invalid JSON');
    }

    const { type, roomId } = msg;

    // UUID format guard
    if (roomId && !/^[0-9a-f-]{36}$/i.test(roomId)) {
      return sendError(ws, 'Invalid roomId');
    }

    switch (type) {
      case 'ping': {
        ws.lastPing = Date.now();
        send(ws, { type: 'pong' });
        break;
      }

      case 'host-room': {
        if (!roomId) return sendError(ws, 'roomId required');

        // Verify the room exists in Redis
        const raw = await redis.get(`room:${roomId}`);
        if (!raw) return sendError(ws, 'Room not found');

        let room;
        try {
          room = JSON.parse(raw);
        } catch {
          return sendError(ws, 'Corrupted room data');
        }

        if (room.hostId !== ws.userId) {
          return sendError(ws, 'Only the host can host-room');
        }

        // Leave previous room if any
        if (ws.roomId) {
          rooms.get(ws.roomId)?.delete(ws);
        }

        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId).add(ws);
        ws.isHost = true;
        ws.roomId = roomId;

        send(ws, { type: 'room-hosted', roomId });
        console.info('[Signal] Host registered roomId=%s userId=%s', roomId, ws.userId);
        break;
      }

      case 'join-room': {
        if (!roomId) return sendError(ws, 'roomId required');

        // Verify the room exists in Redis and has capacity
        const rawRoom = await redis.get(`room:${roomId}`);
        if (!rawRoom) return sendError(ws, 'Room not found');

        let joinTarget;
        try {
          joinTarget = JSON.parse(rawRoom);
        } catch {
          return sendError(ws, 'Corrupted room data');
        }

        if (!rooms.has(roomId)) {
          return sendError(ws, 'Room has no active host');
        }

        if ((joinTarget.playersCount ?? joinTarget.players?.length ?? 1) >= joinTarget.maxPlayers) {
          return sendError(ws, 'Room is full');
        }

        // Leave previous room if any
        if (ws.roomId) {
          rooms.get(ws.roomId)?.delete(ws);
          const prevRoom = await removePlayer(ws.roomId, ws.userId);
          if (prevRoom) {
            broadcast(ws.roomId, {
              type: 'room-updated',
              players: prevRoom.players,
              playersCount: prevRoom.playersCount,
              playerCharacters: prevRoom.playerCharacters || {},
            });
          }
        }

        rooms.get(roomId).add(ws);
        ws.isHost = false;
        ws.roomId = roomId;

        const updatedRoom = await addPlayer(roomId, ws.userId);

        // Notify host of new join request
        const host = getHost(roomId);
        if (host) {
          send(host, { type: 'player-join-request', userId: ws.userId });
        }

        // Broadcast updated player list to everyone in the room
        if (updatedRoom) {
          broadcast(roomId, {
            type: 'room-updated',
            players: updatedRoom.players,
            playersCount: updatedRoom.playersCount,
            playerCharacters: updatedRoom.playerCharacters || {},
          });
        }

        send(ws, {
          type: 'room-joined',
          roomId,
          playerCharacters: updatedRoom?.playerCharacters || joinTarget.playerCharacters || {},
        });
        console.info('[Signal] Player joined roomId=%s userId=%s', roomId, ws.userId);
        break;
      }

      case 'set-character-color': {
        const { color } = msg;
        if (!roomId) return sendError(ws, 'roomId required');
        if (ws.roomId !== roomId) {
          return sendError(ws, 'Socket is not in this room');
        }

        const rawRoom = await redis.get(`room:${roomId}`);
        if (!rawRoom) return sendError(ws, 'Room not found');

        let room;
        try {
          room = JSON.parse(rawRoom);
        } catch {
          return sendError(ws, 'Corrupted room data');
        }

        if (!Array.isArray(room.players) || !room.players.includes(ws.userId)) {
          return sendError(ws, 'Player is not part of this room');
        }

        if (!room.playerCharacters || typeof room.playerCharacters !== 'object') {
          room.playerCharacters = {};
        }

        const currentColor = room.playerCharacters[ws.userId] || '';
        const normalizedColor = String(color || '').toLowerCase();
        const nextColor = ALLOWED_CHARACTER_COLORS.has(normalizedColor)
          ? normalizedColor
          : getRandomCharacterColor(currentColor);

        room.playerCharacters[ws.userId] = nextColor;
        await redis.set(`room:${roomId}`, JSON.stringify(room), 'KEEPTTL');

        broadcast(roomId, {
          type: 'room-character-updated',
          userId: ws.userId,
          color: nextColor,
          playerCharacters: room.playerCharacters,
        });
        break;
      }

      default:
        sendError(ws, `Unknown message type: ${type}`);
    }
  },

  /**
   * Close handler.
   */
  close: async (ws, _code, _msg) => {
    const { roomId, isHost, userId } = ws;
    console.info('[Signal] Disconnected userId=%s roomId=%s isHost=%s', userId, roomId, isHost);

    if (!roomId) return;

    const peers = rooms.get(roomId);
    if (peers) {
      peers.delete(ws);

      if (isHost) {
        // Notify remaining players and clean up
        for (const peer of peers) {
          send(peer, {
            type: 'host-disconnected',
            message: 'El host se salio de la sala.',
          });
        }
        await cleanupRoom(roomId);
        console.info('[Signal] Host disconnected – room cleaned up roomId=%s', roomId);
      } else {
        // Non-host player left — remove from array in Redis and notify remaining peers
        const updatedRoom = await removePlayer(roomId, userId);
        if (updatedRoom) {
          broadcast(roomId, {
            type: 'room-updated',
            players: updatedRoom.players,
            playersCount: updatedRoom.playersCount,
            playerCharacters: updatedRoom.playerCharacters || {},
          });
        }
        if (peers.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  },
});

// ── Heartbeat watchdog ───────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [roomId, peers] of rooms) {
    const host = getHost(roomId);
    if (host && now - host.lastPing > HEARTBEAT_INTERVAL_MS * 2) {
      console.warn('[Signal] Host heartbeat timeout roomId=%s', roomId);
      // Kick the host – uWS close will fire the close handler
      host.close();
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// ── Game route ───────────────────────────────────────────────────────────────

setupGameRoute(app);

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(WS_PORT, (token) => {
  if (token) {
    console.info('[Signal] WebSocket signaling server listening on port %d', WS_PORT);
  } else {
    console.error('[Signal] Failed to listen on port %d', WS_PORT);
    process.exit(1);
  }
});

module.exports = { rooms };
