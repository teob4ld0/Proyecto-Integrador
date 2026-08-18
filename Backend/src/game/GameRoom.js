'use strict';

const { createWorld, addPlayerBody, applyInput } = require('./physics');
const { BulletSystem } = require('./systems/BulletSystem');
const { LaserSystem } = require('./systems/LaserSystem');
const { WallSystem } = require('./systems/WallSystem');
const { BeamStruggleAuthority } = require('./systems/BeamStruggleAuthority');
const { RoomPhaseController } = require('./RoomPhaseController');
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
  constructor(roomId, hostId) {
    this.roomId        = roomId;
    this.hostId        = hostId;
    /** @type {'lobby'|'ready'|'countdown'|'playing'} */
    this.phase         = 'lobby';
    this.players       = new Map();
    this.bulletSystem  = new BulletSystem();
    this.laserSystem   = new LaserSystem();
    this.wallSystem    = new WallSystem();
    this.bossPos       = { x: 700, y: 300 };
    this.bossHp        = 100;
    this.maxBossHp     = 100;
    this.world         = createWorld();
    this.tick          = 0;
    this._countdownMs  = 0;
    this._phaseController = new RoomPhaseController();
    this._beamStruggleController = new BeamStruggleAuthority();
    // Kept for compatibility with existing reads in case anything still peeks internals.
    this._beamStruggle = this._beamStruggleController.state;
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
    for (const [id, player] of this.players) {
      this._updatePlayerActor(id, player, deltaTime);
    }

    this._spawnBossPatterns();

    this.world.step(deltaTime);

    const bulletHits = this.bulletSystem.update(deltaTime, this.players);
    this._applyBulletHits(bulletHits);

    this.laserSystem.update(deltaTime);
    this.laserSystem.clearBulletsInPath(this.bulletSystem);

    this._beamStruggleController.update(deltaTime, {
      lasers: this.laserSystem.lasers,
      players: this.players,
      onPlayerWin: () => {
        this.bossHp = Math.max(0, Number((this.bossHp - STRUGGLE_PLAYER_WIN_BOSS_DAMAGE).toFixed(1)));
      },
      onBossWin: () => {
        for (const [, p] of this.players) {
          if (!p.active || p.hp <= 0) continue;
          this.applyDamageToPlayer(p, STRUGGLE_BOSS_WIN_PLAYER_DAMAGE);
        }
      },
    });

    this.laserSystem.strikeWalls(this.wallSystem, deltaTime);
    this.wallSystem.update(deltaTime);
    this.wallSystem.blockBullets(this.bulletSystem);

    let laserHits = [];
    if (!this._beamStruggleController.isSuppressingLaserDamage()) {
      laserHits = this.laserSystem.checkCollisions(this.players, deltaTime);
      for (const hit of laserHits) {
        const player = this.players.get(hit.playerId);
        if (!player || player.hp <= 0) continue;
        this.applyDamageToPlayer(player, hit.damage || 0);
      }
      this.laserSystem.strikeBoss(this.bossPos, deltaTime);
    }

    this._resolvePlayerBulletsAgainstBoss();
    return [...bulletHits, ...laserHits];
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
        spawnAutoAimBullet(this.bulletSystem, id, pos.x + 16, pos.y, [this.bossPos], 650, 4, 2.5, stats.bulletDamage, 'autoaim');
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

  _spawnBossPatterns() {
    if (this.bossHp <= 0) return;

    if (this.tick % 150 === 0) {
      for (const offset of [-0.25, 0, 0.25]) {
        const angle = Math.PI + offset;
        this.bulletSystem.spawn('boss', this.bossPos.x - 35, this.bossPos.y, angle, 240, 5, 4, 'normal', 5);
      }
    }

    if (this.tick % 330 !== 0) return;
    this.laserSystem.spawnLaser(665, 252, 252, {
      ownerId: 'boss',
      direction: 'left',
      podType: 'top',
      chargeDuration: 0.7,
      fireDuration: 1.0,
      fadeDuration: 0.3,
      maxWidth: 34,
      color: 0xff2b5b,
    });
    this.laserSystem.spawnLaser(665, 348, 348, {
      ownerId: 'boss',
      direction: 'left',
      podType: 'bottom',
      chargeDuration: 0.7,
      fireDuration: 1.0,
      fadeDuration: 0.3,
      maxWidth: 34,
      color: 0xff2b5b,
    });
  }

  _applyBulletHits(bulletHits) {
    for (const hit of bulletHits) {
      const player = this.players.get(hit.playerId);
      if (!player || player.hp <= 0) continue;
      this.applyDamageToPlayer(player, hit.damage || 5);
    }
  }

  _resolvePlayerBulletsAgainstBoss() {
    if (this.bossHp <= 0) return;

    for (let i = this.bulletSystem.active.length - 1; i >= 0; i--) {
      const b = this.bulletSystem.active[i];
      if (b.ownerId === 'boss') continue;

      const dx = b.x - this.bossPos.x;
      const dy = b.y - this.bossPos.y;
      if (dx * dx + dy * dy >= (40 + b.radius) * (40 + b.radius)) continue;

      const damage = b.damage || 5;
      const owner = this.players.get(b.ownerId);
      if (owner && owner.hp > 0) {
        const stats = owner.stats || DEFAULT_PLAYER_STATS;
        owner.sp = Math.min(stats.spMax, owner.sp + (stats.spChargePerHit || 0));
      }

      this.bossHp = Math.max(0, Number((this.bossHp - (damage * 0.08)).toFixed(1)));
      this.bulletSystem.hash.remove(b);
      releaseBullet(b);
      this.bulletSystem.active.splice(i, 1);
    }
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
