'use strict';

const assert = require('assert');
const { Bullet, acquireBullet, releaseBullet } = require('../src/game/entities/Bullet');
const { Wall, acquireWall, releaseWall } = require('../src/game/entities/Wall');
const { BulletSystem } = require('../src/game/systems/BulletSystem');
const { LaserSystem } = require('../src/game/systems/LaserSystem');
const { WallSystem } = require('../src/game/systems/WallSystem');
const { findClosestTarget, spawnAutoAimBullet } = require('../src/game/autoAim');
const GameRoom = require('../src/game/GameRoom');

console.log('--- STARTING DANMAKREW PHYSICS TESTS ---');

// 1. Test Bullet damage = 5
{
  const b = acquireBullet('player1', 100, 100, 100, 0, 4, 3, 'normal');
  assert.strictEqual(b.damage, 5, 'Default bullet damage should be 5');
  console.log('✓ Bullet has damage = 5 by default');
  releaseBullet(b);
}

// 2. Test Autoaim targeting closest boss/enemy
{
  const bulletSystem = new BulletSystem();
  const targets = [
    { x: 500, y: 300, hp: 100 },
    { x: 200, y: 200, hp: 100 }, // Closest to (100, 200)
  ];
  const autoBullet = spawnAutoAimBullet(bulletSystem, 'p1', 100, 200, targets, 500);
  assert(autoBullet.vx > 0, 'Bullet should travel rightwards towards target');
  assert.strictEqual(Math.round(autoBullet.vy), 0, 'Bullet should travel straight horizontal to target at same Y');
  console.log('✓ Autoaim successfully directs trajectory to closest enemy');
}

// 3. Test Wall stops normal bullets
{
  const bulletSystem = new BulletSystem();
  const wallSystem = new WallSystem();

  // Spawn wall at (200, 200)
  const wall = wallSystem.spawnWall('tank_player', 200, 200, 40, 0, 14, 48, 25, 1.0);
  assert.strictEqual(wall.hp, 25, 'Wall has 25 HP');
  assert.strictEqual(wall.ttl, 1.0, 'Wall has 1.0s TTL');

  // Spawn bullet flying towards wall at (195, 200)
  bulletSystem.spawnBullet('boss', 195, 200, 200, 0, 4, 3, 'normal');
  assert.strictEqual(bulletSystem.active.length, 1);

  const blocked = wallSystem.blockBullets(bulletSystem);
  assert.strictEqual(blocked.length, 1, 'Wall should have blocked bullet');
  assert.strictEqual(bulletSystem.active.length, 0, 'Bullet should be eliminated by the wall');
  console.log('✓ Tank Wall stops and absorbs bullets in its way');
}

// 4. Test Laser deletes normal bullets in its path
{
  const bulletSystem = new BulletSystem();
  const laserSystem = new LaserSystem();

  // Firing laser along Y = 250, pointing left from X = 700
  laserSystem.spawnLaser(700, 250, 250, {
    ownerId: 'boss',
    direction: 'left',
    chargeDuration: 0,
    fireDuration: 1.0,
    maxWidth: 34,
  });
  laserSystem.update(0.01); // transitions to 'firing'

  // Normal bullet in beam path at (500, 255)
  bulletSystem.spawnBullet('p1', 500, 255, 300, 0, 4, 3, 'normal');
  assert.strictEqual(bulletSystem.active.length, 1);

  laserSystem.clearBulletsInPath(bulletSystem);
  assert.strictEqual(bulletSystem.active.length, 0, 'Laser should have deleted normal bullet in its path');
  console.log('✓ Laser deletes normal bullets in its path');
}

// 5. Test Laser destroys two 25hp walls in 1 second
{
  const laserSystem = new LaserSystem();
  const wallSystem = new WallSystem();

  laserSystem.spawnLaser(700, 300, 300, {
    ownerId: 'boss',
    direction: 'left',
    chargeDuration: 0,
    fireDuration: 1.0,
    maxWidth: 40,
    dps: 50,
  });
  laserSystem.update(0.01); // firing

  const wall1 = wallSystem.spawnWall('tank1', 500, 300, 0, 0, 14, 48, 25, 2.0);
  const wall2 = wallSystem.spawnWall('tank2', 400, 300, 0, 0, 14, 48, 25, 2.0);

  // Simulate 1 full second (60 ticks @ 1/60s = 50 damage total)
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    laserSystem.strikeWalls(wallSystem, dt);
    wallSystem.update(dt);
  }

  assert.strictEqual(wall1.hp, 0, 'Wall 1 should be destroyed (25hp taken)');
  assert.strictEqual(wall2.hp, 0, 'Wall 2 should be destroyed (25hp taken)');
  assert.strictEqual(wallSystem.active.length, 0, 'Laser (50 dmg/s) destroyed two 25hp walls in 1s');
  console.log('✓ Laser destroys two 25hp Tank walls in a row over 1s');
}

// 6. Test GameRoom full simulation integration
{
  const room = new GameRoom('test-room', 'p1');
  room.addPlayer('p1', 'Tank');
  room.addPlayer('p2', 'Support');
  room.addPlayer('p3', 'Special_Attack');
  room.phase = 'playing';

  // Tank spawns wall
  room.setInput('p1', { dx: 0, dy: 0, action: 'wall' });
  room.update(1 / 60);
  assert.strictEqual(room.wallSystem.active.length, 1, 'Tank spawned a wall');

  // Support fires autoaim
  room.setInput('p2', { dx: 0, dy: 0, action: 'shoot' });
  room.update(1 / 60);
  assert(room.bulletSystem.active.some(b => b.type === 'autoaim'), 'Support spawned autoaim bullet');

  // SP.ATK fires ultimate laser
  room.setInput('p3', { dx: 0, dy: 0, action: 'laser' });
  room.update(1 / 60);
  assert(room.laserSystem.lasers.some(l => l.ownerId === 'p3'), 'SP.ATK spawned ultimate laser');

  const snapshot = room.getState();
  assert(Array.isArray(snapshot.walls), 'Snapshot includes walls');
  assert(Array.isArray(snapshot.lasers), 'Snapshot includes lasers');
  assert(Array.isArray(snapshot.bullets), 'Snapshot includes bullets');
  console.log('✓ GameRoom integrates all 4 character physics and snapshot state');
}

console.log('--- ALL PHYSICS TESTS PASSED PERFECTLY! ---');
