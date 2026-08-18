'use strict';

const { acquireBullet, releaseBullet } = require('../entities/Bullet');
const SpatialHash                      = require('./SpatialHash');
const { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } = require('../physics');

const BULLET_RADIUS = 4;
const BULLET_SPEED  = 400;  // px / s
const BULLET_TTL    = 3;    // seconds
// Largest radius we ever query from a player position
const MAX_QUERY_R   = PLAYER_RADIUS + BULLET_RADIUS;

class BulletSystem {
  constructor() {
    /** @type {import('../entities/Bullet').Bullet[]} */
    this.active = [];
    this.hash   = new SpatialHash(100);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Spawn a new bullet from (x, y) in direction `angle` (radians).
   * Called by GameRoom when a player or boss shoots.
   */
  spawn(ownerId, x, y, angle, speed = BULLET_SPEED, radius = BULLET_RADIUS, ttl = BULLET_TTL, type = 'normal', damage = 5) {
    const vx     = Math.cos(angle) * speed;
    const vy     = Math.sin(angle) * speed;
    const bullet = acquireBullet(ownerId, x, y, vx, vy, radius, ttl, type, damage);
    this.active.push(bullet);
    this.hash.insert(bullet);
    return bullet;
  }

  /**
   * Spawn a bullet directly with velocity components vx, vy.
   */
  spawnBullet(ownerId, x, y, vx, vy, radius = BULLET_RADIUS, ttl = BULLET_TTL, type = 'normal', damage = 5) {
    const bullet = acquireBullet(ownerId, x, y, vx, vy, radius, ttl, type, damage);
    this.active.push(bullet);
    this.hash.insert(bullet);
    return bullet;
  }

  /**
   * Advance the simulation one tick.
   *
   * Phases:
   *   1. Move every bullet and re-register it in the spatial hash.
   *      Remove bullets that expired or left the field.
   *   2. For each active player, query nearby bullets via the spatial hash
   *      and perform circle-circle collision checks (boss bullets vs players).
   *   3. Remove bullets that hit a player.
   *
   * @param {number} deltaTime  — fixed tick delta (1/60 s)
   * @param {Map<string, {body, active}>} players — from GameRoom
   * @returns {{ playerId: string, bulletId: string, ownerId: string }[]} hit events
   */
  update(deltaTime, players) {
    // ── Phase 1: move & expire ────────────────────────────────────────────────
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];

      this.hash.remove(b);
      b.update(deltaTime);

      if (
        b.ttl <= 0 ||
        b.x < 0 || b.x > WORLD_WIDTH ||
        b.y < 0 || b.y > WORLD_HEIGHT
      ) {
        releaseBullet(b);
        this.active.splice(i, 1);
        continue;
      }

      this.hash.insert(b); // insert at new position
    }

    // ── Phase 2 & 3: collision detection ─────────────────────────────────────
    const hits    = [];
    const toKill  = new Set(); // bullets to remove after the loop

    for (const [playerId, player] of players) {
      if (!player.active) continue;
      const pos = player.body.getPosition();

      const candidates = this.hash.query(pos.x, pos.y, MAX_QUERY_R);
      for (const b of candidates) {
        if (toKill.has(b)) continue; // already hit something this tick
        if (b.ownerId === playerId) continue; // no self-hit
        // In PvE, only boss bullets damage players
        if (b.ownerId !== 'boss') continue;

        const dx = b.x - pos.x;
        const dy = b.y - pos.y;
        const minDist = PLAYER_RADIUS + b.radius;
        if (dx * dx + dy * dy <= minDist * minDist) {
          hits.push({ playerId, bulletId: b.id, ownerId: b.ownerId, damage: b.damage || 5 });
          toKill.add(b);
        }
      }
    }

    // Remove hit bullets (in reverse to keep indices stable)
    for (const b of toKill) {
      this.hash.remove(b);
      releaseBullet(b);
      const idx = this.active.indexOf(b);
      if (idx !== -1) this.active.splice(idx, 1);
    }

    return hits;
  }

  /**
   * Serialise active bullets for the snapshot.
   * Sends id, position, radius, ownerId and type.
   */
  getState() {
    return this.active.map((b) => ({
      id:      b.id,
      x:       b.x,
      y:       b.y,
      radius:  b.radius,
      ownerId: b.ownerId,
      type:    b.type || 'normal',
    }));
  }
}

module.exports = { BulletSystem, BULLET_RADIUS, BULLET_SPEED };
