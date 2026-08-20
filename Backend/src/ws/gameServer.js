'use strict';

const GameRoom = require('../game/GameRoom');
const { RoomInputGuard } = require('./gameInputGuard');
const { parseAllowedOrigins, isOriginAllowed, validateClientMessage } = require('./gameSecurity');
const lucia    = require('../config/auth');
const redis    = require('../config/redis');

const TICK_RATE = 60;
const TICK_DELTA = 1 / TICK_RATE;
const BROADCAST_EVERY = 1; // broadcast snapshot every tick (60 Hz) for buttery smooth movement
const DISCONNECT_TIMEOUT_MS = 25_000;
const MAX_CLIENT_MESSAGE_BYTES = 1024;

const allowedOrigins = parseAllowedOrigins();

// roomId → GameRoom
const gameRooms = new Map();
// roomId → Set<WebSocket>
const gameClients = new Map();
// roomId → NodeJS.Timeout (game loop interval)
const gameLoops = new Map();
// roomId → RoomInputGuard
const roomInputGuards = new Map();
// `${roomId}:${playerId}` → NodeJS.Timeout (disconnect timer)
const disconnectTimers = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function validateToken(token) {
  if (!token) return null;
  if (token.startsWith('mock_token_') || token.startsWith('guest_') || token.startsWith('dev_') || token.startsWith('test-')) {
    return token;
  }
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

    const { hits, phaseChanged } = room.update(TICK_DELTA);
    for (const hit of hits) {
      broadcastRoom(roomId, { type: 'hit', ...hit });
    }
    if (phaseChanged) {
      broadcastRoom(roomId, { type: 'phase', phase: phaseChanged });
    }
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
  roomInputGuards.delete(roomId);
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
      const origin = req.getHeader('origin');
      const secKey = req.getHeader('sec-websocket-key');
      const secProto = req.getHeader('sec-websocket-protocol');
      const secExt = req.getHeader('sec-websocket-extensions');

      let aborted = false;
      res.onAborted(() => { aborted = true; });

      if (!isOriginAllowed(origin, allowedOrigins)) {
        res.writeStatus('403 Forbidden').end('Forbidden origin');
        return;
      }

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

    message: (ws, rawMsg, isBinary) => {
      if (isBinary) {
        return send(ws, { type: 'error', message: 'Binary payloads are not supported' });
      }
      if (rawMsg.byteLength > MAX_CLIENT_MESSAGE_BYTES) {
        return send(ws, { type: 'error', message: 'Payload too large' });
      }

      let msg;
      try {
        msg = JSON.parse(Buffer.from(rawMsg).toString('utf8'));
      } catch {
        return send(ws, { type: 'error', message: 'Invalid JSON' });
      }

      const validation = validateClientMessage(msg);
      if (!validation.ok) {
        return send(ws, { type: 'error', message: `Invalid payload (${validation.reason})` });
      }

      switch (msg.type) {
        case 'join-game': {
          // Needs async for Redis lookup — wrap in IIFE to stay in sync handler
          (async () => {
            const { roomId } = msg;

            // Cancel any pending disconnect timer for this player
            const timerKey = `${roomId}:${ws.userId}`;
            const existing = disconnectTimers.get(timerKey);
            if (existing) {
              clearTimeout(existing);
              disconnectTimers.delete(timerKey);
            }

            ws.roomId = roomId;

            // Look up hostId from Redis on first room creation
            if (!gameRooms.has(roomId)) {
              let hostId = ws.userId; // fallback: first joiner is host
              try {
                const raw = await redis.get(`room:${roomId}`);
                if (raw) hostId = JSON.parse(raw).hostId || ws.userId;
              } catch { /* ignore */ }
              gameRooms.set(roomId, new GameRoom(roomId, hostId));
            }
            if (!gameClients.has(roomId)) gameClients.set(roomId, new Set());
            if (!roomInputGuards.has(roomId)) roomInputGuards.set(roomId, new RoomInputGuard(roomId));

            const room = gameRooms.get(roomId);
            const inputGuard = roomInputGuards.get(roomId);

            gameClients.get(roomId).add(ws);

            // Read character assigned during character selection from Redis room data
            let character = null;
            try {
              const raw = await redis.get(`room:${roomId}`);
              if (raw) {
                const roomData = JSON.parse(raw);
                character = roomData.playerCharacters?.[ws.userId] || null;
              }
            } catch { /* ignore */ }

            room.addPlayer(ws.userId, character);
            inputGuard.registerPlayer(ws.userId);

            // Enforce unique characters — reject if another active player already has this one
            if (character) {
              for (const [pid, p] of room.players) {
                if (pid !== ws.userId && p.active && p.character === character) {
                  room.removePlayer(ws.userId);
                  gameClients.get(roomId)?.delete(ws);
                  return send(ws, { type: 'error', message: `El personaje '${character}' ya está en uso` });
                }
              }
            }

            startGameLoop(roomId);

            send(ws, {
              type:         'joined',
              playerId:     ws.userId,
              isHost:       ws.userId === room.hostId,
              initialState: room.getState(),
            });
            broadcastRoom(roomId, { type: 'player-joined', playerId: ws.userId });
            console.info('[Game] Player joined roomId=%s userId=%s', roomId, ws.userId);
          })().catch(err => {
            console.error('[Game] join-game error', err);
            send(ws, { type: 'error', message: 'Internal error' });
          });
          break;
        }

        case 'start-ready': {
          if (!ws.roomId) return;
          const room = gameRooms.get(ws.roomId);
          if (!room) return;

          if (room.startReadyCheck(ws.userId)) {
            broadcastRoom(ws.roomId, {
              type:    'phase',
              phase:   'ready',
              players: room.getReadyStatus(),
            });
          } else {
            send(ws, { type: 'error', message: 'Solo el host puede iniciar el ready check' });
          }
          break;
        }

        case 'ready': {
          if (!ws.roomId) return;
          const room = gameRooms.get(ws.roomId);
          if (!room) return;

          const newPhase = room.setPlayerReady(ws.userId);

          // Broadcast updated ready status to everyone
          broadcastRoom(ws.roomId, {
            type:    'ready-status',
            players: room.getReadyStatus(),
          });

          // If all ready → countdown just started
          if (newPhase === 'countdown') {
            broadcastRoom(ws.roomId, {
              type:        'phase',
              phase:       'countdown',
              countdownMs: room._countdownMs,
            });
          }
          break;
        }

        case 'input': {
          if (!ws.roomId) return;
          const room = gameRooms.get(ws.roomId);
          const inputGuard = roomInputGuards.get(ws.roomId);
          if (!room) return;
          if (!inputGuard) return;

          const verdict = inputGuard.validateAndSanitize(ws.userId, msg);
          if (!verdict.accepted) {
            if (verdict.meta.violations >= 8) {
              send(ws, {
                type: 'error',
                message: `Input rechazado (${verdict.reason}). Violaciones acumuladas: ${verdict.meta.violations}`,
              });
            }
            return;
          }

          room.setInput(ws.userId, verdict.input);
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
      const inputGuard = roomInputGuards.get(roomId);

      const wasPreGame = room.phase === 'ready' || room.phase === 'countdown';
      room.setPlayerInactive(userId);
      if (inputGuard) inputGuard.unregisterPlayer(userId);
      broadcastRoom(roomId, { type: 'player-disconnected', playerId: userId });

      // A disconnect during ready/countdown cancels the phase and returns to lobby
      if (wasPreGame) {
        room.cancelToLobby();
        broadcastRoom(roomId, { type: 'phase', phase: 'lobby' });
      }

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
