'use strict';

const { WORLD_WIDTH, WORLD_HEIGHT } = require('../physics');

let _nextEnemyId = 0;

/**
 * Backend-authoritative enemy system.
 * Manages spawning, movement, HP, death, and collision for intermediate enemies (fairies).
 * Ported from frontend EnemySystem.ts — logic only, no rendering.
 */
class EnemySystem {
  constructor() {
    /** @type {Enemy[]} */
    this.active = [];
  }

  /**
   * Spawn a single enemy with the given config.
   */
  spawn(config) {
    const enemy = {
      id: `enemy_${_nextEnemyId++}`,
      type: config.type || 'green_fairy',
      x: config.startX || WORLD_WIDTH + 30,
      y: config.startY || WORLD_HEIGHT / 2,
      vx: -(config.speed || 160),
      vy: 0,
      hp: config.hp || 12,
      maxHp: config.hp || 12,
      radius: config.radius || 16,
      scoreValue: config.scoreValue || 200,
      itemDrop: config.itemDrop || 'point',
      isDead: false,
      trajectory: config.trajectory || 'straight',
      attackPattern: config.attackPattern || 'none',
      shootInterval: config.shootInterval || 2.0,
      shootTimer: config.shootDelay || 0,
      customParams: config.customParams || {},
      spawnTime: 0, // Elapsed since spawn, used for trajectory math
      speed: config.speed || 160,
      startX: config.startX || WORLD_WIDTH + 30,
      startY: config.startY || WORLD_HEIGHT / 2,
    };
    this.active.push(enemy);
    return enemy;
  }

  // ── Wave Patterns ─────────────────────────────────────────────────────────────

  spawnDoubleHelixWave(countPerLine = 5) {
    for (let i = 0; i < countPerLine; i++) {
      this.spawn({
        type: 'green_fairy', trajectory: 'double_helix', attackPattern: 'aimed_single',
        startX: WORLD_WIDTH + 50 + i * 60, startY: 170, speed: 130, hp: 14,
        itemDrop: i % 2 === 0 ? 'power' : 'point',
        customParams: { freq: 3.2, amp: 70, phase: i * 0.4 },
      });
      this.spawn({
        type: 'yellow_fairy', trajectory: 'double_helix', attackPattern: 'helix_stream',
        startX: WORLD_WIDTH + 50 + i * 60, startY: 430, speed: 130, hp: 16,
        itemDrop: 'power',
        customParams: { freq: 3.2, amp: 70, phase: i * 0.4 + Math.PI },
      });
    }
  }

  spawnPincerWave(countPerSide = 3) {
    for (let i = 0; i < countPerSide; i++) {
      this.spawn({
        type: 'red_fairy', trajectory: 'hover_retreat', attackPattern: 'flower_burst',
        startX: WORLD_WIDTH + 50 + i * 70, startY: 100 + i * 20, speed: 150, hp: 28,
        itemDrop: 'power', shootInterval: 1.1,
        customParams: { hoverX: 580 - i * 30, hoverTime: 3.8 },
      });
      this.spawn({
        type: 'red_fairy', trajectory: 'hover_retreat', attackPattern: 'flower_burst',
        startX: WORLD_WIDTH + 50 + i * 70, startY: 500 - i * 20, speed: 150, hp: 28,
        itemDrop: 'point', shootInterval: 1.1,
        customParams: { hoverX: 580 - i * 30, hoverTime: 3.8 },
      });
    }
  }

  spawnCommanderWave(startX, startY) {
    startX = startX || WORLD_WIDTH + 50;
    startY = startY || WORLD_HEIGHT / 2;
    this.spawn({
      type: 'big_fairy', trajectory: 'hover_retreat', attackPattern: 'star_rings',
      startX, startY, speed: 60, hp: 130, radius: 30, scoreValue: 1200,
      itemDrop: 'life_frag', shootInterval: 0.75,
      customParams: { hoverX: 530, hoverTime: 7.5 },
    });
    for (let k = 0; k < 4; k++) {
      this.spawn({
        type: k % 2 === 0 ? 'red_fairy' : 'purple_fairy',
        trajectory: 'spiral', attackPattern: 'cross_spread',
        startX: startX + 30, startY: startY + (k % 2 === 0 ? -100 : 100),
        speed: 110, hp: 35,
        itemDrop: k % 2 === 0 ? 'power' : 'bomb_frag',
        shootInterval: 0.95,
        customParams: { phase: (Math.PI / 2) * k },
      });
    }
  }

