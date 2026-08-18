'use strict';

const { PLAYER_RADIUS } = require('../physics');
const { releaseBullet } = require('../entities/Bullet');

const LASER_DPS = 50; // 50 damage per second (around 50 over 1s default duration)

class LaserSystem {
  constructor() {
    /** @type {Array<Object>} */
    this.lasers = [];
    this._nextId = 0;
  }

  /**
   * Spawn a new laser beam (Boss ray or Player SP.ATK Ultimate).
   * @param {number} sourceX
   * @param {number} sourceY
   * @param {number} targetY
   * @param {Object} [options]
   */
  spawnLaser(sourceX, sourceY, targetY, options = {}) {
    const laser = {
      id:             options.id || `laser-${this._nextId++}`,
      ownerId:        options.ownerId || 'boss',
      direction:      options.direction || (options.ownerId && options.ownerId !== 'boss' ? 'right' : 'left'),
      sourceX,
      sourceY,
      targetY:        targetY !== undefined ? targetY : sourceY,
      state:          'charging', // 'charging' | 'firing' | 'fading'
      timer:          0,
      chargeDuration: options.chargeDuration !== undefined ? options.chargeDuration : 0.7,
      fireDuration:   options.fireDuration !== undefined ? options.fireDuration : 1.0, // default 1.0s (1 to 2s)
      fadeDuration:   options.fadeDuration !== undefined ? options.fadeDuration : 0.3,
      maxWidth:       options.maxWidth !== undefined ? options.maxWidth : 34,
      color:          options.color !== undefined ? options.color : 0xff2b5b,
      podType:        options.podType || 'top',
      dps:            options.dps !== undefined ? options.dps : LASER_DPS,
    };
    this.lasers.push(laser);
    return laser;
  }

  /**
   * Advance all lasers by deltaTime.
   * @param {number} dt
   */
  update(dt) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.timer += dt;

      if (laser.state === 'charging') {
        if (laser.timer >= laser.chargeDuration) {
          laser.state = 'firing';
          laser.timer = 0;
        }
      } else if (laser.state === 'firing') {
        if (laser.timer >= laser.fireDuration) {
          laser.state = 'fading';
          laser.timer = 0;
        }
      } else if (laser.state === 'fading') {
        if (laser.timer >= laser.fadeDuration) {
          this.lasers.splice(i, 1);
        }
      }
    }
  }

  /**
   * Delete normal bullets in the path of any firing laser.
   * @param {import('./BulletSystem').BulletSystem} bulletSystem
   */
  clearBulletsInPath(bulletSystem) {
    if (this.lasers.length === 0 || bulletSystem.active.length === 0) return;

    for (const laser of this.lasers) {
      if (laser.state !== 'firing') continue;
      const halfWidth = (laser.maxWidth * 0.5);

      for (let i = bulletSystem.active.length - 1; i >= 0; i--) {
        const b = bulletSystem.active[i];
        if (!b.active) continue;

        // Lasers delete any normal bullet in their path
        if (b.type === 'normal') {
          const inHorizontalPath = laser.direction === 'right'
            ? (b.x >= laser.sourceX - 10)
            : (b.x <= laser.sourceX + 10);

          if (inHorizontalPath) {
            const dy = Math.abs(b.y - laser.sourceY);
            if (dy <= (halfWidth + b.radius)) {
              bulletSystem.hash.remove(b);
              releaseBullet(b);
              bulletSystem.active.splice(i, 1);
            }
          }
        }
      }
    }
  }

  /**
   * Apply laser damage per tick to Tank Walls in the beam's path.
   * A 1s laser (50 dps) destroys two 25hp walls in a row.
   * @param {import('./WallSystem').WallSystem} wallSystem
   * @param {number} dt
   */
  strikeWalls(wallSystem, dt) {
    if (!wallSystem || wallSystem.active.length === 0) return;

    for (const laser of this.lasers) {
      if (laser.state !== 'firing') continue;
      const halfWidth = (laser.maxWidth * 0.5);
      const damageThisTick = laser.dps * dt;

      for (let i = wallSystem.active.length - 1; i >= 0; i--) {
        const wall = wallSystem.active[i];
        if (!wall.active) continue;

        const inHorizontalPath = laser.direction === 'right'
          ? (wall.x >= laser.sourceX - 10)
          : (wall.x <= laser.sourceX + 10);

        if (inHorizontalPath) {
          const dy = Math.abs(wall.y - laser.sourceY);
          if (dy <= (halfWidth + (wall.height * 0.5))) {
            wall.takeDamage(damageThisTick);
          }
        }
      }
    }
  }

  /**
   * Check laser beam collisions against active players during the firing phase.
   * Calculates tick damage (~50 damage per second).
   * @param {Map<string, {body: any, active: boolean}>} players
   * @param {number} dt
   * @returns {Array<{playerId: string, laserId: string, damage: number}>}
   */
  checkCollisions(players, dt = 1 / 60) {
    const hits = [];
    for (const laser of this.lasers) {
      if (laser.state !== 'firing') continue;
      if (laser.ownerId !== 'boss') continue; // Only boss lasers hit players in PvE

      const halfWidth = (laser.maxWidth * 0.5) + PLAYER_RADIUS;
      const damageThisTick = Number((laser.dps * dt).toFixed(3));

      for (const [playerId, player] of players) {
        if (!player.active) continue;
        const pos = player.body.getPosition();

        const inHorizontalPath = laser.direction === 'right'
          ? (pos.x >= laser.sourceX - 10)
          : (pos.x <= laser.sourceX + 10);

        if (inHorizontalPath) {
          const dy = Math.abs(pos.y - laser.sourceY);
          if (dy <= halfWidth) {
            hits.push({ playerId, laserId: laser.id, damage: damageThisTick });
          }
        }
      }
    }
    return hits;
  }

  /**
   * Check player SP.ATK ultimate laser hitting Boss.
   * @param {{ x: number, y: number, hp: number }} boss
   * @param {number} dt
   */
  strikeBoss(boss, dt = 1 / 60) {
    if (!boss || boss.hp <= 0) return 0;
    let totalDmg = 0;

    for (const laser of this.lasers) {
      if (laser.state !== 'firing') continue;
      if (laser.ownerId === 'boss') continue; // Only player lasers hit Boss

      const halfWidth = (laser.maxWidth * 0.5) + 40; // 40 boss radius
      if (boss.x >= laser.sourceX - 10) {
        const dy = Math.abs(boss.y - laser.sourceY);
        if (dy <= halfWidth) {
          const damageThisTick = laser.dps * dt;
          boss.hp = Math.max(0, Number((boss.hp - damageThisTick).toFixed(2)));
          totalDmg += damageThisTick;
        }
      }
    }

    return totalDmg;
  }

  /**
   * Serialise lasers for network snapshots.
   */
  getState() {
    return this.lasers.map((l) => ({
      id:             l.id,
      ownerId:        l.ownerId,
      direction:      l.direction,
      sourceX:        l.sourceX,
      sourceY:        l.sourceY,
      targetY:        l.targetY,
      state:          l.state,
      timer:          Number(l.timer.toFixed(3)),
      chargeDuration: l.chargeDuration,
      fireDuration:   l.fireDuration,
      fadeDuration:   l.fadeDuration,
      maxWidth:       l.maxWidth,
      color:          l.color,
    }));
  }
}

module.exports = { LaserSystem, LASER_DPS };

