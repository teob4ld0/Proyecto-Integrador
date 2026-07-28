/**
 * debug-game.js — Script de debugging del game loop y sistema de balas.
 *
 * Corre una suite de tests automáticos:
 *   T1 — Las balas aparecen en los snapshots al disparar
 *   T2 — El cooldown server-side limita la cadencia de disparo
 *   T3 — Una bala impacta a P2 → se recibe evento 'hit'
 *   T4 — Las balas desaparecen al expirar el TTL (3s)
 *   T5 — El servidor mantiene el ritmo de snapshots (~20 Hz) bajo carga
 *
 * Uso:
 *   node scripts/debug-game.js
 *
 * Variables de entorno opcionales:
 *   API_URL   — default http://localhost:8080
 *   WS_URL    — default ws://localhost:9001
 *   P1_EMAIL / P1_PASS
 *   P2_EMAIL / P2_PASS
 */

'use strict';

const { WebSocket } = require('ws');
const Database = require('better-sqlite3');
const path = require('path');

const API     = process.env.API_URL  || 'http://localhost:8080';
const WS      = process.env.WS_URL   || 'ws://localhost:9001';
const DB_PATH = process.env.DB_PATH  || path.join(__dirname, '../data/danmakrew.db');

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
}

function forceVerify(email) {
  const db = new Database(DB_PATH);
  const result = db.prepare('UPDATE user SET is_verified = 1, verification_token = NULL WHERE email = ?').run(email);
  db.close();
  if (result.changes > 0) log('setup', `${email} verificado en DB`);
}

function wsConnect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => { log(label, 'connected'); resolve(ws); });
    ws.on('error', reject);
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

