/// <reference lib="webworker" />

import type {
  GameSnapshot,
  ServerPlayer,
  ServerBullet,
  ServerWall,
  ServerEnemy,
  ServerItem,
  ServerBoss,
  ServerBeamStruggle,
} from '../network/wsClient';

interface TimedSnapshot {
  receivedAt: number;
  snapshot: GameSnapshot;
}

const MAX_BUFFER_SIZE = 24;
const RENDER_DELAY_MS = 38;

let snapshotBuffer: TimedSnapshot[] = [];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolatePlayers(p0: ServerPlayer[], p1: ServerPlayer[], alpha: number): ServerPlayer[] {
  const prevById = new Map<string, ServerPlayer>();
  for (const p of p0) prevById.set(p.id, p);

  return p1.map((curr) => {
    const prev = prevById.get(curr.id);
    if (!prev) return curr;
    return {
      ...curr,
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
      hp: prev.hp !== undefined && curr.hp !== undefined ? lerp(prev.hp, curr.hp, alpha) : curr.hp,
      sp: prev.sp !== undefined && curr.sp !== undefined ? lerp(prev.sp, curr.sp, alpha) : curr.sp,
    };
  });
}

function interpolateBullets(b0: ServerBullet[], b1: ServerBullet[], alpha: number): ServerBullet[] {
  if (!b0.length || !b1.length) return b1;
  const prevById = new Map<string | number, ServerBullet>();
  for (const b of b0) prevById.set(b.id, b);

  return b1.map((curr) => {
    const prev = prevById.get(curr.id);
    if (!prev) return curr;
    return {
      ...curr,
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
    };
  });
}

function interpolateWalls(w0: ServerWall[] | undefined, w1: ServerWall[] | undefined, alpha: number): ServerWall[] | undefined {
  if (!w1) return undefined;
  if (!w0 || !w0.length) return w1;
  const prevById = new Map<string, ServerWall>();
  for (const w of w0) prevById.set(w.id, w);

  return w1.map((curr) => {
    const prev = prevById.get(curr.id);
    if (!prev) return curr;
    return {
      ...curr,
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
      hp: lerp(prev.hp, curr.hp, alpha),
    };
  });
}

function interpolateEnemies(e0: ServerEnemy[] | undefined, e1: ServerEnemy[] | undefined, alpha: number): ServerEnemy[] | undefined {
  if (!e1) return undefined;
  if (!e0 || !e0.length) return e1;
  const prevById = new Map<string, ServerEnemy>();
  for (const e of e0) prevById.set(e.id, e);

  return e1.map((curr) => {
    const prev = prevById.get(curr.id);
    if (!prev) return curr;
    return {
      ...curr,
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
    };
  });
}

function interpolateItems(i0: ServerItem[] | undefined, i1: ServerItem[] | undefined, alpha: number): ServerItem[] | undefined {
  if (!i1) return undefined;
  if (!i0 || !i0.length) return i1;
  const prevById = new Map<string, ServerItem>();
  for (const item of i0) prevById.set(item.id, item);

  return i1.map((curr) => {
    const prev = prevById.get(curr.id);
    if (!prev) return curr;
    return {
      ...curr,
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
    };
  });
}

function interpolateBoss(b0: ServerBoss | undefined, b1: ServerBoss | undefined, alpha: number): ServerBoss | undefined {
  if (!b1) return undefined;
  if (!b0 || !b0.isActive || !b1.isActive) return b1;
  return {
    ...b1,
    x: lerp(b0.x, b1.x, alpha),
    y: lerp(b0.y, b1.y, alpha),
    hp: lerp(b0.hp, b1.hp, alpha),
  };
}

function interpolateStruggle(
  s0: ServerBeamStruggle | undefined,
  s1: ServerBeamStruggle | undefined,
  alpha: number
): ServerBeamStruggle | undefined {
  if (!s1) return undefined;
  if (!s0 || (!s0.active && !s0.isAligning)) return s1;
  return {
    ...s1,
    balance: lerp(s0.balance, s1.balance, alpha),
    clashX: lerp(s0.clashX, s1.clashX, alpha),
    clashY: lerp(s0.clashY, s1.clashY, alpha),
    playerTipX: s0.playerTipX !== undefined && s1.playerTipX !== undefined ? lerp(s0.playerTipX, s1.playerTipX, alpha) : s1.playerTipX,
    bossTipX: s0.bossTipX !== undefined && s1.bossTipX !== undefined ? lerp(s0.bossTipX, s1.bossTipX, alpha) : s1.bossTipX,
    vortexX: s0.vortexX !== undefined && s1.vortexX !== undefined ? lerp(s0.vortexX, s1.vortexX, alpha) : s1.vortexX,
    vortexY: s0.vortexY !== undefined && s1.vortexY !== undefined ? lerp(s0.vortexY, s1.vortexY, alpha) : s1.vortexY,
  };
}

function computeInterpolatedFrame(): GameSnapshot | null {
  if (snapshotBuffer.length === 0) return null;
  if (snapshotBuffer.length === 1) return snapshotBuffer[0].snapshot;

  const renderTime = performance.now() - RENDER_DELAY_MS;
  const first = snapshotBuffer[0];
  const last = snapshotBuffer[snapshotBuffer.length - 1];

  if (renderTime <= first.receivedAt) {
    return first.snapshot;
  }
  if (renderTime >= last.receivedAt) {
    return last.snapshot;
  }

  let s0 = first;
  let s1 = last;
  for (let i = 0; i < snapshotBuffer.length - 1; i++) {
    const a = snapshotBuffer[i];
    const b = snapshotBuffer[i + 1];
    if (a.receivedAt <= renderTime && b.receivedAt >= renderTime) {
      s0 = a;
      s1 = b;
      break;
    }
  }

  const span = s1.receivedAt - s0.receivedAt;
  const alpha = span > 0.001 ? Math.max(0, Math.min(1, (renderTime - s0.receivedAt) / span)) : 1;

  return {
    ...s1.snapshot,
    players: interpolatePlayers(s0.snapshot.players, s1.snapshot.players, alpha),
    bullets: interpolateBullets(s0.snapshot.bullets, s1.snapshot.bullets, alpha),
    walls: interpolateWalls(s0.snapshot.walls, s1.snapshot.walls, alpha),
    enemies: interpolateEnemies(s0.snapshot.enemies, s1.snapshot.enemies, alpha),
    items: interpolateItems(s0.snapshot.items, s1.snapshot.items, alpha),
    boss: interpolateBoss(s0.snapshot.boss, s1.snapshot.boss, alpha),
    struggle: interpolateStruggle(s0.snapshot.struggle, s1.snapshot.struggle, alpha),
  };
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === 'ADD_SNAPSHOT' && payload) {
    snapshotBuffer.push({
      receivedAt: performance.now(),
      snapshot: payload as GameSnapshot,
    });
    if (snapshotBuffer.length > MAX_BUFFER_SIZE) {
      snapshotBuffer.shift();
    }
    return;
  }

  if (type === 'RESET') {
    snapshotBuffer = [];
    return;
  }

  if (type === 'GET_INTERPOLATED_STATE') {
    const frame = computeInterpolatedFrame();
    if (frame) {
      self.postMessage({ type: 'RENDER_FRAME', payload: frame });
    }
  }
};

