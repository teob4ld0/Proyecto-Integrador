'use strict';

const planck = require('planck');

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 200; // units per second

/**
 * Create a Planck.js world with no gravity and boundary walls.
 */
function createWorld() {
  const world = planck.World({ gravity: planck.Vec2(0, 0) });

  // Static boundary walls: top, right, bottom, left
  const wallDefs = [
    [planck.Vec2(0, 0),            planck.Vec2(WORLD_WIDTH, 0)],
    [planck.Vec2(WORLD_WIDTH, 0),  planck.Vec2(WORLD_WIDTH, WORLD_HEIGHT)],
    [planck.Vec2(WORLD_WIDTH, WORLD_HEIGHT), planck.Vec2(0, WORLD_HEIGHT)],
    [planck.Vec2(0, WORLD_HEIGHT), planck.Vec2(0, 0)],
  ];

  for (const [p1, p2] of wallDefs) {
    const wall = world.createBody({ type: 'static' });
    wall.createFixture(planck.Edge(p1, p2), { friction: 0, restitution: 1 });
  }

  return world;
}

/**
 * Add a dynamic circular body for a player at the given spawn position.
 * @returns {planck.Body}
 */
function addPlayerBody(world, x, y) {
  const body = world.createBody({
    type: 'dynamic',
    position: planck.Vec2(x, y),
    fixedRotation: true,
    linearDamping: 0,
    bullet: true,
  });
  body.createFixture(planck.Circle(PLAYER_RADIUS), {
    density: 1.0,
    friction: 0,
    restitution: 0,
  });
  return body;
}

/**
 * Apply normalised directional input to a player body.
 * @param {planck.Body} body
 * @param {{ dx: number, dy: number }} input - components in [-1, 1]
 */
function applyInput(body, input) {
  const { dx = 0, dy = 0 } = input;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    body.setLinearVelocity(planck.Vec2(
      (dx / len) * PLAYER_SPEED,
      (dy / len) * PLAYER_SPEED,
    ));
  } else {
    body.setLinearVelocity(planck.Vec2(0, 0));
  }
}

module.exports = { createWorld, addPlayerBody, applyInput, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS };
