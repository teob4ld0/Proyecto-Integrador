'use strict';

const { getStageConfig, hasNextStage, getNextStageIndices, WORLDS_PER_DIFFICULTY, STAGES_PER_WORLD, DIFFICULTY_LABELS } = require('./stageConfigs');

const VALID_DIFFICULTIES = ['normal', 'difficult', 'no_mercy'];

function normalizeDifficulty(raw) {
  if (VALID_DIFFICULTIES.includes(raw)) return raw;
  return 'normal';
}

function clampIndex(oneBased, max) {
  const num = Number(oneBased);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(max - 1, Math.floor(num) - 1));
}

/**
 * Manages campaign progression for a game room.
 * Tracks difficulty, current world/stage, and stage clear state.
 */
class CampaignManager {
  constructor(rawDifficulty, initialWorld = 1, initialStage = 1) {
    this.difficulty = normalizeDifficulty(rawDifficulty);
    this.worldIndex = clampIndex(initialWorld, WORLDS_PER_DIFFICULTY);
    this.stageIndex = clampIndex(initialStage, STAGES_PER_WORLD);
    this.campaignComplete = false;
    this.stageState = 'intro'; // 'intro' | 'waves' | 'boss_warning' | 'boss_battle' | 'stage_clear'
  }

  setLevel(world = 1, stage = 1) {
    this.worldIndex = clampIndex(world, WORLDS_PER_DIFFICULTY);
    this.stageIndex = clampIndex(stage, STAGES_PER_WORLD);
    this.campaignComplete = false;
    this.stageState = 'intro';
  }

  getStageConfig() {
    return getStageConfig(this.difficulty, this.worldIndex, this.stageIndex);
  }

  markStageCleared() {
    this.stageState = 'stage_clear';
    this.campaignComplete = !hasNextStage(this.worldIndex, this.stageIndex);
  }

  advanceToNextStage() {
    const next = getNextStageIndices(this.worldIndex, this.stageIndex);
    if (!next) return false;
    this.worldIndex = next.worldIndex;
    this.stageIndex = next.stageIndex;
    this.campaignComplete = false;
    this.stageState = 'intro';
    return true;
  }

  hasNextStage() {
    return hasNextStage(this.worldIndex, this.stageIndex);
  }

  get bannerText() {
    return `WORLD ${this.worldIndex + 1} - STAGE ${this.stageIndex + 1}`;
  }

  get bannerSubtext() {
    const config = this.getStageConfig();
    return `${DIFFICULTY_LABELS[this.difficulty]} | ${config.worldName} ~ ${config.stageTitle}`;
  }

  get clearTitle() {
    if (this.campaignComplete) return `${this.bannerText} CLEARED! CAMPAIGN COMPLETE`;
    return `${this.bannerText} CLEARED!`;
  }

  get clearSubtext() {
    if (this.campaignComplete) {
      return `Completaste ${DIFFICULTY_LABELS[this.difficulty]} (${WORLDS_PER_DIFFICULTY} mundos x ${STAGES_PER_WORLD} stages).`;
    }
    return `Boss final derrotado en ${this.bannerText}.`;
  }

  toSnapshot() {
    return {
      difficulty: this.difficulty,
      difficultyLabel: DIFFICULTY_LABELS[this.difficulty],
      world: this.worldIndex + 1,
      stage: this.stageIndex + 1,
      stageState: this.stageState,
      campaignComplete: this.campaignComplete,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      clearTitle: this.clearTitle,
      clearSubtext: this.clearSubtext,
      worldName: this.getStageConfig().worldName,
      stageTitle: this.getStageConfig().stageTitle,
    };
  }
}

module.exports = { CampaignManager };
