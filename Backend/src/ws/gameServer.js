'use strict';

const GameRoom = require('../game/GameRoom');
const { updateBullets } = require('../game/bulletSystem');
const lucia = require('../config/auth');

const TICK_RATE = 60;
const TICK_DELTA = 1 / TICK_RATE;
const BROADCAST_EVERY = 3; // broadcast snapshot every 3 ticks → ~20 Hz
const DISCONNECT_TIMEOUT_MS = 15_000;

// roomId → GameRoom
const gameRooms = new Map();
// roomId → Set<WebSocket>
const gameClients = new Map();
// roomId → NodeJS.Timeout (game loop interval)
const gameLoops = new Map();
// `${roomId}:${playerId}` → NodeJS.Timeout (disconnect timer)
const disconnectTimers = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function validateToken(token) {
  try {
    const { session, user } = await lucia.validateSession(token);
    return session ? user.id : null;
  } catch {
    return null;
  }
}

function send(ws, payload) {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // socket already closed
  }
}

function broadcastRoom(roomId, payload) {
  const clients = gameClients.get(roomId);
  if (!clients) return;
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      // ignore closed sockets
    }
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────────

function startGameLoop(roomId) {
  if (gameLoops.has(roomId)) return;

  let tickCounter = 0;
  const interval = setInterval(() => {
    const room = gameRooms.get(roomId);
    if (!room) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      return;
    }

    room.update(TICK_DELTA);
    updateBullets(room.world, TICK_DELTA);
    tickCounter++;

    if (tickCounter >= BROADCAST_EVERY) {
      broadcastRoom(roomId, room.getState());
      tickCounter = 0;
    }
  }, 1000 / TICK_RATE);

  gameLoops.set(roomId, interval);
  console.info('[Game] Loop started roomId=%s', roomId);
}

function stopGameLoop(roomId) {
  const interval = gameLoops.get(roomId);
  if (interval) {
    clearInterval(interval);
    gameLoops.delete(roomId);
    console.info('[Game] Loop stopped roomId=%s', roomId);
  }
}

function teardownRoom(roomId) {
  stopGameLoop(roomId);
  gameRooms.delete(roomId);
  gameClients.delete(roomId);
}

// ── Route setup ───────────────────────────────────────────────────────────────

/**
 * Register the /game WebSocket route on the given µWebSockets app.
 * Must be called before app.listen().
 * @param {import('uWebSockets.js').TemplatedApp} app
 */
function setupGameRoute(app) {
  app.ws('/game', {
    compression: 0,
    maxPayloadLength: 2 * 1024, // 2 KB
    idleTimeout: 120,

    /**
     * Authenticate the client during the WebSocket upgrade.
     */
    upgrade: async (res, req, context) => {
      const query = req.getQuery();
      const secKey = req.getHeader('sec-websocket-key');
      const secProto = req.getHeader('sec-websocket-protocol');
      const secExt = req.getHeader('sec-websocket-extensions');

      let aborted = false;
      res.onAborted(() => { aborted = true; });

      const params = new URLSearchParams(query);
      const token = params.get('token') || '';
      const userId = token ? await validateToken(token) : null;

      if (aborted) return;

      if (!userId) {
        res.writeStatus('401 Unauthorized').end('Unauthorized');
        return;
      }

      res.upgrade({ userId }, secKey, secProto, secExt, context);
    },

    open: (ws) => {
      ws.roomId = null;
      console.info('[Game] Connected userId=%s', ws.userId);
    },

    message: (ws, rawMsg, _isBinary) => {
      let msg;
      try {
        msg = JSON.parse(Buffer.from(rawMsg).toString('utf8'));
      } catch {
        return send(ws, { type: 'error', message: 'Invalid JSON' });
      }

      switch (msg.type) {
        case 'join-game': {
          const { roomId } = msg;
          if (!roomId || !/^[0-9a-f-]{36}$/i.test(roomId)) {
            return send(ws, { type: 'error', message: 'Invalid roomId' });
          }

          // Cancel any pending disconnect timer for this player
          const timerKey = `${roomId}:${ws.userId}`;
          const existing = disconnectTimers.get(timerKey);
          if (existing) {
            clearTimeout(existing);
            disconnectTimers.delete(timerKey);
          }

          ws.roomId = roomId;

          if (!gameRooms.has(roomId)) gameRooms.set(roomId, new GameRoom(roomId));
          if (!gameClients.has(roomId)) gameClients.set(roomId, new Set());

          const room = gameRooms.get(roomId);
          gameClients.get(roomId).add(ws);
          room.addPlayer(ws.userId);

          startGameLoop(roomId);

          send(ws, {
            type: 'joined',
            playerId: ws.userId,
            initialState: room.getState(),
          });
          console.info('[Game] Player joined roomId=%s userId=%s', roomId, ws.userId);
          break;
        }

        case 'input': {
          if (!ws.roomId) return;
          const room = gameRooms.get(ws.roomId);
          if (!room) return;

          // Clamp input values to prevent cheating
          const dx = typeof msg.dx === 'number' ? Math.max(-1, Math.min(1, msg.dx)) : 0;
          const dy = typeof msg.dy === 'number' ? Math.max(-1, Math.min(1, msg.dy)) : 0;
          const action = msg.action === null ? null : undefined; // only null allowed for now

          room.setInput(ws.userId, { dx, dy, action: action ?? null });
          break;
        }

        default:
          send(ws, { type: 'error', message: `Unknown type: ${msg.type}` });
      }
    },

    close: (ws, _code, _msg) => {
      const { roomId, userId } = ws;
      console.info('[Game] Disconnected userId=%s roomId=%s', userId, roomId);

      if (!roomId) return;

      const clients = gameClients.get(roomId);
      if (clients) clients.delete(ws);

      const room = gameRooms.get(roomId);
      if (!room) return;

      room.setPlayerInactive(userId);
      broadcastRoom(roomId, { type: 'player-disconnected', playerId: userId });

      // Give the player 15 s to reconnect before removing them
      const timerKey = `${roomId}:${userId}`;
      const timer = setTimeout(() => {
        disconnectTimers.delete(timerKey);
        const r = gameRooms.get(roomId);
        if (!r) return;

        r.removePlayer(userId);
        broadcastRoom(roomId, { type: 'player-left', playerId: userId });
        console.info('[Game] Player removed after timeout userId=%s roomId=%s', userId, roomId);

        if (r.players.size === 0) {
          teardownRoom(roomId);
        }
      }, DISCONNECT_TIMEOUT_MS);

      disconnectTimers.set(timerKey, timer);
    },
  });

  console.info('[Game] /game route registered');
}

module.exports = { setupGameRoute };
