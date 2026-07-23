'use strict';

const { createWorld, addPlayerBody, applyInput } = require('./physics');

const SPAWN_POSITIONS = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 100, y: 500 },
  { x: 700, y: 500 },
];

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    /** @type {Map<string, { body: import('planck-js').Body, input: { dx: number, dy: number, action: null|string }, angle: number, active: boolean }>} */
    this.players = new Map();
    this.bullets = [];
    this.world = createWorld();
    this.tick = 0;
  }

  addPlayer(playerId) {
    if (this.players.has(playerId)) {
      // Reconnect – just mark active again
      this.players.get(playerId).active = true;
      return;
    }
    const spawn = SPAWN_POSITIONS[this.players.size % SPAWN_POSITIONS.length];
    const body = addPlayerBody(this.world, spawn.x, spawn.y);
    this.players.set(playerId, {
      body,
      input: { dx: 0, dy: 0, action: null },
      angle: 0,
      active: true,
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
      player.input = { dx: 0, dy: 0, action: null };
    }
  }

  setInput(playerId, input) {
    const player = this.players.get(playerId);
    if (player && player.active) {
      player.input = input;
    }
  }

  update(deltaTime) {
    for (const [, player] of this.players) {
      if (player.active) {
        applyInput(player.body, player.input);
      } else {
        // Stop inactive players in place
        player.body.setLinearVelocity({ x: 0, y: 0 });
      }
    }
    this.world.step(deltaTime);
    this.tick++;
  }

  getState() {
    const players = [];
    for (const [id, player] of this.players) {
      const pos = player.body.getPosition();
      players.push({ id, x: pos.x, y: pos.y, angle: player.angle });
    }
    return {
      type: 'snapshot',
      tick: this.tick,
      players,
      bullets: this.bullets,
    };
  }
}

module.exports = GameRoom;
