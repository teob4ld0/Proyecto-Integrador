'use strict';

const { createWorld, addPlayerBody, applyInput } = require('./physics');
const { BulletSystem } = require('./systems/BulletSystem');
const { LaserSystem } = require('./systems/LaserSystem');
const { WallSystem } = require('./systems/WallSystem');
const { BeamStruggleAuthority } = require('./systems/BeamStruggleAuthority');
const { EnemySystem } = require('./systems/EnemySystem');
const { ItemSystem } = require('./systems/ItemSystem');
const { TimelineManager } = require('./systems/TimelineManager');
const { RoomPhaseController } = require('./RoomPhaseController');
const { CampaignManager } = require('./campaign/CampaignManager');
const { BossController } = require('./entities/Boss');
const { spawnAutoAimBullet } = require('./autoAim');
const { releaseBullet } = require('./entities/Bullet');
const { DEFAULT_PLAYER_STATS, normalizeClassId, getCharacterStats } = require('./config/characterStats');
const { buildRoomSnapshot } = require('./serializers/roomSnapshot');

const SKILL_COOLDOWN    = 1.5;   // 1.5s skill cooldown
const STRUGGLE_PLAYER_WIN_BOSS_DAMAGE = 25;
const STRUGGLE_BOSS_WIN_PLAYER_DAMAGE = 35;

const SPAWN_POSITIONS = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 100, y: 500 },
  { x: 700, y: 500 },
];

class GameRoom {
  constructor(roomId, hostId, options = {}) {
    this.roomId        = roomId;
    this.hostId        = hostId;
    /** @type {'lobby'|'ready'|'countdown'|'playing'} */
    this.phase         = 'playing';
    this.players       = new Map();
    this.bulletSystem  = new BulletSystem();
    this.laserSystem   = new LaserSystem();
    this.wallSystem    = new WallSystem();
    this.enemySystem   = new EnemySystem();
    this.itemSystem    = new ItemSystem();
    this.timeline      = new TimelineManager();
    this.campaign      = new CampaignManager(options.difficulty);
    this.boss          = new BossController();
    this.world         = createWorld();
    this.tick          = 0;
    this.stageTime     = 0;
    this._countdownMs  = 0;
    this._phaseController = new RoomPhaseController();
    this._beamStruggleController = new BeamStruggleAuthority();
    // Kept for compatibility with existing reads in case anything still peeks internals.
    this._beamStruggle = this._beamStruggleController.state;

    // Setup boss callbacks
    this.boss.onPhaseChange = (phase, spellName, isSpellCard) => {
      this.bulletSystem.clearByOwner('boss');
    };

    this.boss.onDefeated = () => {
      this.campaign.markStageCleared();
      this.itemSystem.spawnItemFountain(this.boss.x, this.boss.y, 20);
    };

    // Setup timeline for the current stage
    this._setupTimeline();
  }

  _setupTimeline() {
    const config = this.campaign.getStageConfig();
    this.timeline.loadFromStageConfig(config, this.campaign.bannerText, this.campaign.bannerSubtext);

    this.timeline
      .on('stage_banner', (payload) => {
        this.campaign.stageState = 'waves';
      })
      .on('spawn_wave', (payload) => {
        this.enemySystem.runWavePattern(payload.wave);
      })
      .on('boss_warning', () => {
        this.campaign.stageState = 'boss_warning';
      })
      .on('spawn_boss', () => {
        this.campaign.stageState = 'boss_battle';
        this.boss.spawn();
      });
  }

  // ── Player management ───────────────────────────────────────────────────────

  addPlayer(playerId, character = null) {
    if (this.players.has(playerId)) {
      this.players.get(playerId).active = true;
      return;
    }
    const resolvedCharacter = character || 'DPS';
    const stats = { ...getCharacterStats(resolvedCharacter) };
    const spawn = SPAWN_POSITIONS[this.players.size % SPAWN_POSITIONS.length];
    const body  = addPlayerBody(this.world, spawn.x, spawn.y);
    this.players.set(playerId, {
      body,
      input:         { dx: 0, dy: 0, action: null },
      angle:         0,
      shootCooldown: 0,
      skillCooldown: 0,
      active:        true,
      isReady:       false,
      character:     resolvedCharacter,
      stats,
      hp:            stats.hpMax,
      sp:            0,
    });
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    this.world.destroyBody(player.body);
    this.players.delete(playerId);
  }

