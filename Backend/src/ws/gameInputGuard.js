'use strict';

const ALLOWED_ACTIONS = new Set(['shoot', 'special', 'wall', 'laser', 'struggle_push']);

const MAX_ACTION_RATE = {
  shoot: 60,
  special: 10,
  wall: 10,
  laser: 10,
  struggle_push: 60,
};

const MAX_SEQUENCE_JUMP = 500;
const MAX_INPUT_RATE_PER_SECOND = 300;
const MAX_CLIENT_CLOCK_SKEW_MS = 60000;

class RoomInputGuard {
  constructor(roomId) {
    this.roomId = roomId;
    this.playerState = new Map();
  }

  registerPlayer(playerId) {
    if (this.playerState.has(playerId)) return;
    this.playerState.set(playerId, {
      lastInputAt: 0,
      recentInputTimes: [],
      lastActionAt: {
        shoot: 0,
        special: 0,
        wall: 0,
        laser: 0,
        struggle_push: 0,
      },
      lastSequence: -1,
      lastClientTs: 0,
      violations: 0,
    });
  }

  unregisterPlayer(playerId) {
    this.playerState.delete(playerId);
  }

  validateAndSanitize(playerId, rawInput) {
    this.registerPlayer(playerId);
    const state = this.playerState.get(playerId);
    const now = Date.now();

    const vector = this._sanitizeVector(rawInput?.dx, rawInput?.dy);
    const dx = vector.dx;
    const dy = vector.dy;

    let action = null;
    if (typeof rawInput?.action === 'string' && ALLOWED_ACTIONS.has(rawInput.action)) {
      action = rawInput.action;
    }

    const seq = Number.isInteger(rawInput?.seq) ? Number(rawInput.seq) : null;
    if (seq !== null) {
      if (state.lastSequence >= 0 && seq <= state.lastSequence) {
        state.violations++;
        return this._reject('stale-sequence', state);
      }
      if (state.lastSequence >= 0 && seq - state.lastSequence > MAX_SEQUENCE_JUMP) {
        state.violations++;
        return this._reject('sequence-jump', state);
      }
      state.lastSequence = seq;
    }

    const clientTs = Number.isFinite(rawInput?.clientTs) ? Number(rawInput.clientTs) : null;
    if (clientTs !== null) {
      const skew = Math.abs(now - clientTs);
      if (skew > MAX_CLIENT_CLOCK_SKEW_MS) {
        state.violations++;
        return this._reject('clock-skew', state);
      }
      if (state.lastClientTs > 0 && clientTs < state.lastClientTs) {
        state.violations++;
        return this._reject('stale-client-ts', state);
      }
      state.lastClientTs = clientTs;
    }

    if (!this._withinInputRateLimit(state, now)) {
      state.violations++;
      return this._reject('input-rate-limit', state);
    }

    if (action) {
      const maxRate = MAX_ACTION_RATE[action] || 10;
      const minIntervalMs = Math.floor(1000 / maxRate);
      const elapsed = now - state.lastActionAt[action];
      if (state.lastActionAt[action] > 0 && elapsed < minIntervalMs) {
        state.violations++;
        return this._reject('action-rate-limit', state);
      }
      state.lastActionAt[action] = now;
    }

    state.lastInputAt = now;

    return {
      accepted: true,
      input: { dx, dy, action },
      meta: {
        suspicious: state.violations > 0,
        violations: state.violations,
      },
    };
  }

  _reject(reason, state) {
    return {
      accepted: false,
      reason,
      meta: {
        suspicious: true,
        violations: state.violations,
      },
    };
  }

  _sanitizeVector(rawDx, rawDy) {
    const dx = Number.isFinite(rawDx) ? Math.max(-1, Math.min(1, Number(rawDx))) : 0;
    const dy = Number.isFinite(rawDy) ? Math.max(-1, Math.min(1, Number(rawDy))) : 0;
    const mag = Math.hypot(dx, dy);
    if (mag <= 1 || mag === 0) {
      return { dx, dy };
    }
    return {
      dx: Number((dx / mag).toFixed(4)),
      dy: Number((dy / mag).toFixed(4)),
    };
  }

  _withinInputRateLimit(state, now) {
    const windowStart = now - 1000;
    state.recentInputTimes = state.recentInputTimes.filter((t) => t >= windowStart);
    state.recentInputTimes.push(now);
    return state.recentInputTimes.length <= MAX_INPUT_RATE_PER_SECOND;
  }
}

module.exports = {
  RoomInputGuard,
};
