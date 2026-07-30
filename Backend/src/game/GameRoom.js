'use strict';

const { createWorld, addPlayerBody, applyInput, PLAYER_RADIUS } = require('./physics');
const { BulletSystem } = require('./systems/BulletSystem');

const SHOOT_COOLDOWN    = 0.3;
const BULLET_SPAWN_DIST = PLAYER_RADIUS + 6;
const COUNTDOWN_MS      = 5_000;  // 5 second countdown
const READY_TIMEOUT_MS  = 30_000; // force-start after 30s if not all ready

const SPAWN_POSITIONS = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 100, y: 500 },
  { x: 700, y: 500 },
];

class GameRoom {
  constructor(roomId, hostId) {
    this.roomId   = roomId;
    this.hostId   = hostId;
    /** @type {'lobby'|'ready'|'countdown'|'playing'} */
    this.phase    = 'lobby';
    this.players  = new Map();
    this.bulletSystem  = new BulletSystem();
    this.world    = createWorld();
    this.tick     = 0;
    this._countdownMs = 0;
    this._readyTimer  = null;
  }

  // ── Player management ───────────────────────────────────────────────────────

  addPlayer(playerId, character = null) {
    if (this.players.has(playerId)) {
      this.players.get(playerId).active = true;
      return;
    }
    const spawn = SPAWN_POSITIONS[this.players.size % SPAWN_POSITIONS.length];
    const body  = addPlayerBody(this.world, spawn.x, spawn.y);
    this.players.set(playerId, {
      body,
      input:         { dx: 0, dy: 0, action: null },
      angle:         -Math.PI / 2,
      shootCooldown: 0,
      active:        true,
      isReady:       false,
      character,
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
    if (requesterId !== this.hostId) return false;
    if (this.phase !== 'lobby') return false;
    this.phase = 'ready';
    // Auto-force after timeout
    this._readyTimer = setTimeout(() => {
      if (this.phase === 'ready') this._beginCountdown();
    }, READY_TIMEOUT_MS);
    return true;
  }

  /**
   * Mark a player as ready. Returns the new phase if it changed, null otherwise.
   */
  setPlayerReady(playerId) {
    const player = this.players.get(playerId);
    if (!player || this.phase !== 'ready') return null;
    player.isReady = true;
    const allReady = [...this.players.values()].every(p => !p.active || p.isReady);
    if (allReady) {
      this._beginCountdown();
      return 'countdown';
    }
    return null;
  }

  _beginCountdown() {
    if (this._readyTimer) { clearTimeout(this._readyTimer); this._readyTimer = null; }
    this.phase = 'countdown';
    this._countdownMs = COUNTDOWN_MS;
  }

  /**
   * Cancel an ongoing ready/countdown and return to lobby.
   */
  cancelToLobby() {
    if (this._readyTimer) { clearTimeout(this._readyTimer); this._readyTimer = null; }
    this.phase = 'lobby';
    for (const p of this.players.values()) p.isReady = false;
  }

  // ── Game loop ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation one tick.
   * @returns {{ hits: Array, phaseChanged: string|null }}
   */
  update(deltaTime) {
    let phaseChanged = null;

    if (this.phase === 'countdown') {
      this._countdownMs -= deltaTime * 1000;
      if (this._countdownMs <= 0) {
        this._countdownMs = 0;
        this.phase = 'playing';
        phaseChanged = 'playing';
      }
    }

    let hits = [];
    if (this.phase === 'playing') {
      for (const [id, player] of this.players) {
        if (player.active) {
          const { dx, dy, action } = player.input;
          if (dx !== 0 || dy !== 0) player.angle = Math.atan2(dy, dx);
          if (player.shootCooldown > 0) {
            player.shootCooldown = Math.max(0, player.shootCooldown - deltaTime);
          }
          if (action === 'shoot' && player.shootCooldown <= 0) {
            const pos = player.body.getPosition();
            const bx  = pos.x + Math.cos(player.angle) * BULLET_SPAWN_DIST;
            const by  = pos.y + Math.sin(player.angle) * BULLET_SPAWN_DIST;
            this.bulletSystem.spawn(id, bx, by, player.angle);
            player.shootCooldown = SHOOT_COOLDOWN;
          }
          applyInput(player.body, player.input);
        } else {
          player.body.setLinearVelocity({ x: 0, y: 0 });
        }
      }
      this.world.step(deltaTime);
      hits = this.bulletSystem.update(deltaTime, this.players);
    }

    this.tick++;
    return { hits, phaseChanged };
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  getState() {
    const players = [];
    for (const [id, player] of this.players) {
      const pos = player.body.getPosition();
      players.push({ id, x: pos.x, y: pos.y, angle: player.angle, isReady: player.isReady, character: player.character });
    }
    return {
      type:        'snapshot',
      tick:        this.tick,
      phase:       this.phase,
      countdownMs: this.phase === 'countdown' ? Math.max(0, this._countdownMs) : undefined,
      players,
      bullets:     this.bulletSystem.getState(),
    };
  }

  /** Serialise ready state for broadcasting. */
  getReadyStatus() {
    return [...this.players.entries()].map(([id, p]) => ({ id, isReady: p.isReady }));
  }
}

module.exports = GameRoom;
