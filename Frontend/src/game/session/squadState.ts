import type { ServerPlayer } from '../network/wsClient';
import type { PlayerRole } from './gameRuntimeSession';

export type CompanionSlot = {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
};

export function normalizeRole(character?: string | null): PlayerRole {
  const value = String(character ?? '').trim().toLowerCase();
  if (value === 'tank' || value === 'defense' || value === 'defence') return 'Tank';
  if (value === 'support' || value === 'healer') return 'Support';
  if (value === 'special_attack' || value === 'special' || value === 'specialattack' || value === 'spatk' || value === 'attack') {
    return 'Special_Attack';
  }
  return 'DPS';
}

export function roleLabel(role: PlayerRole): string {
  if (role === 'Special_Attack') return 'SP.ATK';
  return role.toUpperCase();
}

export function roleIcon(role: PlayerRole): string {
  if (role === 'Tank') return '/assets/sprites/defence.png';
  if (role === 'Support') return '/assets/sprites/healer.png';
  if (role === 'Special_Attack') return '/assets/sprites/specialattack.png';
  return '/assets/sprites/physicalattack.png';
}

export function roleColor(role: PlayerRole): string {
  if (role === 'Tank') return '#10b981';
  if (role === 'Support') return '#ec4899';
  if (role === 'Special_Attack') return '#a855f7';
  return '#00f2fe';
}

export function createDefaultCompanionSlots(): CompanionSlot[] {
  return [];
}

export function mergeCompanionSnapshot(
  _slots: CompanionSlot[],
  players: ServerPlayer[],
  myPlayerId: string,
  usernamesById?: Record<string, string>
): CompanionSlot[] {
  if (!Array.isArray(players)) return [];

  const teammates = players.filter((p) => p.id && p.id !== myPlayerId);

  return teammates.map((remote) => {
    const role = normalizeRole(remote.character);
    const nextMaxHp = remote.maxHp ?? 100;
    const nextMaxSp = remote.maxSp ?? 1000;
    const displayName = usernamesById?.[remote.id] || `P-${remote.id.slice(0, 4)}`;

    return {
      id: remote.id,
      name: displayName,
      role: roleLabel(role),
      icon: roleIcon(role),
      hp: typeof remote.hp === 'number' ? remote.hp : nextMaxHp,
      maxHp: nextMaxHp,
      sp: typeof remote.sp === 'number' ? remote.sp : 0,
      maxSp: nextMaxSp,
      color: remote.characterColor || roleColor(role),
    };
  });
}

