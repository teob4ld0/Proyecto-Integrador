import type { RemotePlayer } from '../types';
import type { ServerBoss, ServerBeamStruggle, ServerCampaign } from '../../network/wsClient';
import { Boss } from '../entities/Boss';
import { Player } from '../entities/Player';

export type ServerCombatState = {
  hp?: number;
  maxHp?: number;
  sp?: number;
  maxSp?: number;
  defensePercent?: number;
};

export class NetworkSyncController {
  private combatState: ServerCombatState | null = null;
  private struggleState: ServerBeamStruggle | null = null;
  public campaignState: ServerCampaign | null = null;

  public applySnapshot(players: RemotePlayer[], myPlayerId: string, player: Player): void {
    const me = players.find((p) => p.id === myPlayerId) as (RemotePlayer & ServerCombatState) | undefined;
    if (!me) return;

    this.combatState = {
      hp: me.hp,
      maxHp: me.maxHp,
      sp: me.sp,
      maxSp: me.maxSp,
      defensePercent: me.defensePercent,
    };

    if (me.hp !== undefined) player.hp = me.hp;
    if (me.sp !== undefined) player.sp = me.sp;
  }

  public applyBossSnapshot(boss: ServerBoss, bossEntity: Boss, scaleX: number, scaleY: number): void {
    if (!boss) return;
    if (boss.isActive && !bossEntity.isActive) {
      bossEntity.spawn(boss.x * scaleX, boss.y * scaleY);
    }
    bossEntity.setPosition(boss.x * scaleX, boss.y * scaleY);
    bossEntity.hp = boss.hp;
    bossEntity.maxHp = boss.maxHp;
    if (boss.phase !== undefined) bossEntity.phase = boss.phase as any;
    if (boss.remainingStocks !== undefined) bossEntity.remainingStocks = boss.remainingStocks;
    if (boss.spellcardName !== undefined) bossEntity.spellcardName = boss.spellcardName;
    if (boss.isSpellCard !== undefined) bossEntity.isSpellCard = boss.isSpellCard;
    if (boss.isDefeated !== undefined) bossEntity.isDefeated = boss.isDefeated;
    if (boss.isRefilling !== undefined) bossEntity.isRefilling = boss.isRefilling;
    if (boss.isLockedForBeam !== undefined) bossEntity.isLockedForBeam = boss.isLockedForBeam;
  }

  public applyCampaignSnapshot(campaign: ServerCampaign): void {
    this.campaignState = campaign;
  }

  public applyStruggleSnapshot(struggle?: ServerBeamStruggle): void {
    this.struggleState = struggle ?? null;
  }

  public resolveCombat<T>(isBackendConnected: boolean, fallback: T, pick: (state: ServerCombatState) => T | undefined): T {
    if (!isBackendConnected || !this.combatState) return fallback;
    const val = pick(this.combatState);
    return val === undefined ? fallback : val;
  }

  public resolveStruggle<T>(isAuthoritativeBackend: boolean, fallback: T, pick: (state: ServerBeamStruggle) => T | undefined): T {
    if (!isAuthoritativeBackend || !this.struggleState) return fallback;
    const val = pick(this.struggleState);
    return val === undefined ? fallback : val;
  }

  public getStruggleState(): ServerBeamStruggle | null {
    return this.struggleState;
  }
}

