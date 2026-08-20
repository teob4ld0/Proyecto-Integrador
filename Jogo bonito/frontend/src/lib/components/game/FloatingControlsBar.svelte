<script lang="ts">
  type PlayerRole = 'Tank' | 'Support' | 'DPS' | 'Special_Attack';

  let {
    selectedClass,
    isFullscreen,
    onSelectRole,
    onTriggerSkill,
    onSpawnBoss,
    onStartStruggle,
    onToggleFullscreen,
    showDebugActions = true,
  } = $props<{
    selectedClass: PlayerRole;
    isFullscreen: boolean;
    onSelectRole: (role: PlayerRole) => void;
    onTriggerSkill: () => void;
    onSpawnBoss: () => void;
    onStartStruggle: () => void;
    onToggleFullscreen: () => void;
    showDebugActions?: boolean;
  }>();
</script>

<div class="floating-controls-bar">
  <div class="roles-quick-group">
    <button class="quick-role-btn {selectedClass === 'DPS' ? 'active' : ''}" onclick={() => onSelectRole('DPS')}>
      ⚔️ DPS [1]
    </button>
    <button class="quick-role-btn {selectedClass === 'Tank' ? 'active' : ''}" onclick={() => onSelectRole('Tank')}>
      🛡️ TANK [2]
    </button>
    <button class="quick-role-btn {selectedClass === 'Support' ? 'active' : ''}" onclick={() => onSelectRole('Support')}>
      💖 SUPPORT [3]
    </button>
    <button class="quick-role-btn {selectedClass === 'Special_Attack' ? 'active' : ''}" onclick={() => onSelectRole('Special_Attack')}>
      ⚡ SP.ATK [4]
    </button>
  </div>

  <div class="actions-quick-group">
    <button class="action-btn skill-act-btn" onclick={onTriggerSkill} title="Activar Skill Especial [X]">
      ⭐ SKILL [X]
    </button>
    {#if showDebugActions}
      <button class="action-btn boss-act-btn" onclick={onSpawnBoss} title="Invocar Jefe Ahora [B]">
        👹 BOSS [B]
      </button>
      <button class="action-btn struggle-act-btn" onclick={onStartStruggle} title="Probar Choque de Rayos [T]">
        ⚡ STRUGGLE [T]
      </button>
    {/if}
    <button class="action-btn fullscreen-toggle-btn" onclick={onToggleFullscreen} title="Pantalla Completa [F]">
      {isFullscreen ? '🗗 SALIR FULL' : '⛶ FULLSCREEN [F]'}
    </button>
  </div>
</div>

<style>
  .floating-controls-bar {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    padding: 4px 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    z-index: 20;
    opacity: 0.75;
    transition: opacity 0.2s, transform 0.2s;
  }

  .floating-controls-bar:hover {
    opacity: 1;
    transform: translateX(-50%) translateY(-2px);
  }

  .roles-quick-group, .actions-quick-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .quick-role-btn, .action-btn {
    background: rgba(255, 255, 255, 0.08);
    color: #e4e4e7;
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-role-btn.active {
    background: #00f2fe;
    color: #040406;
    border-color: #00f2fe;
    font-weight: 800;
  }

  .skill-act-btn {
    background: #ff2b5b;
    color: #ffffff;
    border-color: #ff2b5b;
  }

  .boss-act-btn {
    background: #ef4444;
    color: #ffffff;
    border-color: #ef4444;
  }

  .struggle-act-btn {
    background: #ffd000;
    color: #000000;
    border-color: #ffd000;
  }

  .fullscreen-toggle-btn {
    background: #3b82f6;
    color: #ffffff;
    border-color: #3b82f6;
  }

  @media (max-width: 768px) {
    .floating-controls-bar { bottom: 74px; scale: 0.85; }
  }
</style>