function log(label, ...args) {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] [${label}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Envía inputs a 60 Hz durante `durationMs`. getInput() se llama cada frame.
function runInputs(ws, getInput, durationMs) {
  return new Promise(resolve => {
    const iv = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'input', ...getInput() }));
    }, 1000 / 60);
    setTimeout(() => { clearInterval(iv); resolve(); }, durationMs);
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true });
  console.log(`\n  ✅ PASS  ${name}${detail ? '  — ' + detail : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false });
  console.log(`\n  ❌ FAIL  ${name}${detail ? '  — ' + detail : ''}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── Setup ─────────────────────────────────────────────────────────────────
  log('setup', 'Registrando jugadores…');
  await tryRegister(P1.email, P1.password, 'DebugP1');
  await tryRegister(P2.email, P2.password, 'DebugP2');
  forceVerify(P1.email);
  forceVerify(P2.email);

  const token1 = await login(P1.email, P1.password);
  const token2 = await login(P2.email, P2.password);
  log('setup', 'Login OK');

  const roomRes = await api('POST', '/api/rooms', {
    name: 'Debug Room', map: 'classic', maxPlayers: 4, isPublic: true, difficulty: 'normal',
  }, token1);
  if (!roomRes.ok) throw new Error('No se pudo crear sala: ' + JSON.stringify(roomRes.data));
  const roomId = roomRes.data.id;
  log('setup', `Sala: ${roomId}`);

  // Señalización
  const sig1 = await wsConnect(`${WS}/signal?token=${token1}`, 'SIG-P1');
  const sig2 = await wsConnect(`${WS}/signal?token=${token2}`, 'SIG-P2');
  sig1.on('message', () => {});
  sig2.on('message', () => {});
  send(sig1, { type: 'host-room', roomId });
  await sleep(200);
  await api('POST', `/api/rooms/${roomId}/join`, {}, token2);
  send(sig2, { type: 'join-room', roomId });
  await sleep(200);

  // Conexión al juego
  const gws1 = await wsConnect(`${WS}/game?token=${token1}`, 'GAME-P1');
  const gws2 = await wsConnect(`${WS}/game?token=${token2}`, 'GAME-P2');

  // Estado compartido capturado por los listeners
  const state = {
    snapshots:    [],   // todos los snapshots recibidos por P1
    hits:         [],   // eventos hit recibidos por cualquiera
    bulletIds:    new Set(), // IDs únicos de balas vistos en snapshots
  };

  gws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'snapshot') {
      state.snapshots.push({ ts: Date.now(), snap: msg });
      for (const b of (msg.bullets || [])) state.bulletIds.add(b.id);
    } else if (msg.type === 'hit') {
      state.hits.push({ ts: Date.now(), ...msg });
      log('HIT', `playerId=${msg.playerId.slice(0,8)} ownerId=${msg.ownerId.slice(0,8)}`);
    } else if (msg.type === 'joined') {
      log('GAME-P1', `joined playerId=${msg.playerId}`);
    }
  });

  gws2.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'hit') {
      state.hits.push({ ts: Date.now(), ...msg });
      log('HIT', `(P2) playerId=${msg.playerId.slice(0,8)}`);
    }
  });

  send(gws1, { type: 'join-game', roomId });
  send(gws2, { type: 'join-game', roomId });
  await sleep(400);
  log('setup', 'Ambos jugadores en partida');

  // ── T1: Las balas aparecen en snapshots al disparar ───────────────────────
  console.log('\n── T1: Balas aparecen en snapshots ─────────────────────────');
  state.bulletIds.clear();
  await runInputs(gws1, () => ({ dx: 1, dy: 0, action: 'shoot' }), 1500);
  const t1BulletsFound = state.bulletIds.size > 0;
  t1BulletsFound
    ? pass('T1 — Balas en snapshots', `${state.bulletIds.size} IDs únicos vistos`)
    : fail('T1 — Balas en snapshots', 'ninguna bala en snapshots tras 1.5s disparando');

  // ── T2: Cooldown server-side limita la cadencia ───────────────────────────
  console.log('\n── T2: Cooldown server-side (300ms) ────────────────────────');
  // El servidor mantiene el último input recibido: hay que enviar stop explícito
  // para evitar que P1 siga disparando durante el sleep.
  send(gws1, { type: 'input', dx: 0, dy: 0, action: null });
  await sleep(1500); // esperar que balas de T1 impacten o expiren
  state.bulletIds.clear();
  // Disparar hacia la IZQUIERDA (dx=-1 → ángulo=PI → vx=-400)
  // Balas van de x≈400 hacia x=0 (borde), se eliminan al salir del campo.
  // No hay hits contra P2 (x=700) → bulletIds = solo balas nuevas de T2.
  await runInputs(gws1, () => ({ dx: -1, dy: 0, action: 'shoot' }), 3000);
  const t2NewBullets = state.bulletIds.size;
  // Con cooldown 300ms en 3s: disparo inicial + 1 cada 300ms → máx 10-11 balas
  const t2MaxExpected = Math.ceil(3000 / 300) + 1; // 11
  t2NewBullets <= t2MaxExpected
    ? pass('T2 — Cooldown 300ms', `${t2NewBullets} balas únicas en 3s (máx esperado ${t2MaxExpected})`)
    : fail('T2 — Cooldown 300ms', `${t2NewBullets} balas en 3s superan el máx ${t2MaxExpected} — cooldown no funciona`);

  // ── T3: Impacto → evento 'hit' ────────────────────────────────────────────
  // P1 spawn: (100,100). P2 spawn: (700,100).
  // P1 mueve derecha → ángulo=0 → balas van hacia P2.
  console.log('\n── T3: Bala impacta jugador → evento hit ───────────────────');
  const hitsBefore = state.hits.length;
  // Mover P1 a la derecha y disparar 3s — balas a 400px/s cruzan 600px en 1.5s
  await runInputs(gws1, () => ({ dx: 1, dy: 0, action: 'shoot' }), 3000);
  await sleep(500); // dar tiempo a que lleguen las últimas balas
  const newHits = state.hits.length - hitsBefore;
  newHits > 0
    ? pass('T3 — Hit event recibido', `${newHits} hit(s) detectados`)
    : fail('T3 — Hit event recibido', 'ningún hit tras 3s disparando hacia P2');

  // ── T4: Balas desaparecen al expirar TTL (3s) ─────────────────────────────
  console.log('\n── T4: TTL — balas desaparecen tras 3s ─────────────────────');
  // Detener P1 antes de la ráfaga para evitar que las balas de T3 contaminen
  send(gws1, { type: 'input', dx: 0, dy: 0, action: null });
  await sleep(500);
  // Disparar una ráfaga corta y luego detener; esperar 4s y verificar que no hay balas
  await runInputs(gws1, () => ({ dx: 0, dy: 0, action: 'shoot' }), 600);
  send(gws1, { type: 'input', dx: 0, dy: 0, action: null }); // stop explícito
  await sleep(4000); // esperar más que el TTL de 3s
  const lastSnap = state.snapshots[state.snapshots.length - 1]?.snap;
  const t4BulletsLeft = lastSnap?.bullets?.length ?? 0;
  t4BulletsLeft === 0
    ? pass('T4 — TTL cleanup', 'bullets=0 en el snapshot 4s después de disparar')
    : fail('T4 — TTL cleanup', `quedan ${t4BulletsLeft} balas 4s después — TTL no expira`);

  // ── T5: Ritmo de snapshots estable bajo carga ──────────────────────────────
  console.log('\n── T5: Snapshot rate ~20 Hz bajo carga ─────────────────────');
  // Ambos jugadores disparando 5s. Contar snapshots recibidos en ese periodo.
  const t5Start = Date.now();
  const t5SnapsBefore = state.snapshots.length;
  await Promise.all([
    runInputs(gws1, () => ({ dx: 1, dy: 0, action: 'shoot' }), 5000),
    runInputs(gws2, () => ({ dx: -1, dy: 0, action: 'shoot' }), 5000),
  ]);
  const t5Elapsed    = (Date.now() - t5Start) / 1000;
  const t5SnapsCount = state.snapshots.length - t5SnapsBefore;
  const t5Rate       = (t5SnapsCount / t5Elapsed).toFixed(1);
  // Aceptable: entre 15 y 25 snaps/s (target 20 Hz)
  (t5SnapsCount >= 15 * t5Elapsed && t5SnapsCount <= 25 * t5Elapsed)
    ? pass('T5 — Snapshot rate', `${t5SnapsCount} snaps en ${t5Elapsed.toFixed(1)}s = ${t5Rate} Hz`)
    : fail('T5 — Snapshot rate', `${t5SnapsCount} snaps en ${t5Elapsed.toFixed(1)}s = ${t5Rate} Hz (esperado 15-25)`);

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  const passed = results.filter(r => r.ok).length;
  console.log(`  Resultado: ${passed}/${results.length} tests pasaron`);
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'}  ${r.name}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  gws1.close(); gws2.close();
  sig1.close(); sig2.close();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});

