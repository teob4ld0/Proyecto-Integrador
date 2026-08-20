'use strict';

const { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } = require('../physics');

let _nextItemId = 0;

/**
 * Backend-authoritative item system.
 * Manages item drops, movement, magnetization, and pickup detection.
 */
class ItemSystem {
  constructor() {
    /** @type {Item[]} */
    this.active = [];
  }

  /**
   * Spawn a single item at position.
   * @param {number} x
   * @param {number} y
   * @param {string} type - 'power' | 'point' | 'bomb_frag' | 'life_frag'
   */
  spawnItem(x, y, type) {
    this.active.push({
      id: `item_${_nextItemId++}`,
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: -120 - Math.random() * 60,
      type: type || 'point',
      value: type === 'power' ? 1 : type === 'point' ? 1000 : 1,
      magnetized: false,
      ttl: 8.0,
    });
  }

  /**
   * Spawn a fountain of items (e.g., boss defeat).
   */
  spawnItemFountain(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
      const type = i < 4 ? 'power' : (i < 8 ? 'point' : (i === 8 ? 'bomb_frag' : 'point'));
      this.active.push({
        id: `item_${_nextItemId++}`,
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -200 - Math.random() * 150,
        type,
        value: type === 'power' ? 1 : type === 'point' ? 2000 : 1,
        magnetized: false,
        ttl: 10.0,
      });
    }
  }

  /**
   * Update all items. Returns collected items.
   * @param {number} dt
   * @param {Map<string, { body, active, hp, stats, sp }>} players
   * @returns {{ playerId: string, type: string, value: number }[]}
   */
  update(dt, players) {
    const collected = [];
    const MAGNET_RADIUS = 80;
    const PICKUP_RADIUS = PLAYER_RADIUS + 12;
    const GRAVITY = 60;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];

      item.ttl -= dt;
      if (item.ttl <= 0 || item.y > WORLD_HEIGHT + 50) {
        this.active.splice(i, 1);
        continue;
      }

      // Apply gravity to slow falling
      item.vy += GRAVITY * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;

      // Dampen horizontal velocity
      item.vx *= 0.98;

      // Check pickup for each player
      for (const [playerId, player] of players) {
        if (!player.active || player.hp <= 0) continue;

        const pos = player.body.getPosition();
        const dx = item.x - pos.x;
        const dy = item.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Magnetization (pull towards player when close)
        if (dist < MAGNET_RADIUS) {
          item.magnetized = true;
          const pullStrength = 400 * (1 - dist / MAGNET_RADIUS);
          const invDist = 1 / Math.max(1, dist);
          item.vx = -dx * invDist * pullStrength;
          item.vy = -dy * invDist * pullStrength;
        }

        // Pickup
        if (dist < PICKUP_RADIUS) {
          collected.push({ playerId, type: item.type, value: item.value });
          this.active.splice(i, 1);
          break;
        }
      }
    }

    return collected;
  }

  clear() {
    this.active = [];
  }

  getState() {
    return this.active.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      type: item.type,
    }));
  }
}

module.exports = { ItemSystem };
