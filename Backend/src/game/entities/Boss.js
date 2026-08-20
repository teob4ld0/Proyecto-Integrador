'use strict';

/**
 * Backend-authoritative Boss controller.
 * Manages 5 phases (multi-stock HP bars), danmaku patterns, movement AI.
 * Ported from frontend Boss.ts — logic only, no PIXI.js rendering.
 */

const BOSS_PHASES = [
  { phase: 1, name: 'Twilight Non-Spell "Evening Flutter"', isSpellCard: false, maxHp: 110 },
  { phase: 2, name: 'Moon Sign "Moonlight Ray"', isSpellCard: true, maxHp: 140 },
  { phase: 3, name: 'Night Non-Spell "Midnight Petal Barrage"', isSpellCard: false, maxHp: 130 },
  { phase: 4, name: 'Night Sign "Midnight Gaster Cage"', isSpellCard: true, maxHp: 160 },
  { phase: 5, name: 'Darkness Sign "Demarcation of the Dark Forest"', isSpellCard: true, maxHp: 200 },
];

class BossController {
  constructor() {
    this.x = 700;
    this.y = 300;
    this.targetX = 700;
    this.targetY = 300;
    this.hp = BOSS_PHASES[0].maxHp;
    this.maxHp = BOSS_PHASES[0].maxHp;
    this.phase = 1;
    this.remainingStocks = 4;
    this.spellcardName = BOSS_PHASES[0].name;
    this.isSpellCard = false;
    this.isActive = false;
    this.isDefeated = false;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.isLockedForBeam = false;
    this.refillTimer = 0;

    // Timers for danmaku patterns
    this._shootTimer = 0;
    this._laserTimer = 0;
    this._specialTimer = 0;
    this._darkOrbTimer = 0;
    this._megaLaserTimer = 0;
    this._animTimer = 0;
    this._introProgress = 0;

    /** @type {function|null} */
    this.onPhaseChange = null;
    /** @type {function|null} */
    this.onDefeated = null;
  }

  spawn(targetX = 700, targetY = 300) {
    this.isActive = true;
    this.x = 800; // off-screen right (in 800-wide world)
    this.y = targetY;
    this.targetX = targetX;
    this.targetY = targetY;
    this._introProgress = 0;
    this.phase = 1;
    this.remainingStocks = 4;
    this.hp = BOSS_PHASES[0].maxHp;
    this.maxHp = BOSS_PHASES[0].maxHp;
    this.spellcardName = BOSS_PHASES[0].name;
    this.isSpellCard = BOSS_PHASES[0].isSpellCard;
    this.isDefeated = false;
    this.isInvulnerable = true;
    this.isRefilling = true;
    this.refillTimer = 1.3;
  }

  /**
   * Advance the boss simulation one tick.
   * @param {number} dt
   * @param {{ x: number, y: number }} playerPos
   * @param {BulletSystem} bulletSystem
   * @param {LaserSystem} laserSystem
   */
  update(dt, playerPos, bulletSystem, laserSystem) {
    if (!this.isActive || this.isDefeated) return;

    this._animTimer += dt;

    // 1. Intro animation
    if (this._introProgress < 1.0) {
      this._introProgress = Math.min(1.0, this._introProgress + dt * 0.9);
      const ease = 1 - Math.pow(1 - this._introProgress, 3);
      this.x = 800 + (this.targetX - 800) * ease;
      this.y = this.targetY;
      return;
    }

    // 2. Refill animation (invulnerable transition)
    if (this.isRefilling) {
      this.refillTimer -= dt;
      if (this.refillTimer <= 0) {
        this.isRefilling = false;
        this.isInvulnerable = false;
      }
      return;
    }

    // 3. Movement AI per phase
    if (this.isLockedForBeam) {
      this.x = this.targetX;
      this.y = this.targetY;
    } else {
      const t = this._animTimer;
      switch (this.phase) {
        case 1:
          this.y = this.targetY + Math.sin(t * 2.2) * 40;
          this.x = this.targetX + Math.cos(t * 1.1) * 12;
          break;
        case 2:
          this.x = this.targetX + Math.cos(t * 1.8) * 35;
          this.y = this.targetY + Math.sin(t * 3.6) * 48;
          break;
        case 3:
          this.x = this.targetX + Math.sin(t * 3.0) * 28;
          this.y = this.targetY + Math.cos(t * 2.0) * 60;
          break;
        case 4:
          this.x = this.targetX + Math.sin(t * 5.0) * 12;
          this.y = this.targetY + Math.cos(t * 2.8) * 32;
          break;
        case 5:
          this.x = this.targetX + Math.cos(t * 2.5) * 45;
          this.y = this.targetY + Math.sin(t * 2.5) * 60;
          break;
      }
    }

    // If locked for beam, don't shoot
    if (this.isLockedForBeam) {
      this._shootTimer = 0;
      this._laserTimer = 0;
      this._specialTimer = 0;
      this._darkOrbTimer = 0;
      return;
    }

    // 4. Danmaku patterns per phase
    this._shootTimer += dt;
    this._laserTimer += dt;
    this._specialTimer += dt;
    this._darkOrbTimer += dt;

    switch (this.phase) {
      case 1:
        this._updatePhase1(bulletSystem, laserSystem, playerPos);
        break;
      case 2:
        this._updatePhase2(dt, bulletSystem, laserSystem, playerPos);
        break;
      case 3:
        this._updatePhase3(bulletSystem, playerPos);
        break;
      case 4:
        this._updatePhase4(dt, bulletSystem, laserSystem, playerPos);
        break;
      case 5:
        this._updatePhase5(dt, bulletSystem, laserSystem, playerPos);
        break;
    }
  }