  spawnPurpleAssaultWave() {
    const yPositions = [120, 200, 400, 480];
    for (let i = 0; i < yPositions.length; i++) {
      this.spawn({
        type: 'purple_fairy', trajectory: 'hover_retreat', attackPattern: 'ring_burst',
        startX: WORLD_WIDTH + 50 + i * 40, startY: yPositions[i], speed: 120, hp: 38,
        itemDrop: i % 2 === 0 ? 'power' : 'point',
        shootInterval: 0.9,
        customParams: { hoverX: 560 - (i % 2) * 40, hoverTime: 4.2 },
      });
    }
  }

  spawnCrossfireWave(count = 8) {
    for (let i = 0; i < count; i++) {
      const isTop = i % 2 === 0;
      this.spawn({
        type: 'green_fairy', trajectory: isTop ? 'cross_top' : 'cross_bottom',
        attackPattern: 'needle_stream',
        startX: WORLD_WIDTH + 40 + i * 50, startY: isTop ? 30 : WORLD_HEIGHT - 30,
        speed: 180, hp: 18,
        itemDrop: i % 3 === 0 ? 'power' : 'point',
        shootInterval: 0.8, shootDelay: 0.15 + i * 0.1,
      });
    }
  }

  /**
   * Run a wave pattern by ID (1-5).
   */
  runWavePattern(waveId) {
    switch (waveId) {
      case 1: this.spawnDoubleHelixWave(6); break;
      case 2: this.spawnPincerWave(3); break;
      case 3: this.spawnCommanderWave(); break;
      case 4: this.spawnPurpleAssaultWave(); break;
      case 5: this.spawnCrossfireWave(10); break;
    }
  }

  // ── Simulation ────────────────────────────────────────────────────────────────

  /**
   * Advance the enemy simulation one tick.
   * @param {number} dt - delta time in seconds
   * @param {BulletSystem} bulletSystem - for enemy shooting & player bullet collision
   * @param {{ x: number, y: number }} playerPos - for aimed shots
   * @returns {{ x: number, y: number, score: number, itemDrop: string }[]} defeated enemies
   */
  update(dt, bulletSystem, playerPos) {
    const defeated = [];

    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (e.isDead) continue;

      e.spawnTime += dt;
      this._moveEnemy(e, dt);

      // Off-screen cleanup (exited left side)
      if (e.x < -50 || e.x > WORLD_WIDTH + 100 || e.y < -50 || e.y > WORLD_HEIGHT + 50) {
        this.active.splice(i, 1);
        continue;
      }

      // Enemy shooting
      e.shootTimer += dt;
      if (e.shootTimer >= e.shootInterval && e.attackPattern !== 'none') {
        e.shootTimer = 0;
        this._enemyShoot(e, bulletSystem, playerPos);
      }
    }

