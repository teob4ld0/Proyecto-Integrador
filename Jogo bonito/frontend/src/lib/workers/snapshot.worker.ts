import type { GameSnapshot } from '../network/wsClient';

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

function getInterpolatedState(renderTime: number): GameSnapshot | null {
  if (snapshotBuffer.length === 0) return null;

  // Si solo hay un snapshot o el tiempo es muy antiguo, retornar el último
  if (snapshotBuffer.length === 1 || renderTime < snapshotBuffer[0].timestamp) {
    return snapshotBuffer[snapshotBuffer.length - 1];
  }

  // Buscar los dos snapshots que rodean el renderTime
  for (let i = 0; i < snapshotBuffer.length - 1; i++) {
    const s0 = snapshotBuffer[i];
    const s1 = snapshotBuffer[i + 1];

    if (renderTime >= s0.timestamp && renderTime <= s1.timestamp) {
      const alpha = (renderTime - s0.timestamp) / (s1.timestamp - s0.timestamp);
      return interpolateSnapshots(s0, s1, alpha);
    }
  }

  return snapshotBuffer[snapshotBuffer.length - 1];
}

function interpolateSnapshots(s0: GameSnapshot, s1: GameSnapshot, alpha: number): GameSnapshot {
  const interpolatedPlayers: Record<string, { x: number; y: number; hp: number; focus: boolean }> = {};

  for (const id in s1.players) {
    const p1 = s1.players[id];
    const p0 = s0.players[id] || p1;

    interpolatedPlayers[id] = {
      x: p0.x + (p1.x - p0.x) * alpha,
      y: p0.y + (p1.y - p0.y) * alpha,
      hp: p1.hp,
      focus: p1.focus
    };
  }

  return {
    timestamp: s0.timestamp + (s1.timestamp - s0.timestamp) * alpha,
    players: interpolatedPlayers,
    boss: {
      x: s0.boss.x + (s1.boss.x - s0.boss.x) * alpha,
      y: s0.boss.y + (s1.boss.y - s0.boss.y) * alpha,
      hp: s1.boss.hp,
      maxHp: s1.boss.maxHp,
      spellcard: s1.boss.spellcard
    },
    bullets: s1.bullets
  };
}
