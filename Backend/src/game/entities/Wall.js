'use strict';

let _nextWallId = 0;

class Wall {
  constructor() {
    this.id      = '';
    this.ownerId = '';
    this.x       = 0;
    this.y       = 0;
    this.vx      = 0;
    this.vy      = 0;
    this.width   = 14;
    this.height  = 48;
    this.hp      = 25;
    this.maxHp   = 25;
    this.ttl     = 1.0; // 1 second TTL
    this.active  = false;
  }

  /**
   * Initialise or reuse wall from pool.
   */
  init(ownerId, x, y, vx = 40, vy = 0, width = 14, height = 48, hp = 25, ttl = 1.0) {
    this.id      = `wall-${_nextWallId++}`;
    this.ownerId = ownerId;
    this.x       = x;
    this.y       = y;
    this.vx      = vx; // moves forward slightly
    this.vy      = vy;
    this.width   = width;
    this.height  = height;
    this.hp      = hp;
    this.maxHp   = hp;
    this.ttl     = ttl;
    this.active  = true;
    return this;
  }

  update(deltaTime) {
    this.x   += this.vx * deltaTime;
    this.y   += this.vy * deltaTime;
    this.ttl -= deltaTime;
    if (this.ttl <= 0 || this.hp <= 0) {
      this.active = false;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
    }
    return this.hp;
  }

  /**
   * Check circle-box intersection for stopping bullets.
   */
  intersectsCircle(cx, cy, radius) {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;

    const closestX = Math.max(this.x - halfW, Math.min(cx, this.x + halfW));
    const closestY = Math.max(this.y - halfH, Math.min(cy, this.y + halfH));

    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (radius * radius);
  }
}

// ── Object pool ───────────────────────────────────────────────────────────────

const WALL_POOL_SIZE = 50;
const _wallPool      = Array.from({ length: WALL_POOL_SIZE }, () => new Wall());
let   _wallPoolIdx   = 0;

function acquireWall(ownerId, x, y, vx, vy, width, height, hp, ttl) {
  const start = _wallPoolIdx;
  do {
    const w = _wallPool[_wallPoolIdx];
    _wallPoolIdx = (_wallPoolIdx + 1) % WALL_POOL_SIZE;
    if (!w.active) return w.init(ownerId, x, y, vx, vy, width, height, hp, ttl);
  } while (_wallPoolIdx !== start);

  return new Wall().init(ownerId, x, y, vx, vy, width, height, hp, ttl);
}

function releaseWall(wall) {
  wall.active = false;
}

module.exports = { Wall, acquireWall, releaseWall };
