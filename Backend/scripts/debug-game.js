/**
 * debug-game.js — Script de debugging del game loop sin necesidad de frontend.
 *
 * Simula el flujo completo de dos jugadores:
 *   1. Login de jugador 1 y 2
 *   2. Jugador 1 crea sala
 *   3. Ambos se conectan al /signal WS
 *   4. Jugador 2 se une a la sala
 *   5. Ambos se conectan al /game WS y envían join-game
 *   6. Jugador 1 envía inputs WASD simulados
 *   7. Se loguean los snapshots recibidos
 *
 * Uso:
 *   node scripts/debug-game.js
 *
 * Variables de entorno opcionales:
 *   API_URL   — default http://localhost:8080
 *   WS_URL    — default ws://localhost:9001
 *   P1_EMAIL  — email del jugador 1
 *   P1_PASS   — contraseña del jugador 1
 *   P2_EMAIL  — email del jugador 2
 *   P2_PASS   — contraseña del jugador 2
 */

'use strict';

const { WebSocket } = require('ws');
const Database = require('better-sqlite3');
const path = require('path');

const API   = process.env.API_URL  || 'http://localhost:8080';
const WS    = process.env.WS_URL   || 'ws://localhost:9001';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/danmakrew.db');

const P1 = { email: process.env.P1_EMAIL || 'p1@debug.com', password: process.env.P1_PASS || 'debug1234' };
const P2 = { email: process.env.P2_EMAIL || 'p2@debug.com', password: process.env.P2_PASS || 'debug1234' };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { email, password });
  if (!r.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.token || r.data.sessionId || r.data.id;
}

async function tryRegister(email, password, username) {
  await api('POST', '/api/auth/register', { email, password, username });
  // ignore error if already registered
}

// Marca el usuario como verificado directamente en la DB local.
// Necesario porque el script no puede completar el flujo de verificación por mail.
function forceVerify(email) {
  const db = new Database(DB_PATH);
  const result = db.prepare('UPDATE user SET is_verified = 1, verification_token = NULL WHERE email = ?').run(email);
  db.close();
  if (result.changes > 0) log('setup', `${email} verificado en DB`);
}

function wsConnect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => {
      log(label, 'connected');
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function wsSend(ws, label, msg) {
  const raw = JSON.stringify(msg);
  log(label, '→', raw);
  ws.send(raw);
}

function wsOnMessage(ws, label, handler) {
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    handler(msg);
  });
}

let _tick = 0;
function log(label, ...args) {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] [${label}]`, ...args);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Registrar usuarios si no existen y forzar verificación de mail
  log('setup', 'Registrando jugadores (ignora error si ya existen)…');
  await tryRegister(P1.email, P1.password, 'DebugP1');
  await tryRegister(P2.email, P2.password, 'DebugP2');
  forceVerify(P1.email);
  forceVerify(P2.email);

  // 2. Login
  log('setup', 'Login…');
  const token1 = await login(P1.email, P1.password);
  const token2 = await login(P2.email, P2.password);
  log('setup', `token1=${token1.slice(0,12)}… token2=${token2.slice(0,12)}…`);

  // 3. Jugador 1 crea sala
  const roomRes = await api('POST', '/api/rooms', {
    name: 'Debug Room',
    map: 'classic',
    maxPlayers: 4,
    isPublic: true,
    difficulty: 'normal',
  }, token1);
  if (!roomRes.ok) throw new Error('No se pudo crear sala: ' + JSON.stringify(roomRes.data));
  const roomId = roomRes.data.id;
  log('setup', `Sala creada: ${roomId}`);

  // 4. Conectar ambos al /signal WS
  const sig1 = await wsConnect(`${WS}/signal?token=${token1}`, 'SIG-P1');
  const sig2 = await wsConnect(`${WS}/signal?token=${token2}`, 'SIG-P2');

  wsOnMessage(sig1, 'SIG-P1', (msg) => {
    if (msg.type === 'player-join-request') {
      log('SIG-P1', `Join request from ${msg.userId}`);
    } else {
      log('SIG-P1', JSON.stringify(msg));
    }
  });
  wsOnMessage(sig2, 'SIG-P2', (msg) => log('SIG-P2', JSON.stringify(msg)));

  // Host room (P1)
  wsSend(sig1, 'SIG-P1', { type: 'host-room', roomId });
  await sleep(300);

  // Jugador 2 se une a la sala HTTP
  const joinRes = await api('POST', `/api/rooms/${roomId}/join`, {}, token2);
  if (!joinRes.ok) log('setup', 'Warn join HTTP:', JSON.stringify(joinRes.data));

  // P2 se une por signal
  wsSend(sig2, 'SIG-P2', { type: 'join-room', roomId });
  await sleep(300);

  // 5. Ambos se conectan al /game WS
  log('game', 'Conectando al /game WS…');
  const gws1 = await wsConnect(`${WS}/game?token=${token1}`, 'GAME-P1');
  const gws2 = await wsConnect(`${WS}/game?token=${token2}`, 'GAME-P2');

  let snapshotCount = 0;
  wsOnMessage(gws1, 'GAME-P1', (msg) => {
    if (msg.type === 'joined') {
      log('GAME-P1', `Joined! playerId=${msg.playerId}`);
      log('GAME-P1', 'Initial state:', JSON.stringify(msg.initialState));
    } else if (msg.type === 'snapshot') {
      snapshotCount++;
      if (snapshotCount % 20 === 1) { // log cada 20 snapshots para no saturar
        log('GAME-P1', `snap #${snapshotCount} tick=${msg.tick} players=${msg.players.length}`, 
          msg.players.map(p => `${p.id.slice(0,6)} (${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' | '));
      }
    } else {
      log('GAME-P1', JSON.stringify(msg));
    }
  });

  wsOnMessage(gws2, 'GAME-P2', (msg) => {
    if (msg.type === 'joined') {
      log('GAME-P2', `Joined! playerId=${msg.playerId}`);
    } else if (msg.type === 'snapshot') {
      // silencioso para no saturar
    } else {
      log('GAME-P2', JSON.stringify(msg));
    }
  });

  // 6. Ambos envían join-game
  wsSend(gws1, 'GAME-P1', { type: 'join-game', roomId });
  wsSend(gws2, 'GAME-P2', { type: 'join-game', roomId });
  await sleep(500);

  // 7. Simular inputs de P1 durante 5 segundos (moverse en diagonal)
  log('game', 'Enviando inputs durante 5 segundos…');
  const inputPatterns = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
  ];
  let step = 0;
  const inputInterval = setInterval(() => {
    const input = inputPatterns[step % inputPatterns.length];
    wsSend(gws1, 'GAME-P1', { type: 'input', ...input, action: null });
    step++;
  }, 500); // cambiar dirección cada 500ms

  await sleep(5000);
  clearInterval(inputInterval);

  // 8. Desconectar P2 y esperar timeout
  log('game', 'Desconectando P2…');
  gws2.close();
  await sleep(2000);

  // 9. Cerrar todo
  log('done', `Total snapshots recibidos por P1: ${snapshotCount}`);
  gws1.close();
  sig1.close();
  sig2.close();
  process.exit(0);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
