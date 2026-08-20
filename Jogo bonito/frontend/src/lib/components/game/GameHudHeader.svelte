<script lang="ts">
  type PlayerRole = 'Tank' | 'Support' | 'DPS' | 'Special_Attack';

  type CompanionSlot = {
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

  let {
    selectedClass,
    playerAvatarSrc,
    playerHpPercent,
    playerSpPercent,
    isUltiReady,
    companionSlots,
    showBossHpBar,
    bossRemainingStocks,
    spellcardName,
    isBossRefilling,
    bossDisplayHpPercent,
  } = $props<{
    selectedClass: PlayerRole;
    playerAvatarSrc: string;
    playerHpPercent: number;
    playerSpPercent: number;
    isUltiReady: boolean;
    companionSlots: CompanionSlot[];
    showBossHpBar: boolean;
    bossRemainingStocks: number;
    spellcardName: string;
    isBossRefilling: boolean;
    bossDisplayHpPercent: number;
  }>();
</script>

<header class="top-hud-bar {showBossHpBar ? 'mode-boss' : 'mode-squad'}">
  <div class="squad-container {showBossHpBar ? 'squad-compact' : 'squad-full'}">
    <div class="player-hud-card" title="Tu Personaje: {selectedClass}">
      <div class="avatar-box player-avatar-box">
        <img src={playerAvatarSrc} alt="Tu Personaje" class="avatar-img" />
        <span class="avatar-role-tag">{selectedClass === 'Special_Attack' ? 'SP.ATK' : selectedClass}</span>
      </div>

      <div class="resource-bars-column player-bars">
        <div class="capsule-bar-track hp-track">
          <div class="capsule-bar-fill hp-fill" style="width: {playerHpPercent}%"></div>
          <div class="capsule-bar-content">
            <span class="bar-name">HP</span>
            <span class="bar-percent">{Math.round(playerHpPercent)}%</span>
          </div>
        </div>

        <div class="capsule-bar-track ulti-track {isUltiReady ? 'ulti-ready' : ''}">
          <div class="capsule-bar-fill ulti-fill" style="width: {playerSpPercent}%"></div>
          <div class="capsule-bar-content">
            <span class="bar-name">ULTI</span>
            <span class="bar-percent">{isUltiReady ? 'READY [X]' : `${Math.round(playerSpPercent)}%`}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="companions-group">
      {#each companionSlots as companion}
        {#if !showBossHpBar}
          <div class="companion-full-card" style="--comp-accent: {companion.color}">
            <div class="avatar-box companion-avatar-box">
              <img src={companion.icon} alt={companion.name} class="avatar-img" />
              <span class="avatar-role-tag" style="color: {companion.color}; border-color: {companion.color};">{companion.role}</span>
              <span class="online-indicator-dot"></span>
            </div>
            <div class="resource-bars-column">
              <div class="capsule-bar-track hp-track">
                <div class="capsule-bar-fill hp-fill" style="width: {Math.round((companion.hp / (companion.maxHp || 1)) * 100)}%"></div>
                <div class="capsule-bar-content">
                  <span class="bar-name">HP</span>
                  <span class="bar-percent">{Math.round((companion.hp / (companion.maxHp || 1)) * 100)}%</span>
                </div>
              </div>
              <div class="capsule-bar-track ulti-track">
                <div class="capsule-bar-fill ulti-fill" style="width: {Math.round((companion.sp / companion.maxSp) * 100)}%"></div>
                <div class="capsule-bar-content">
                  <span class="bar-name">ULTI</span>
                  <span class="bar-percent">{Math.round((companion.sp / companion.maxSp) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="companion-mini-card" style="--comp-accent: {companion.color}">
            <div class="avatar-box mini-avatar-box">
              <img src={companion.icon} alt={companion.name} class="avatar-img" />
              <span class="avatar-role-tag mini-tag" style="color: {companion.color}; border-color: {companion.color};">{companion.role}</span>
              <span class="online-indicator-dot"></span>
            </div>
            <div class="mini-bars-col">
              <div class="capsule-bar-track mini-track hp-track" title="Vida {companion.name}: {Math.round((companion.hp / (companion.maxHp || 1)) * 100)}%">
                <div class="capsule-bar-fill hp-fill" style="width: {Math.round((companion.hp / (companion.maxHp || 1)) * 100)}%"></div>
                <div class="capsule-bar-content mini-content">
                  <span class="bar-name">HP</span>
                  <span class="bar-percent">{Math.round((companion.hp / (companion.maxHp || 1)) * 100)}%</span>
                </div>
              </div>
              <div class="capsule-bar-track mini-track ulti-track" title="Ulti {companion.name}: {Math.round((companion.sp / companion.maxSp) * 100)}%">
                <div class="capsule-bar-fill ulti-fill" style="width: {Math.round((companion.sp / companion.maxSp) * 100)}%"></div>
                <div class="capsule-bar-content mini-content">
                  <span class="bar-name">ULT</span>
                  <span class="bar-percent">{Math.round((companion.sp / companion.maxSp) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  {#if showBossHpBar}
    <div class="hud-center-spacer"></div>

    <div class="boss-hud-card active-boss" title="Jefe del Escenario: {spellcardName}">
      <div class="boss-meta-column">
        <div class="boss-header-row">
          <div class="boss-stocks-stars">
            {#each Array.from({ length: Math.max(0, bossRemainingStocks) }) as _}
              <span class="stock-star">★</span>
            {/each}
          </div>
          <div class="boss-title-badge">
            <span class="boss-name">{spellcardName || 'STAGE BOSS'}</span>
            <span class="boss-tag">BOSS</span>
          </div>
        </div>

        <div class="capsule-bar-track boss-hp-track {isBossRefilling ? 'boss-refilling' : ''}">
          <div class="capsule-bar-fill boss-hp-fill" style="width: {bossDisplayHpPercent}%"></div>
          <div class="capsule-bar-content">
            <span class="bar-name">BOSS HP</span>
            <span class="bar-percent">{isBossRefilling ? 'CHARGING...' : `${Math.round(bossDisplayHpPercent)}%`}</span>
          </div>
        </div>
      </div>

      <div class="avatar-box boss-avatar-box">
        <img src="/assets/sprites/boss.png" alt="Jefe" class="avatar-img boss-img" />
        <span class="boss-active-pulse"></span>
      </div>
    </div>
  {/if}
</header>

<style>
  .top-hud-bar {
    height: 78px;
    min-height: 70px;
    width: 100%;
    display: flex;
    align-items: center;
    background: #111116;
    border-radius: 10px 10px 0 0;
    padding: 6px 16px;
    box-sizing: border-box;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    border-bottom: 2px solid #27272e;
    z-index: 10;
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .top-hud-bar.mode-squad {
    justify-content: space-between;
  }

  .top-hud-bar.mode-boss {
    justify-content: flex-start;
    gap: 12px;
  }

  .squad-container {
    display: flex;
    align-items: center;
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .squad-container.squad-full {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .squad-container.squad-full .companions-group {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 16px;
  }

  .squad-container.squad-full .player-hud-card,
  .squad-container.squad-full .companion-full-card {
    flex: 1;
  }

  .squad-container.squad-compact {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .squad-container.squad-compact .companions-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .avatar-box {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
    border: 2px solid #ffffff;
    transition: all 0.3s ease;
    z-index: 2;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 50%;
    background: #ffffff;
  }

  .player-hud-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .player-avatar-box {
    width: 48px;
    height: 48px;
    border-color: #ffd000;
    background: #ffd000;
  }

  .player-bars {
    width: 175px;
    min-width: 175px;
  }

  .avatar-role-tag {
    position: absolute;
    bottom: -5px;
    background: #18181b;
    color: #ffd000;
    font-size: 0.58rem;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 4px;
    border: 1px solid #ffd000;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .companion-full-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    width: 100%;
    animation: fadeInSquad 0.35s ease;
  }

  .companion-avatar-box {
    border-color: var(--comp-accent, #10b981);
  }

  @keyframes fadeInSquad {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .companion-mini-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.06);
    padding: 4px 10px 4px 6px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: transform 0.2s, border-color 0.2s;
    animation: compactSlideIn 0.35s ease-out;
    flex-shrink: 0;
    box-sizing: border-box;
  }

  @keyframes compactSlideIn {
    from { opacity: 0; transform: translateX(-15px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .companion-mini-card:hover {
    transform: translateY(-2px);
    border-color: var(--comp-accent, #10b981);
  }

  .mini-avatar-box {
    width: 38px;
    height: 38px;
    border-color: var(--comp-accent, #10b981);
    flex-shrink: 0;
  }

  .mini-tag {
    font-size: 0.48rem;
    padding: 0 3px;
    bottom: -4px;
  }

  .mini-bars-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 80px;
    min-width: 80px;
    flex-shrink: 0;
  }

  .capsule-bar-track.mini-track {
    height: 14px;
    border-radius: 7px;
  }

  .mini-content {
    font-size: 0.58rem;
    padding: 0 5px;
    font-weight: 800;
  }

  .online-indicator-dot {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    border: 2px solid #111116;
  }

  .resource-bars-column {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 130px;
  }

  .capsule-bar-track {
    position: relative;
    height: 20px;
    border-radius: 10px;
    background: #2a2a32;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
  }

  .hp-track {
    background: #5a1a1a;
  }

  .ulti-track {
    background: #142a4a;
  }

  .ulti-track.ulti-ready {
    box-shadow: 0 0 12px rgba(0, 242, 254, 0.6), inset 0 0 6px rgba(0, 242, 254, 0.4);
    animation: ultiPulse 1.2s infinite alternate;
  }

  @keyframes ultiPulse {
    from { border-color: #00f2fe; filter: drop-shadow(0 0 4px #00f2fe); }
    to { border-color: #ffffff; filter: drop-shadow(0 0 10px #00f2fe); }
  }

  .capsule-bar-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .hp-fill {
    background: linear-gradient(90deg, #dc2626, #ef4444);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  }

  .ulti-fill {
    background: linear-gradient(90deg, #2563eb, #00d2ff);
    box-shadow: 0 0 8px rgba(0, 210, 255, 0.6);
  }

  .capsule-bar-content {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 8px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    pointer-events: none;
  }

  .bar-name {
    color: #ffffff;
    opacity: 0.9;
  }

  .bar-percent {
    color: #ffffff;
  }

  .hud-center-spacer {
    flex: 1;
  }

  .boss-hud-card {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    animation: bossSpawnIn 0.5s ease-out;
  }

  @keyframes bossSpawnIn {
    from { opacity: 0; transform: translateX(25px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .boss-meta-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  .boss-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .boss-title-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .boss-tag {
    background: #ef4444;
    color: #ffffff;
    font-size: 0.6rem;
    font-weight: 900;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .boss-name {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #ffffff;
    max-width: 190px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .boss-stocks-stars {
    display: flex;
    gap: 2px;
    color: #ffd000;
    font-size: 0.8rem;
  }

  .boss-hp-track {
    width: 210px;
    background: #450a0a;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .boss-hp-track.boss-refilling {
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.85), inset 0 0 8px rgba(255, 255, 255, 0.5);
    animation: bossRefillGlow 0.6s infinite alternate;
  }

  @keyframes bossRefillGlow {
    from { filter: drop-shadow(0 0 4px #ef4444); }
    to { filter: drop-shadow(0 0 14px #ff2b5b); }
  }

  .boss-hp-fill {
    background: linear-gradient(90deg, #991b1b, #ef4444, #f87171);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);
  }

  .boss-avatar-box {
    border-color: #ef4444;
    background: #ef4444;
  }

  .boss-img {
    background: #ffffff;
  }

  .boss-active-pulse {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid #ef4444;
    animation: bossPulse 1s infinite alternate;
  }

  @keyframes bossPulse {
    from { opacity: 0.4; transform: scale(1); }
    to { opacity: 1; transform: scale(1.1); }
  }

  @media (max-width: 768px) {
    .top-hud-bar { height: 68px; padding: 4px 8px; }
    .player-bars { width: 130px; min-width: 130px; }
    .mini-bars-col { width: 55px; }
    .avatar-box { width: 38px; height: 38px; }
    .boss-hp-track { width: 140px; }
  }
</style>
