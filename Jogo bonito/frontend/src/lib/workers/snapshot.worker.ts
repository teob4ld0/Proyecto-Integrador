import type { GameSnapshot, ServerPlayer } from '../network/wsClient';

let snapshotBuffer: GameSnapshot[] = [];
const RENDER_DELAY_MS = 60; // 60ms buffer para suavizado fluido contra jitter

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  if (type === 'ADD_SNAPSHOT') {
    snapshotBuffer.push(data);
    // Limitar buffer a los últimos 30 snapshots
    if (snapshotBuffer.length > 30) {
      snapshotBuffer.shift();
    }
  } else if (type === 'GET_INTERPOLATED_STATE') {
    const renderTime = Date.now() - RENDER_DELAY_MS;
    const interpolated = getInterpolatedState(renderTime);
    if (interpolated) {
      self.postMessage({ type: 'RENDER_FRAME', payload: interpolated });
    }
  }
};

function getSnapshotTime(s: GameSnapshot): number {
  return s.timestamp ?? (s.tick * (1000 / 60));
}

function getInterpolatedState(renderTime: number): GameSnapshot | null {
  if (snapshotBuffer.length === 0) return null;

  if (snapshotBuffer.length === 1 || renderTime < getSnapshotTime(snapshotBuffer[0])) {
    return snapshotBuffer[snapshotBuffer.length - 1];
  }

  // Buscar los dos snapshots que rodean el renderTime
  for (let i = 0; i < snapshotBuffer.length - 1; i++) {
    const s0 = snapshotBuffer[i];
    const s1 = snapshotBuffer[i + 1];
    const t0 = getSnapshotTime(s0);
    const t1 = getSnapshotTime(s1);

    if (renderTime >= t0 && renderTime <= t1) {
      const alpha = t1 === t0 ? 0 : (renderTime - t0) / (t1 - t0);
      return interpolateSnapshots(s0, s1, alpha);
    }
  }

  return snapshotBuffer[snapshotBuffer.length - 1];
}

function interpolateSnapshots(s0: GameSnapshot, s1: GameSnapshot, alpha: number): GameSnapshot {
  const p0Map = new Map((s0.players || []).map((p) => [p.id, p]));
  const interpolatedPlayers: ServerPlayer[] = (s1.players || []).map((p1) => {
    const p0 = p0Map.get(p1.id) || p1;
    return {
      ...p1,
      x: p0.x + (p1.x - p0.x) * alpha,
      y: p0.y + (p1.y - p0.y) * alpha,
    };
  });

  const t0 = getSnapshotTime(s0);
  const t1 = getSnapshotTime(s1);

  let interpolatedBoss = s1.boss;
  if (s0.boss && s1.boss) {
    interpolatedBoss = {
      ...s1.boss,
      x: s0.boss.x + (s1.boss.x - s0.boss.x) * alpha,
      y: s0.boss.y + (s1.boss.y - s0.boss.y) * alpha,
    };
  }

  return {
    type: 'snapshot',
    tick: s1.tick,
    timestamp: t0 + (t1 - t0) * alpha,
    phase: s1.phase,
    countdownMs: s1.countdownMs,
    players: interpolatedPlayers,
    bullets: s1.bullets,
    lasers: s1.lasers,
    boss: interpolatedBoss,
    struggle: s1.struggle,
  };
}
