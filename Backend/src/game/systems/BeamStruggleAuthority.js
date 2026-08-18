'use strict';

const STRUGGLE_ALIGN_DURATION = 0.45;
const STRUGGLE_MAX_TIMER = 3.5;
const STRUGGLE_BOSS_PRESSURE_PER_SEC = 22;
const STRUGGLE_PLAYER_PUSH_PER_SEC = 30;

class BeamStruggleAuthority {
  constructor() {
    this.state = this._createInitialState();
  }

  _createInitialState() {
    return {
      active: false,
      isAligning: false,
      winner: null,
      timer: STRUGGLE_MAX_TIMER,
      maxTimer: STRUGGLE_MAX_TIMER,
      balance: 50,
      resolutionTimer: 0,
      clashX: 400,
      clashY: 300,
      playerTipX: 130,
      bossTipX: 670,
      vortexX: 400,
      vortexY: 300,
      playerId: null,
      playerLaserId: null,
      bossLaserId: null,
      alignProgress: 0,
    };
  }

  isSuppressingLaserDamage() {
    return this.state.active || this.state.isAligning;
  }

  toSnapshot() {
    return {
      active: this.state.active,
      isAligning: this.state.isAligning,
      winner: this.state.winner,
      timer: Number(this.state.timer.toFixed(3)),
      maxTimer: this.state.maxTimer,
      balance: Number(this.state.balance.toFixed(2)),
      resolutionTimer: Number(this.state.resolutionTimer.toFixed(3)),
      clashX: Number(this.state.clashX.toFixed(2)),
      clashY: Number(this.state.clashY.toFixed(2)),
      playerTipX: Number(this.state.playerTipX.toFixed(2)),
      bossTipX: Number(this.state.bossTipX.toFixed(2)),
      vortexX: Number(this.state.vortexX.toFixed(2)),
      vortexY: Number(this.state.vortexY.toFixed(2)),
    };
  }

  reset() {
    const nextState = this._createInitialState();
    Object.assign(this.state, nextState);
  }

  update(dt, context) {
    const struggle = this.state;
    const { lasers, players, onPlayerWin, onBossWin } = context;

    if (struggle.resolutionTimer > 0) {
      struggle.resolutionTimer = Math.max(0, struggle.resolutionTimer - dt);
      if (struggle.resolutionTimer === 0) this.reset();
      return;
    }

    if (!struggle.active && !struggle.isAligning) {
      const playerLaser = lasers.find((l) => l.ownerId !== 'boss' && (l.state === 'charging' || l.state === 'firing'));
      const bossLaser = lasers.find((l) => l.ownerId === 'boss' && (l.state === 'charging' || l.state === 'firing'));

      if (!playerLaser || !bossLaser) return;
      if ((playerLaser.direction || 'right') !== 'right') return;
      if ((bossLaser.direction || 'left') !== 'left') return;

      const ownerId = playerLaser.ownerId;
      const ownerPlayer = ownerId ? players.get(ownerId) : null;
      if (!ownerPlayer || !ownerPlayer.active || ownerPlayer.hp <= 0) return;

      const yDelta = Math.abs(playerLaser.sourceY - bossLaser.sourceY);
      if (yDelta > 40) return;

      if (playerLaser.sourceX >= bossLaser.sourceX + 140) return;

      struggle.isAligning = true;
      struggle.active = false;
      struggle.winner = null;
      struggle.alignProgress = 0;
      struggle.playerId = ownerId;
      struggle.playerLaserId = playerLaser.id;
      struggle.bossLaserId = bossLaser.id;
      struggle.balance = 50;
      struggle.timer = STRUGGLE_MAX_TIMER;
      struggle.maxTimer = STRUGGLE_MAX_TIMER;

      const midX = (playerLaser.sourceX + bossLaser.sourceX) * 0.5;
      const midY = (playerLaser.sourceY + bossLaser.sourceY) * 0.5;
      struggle.clashX = midX;
      struggle.clashY = midY;
      struggle.vortexX = midX;
      struggle.vortexY = midY;
      struggle.playerTipX = playerLaser.sourceX + 22;
      struggle.bossTipX = bossLaser.sourceX;

      playerLaser.state = 'firing';
      playerLaser.timer = 0;
      playerLaser.maxWidth = Math.max(playerLaser.maxWidth, 96);
      playerLaser.color = 0x00f2fe;

      bossLaser.state = 'firing';
      bossLaser.timer = 0;
      bossLaser.maxWidth = Math.max(bossLaser.maxWidth, 96);
      bossLaser.color = 0xffdd00;
      return;
    }

    if (struggle.isAligning) {
      struggle.alignProgress = Math.min(1, struggle.alignProgress + (dt / STRUGGLE_ALIGN_DURATION));
      const ease = 1 - Math.pow(1 - struggle.alignProgress, 3);

      const playerLaser = lasers.find((l) => l.id === struggle.playerLaserId);
      const bossLaser = lasers.find((l) => l.id === struggle.bossLaserId);
      if (!playerLaser || !bossLaser) {
        this.reset();
        return;
      }

      const dynamicClashX = 150 + (struggle.balance / 100) * 500;
      struggle.clashX = dynamicClashX;
      struggle.clashY = (playerLaser.sourceY + bossLaser.sourceY) * 0.5;
      struggle.playerTipX = (playerLaser.sourceX + 22) + (dynamicClashX - (playerLaser.sourceX + 22)) * ease;
      struggle.bossTipX = bossLaser.sourceX + (dynamicClashX - bossLaser.sourceX) * ease;
      struggle.vortexX = (struggle.playerTipX + struggle.bossTipX) * 0.5;
      struggle.vortexY = struggle.clashY;

      if (struggle.alignProgress >= 1) {
        struggle.isAligning = false;
        struggle.active = true;
      }
      return;
    }

    if (!struggle.active) return;

    const playerLaser = lasers.find((l) => l.id === struggle.playerLaserId);
    const bossLaser = lasers.find((l) => l.id === struggle.bossLaserId);
    const strugglePlayer = struggle.playerId ? players.get(struggle.playerId) : null;

    if (!playerLaser || !bossLaser || !strugglePlayer || !strugglePlayer.active || strugglePlayer.hp <= 0) {
      this.reset();
      return;
    }

    struggle.timer = Math.max(0, struggle.timer - dt);
    struggle.balance -= STRUGGLE_BOSS_PRESSURE_PER_SEC * dt;
    if (strugglePlayer.input.action === 'shoot' || strugglePlayer.input.action === 'struggle_push') {
      struggle.balance += STRUGGLE_PLAYER_PUSH_PER_SEC * dt;
    }

    struggle.balance = Math.max(0, Math.min(100, struggle.balance));

    struggle.clashX = 150 + (struggle.balance / 100) * 500;
    struggle.clashY = (playerLaser.sourceY + bossLaser.sourceY) * 0.5;
    struggle.playerTipX = struggle.clashX;
    struggle.bossTipX = struggle.clashX;
    struggle.vortexX = struggle.clashX;
    struggle.vortexY = struggle.clashY;

    if (struggle.balance >= 100) {
      struggle.winner = 'player';
    } else if (struggle.balance <= 0 || struggle.timer <= 0) {
      struggle.winner = 'boss';
    }

    if (!struggle.winner) return;

    struggle.active = false;
    struggle.resolutionTimer = 0.75;

    if (struggle.winner === 'player') {
      onPlayerWin();
    } else {
      onBossWin();
    }
  }
}

module.exports = { BeamStruggleAuthority };
