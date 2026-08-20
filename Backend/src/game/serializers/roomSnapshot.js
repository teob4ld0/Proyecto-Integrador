'use strict';

function serializePlayers(players, fallbackStats) {
  const result = [];
  for (const [id, player] of players) {
    const pos = player.body.getPosition();
    const stats = player.stats || fallbackStats;
    result.push({
      id,
      x: pos.x,
      y: pos.y,
      angle: player.angle,
      isReady: player.isReady,
      character: player.character,
      hp: Number(player.hp.toFixed(2)),
      sp: Number(player.sp.toFixed(2)),
      maxHp: stats.hpMax,
      maxSp: stats.spMax,
      defensePercent: stats.defensePercent,
    });
  }
  return result;
}

function buildRoomSnapshot(room, options) {
  const { fallbackStats } = options;
  return {
    type: 'snapshot',
    tick: room.tick,
    phase: room.phase,
    countdownMs: room.phase === 'countdown' ? Math.max(0, room._countdownMs) : undefined,
    stageTime: room.stageTime,
    players: serializePlayers(room.players, fallbackStats),
    bullets: room.bulletSystem.getState(),
    lasers: room.laserSystem.getState(),
    walls: room.wallSystem.getState(),
    enemies: room.enemySystem.getState(),
    items: room.itemSystem.getState(),
    boss: room.boss.toSnapshot(),
    campaign: room.campaign.toSnapshot(),
    struggle: room._beamStruggleController.toSnapshot(),
  };
}

module.exports = {
  buildRoomSnapshot,
};
