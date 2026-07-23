/**
 * Interpolation Web Worker
 *
 * Maintains a rolling buffer of the last 3 server snapshots.
 * Every ~16.6 ms it calculates smooth interpolated positions for all
 * entities and posts them to the main thread ready for Pixi.js rendering.
 *
 * Interpolation strategy:
 *   - Render time = now - INTERPOLATION_DELAY_MS
 *   - Find the pair of snapshots that straddle render time
 *   - Lerp between them with t = elapsed / interval
 */

const SNAPSHOT_BUFFER_SIZE = 3;
const INTERPOLATION_DELAY_MS = 100; // renders 100 ms behind to always have two points

let snapshots = [];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  // Shortest-path angle interpolation
  let delta = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + delta * t;
}

self.onmessage = (e) => {
  const { type, data } = e.data;
  if (type !== 'snapshot') return;

  const snapshot = { ...data, receivedAt: performance.now() };
  snapshots.push(snapshot);
  if (snapshots.length > SNAPSHOT_BUFFER_SIZE) {
    snapshots.shift();
  }
};

function interpolateAndPost() {
  if (snapshots.length === 0) return;

  // With only one snapshot, just send it as-is
  if (snapshots.length === 1) {
    self.postMessage({ players: snapshots[0].players, bullets: snapshots[0].bullets || [] });
    return;
  }

  const renderTime = performance.now() - INTERPOLATION_DELAY_MS;

  // Find the two snapshots that straddle renderTime
  let prev = null;
  let next = null;

  for (let i = 0; i < snapshots.length - 1; i++) {
    if (snapshots[i].receivedAt <= renderTime && snapshots[i + 1].receivedAt >= renderTime) {
      prev = snapshots[i];
      next = snapshots[i + 1];
      break;
    }
  }

  // If renderTime is ahead of all snapshots, extrapolate from the last two
  if (!prev) {
    prev = snapshots[snapshots.length - 2];
    next = snapshots[snapshots.length - 1];
  }

  const duration = next.receivedAt - prev.receivedAt;
  const t = duration > 0 ? Math.min(1, (renderTime - prev.receivedAt) / duration) : 1;

  const nextMap = new Map((next.players || []).map((p) => [p.id, p]));

  const players = (prev.players || []).map((p) => {
    const n = nextMap.get(p.id);
    if (!n) return p;
    return {
      id: p.id,
      x: lerp(p.x, n.x, t),
      y: lerp(p.y, n.y, t),
      angle: lerpAngle(p.angle, n.angle, t),
    };
  });

  self.postMessage({ players, bullets: next.bullets || [] });
}

// Run at 60 FPS
setInterval(interpolateAndPost, 1000 / 60);
