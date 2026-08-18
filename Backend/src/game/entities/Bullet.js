'use strict';

let _nextId = 0;

class Bullet {
  constructor() {
    this.id      = '';
    this.x       = 0;
    this.y       = 0;
    this.vx      = 0;
    this.vy      = 0;
    this.radius  = 4;
    this.damage  = 5;   // int = 5 default damage
    this.ownerId = '';
    this.type    = 'normal';
    this.ttl     = 0;   // remaining life in seconds
    this.active  = false;
    // Spatial hash tracking (set by SpatialHash)
    this._cellX  = NaN;
    this._cellY  = NaN;
  }

  /**
   * Reuse this bullet (pool pattern).
   */
  init(ownerId, x, y, vx, vy, radius = 4, ttl = 3, type = 'normal', damage = 5) {
    this.id      = `b${_nextId++}`;
    this.ownerId = ownerId;
    this.x       = x;
    this.y       = y;
    this.vx      = vx;
    this.vy      = vy;
    this.radius  = radius;
    this.damage  = damage;
    this.ttl     = ttl;
    this.type    = type;
    this.active  = true;
    this._cellX  = NaN;
    this._cellY  = NaN;
    return this;
  }

  update(deltaTime) {
    this.x   += this.vx * deltaTime;
    this.y   += this.vy * deltaTime;
    this.ttl -= deltaTime;
  }
}

// ── Object pool ───────────────────────────────────────────────────────────────

const POOL_SIZE = 600;
const _pool     = Array.from({ length: POOL_SIZE }, () => new Bullet());
let   _poolIdx  = 0;

/**
 * Acquire an inactive Bullet from the pool and initialise it.
 * Falls back to a fresh allocation if the pool is exhausted.
 */
function acquireBullet(ownerId, x, y, vx, vy, radius, ttl, type = 'normal', damage = 5) {
  const start = _poolIdx;
  do {
    const b = _pool[_poolIdx];
    _poolIdx = (_poolIdx + 1) % POOL_SIZE;
    if (!b.active) return b.init(ownerId, x, y, vx, vy, radius, ttl, type, damage);
  } while (_poolIdx !== start);

  console.warn('[BulletPool] Pool exhausted — allocating outside pool');
  return new Bullet().init(ownerId, x, y, vx, vy, radius, ttl, type, damage);
}

function releaseBullet(bullet) {
  bullet.active = false;
}

module.exports = { Bullet, acquireBullet, releaseBullet };
