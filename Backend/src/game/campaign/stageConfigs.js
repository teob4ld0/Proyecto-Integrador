'use strict';

/**
 * Stage configurations for the campaign.
 * Structure: difficulty → world → stage (3×3×3 = 27 stages)
 * 
 * Each config defines wave patterns, timing, boss spawn, and metadata.
 */

const WAVE_SCHEDULE_DEFAULT = [3.0, 8.5, 16.0, 27.0, 36.0];

function stageConfig(difficulty, world, stage, worldName, stageTitle, wavePattern, opts = {}) {
  return {
    difficulty,
    world,
    stage,
    worldName,
    stageTitle,
    wavePattern,
    waveScheduleSeconds: opts.waveScheduleSeconds || WAVE_SCHEDULE_DEFAULT,
    bossWarningAt: opts.bossWarningAt || 45.0,
    bossSpawnAt: opts.bossSpawnAt || 48.5,
  };
}

// ── NORMAL ──────────────────────────────────────────────────────────────────────
const NORMAL_CONFIGS = [
  // World 1: Moonlit Forest
  stageConfig('normal', 1, 1, 'Moonlit Forest', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('normal', 1, 2, 'Moonlit Forest', 'Crimson Crossfire', [2, 3, 4, 5, 1]),
  stageConfig('normal', 1, 3, 'Moonlit Forest', 'Final Spell Duel', [3, 4, 5, 1, 2]),
  // World 2: Scarlet Riverside
  stageConfig('normal', 2, 1, 'Scarlet Riverside', 'Danmaku Vanguard', [2, 1, 4, 3, 5]),
  stageConfig('normal', 2, 2, 'Scarlet Riverside', 'Crimson Crossfire', [4, 2, 5, 1, 3]),
  stageConfig('normal', 2, 3, 'Scarlet Riverside', 'Final Spell Duel', [5, 4, 3, 2, 1]),
  // World 3: Celestial Observatory
  stageConfig('normal', 3, 1, 'Celestial Observatory', 'Danmaku Vanguard', [3, 1, 5, 2, 4]),
  stageConfig('normal', 3, 2, 'Celestial Observatory', 'Crimson Crossfire', [4, 5, 2, 1, 3]),
  stageConfig('normal', 3, 3, 'Celestial Observatory', 'Final Spell Duel', [5, 3, 4, 2, 1]),
];

// ── DIFFICULT ───────────────────────────────────────────────────────────────────
const DIFFICULT_CONFIGS = [
  stageConfig('difficult', 1, 1, 'Infernal Peaks', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 1, 2, 'Infernal Peaks', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 1, 3, 'Infernal Peaks', 'Final Spell Duel', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 2, 1, 'Abyssal Depths', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 2, 2, 'Abyssal Depths', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 2, 3, 'Abyssal Depths', 'Final Spell Duel', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 3, 1, 'Storm Citadel', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 3, 2, 'Storm Citadel', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('difficult', 3, 3, 'Storm Citadel', 'Final Spell Duel', [1, 2, 3, 4, 5]),
];

// ── NO MERCY ────────────────────────────────────────────────────────────────────
const NO_MERCY_CONFIGS = [
  stageConfig('no_mercy', 1, 1, 'Void Sanctum', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 1, 2, 'Void Sanctum', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 1, 3, 'Void Sanctum', 'Final Spell Duel', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 2, 1, 'Shattered Realm', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 2, 2, 'Shattered Realm', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 2, 3, 'Shattered Realm', 'Final Spell Duel', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 3, 1, 'Oblivion Edge', 'Danmaku Vanguard', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 3, 2, 'Oblivion Edge', 'Crimson Crossfire', [1, 2, 3, 4, 5]),
  stageConfig('no_mercy', 3, 3, 'Oblivion Edge', 'Final Spell Duel', [1, 2, 3, 4, 5]),
];

// Build lookup: key = "difficulty-world-stage"
const ALL_CONFIGS = [...NORMAL_CONFIGS, ...DIFFICULT_CONFIGS, ...NO_MERCY_CONFIGS];
const CONFIG_MAP = new Map();
for (const cfg of ALL_CONFIGS) {
  CONFIG_MAP.set(`${cfg.difficulty}-${cfg.world}-${cfg.stage}`, cfg);
}

const WORLDS_PER_DIFFICULTY = 3;
const STAGES_PER_WORLD = 3;

const DIFFICULTY_LABELS = {
  normal: 'Normal',
  difficult: 'Dificil',
  no_mercy: 'NoMercy',
};

function getStageConfig(difficulty, worldIndex, stageIndex) {
  const key = `${difficulty}-${worldIndex + 1}-${stageIndex + 1}`;
  return CONFIG_MAP.get(key) || CONFIG_MAP.get('normal-1-1');
}

function hasNextStage(worldIndex, stageIndex) {
  return !(worldIndex === WORLDS_PER_DIFFICULTY - 1 && stageIndex === STAGES_PER_WORLD - 1);
}

function getNextStageIndices(worldIndex, stageIndex) {
  if (!hasNextStage(worldIndex, stageIndex)) return null;
  if (stageIndex < STAGES_PER_WORLD - 1) {
    return { worldIndex, stageIndex: stageIndex + 1 };
  }
  return { worldIndex: worldIndex + 1, stageIndex: 0 };
}

module.exports = {
  getStageConfig,
  hasNextStage,
  getNextStageIndices,
  WORLDS_PER_DIFFICULTY,
  STAGES_PER_WORLD,
  DIFFICULTY_LABELS,
};