  _updatePhase1(bulletSystem, laserSystem, playerPos) {
    if (this._shootTimer >= 0.38) {
      this._shootTimer = 0;
      this._spawnFan(bulletSystem, playerPos, [-0.35, -0.18, 0, 0.18, 0.35], 210, 0xff3366);
    }
    if (this._specialTimer >= 1.6) {
      this._specialTimer = 0;
      this._spawnFan(bulletSystem, playerPos, [-0.5, 0.5], 250, 0x00f2fe);
    }
    if (this._laserTimer >= 5.0) {
      this._laserTimer = 0;
      this._triggerRhombusLasers(laserSystem, playerPos, 'targeted');
    }
  }

  _updatePhase2(dt, bulletSystem, laserSystem, playerPos) {
    if (this._shootTimer >= 0.3) {
      this._shootTimer = 0;
      this._spawnFan(bulletSystem, playerPos, [-0.22, 0.22], 260, 0x00f2fe);
    }
    if (this._specialTimer >= 1.4) {
      this._specialTimer = 0;
      const count = 18;
      const baseAngle = this._animTimer * 1.8;
      for (let i = 0; i < count; i++) {
        const a = baseAngle + (Math.PI * 2 * i) / count;
        bulletSystem.spawn('boss', this.x, this.y, a, 160, 6, 3, 'normal', 5);
      }
    }
    if (this._laserTimer >= 3.8) {
      this._laserTimer = 0;
      this._triggerRhombusLasers(laserSystem, playerPos, 'targeted');
    }
    this._megaLaserTimer += dt;
    if (this._megaLaserTimer >= 6.5) {
      this._megaLaserTimer = 0;
      this._triggerMegaLaser(laserSystem);
    }
  }

  _updatePhase3(bulletSystem, playerPos) {
    if (this._shootTimer >= 0.22) {
      this._shootTimer = 0;
      const angle = Math.atan2(playerPos.y - this.y, playerPos.x - this.x);
      const wave = Math.sin(this._animTimer * 9) * 0.45;
      bulletSystem.spawn('boss', this.x, this.y, angle + wave, 220, 5, 3, 'normal', 5);
      bulletSystem.spawn('boss', this.x, this.y, angle - wave, 220, 5, 3, 'normal', 5);
    }
    if (this._specialTimer >= 1.1) {
      this._specialTimer = 0;
      this._spawnFan(bulletSystem, playerPos, [-0.3, 0, 0.3], 270, 0xffffff);
    }
  }

  _updatePhase4(dt, bulletSystem, laserSystem, playerPos) {
    if (this._shootTimer >= 0.16) {
      this._shootTimer = 0;
      const rot = this._animTimer * 5.5;
      for (let arm = 0; arm < 6; arm++) {
        const a = rot + (Math.PI / 3) * arm;
        bulletSystem.spawn('boss', this.x, this.y, a, 190, 5, 3, 'normal', 5);
      }
    }
    if (this._laserTimer >= 3.2) {
      this._laserTimer = 0;
      this._triggerRhombusLasers(laserSystem, playerPos, 'both');
    }
    this._megaLaserTimer += dt;
    if (this._megaLaserTimer >= 6.0) {
      this._megaLaserTimer = 0;
      this._triggerMegaLaser(laserSystem);
    }
  }