  setPlayerInactive(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.active  = false;
      player.isReady = false;
      player.input   = { dx: 0, dy: 0, action: null };
    }
  }

  setInput(playerId, input) {
    const player = this.players.get(playerId);
    // Inputs only accepted during playing phase
    if (player && player.active && this.phase === 'playing') {
      player.input = input;
    }
  }

  // ── Phase transitions ────────────────────────────────────────────────────────

  /**
   * Host triggers the ready check. Returns true if the transition succeeded.
   */
  startReadyCheck(requesterId) {
    const ok = this._phaseController.startReadyCheck(requesterId, this.hostId);
    this._syncPhaseState();
    return ok;
  }

  /**
   * Mark a player as ready. Returns the new phase if it changed, null otherwise.
   */
  setPlayerReady(playerId) {
    const nextPhase = this._phaseController.setPlayerReady(playerId, this.players);
    this._syncPhaseState();
    return nextPhase;
  }

  /**
   * Cancel an ongoing ready/countdown and return to lobby.
   */
  cancelToLobby() {
    this._phaseController.cancelToLobby(this.players);
    this._syncPhaseState();
  }

  _syncPhaseState() {
    this.phase = this._phaseController.phase;
    this._countdownMs = this._phaseController.countdownMs;
  }

  // ── Game loop ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation one tick.
   * @returns {{ hits: Array, phaseChanged: string|null }}
   */
  update(deltaTime) {
    const phaseChanged = this._phaseController.tick(deltaTime);
    this._syncPhaseState();

    let hits = [];
    if (this.phase === 'playing') {
      hits = this._runPlayingSimulation(deltaTime);
    }

    this.tick++;
    return { hits, phaseChanged };
  }

  _runPlayingSimulation(deltaTime) {
    this.stageTime += deltaTime;

    // 1. Process player inputs
    for (const [id, player] of this.players) {
      this._updatePlayerActor(id, player, deltaTime);
    }

    // 2. Update timeline (spawns waves, boss warning, boss)
    this.timeline.update(deltaTime);

    // 3. Update boss AI and patterns
    if (this.boss.isActive && !this.boss.isDefeated) {
      // Get average player position for boss aiming
      const playerPos = this._getAveragePlayerPos();
      this.boss.update(deltaTime, playerPos, this.bulletSystem, this.laserSystem);
    }

    // 4. Unlock boss beam if mega laser finished
    if (this.boss.isLockedForBeam) {
      const hasMega = this.laserSystem.lasers.some(l => l.ownerId === 'boss' && (l.isMegaBeam || l.maxWidth >= 60));
      if (!hasMega) this.boss.isLockedForBeam = false;
    }

    // 5. Update enemy system (movement, shooting, player bullet collisions)
    const playerPos = this._getAveragePlayerPos();
    const enemyDefeats = this.enemySystem.update(deltaTime, this.bulletSystem, playerPos);

    // 6. Spawn items from defeated enemies and apply SP gain
    for (const defeat of enemyDefeats) {
      this.itemSystem.spawnItem(defeat.x, defeat.y, defeat.itemDrop);
      // Give SP to all active players
      for (const [, p] of this.players) {
        if (p.active && p.hp > 0) {
          const stats = p.stats || DEFAULT_PLAYER_STATS;
          p.sp = Math.min(stats.spMax, p.sp + 25);
        }
      }
    }

    // 7. Update items (movement, magnetization, pickup)
    const itemPickups = this.itemSystem.update(deltaTime, this.players);
    this._applyItemPickups(itemPickups);

    // 8. Physics step
    this.world.step(deltaTime);

    // 9. Bullet collision (boss bullets → players)
    const bulletHits = this.bulletSystem.update(deltaTime, this.players);
    this._applyBulletHits(bulletHits);

    // 10. Laser updates
    this.laserSystem.update(deltaTime);
    this.laserSystem.clearBulletsInPath(this.bulletSystem);

    // 11. Beam struggle
    this._beamStruggleController.update(deltaTime, {
      lasers: this.laserSystem.lasers,
      players: this.players,
      onPlayerWin: () => {
        this.boss.loseFullHealthBar();
      },
      onBossWin: () => {
        for (const [, p] of this.players) {
          if (!p.active || p.hp <= 0) continue;
          this.applyDamageToPlayer(p, STRUGGLE_BOSS_WIN_PLAYER_DAMAGE);
        }
      },
    });

    // 12. Walls
    this.laserSystem.strikeWalls(this.wallSystem, deltaTime);
    this.wallSystem.update(deltaTime);
    this.wallSystem.blockBullets(this.bulletSystem);

    // 13. Laser collisions
    let laserHits = [];
    if (!this._beamStruggleController.isSuppressingLaserDamage()) {
      laserHits = this.laserSystem.checkCollisions(this.players, deltaTime);
      for (const hit of laserHits) {
        const player = this.players.get(hit.playerId);
        if (!player || player.hp <= 0) continue;
        this.applyDamageToPlayer(player, hit.damage || 0);
      }
      // Player lasers vs boss
      if (this.boss.isActive && !this.boss.isDefeated) {
        for (const laser of this.laserSystem.lasers) {
          if (laser.ownerId === 'boss' || laser.state !== 'firing') continue;
          // Simple hit check: is boss within laser's horizontal range and vertical width
          const beamHalfW = (laser.currentWidth || laser.maxWidth) / 2;
          if (this.boss.x >= laser.sourceX && Math.abs(this.boss.y - laser.sourceY) < beamHalfW + 40) {
            this.boss.takeDamage(deltaTime * 60); // ~1 dmg per frame at 60fps
          }
        }
      }
    }

    // 14. Player bullets vs boss
    this._resolvePlayerBulletsAgainstBoss();

    // 15. Stage advancement
    if (this.campaign.stageState === 'stage_clear' && this.campaign.hasNextStage()) {
      // Auto-advance or wait for client signal — for now just set state
    }

    return [...bulletHits, ...laserHits];
  }

  _getAveragePlayerPos() {
    let totalX = 0, totalY = 0, count = 0;
    for (const [, player] of this.players) {
      if (!player.active || player.hp <= 0) continue;
      const pos = player.body.getPosition();
      totalX += pos.x;
      totalY += pos.y;
      count++;
    }
    if (count === 0) return { x: 100, y: 300 };
    return { x: totalX / count, y: totalY / count };
  }

  _updatePlayerActor(id, player, deltaTime) {
    if (!(player.active && player.hp > 0)) {
      if (player.hp <= 0) player.input = { dx: 0, dy: 0, action: null };
      player.body.setLinearVelocity({ x: 0, y: 0 });
      return;
    }

    const { dx, dy, action } = player.input;
    if (dx !== 0 || dy !== 0) player.angle = Math.atan2(dy, dx);

    if (player.shootCooldown > 0) player.shootCooldown = Math.max(0, player.shootCooldown - deltaTime);
    if (player.skillCooldown > 0) player.skillCooldown = Math.max(0, player.skillCooldown - deltaTime);

    const pos = player.body.getPosition();
    const stats = player.stats || DEFAULT_PLAYER_STATS;
    const normClass = normalizeClassId(player.character);
    const shootCooldown = 1 / Math.max(0.1, stats.shotsPerSecond || 5);

    if (action === 'shoot' && player.shootCooldown <= 0) {
      if (normClass === 'support' || normClass === 'healer') {
        const targets = [{ x: this.boss.x, y: this.boss.y }];
        spawnAutoAimBullet(this.bulletSystem, id, pos.x + 16, pos.y, targets, 650, 4, 2.5, stats.bulletDamage, 'autoaim');
      } else if (normClass === 'tank' || normClass === 'defense') {
        this.bulletSystem.spawnBullet(id, pos.x + 16, pos.y, 600, 0, 5, 2.5, 'normal', stats.bulletDamage);
      } else {
        const bx1 = pos.x + 16;
        const by1 = pos.y - 6;
        const bx2 = pos.x + 16;
        const by2 = pos.y + 6;
        this.bulletSystem.spawnBullet(id, bx1, by1, 750, 0, 4, 2.5, 'normal', stats.bulletDamage);
        this.bulletSystem.spawnBullet(id, bx2, by2, 750, 0, 4, 2.5, 'normal', stats.bulletDamage);
      }
      player.shootCooldown = shootCooldown;
    }

    const canUseSkill = player.skillCooldown <= 0 && player.sp >= stats.spMax;

    if ((action === 'wall' || ((normClass === 'tank' || normClass === 'defense') && action === 'special')) && canUseSkill) {
      this.wallSystem.spawnWall(id, pos.x + 24, pos.y, 40, 0, 14, 48, 25, 1.0);
      player.skillCooldown = SKILL_COOLDOWN;
      player.sp = 0;
    }

    if ((action === 'laser' || ((normClass === 'special_attack' || normClass === 'attack') && action === 'special')) && canUseSkill) {
      this.laserSystem.spawnLaser(pos.x + 16, pos.y, pos.y, {
        ownerId: id,
        direction: 'right',
        chargeDuration: 0.3,
        fireDuration: 1.0,
        fadeDuration: 0.2,
        maxWidth: 30,
        color: 0x00f0ff,
      });
      player.skillCooldown = SKILL_COOLDOWN * 2;
      player.sp = 0;
    }

    applyInput(player.body, player.input);
  }

  _applyBulletHits(bulletHits) {
    for (const hit of bulletHits) {
      const player = this.players.get(hit.playerId);
      if (!player || player.hp <= 0) continue;
      this.applyDamageToPlayer(player, hit.damage || 5);
    }
  }

  _applyItemPickups(pickups) {
    for (const pickup of pickups) {
      const player = this.players.get(pickup.playerId);
      if (!player || player.hp <= 0) continue;

      const stats = player.stats || DEFAULT_PLAYER_STATS;
      switch (pickup.type) {
        case 'power':
          player.sp = Math.min(stats.spMax, player.sp + 20);
          break;
        case 'point':
          player.sp = Math.min(stats.spMax, player.sp + 10);
          break;
        case 'bomb_frag':
          player.sp = Math.min(stats.spMax, player.sp + 50);
          break;
        case 'life_frag':
          player.hp = Math.min(stats.hpMax, player.hp + 20);
          break;
      }
    }
  }

  _resolvePlayerBulletsAgainstBoss() {
    if (!this.boss.isActive || this.boss.isDefeated || this.boss.hp <= 0) return;

    for (let i = this.bulletSystem.active.length - 1; i >= 0; i--) {
      const b = this.bulletSystem.active[i];
      if (b.ownerId === 'boss') continue;

      const dx = b.x - this.boss.x;
      const dy = b.y - this.boss.y;
      if (dx * dx + dy * dy >= (40 + b.radius) * (40 + b.radius)) continue;

      const damage = b.damage || 5;
      const owner = this.players.get(b.ownerId);
      if (owner && owner.hp > 0) {
        const stats = owner.stats || DEFAULT_PLAYER_STATS;
        owner.sp = Math.min(stats.spMax, owner.sp + (stats.spChargePerHit || 0));
      }

      this.boss.takeDamage(damage * 0.08);
      this.bulletSystem.hash.remove(b);
      releaseBullet(b);
      this.bulletSystem.active.splice(i, 1);
    }
  }

  // ── Stage Management ────────────────────────────────────────────────────────

  /**
   * Advance to the next stage if possible.
   * @returns {boolean}
   */
  advanceStage() {
    if (!this.campaign.hasNextStage()) return false;
    if (!this.campaign.advanceToNextStage()) return false;

    // Reset all systems
    this.bulletSystem = new BulletSystem();
    this.enemySystem.clear();
    this.itemSystem.clear();
    this.boss.reset();
    this.timeline.reset();
    this.stageTime = 0;

    // Reload timeline for new stage
    this._setupTimeline();
    return true;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  getState() {
    return buildRoomSnapshot(this, { fallbackStats: DEFAULT_PLAYER_STATS });
  }

  /** Serialise ready state for broadcasting. */
  getReadyStatus() {
    return [...this.players.entries()].map(([id, p]) => ({ id, isReady: p.isReady }));
  }

  applyDamageToPlayer(player, rawDamage) {
    const stats = player.stats || DEFAULT_PLAYER_STATS;
    const mitigation = Math.max(0, Math.min(1, (stats.defensePercent || 0) / 100));
    const appliedDamage = rawDamage * (1 - mitigation);
    player.hp = Math.max(0, Number((player.hp - appliedDamage).toFixed(3)));
  }
}

module.exports = GameRoom;
