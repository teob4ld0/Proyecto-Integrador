'use strict';

/**
 * Stage configurations for the campaign.
 * Structure: difficulty → world → stage (3×3×3 = 27 stages)
 *
 * Currently all 27 levels share the unified Test Level combat script
 * (immediate Wave 1 at 0.4s + full 5-wave sequence + 5-phase Boss + Beam Struggle)
 * so every selectable level starts with immediate action and zero empty downtime.
 */

const TEST_WAVE_PATTERN = [1, 2, 3, 4, 5];
const WAVE_SCHEDULE_DEFAULT = [0.4, 6.5, 13.0, 20.0, 27.0];

function stageConfig(difficulty, world, stage, worldName, stageTitle, wavePattern = TEST_WAVE_PATTERN, opts = {}) {
  return {
    difficulty,
    world,
    stage,
    worldName,
    stageTitle,
    wavePattern,
    waveScheduleSeconds: opts.waveScheduleSeconds || WAVE_SCHEDULE_DEFAULT,
    bossWarningAt: opts.bossWarningAt ?? 33.5,
    bossSpawnAt: opts.bossSpawnAt ?? 36.5,
  };
}

// ── NORMAL ──────────────────────────────────────────────────────────────────────
const NORMAL_CONFIGS = [
  // World 1: Moonlit Forest
  stageConfig('normal', 1, 1, 'Moonlit Forest', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('normal', 1, 2, 'Moonlit Forest', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('normal', 1, 3, 'Moonlit Forest', 'Final Spell Duel', TEST_WAVE_PATTERN),
  // World 2: Scarlet Riverside
  stageConfig('normal', 2, 1, 'Scarlet Riverside', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('normal', 2, 2, 'Scarlet Riverside', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('normal', 2, 3, 'Scarlet Riverside', 'Final Spell Duel', TEST_WAVE_PATTERN),
  // World 3: Celestial Observatory
  stageConfig('normal', 3, 1, 'Celestial Observatory', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('normal', 3, 2, 'Celestial Observatory', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('normal', 3, 3, 'Celestial Observatory', 'Final Spell Duel', TEST_WAVE_PATTERN),
];

// ── DIFFICULT ───────────────────────────────────────────────────────────────────
const DIFFICULT_CONFIGS = [
  stageConfig('difficult', 1, 1, 'Infernal Peaks', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('difficult', 1, 2, 'Infernal Peaks', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('difficult', 1, 3, 'Infernal Peaks', 'Final Spell Duel', TEST_WAVE_PATTERN),
  stageConfig('difficult', 2, 1, 'Abyssal Depths', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('difficult', 2, 2, 'Abyssal Depths', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('difficult', 2, 3, 'Abyssal Depths', 'Final Spell Duel', TEST_WAVE_PATTERN),
  stageConfig('difficult', 3, 1, 'Storm Citadel', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('difficult', 3, 2, 'Storm Citadel', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('difficult', 3, 3, 'Storm Citadel', 'Final Spell Duel', TEST_WAVE_PATTERN),
];

// ── NO MERCY ────────────────────────────────────────────────────────────────────
const NO_MERCY_CONFIGS = [
  stageConfig('no_mercy', 1, 1, 'Void Sanctum', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 1, 2, 'Void Sanctum', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 1, 3, 'Void Sanctum', 'Final Spell Duel', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 2, 1, 'Shattered Realm', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 2, 2, 'Shattered Realm', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 2, 3, 'Shattered Realm', 'Final Spell Duel', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 3, 1, 'Oblivion Edge', 'Danmaku Vanguard', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 3, 2, 'Oblivion Edge', 'Crimson Crossfire', TEST_WAVE_PATTERN),
  stageConfig('no_mercy', 3, 3, 'Oblivion Edge', 'Final Spell Duel', TEST_WAVE_PATTERN),
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
  return CONFIG_MAP.get(key) || CONFIG_MAP.get('no_mercy-3-3') || CONFIG_MAP.get('normal-1-1');
}

function hasNextStage(worldIndex, stageIndex, difficulty = 'normal') {
  if (!DIFFICULTY_LABELS[difficulty]) return false;
  return !(worldIndex === WORLDS_PER_DIFFICULTY - 1 && stageIndex === STAGES_PER_WORLD - 1);
}

function getNextStageIndices(worldIndex, stageIndex, difficulty = 'normal') {
  if (!hasNextStage(worldIndex, stageIndex, difficulty)) return null;
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
