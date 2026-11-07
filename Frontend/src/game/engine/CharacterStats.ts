import type { CharacterClass } from './types';

export interface CharacterCombatStats {
  spMax: number;
  hpMax: number;
  bulletDamage: number;
  shotsPerSecond: number;
  bombDamage: number;
  spChargePerHit: number;
  defensePercent: number;
}

const DPS_PLACEHOLDER_STATS: CharacterCombatStats = {
  spMax: 1000,
  hpMax: 100,
  bulletDamage: 5,
  shotsPerSecond: 5,
  bombDamage: 750,
  spChargePerHit: 10,
  defensePercent: 50,
};

const CHARACTER_STATS: Record<string, CharacterCombatStats> = {
  dps: DPS_PLACEHOLDER_STATS,
  physical: DPS_PLACEHOLDER_STATS,
  special_attack: DPS_PLACEHOLDER_STATS,
  attack: DPS_PLACEHOLDER_STATS,
  tank: { ...DPS_PLACEHOLDER_STATS, hpMax: 140, defensePercent: 65, shotsPerSecond: 3, bulletDamage: 4, bombDamage: 500, spChargePerHit: 8 },
  defense: { ...DPS_PLACEHOLDER_STATS, hpMax: 140, defensePercent: 65, shotsPerSecond: 3, bulletDamage: 4, bombDamage: 500, spChargePerHit: 8 },
  support: { ...DPS_PLACEHOLDER_STATS, hpMax: 90, defensePercent: 40, shotsPerSecond: 4, bulletDamage: 4, bombDamage: 600, spChargePerHit: 12 },
  healer: { ...DPS_PLACEHOLDER_STATS, hpMax: 90, defensePercent: 40, shotsPerSecond: 4, bulletDamage: 4, bombDamage: 600, spChargePerHit: 12 },
};

export function getCharacterStats(classId: CharacterClass): CharacterCombatStats {
  const key = String(classId || '').toLowerCase();
  return CHARACTER_STATS[key] ?? DPS_PLACEHOLDER_STATS;
}
