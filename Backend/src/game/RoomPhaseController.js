'use strict';

const COUNTDOWN_MS = 5_000;
const READY_TIMEOUT_MS = 30_000;

class RoomPhaseController {
  constructor() {
    this.phase = 'lobby';
    this.countdownMs = 0;
    this._readyDeadlineMs = null;
  }

  startReadyCheck(requesterId, hostId) {
    if (requesterId !== hostId) return false;
    if (this.phase !== 'lobby') return false;
    this.phase = 'ready';
    this._readyDeadlineMs = Date.now() + READY_TIMEOUT_MS;
    return true;
  }

  setPlayerReady(playerId, players) {
    const player = players.get(playerId);
    if (!player || this.phase !== 'ready') return null;
    player.isReady = true;

    const allReady = [...players.values()].every((p) => !p.active || p.isReady);
    if (!allReady) return null;

    this._beginCountdown();
    return 'countdown';
  }

  cancelToLobby(players) {
    this.phase = 'lobby';
    this.countdownMs = 0;
    this._readyDeadlineMs = null;
    for (const p of players.values()) p.isReady = false;
  }

  tick(deltaTime) {
    let phaseChanged = null;

    if (this.phase === 'ready' && this._readyDeadlineMs !== null && Date.now() >= this._readyDeadlineMs) {
      this._beginCountdown();
      phaseChanged = 'countdown';
    }

    if (this.phase === 'countdown') {
      this.countdownMs -= deltaTime * 1000;
      if (this.countdownMs <= 0) {
        this.countdownMs = 0;
        this.phase = 'playing';
        phaseChanged = 'playing';
      }
    }

    return phaseChanged;
  }

  _beginCountdown() {
    this.phase = 'countdown';
    this.countdownMs = COUNTDOWN_MS;
    this._readyDeadlineMs = null;
  }
}

module.exports = { RoomPhaseController };
