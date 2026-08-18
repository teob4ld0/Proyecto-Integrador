'use strict';

const { BulletSystem, BULLET_RADIUS, BULLET_SPEED } = require('./systems/BulletSystem');
const { acquireBullet, releaseBullet } = require('./entities/Bullet');

module.exports = {
  BulletSystem,
  BULLET_RADIUS,
  BULLET_SPEED,
  acquireBullet,
  releaseBullet,
};