    // Player bullet → enemy collision
    for (let i = bulletSystem.active.length - 1; i >= 0; i--) {
      const b = bulletSystem.active[i];
      if (b.ownerId === 'boss') continue; // boss bullets don't hit enemies

      for (let j = this.active.length - 1; j >= 0; j--) {
        const e = this.active[j];
        if (e.isDead) continue;

        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.radius + b.radius) * (e.radius + b.radius)) {
          e.hp -= b.damage || 5;
          // Remove bullet
          bulletSystem.hash.remove(b);
          const { releaseBullet } = require('../entities/Bullet');
          releaseBullet(b);
          bulletSystem.active.splice(i, 1);

          if (e.hp <= 0) {
            e.isDead = true;
            defeated.push({
              x: e.x, y: e.y,
              score: e.scoreValue,
              itemDrop: e.itemDrop,
            });
            this.active.splice(j, 1);
          }
          break;
        }
      }
    }

    return defeated;
  }

  _moveEnemy(e, dt) {
    const t = e.spawnTime;
    const p = e.customParams;

    switch (e.trajectory) {
      case 'straight':
        e.x += e.vx * dt;
        break;
      case 'sine':
        e.x -= e.speed * dt;
        e.y = e.startY + (p.amp || 70) * Math.sin((p.freq || 2.8) * t + (p.phase || 0));
        break;
      case 'double_helix':
        e.x -= e.speed * dt;
        e.y = e.startY + (p.amp || 70) * Math.sin((p.freq || 3.2) * t + (p.phase || 0));
        break;
      case 'hover_retreat': {
        const hoverX = p.hoverX || 500;
        const hoverTime = p.hoverTime || 4.0;
        if (e.x > hoverX) {
          e.x -= e.speed * dt;
        } else if (t > hoverTime) {
          e.x -= e.speed * 0.5 * dt; // slow retreat
        }
        e.y = e.startY + Math.sin(t * 2.5) * 15;
        break;
      }
      case 'spiral': {
        const phase = p.phase || 0;
        e.x -= e.speed * 0.6 * dt;
        e.y = e.startY + Math.sin(t * 3.0 + phase) * 60;
        break;
      }
      case 'cross_top':
        e.x -= e.speed * dt;
        e.y = e.startY + Math.abs(Math.sin(t * 1.8)) * 150;
        break;
      case 'cross_bottom':
        e.x -= e.speed * dt;
        e.y = e.startY - Math.abs(Math.sin(t * 1.8)) * 150;
        break;
      case 'zigzag':
        e.x -= e.speed * dt;
        e.y = e.startY + ((Math.floor(t * 2) % 2 === 0 ? 1 : -1) * 40);
        break;
      default:
        e.x += e.vx * dt;
        break;
    }
  }

  _enemyShoot(e, bulletSystem, playerPos) {
    const angle = Math.atan2(playerPos.y - e.y, playerPos.x - e.x);

    switch (e.attackPattern) {
      case 'aimed_single':
        bulletSystem.spawn('boss', e.x, e.y, angle, 200, 4, 3, 'normal', 5);
        break;
      case 'helix_stream':
        bulletSystem.spawn('boss', e.x, e.y, angle + 0.2, 220, 4, 3, 'normal', 5);
        bulletSystem.spawn('boss', e.x, e.y, angle - 0.2, 220, 4, 3, 'normal', 5);
        break;
      case 'flower_burst': {
        const arms = 5;
        for (let k = 0; k < arms; k++) {
          const a = angle + (Math.PI * 2 * k) / arms;
          bulletSystem.spawn('boss', e.x, e.y, a, 180, 4, 3, 'normal', 5);
        }
        break;
      }
      case 'ring_burst': {
        const count = 12;
        for (let k = 0; k < count; k++) {
          const a = (Math.PI * 2 * k) / count;
          bulletSystem.spawn('boss', e.x, e.y, a, 160, 4, 3, 'normal', 4);
        }
        break;
      }
      case 'star_rings': {
        const count = 16;
        const base = e.spawnTime * 2.0;
        for (let k = 0; k < count; k++) {
          const a = base + (Math.PI * 2 * k) / count;
          bulletSystem.spawn('boss', e.x, e.y, a, 140, 5, 3, 'normal', 5);
        }
        break;
      }
      case 'cross_spread':
        for (const offset of [-0.3, 0, 0.3]) {
          bulletSystem.spawn('boss', e.x, e.y, angle + offset, 240, 4, 3, 'normal', 5);
        }
        break;
      case 'needle_stream':
        bulletSystem.spawn('boss', e.x, e.y, angle, 300, 3, 2.5, 'normal', 5);
        break;
      case 'spiral_barrage': {
        const rot = e.spawnTime * 4;
        for (let k = 0; k < 4; k++) {
          const a = rot + (Math.PI / 2) * k;
          bulletSystem.spawn('boss', e.x, e.y, a, 180, 4, 3, 'normal', 5);
        }
        break;
      }
      default:
        break;
    }
  }

  clear() {
    this.active = [];
  }

  getState() {
    return this.active.map(e => ({
      id: e.id, type: e.type,
      x: e.x, y: e.y,
      hp: e.hp, maxHp: e.maxHp,
      radius: e.radius,
    }));
  }
}

module.exports = { EnemySystem };