  _updatePhase5(dt, bulletSystem, laserSystem, playerPos) {
    if (this._shootTimer >= 0.14) {
      this._shootTimer = 0;
      const rot = this._animTimer * 4.2;
      for (let arm = 0; arm < 8; arm++) {
        const a = rot + (Math.PI / 4) * arm;
        bulletSystem.spawn('boss', this.x, this.y, a, 175, 6, 3, 'normal', 5);
      }
    }
    if (this._darkOrbTimer >= 1.5) {
      this._darkOrbTimer = 0;
      const count = 12;
      const baseA = this._animTimer * 2.0;
      for (let i = 0; i < count; i++) {
        const a = baseA + (Math.PI * 2 * i) / count;
        bulletSystem.spawn('boss', this.x, this.y, a, 128, 7, 3, 'normal', 5);
      }
    }
    if (this._laserTimer >= 3.0) {
      this._laserTimer = 0;
      this._triggerRhombusLasers(laserSystem, playerPos, 'both');
    }
    this._megaLaserTimer += dt;
    if (this._megaLaserTimer >= 5.5) {
      this._megaLaserTimer = 0;
      this._triggerMegaLaser(laserSystem);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _spawnFan(bulletSystem, playerPos, offsets, speed, color) {
    const angle = Math.atan2(playerPos.y - this.y, playerPos.x - this.x);
    for (const off of offsets) {
      bulletSystem.spawn('boss', this.x - 25, this.y, angle + off, speed, 5, 3, 'normal', 5);
    }
  }

  _triggerRhombusLasers(laserSystem, playerPos, pattern) {
    const topPodY = 252;
    const bottomPodY = 348;
    const podX = 665;

    if (pattern === 'both') {
      laserSystem.spawnLaser(podX, topPodY, topPodY, {
        ownerId: 'boss', direction: 'left',
        chargeDuration: 0.6, fireDuration: 1.0, fadeDuration: 0.3,
        maxWidth: 30, color: this.phase >= 4 ? 0xff2b5b : 0xff3366, podType: 'top',
      });
      laserSystem.spawnLaser(podX, bottomPodY, bottomPodY, {
        ownerId: 'boss', direction: 'left',
        chargeDuration: 0.6, fireDuration: 1.0, fadeDuration: 0.3,
        maxWidth: 30, color: this.phase >= 4 ? 0xff2b5b : 0xff3366, podType: 'bottom',
      });
    } else {
      const podY = playerPos.y < this.y ? topPodY : bottomPodY;
      laserSystem.spawnLaser(podX, podY, playerPos.y, {
        ownerId: 'boss', direction: 'left',
        chargeDuration: 0.5, fireDuration: 1.0, fadeDuration: 0.3,
        maxWidth: 36, color: 0x00f2fe,
        podType: playerPos.y < this.y ? 'top' : 'bottom',
      });
    }
  }

  _triggerMegaLaser(laserSystem) {
    this.isLockedForBeam = true;
    this.x = 740;
    this.targetX = 740;
    this.targetY = this.y;

    laserSystem.spawnLaser(this.x, this.y, this.y, {
      ownerId: 'boss', direction: 'left',
      chargeDuration: 1.25, fireDuration: 1.8, fadeDuration: 0.4,
      maxWidth: 76, color: 0xffdd00, isMegaBeam: true,
    });
  }

  // ── Damage & Phase Transitions ────────────────────────────────────────────

  takeDamage(amount) {
    if (!this.isActive || this.isDefeated || this.isInvulnerable || this.isRefilling) return;

    this.hp = Math.max(0, Number((this.hp - amount).toFixed(1)));

    if (this.hp <= 0) {
      if (this.phase < 5) {
        // Transition to next phase
        const nextDef = BOSS_PHASES[this.phase]; // phase 1 → index 1 (phase 2)
        this.phase = nextDef.phase;
        this.remainingStocks = 5 - this.phase;
        this.spellcardName = nextDef.name;
        this.isSpellCard = nextDef.isSpellCard;
        this.hp = nextDef.maxHp;
        this.maxHp = nextDef.maxHp;
        this.isInvulnerable = true;
        this.isRefilling = true;
        this.refillTimer = 1.2;

        if (this.onPhaseChange) {
          this.onPhaseChange(this.phase, this.spellcardName, this.isSpellCard);
        }
      } else if (!this.isDefeated) {
        this.isDefeated = true;
        this.isActive = false;
        if (this.onDefeated) {
          this.onDefeated();
        }
      }
    }
  }

  loseFullHealthBar() {
    if (!this.isActive || this.isDefeated) return;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.takeDamage(this.hp + 999);
  }

  reset() {
    this.phase = 1;
    this.remainingStocks = 4;
    this.hp = BOSS_PHASES[0].maxHp;
    this.maxHp = BOSS_PHASES[0].maxHp;
    this.spellcardName = BOSS_PHASES[0].name;
    this.isSpellCard = false;
    this.isActive = false;
    this.isDefeated = false;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.isLockedForBeam = false;
    this.x = 800;
    this.y = 300;
  }

  toSnapshot() {
    return {
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHp: this.maxHp,
      phase: this.phase,
      remainingStocks: this.remainingStocks,
      spellcardName: this.spellcardName,
      isSpellCard: this.isSpellCard,
      isActive: this.isActive,
      isDefeated: this.isDefeated,
      isRefilling: this.isRefilling,
      isLockedForBeam: this.isLockedForBeam,
    };
  }
}

module.exports = { BossController, BOSS_PHASES };
