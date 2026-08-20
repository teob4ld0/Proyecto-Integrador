'use strict';

/**
 * Timeline manager for stage events.
 * Fires events (spawn_wave, boss_warning, spawn_boss, stage_banner) at scheduled times.
 * Ported from frontend TimelineManager.ts — now authoritative on the backend.
 */
class TimelineManager {
  constructor() {
    /** @type {{ time: number, action: string, payload: any, executed: boolean }[]} */
    this.events = [];
    this.currentTime = 0;
    this.isPaused = false;
    /** @type {Map<string, function>} */
    this._handlers = new Map();
  }

  /**
   * Load a stage script (array of timed events).
   * @param {{ time: number, action: string, payload?: any }[]} events
   */
  loadScript(events) {
    this.events = events
      .map(e => ({ ...e, executed: false }))
      .sort((a, b) => a.time - b.time);
    this.currentTime = 0;
    this.isPaused = false;
  }

  /**
   * Build and load timeline events from a stage config.
   */
  loadFromStageConfig(config, bannerText, bannerSubtext) {
    const waveEvents = config.wavePattern.map((wave, idx) => ({
      time: config.waveScheduleSeconds[idx] || (3 + idx * 7),
      action: 'spawn_wave',
      payload: { wave },
    }));

    this.loadScript([
      {
        time: 0.5,
        action: 'stage_banner',
        payload: { text: bannerText, subtext: bannerSubtext },
      },
      ...waveEvents,
      {
        time: config.bossWarningAt,
        action: 'boss_warning',
        payload: {},
      },
      {
        time: config.bossSpawnAt,
        action: 'spawn_boss',
        payload: {},
      },
    ]);
  }

  /**
   * Register an event handler.
   * @param {string} action
   * @param {function} handler
   */
  on(action, handler) {
    this._handlers.set(action, handler);
    return this;
  }

  /**
   * Advance the timeline by dt seconds.
   * Fires any events whose time has been reached.
   */
  update(dt) {
    if (this.isPaused) return;

    this.currentTime += dt;

    for (const ev of this.events) {
      if (!ev.executed && this.currentTime >= ev.time) {
        ev.executed = true;
        const handler = this._handlers.get(ev.action);
        if (handler) handler(ev.payload);
      }
    }
  }

  reset() {
    this.currentTime = 0;
    for (const ev of this.events) {
      ev.executed = false;
    }
  }

  get isFinished() {
    return this.events.every(e => e.executed);
  }
}

module.exports = { TimelineManager };
