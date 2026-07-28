'use strict';

const { createWorld, addPlayerBody, applyInput, PLAYER_RADIUS } = require('./physics');
const { BulletSystem } = require('./systems/BulletSystem');

const SHOOT_COOLDOWN    = 0.3;  // seconds between shots (300 ms)
const BULLET_SPAWN_DIST = PLAYER_RADIUS + 6; // spawn bullet just outside the player hitbox

const SPAWN_POSITIONS = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 100, y: 500 },
  { x: 700, y: 500 },
];

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map();
    this.bulletSystem = new BulletSystem();
    this.world = createWorld();
    this.tick = 0;
  }

  addPlayer(playerId) {
    if (this.players.has(playerId)) {
      this.players.get(playerId).active = true;
      return;
    }
    const spawn = SPAWN_POSITIONS[this.players.size % SPAWN_POSITIONS.length];
    const body  = addPlayerBody(this.world, spawn.x, spawn.y);
    this.players.set(playerId, {
      body,
      input:         { dx: 0, dy: 0, action: null },
      angle:         -Math.PI / 2, // default: facing up
      shootCooldown: 0,
      active:        true,
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
      player.active = false;
      player.input  = { dx: 0, dy: 0, action: null };
    }
  }

  setInput(playerId, input) {
    const player = this.players.get(playerId);
    if (player && player.active) {
      player.input = input;
    }
  }

  /**
   * Advance the simulation one tick.
   * @returns {{ playerId, bulletId, ownerId }[]} hit events produced this tick
   */
  update(deltaTime) {
    for (const [id, player] of this.players) {
      if (player.active) {
        const { dx, dy, action } = player.input;

        // Update facing angle from movement direction
        if (dx !== 0 || dy !== 0) {
          player.angle = Math.atan2(dy, dx);
        }

        // Decrement shoot cooldown
        if (player.shootCooldown > 0) {
          player.shootCooldown = Math.max(0, player.shootCooldown - deltaTime);
        }

        // Process shoot action (server-authoritative rate limit)
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
    const hits = this.bulletSystem.update(deltaTime, this.players);
    this.tick++;
    return hits;
  }

  getState() {
    const players = [];
    for (const [id, player] of this.players) {
      const pos = player.body.getPosition();
      players.push({ id, x: pos.x, y: pos.y, angle: player.angle });
    }
    return {
      type:    'snapshot',
      tick:    this.tick,
      players,
      bullets: this.bulletSystem.getState(),
    };
  }
}

module.exports = GameRoom;
