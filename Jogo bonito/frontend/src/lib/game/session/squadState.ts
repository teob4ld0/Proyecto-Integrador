import type { ServerPlayer } from '$lib/network/wsClient';
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

function normalizeRole(character?: string | null): PlayerRole {
  const value = String(character ?? '').toLowerCase();
  if (value === 'tank' || value === 'defense') return 'Tank';
  if (value === 'support' || value === 'healer') return 'Support';
  if (value === 'special_attack') return 'Special_Attack';
  return 'DPS';
}

function roleLabel(role: PlayerRole): string {
  if (role === 'Special_Attack') return 'SP.ATK';
  return role.toUpperCase();
}

function roleIcon(role: PlayerRole): string {
  if (role === 'Tank') return '/assets/sprites/tank.png';
  if (role === 'Support') return '/assets/sprites/support.png';
  if (role === 'Special_Attack') return '/assets/sprites/spatk.png';
  return '/assets/sprites/dps.png';
}

export function createDefaultCompanionSlots(): CompanionSlot[] {
  return [
    { id: 'p2', name: 'P2 Ally', role: 'SUP', icon: '/assets/sprites/support.png', color: '#10b981', hp: 90, maxHp: 90, sp: 550, maxSp: 1000 },
    { id: 'p3', name: 'P3 Ally', role: 'TANK', icon: '/assets/sprites/tank.png', color: '#3b82f6', hp: 140, maxHp: 140, sp: 800, maxSp: 1000 },
    { id: 'p4', name: 'P4 Ally', role: 'SP.ATK', icon: '/assets/sprites/spatk.png', color: '#a855f7', hp: 100, maxHp: 100, sp: 950, maxSp: 1000 },
  ];
}

export function mergeCompanionSnapshot(slots: CompanionSlot[], players: ServerPlayer[], myPlayerId: string): CompanionSlot[] {
  const teammates = players.filter((p) => p.id !== myPlayerId).slice(0, slots.length);

  return slots.map((slot, index) => {
    const remote = teammates[index];
    if (!remote) return slot;

    const role = normalizeRole(remote.character);
    const nextMaxHp = remote.maxHp ?? slot.maxHp;
    const nextMaxSp = remote.maxSp ?? slot.maxSp;

    return {
      ...slot,
      id: remote.id || slot.id,
      name: remote.id ? `Ally ${remote.id.slice(0, 4)}` : slot.name,
      role: roleLabel(role),
      icon: roleIcon(role),
      hp: remote.hp ?? slot.hp,
      maxHp: nextMaxHp,
      sp: remote.sp ?? slot.sp,
      maxSp: nextMaxSp,
      color: remote.characterColor || slot.color,
    };
  });
}
