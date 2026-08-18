'use strict';

const { acquireBullet } = require('./entities/Bullet');

/**
 * Find the closest enemy or boss to the given source position.
 * @param {number} originX
 * @param {number} originY
 * @param {Array<{ x: number, y: number, hp?: number, active?: boolean }>} targets
 * @returns {{ x: number, y: number } | null}
 */
function findClosestTarget(originX, originY, targets) {
  if (!Array.isArray(targets) || targets.length === 0) return null;

  let closest = null;
  let minDistSq = Infinity;

  for (const target of targets) {
    if (!target) continue;
    if (target.hp !== undefined && target.hp <= 0) continue;
    if (target.active !== undefined && !target.active) continue;

    const dx = target.x - originX;
    const dy = target.y - originY;
    const distSq = dx * dx + dy * dy;

    if (distSq < minDistSq) {
      minDistSq = distSq;
      closest = target;
    }
  }

  return closest;
}

/**
 * Spawns a bullet with a directed trajectory towards the closest enemy or boss.
 * Makes direct use of Bullet.js.
 * 
 * @param {import('./systems/BulletSystem').BulletSystem} bulletSystem
 * @param {string} ownerId
 * @param {number} startX
 * @param {number} startY
 * @param {Array<{ x: number, y: number, hp?: number, active?: boolean }>} targets
 * @param {number} [speed=500]
 * @param {number} [radius=4]
 * @param {number} [ttl=3]
 * @param {number} [damage=5]
 * @param {string} [type='autoaim']
 * @returns {import('./entities/Bullet').Bullet}
 */
function spawnAutoAimBullet(bulletSystem, ownerId, startX, startY, targets, speed = 500, radius = 4, ttl = 3, damage = 5, type = 'autoaim') {
  const target = findClosestTarget(startX, startY, targets);

  let vx = speed;
  let vy = 0;

  if (target) {
    const angle = Math.atan2(target.y - startY, target.x - startX);
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  }

  const bullet = acquireBullet(ownerId, startX, startY, vx, vy, radius, ttl, type, damage);
  if (bulletSystem) {
    bulletSystem.active.push(bullet);
    bulletSystem.hash.insert(bullet);
  }
  return bullet;
}

module.exports = {
  findClosestTarget,
  spawnAutoAimBullet,
};
