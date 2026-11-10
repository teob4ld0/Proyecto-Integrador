'use strict';

const COUNTDOWN_MS = 100;
const LOADING_TIMEOUT_MS = 1_500;
const READY_TIMEOUT_MS = 15_000;

class RoomPhaseController {
  constructor(options = {}) {
    /** @type {'loading'|'ready'|'countdown'|'playing'} */
    this.phase = options.initialPhase || 'loading';
    this.countdownMs = 0;
    this.expectedPlayerCount = options.expectedPlayerCount || 1;
    this._readyDeadlineMs = null;
    this._loadingDeadlineMs = Date.now() + LOADING_TIMEOUT_MS;
  }

  setExpectedPlayerCount(count) {
    if (typeof count === 'number' && count > 0) {
      this.expectedPlayerCount = count;
    }
  }

  setPlayerLoaded(playerId, players) {
    const player = players.get(playerId);
    if (!player) return null;
    player.isLoaded = true;
    player.isReady = true;

    if (this.phase !== 'loading' && this.phase !== 'ready') return null;

    const activePlayers = [...players.values()].filter((p) => p.active);
    const hasEnoughPlayers = activePlayers.length >= this.expectedPlayerCount;
    const allLoaded = activePlayers.length > 0 && activePlayers.every((p) => p.isLoaded);

    if (hasEnoughPlayers && allLoaded) {
      this._beginCountdown();
      return 'countdown';
    }

    return null;
  }

  startReadyCheck(requesterId, hostId) {
    if (requesterId !== hostId) return false;
    if (this.phase !== 'lobby' && this.phase !== 'loading') return false;
    this.phase = 'ready';
    this._readyDeadlineMs = Date.now() + READY_TIMEOUT_MS;
    return true;
  }

  setPlayerReady(playerId, players) {
    return this.setPlayerLoaded(playerId, players);
  }

  cancelToLobby(players) {
    this.phase = 'loading';
    this.countdownMs = 0;
    this._readyDeadlineMs = null;
    this._loadingDeadlineMs = Date.now() + LOADING_TIMEOUT_MS;
    for (const p of players.values()) {
      p.isReady = false;
      p.isLoaded = false;
    }
  }

  tick(deltaTime) {
    let phaseChanged = null;

    if (this.phase === 'loading') {
      if (this._loadingDeadlineMs !== null && Date.now() >= this._loadingDeadlineMs) {
        this._beginCountdown();
        phaseChanged = 'countdown';
      }
    } else if (this.phase === 'ready') {
      if (this._readyDeadlineMs !== null && Date.now() >= this._readyDeadlineMs) {
        this._beginCountdown();
        phaseChanged = 'countdown';
      }
    } else if (this.phase === 'countdown') {
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
    this._loadingDeadlineMs = null;
  }
}

module.exports = { RoomPhaseController };
