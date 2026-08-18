'use strict';

const { acquireWall, releaseWall } = require('../entities/Wall');
const { releaseBullet } = require('../entities/Bullet');

class WallSystem {
  constructor() {
    /** @type {import('../entities/Wall').Wall[]} */
    this.active = [];
  }

  /**
   * Spawn a new wall for the Tank.
   */
  spawnWall(ownerId, x, y, vx = 40, vy = 0, width = 14, height = 48, hp = 25, ttl = 1.0) {
    const wall = acquireWall(ownerId, x, y, vx, vy, width, height, hp, ttl);
    this.active.push(wall);
    return wall;
  }

  /**
   * Update active walls life & position.
   */
  update(deltaTime) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const wall = this.active[i];
      wall.update(deltaTime);
      if (!wall.active) {
        releaseWall(wall);
        this.active.splice(i, 1);
      }
    }
  }

  /**
   * Block and destroy any bullet in the wall's way.
   * @param {import('./BulletSystem').BulletSystem} bulletSystem
   * @returns {Array<{ wallId: string, bulletId: string, ownerId: string }>}
   */
  blockBullets(bulletSystem) {
    const blocked = [];
    if (this.active.length === 0 || bulletSystem.active.length === 0) return blocked;

    for (let wIdx = this.active.length - 1; wIdx >= 0; wIdx--) {
      const wall = this.active[wIdx];
      if (!wall.active) continue;

      for (let bIdx = bulletSystem.active.length - 1; bIdx >= 0; bIdx--) {
        const bullet = bulletSystem.active[bIdx];
        if (!bullet.active) continue;

        // Check if bullet collides with the wall
        if (wall.intersectsCircle(bullet.x, bullet.y, bullet.radius)) {
          blocked.push({ wallId: wall.id, bulletId: bullet.id, ownerId: bullet.ownerId });
          
          // Wall absorbs and eliminates the bullet
          bulletSystem.hash.remove(bullet);
          releaseBullet(bullet);
          bulletSystem.active.splice(bIdx, 1);
        }
      }
    }

    return blocked;
  }

  /**
   * Serialise walls for network snapshot.
   */
  getState() {
    return this.active.map((w) => ({
      id:      w.id,
      ownerId: w.ownerId,
      x:       Number(w.x.toFixed(1)),
      y:       Number(w.y.toFixed(1)),
      width:   w.width,
      height:  w.height,
      hp:      Number(w.hp.toFixed(1)),
      maxHp:   w.maxHp,
      ttl:     Number(w.ttl.toFixed(2)),
    }));
  }
}

module.exports = { WallSystem };
