<script lang="ts">
  let {
    stageBanner,
    bossWarningActive,
    spellcardBanner,
    isStruggleAligning,
    isBeamStruggle,
    struggleProgress,
    struggleTimeLeft,
    isTouchDevice,
    isStageClear,
    backendRequired = false,
    backendConnected = true,
    backendStatusMessage = 'Conectando al backend de la partida...',
    stageClearTitle = 'STAGE 1 CLEARED!',
    stageClearSubtext = '¡Mision completada con exito!',
    stageClearMeta = '',
    stageClearButtonText = '🔄 JUGAR OTRA VEZ (REPLAY)',
    onPushStruggle,
    onRestartStage,
  } = $props<{
    stageBanner: { text: string; subtext: string } | null;
    bossWarningActive: boolean;
    spellcardBanner: { active: boolean; name: string } | null;
    isStruggleAligning: boolean;
    isBeamStruggle: boolean;
    struggleProgress: number;
    struggleTimeLeft: number;
    isTouchDevice: boolean;
    isStageClear: boolean;
    backendRequired?: boolean;
    backendConnected?: boolean;
    backendStatusMessage?: string;
    stageClearTitle?: string;
    stageClearSubtext?: string;
    stageClearMeta?: string;
    stageClearButtonText?: string;
    onPushStruggle: () => void;
    onRestartStage: () => void;
  }>();
</script>

{#if stageBanner}
  <div class="stage-banner-overlay">
    <div class="stage-banner-card">
      <div class="stage-banner-badge">TOUHOU DANMAKU STAGE</div>
      <h1 class="stage-banner-title">{stageBanner.text}</h1>
      <div class="stage-banner-divider"></div>
      <p class="stage-banner-subtext">{stageBanner.subtext}</p>
    </div>
  </div>
{/if}

{#if bossWarningActive}
  <div class="boss-warning-overlay">
    <div class="hazard-bar top"></div>
    <div class="warning-content">
      <span class="warning-siren">⚠️</span>
      <span class="warning-text">WARNING! HIGH-ENERGY BOSS APPROACHING</span>
      <span class="warning-siren">⚠️</span>
    </div>
    <div class="hazard-bar bottom"></div>
  </div>
{/if}

{#if spellcardBanner && spellcardBanner.active}
  <div class="spellcard-cutin-banner">
    <span class="spellcard-tag">SPELL CARD</span>
    <span class="spellcard-title">{spellcardBanner.name}</span>
  </div>
{/if}

{#if isStruggleAligning}
  <div class="beam-clash-intro-banner">
    <div class="clash-intro-badge">⚡ BEAM CLASH INCOMING ⚡</div>
    <div class="clash-intro-sub">¡PREPÁRATE PARA MACHACAR [Z]!</div>
  </div>
{/if}

{#if isBeamStruggle}
  <div class="beam-struggle-clean-overlay">
    <div class="struggle-top-bar">
      <div class="struggle-balance-line">
        <span class="stream-badge player">⚡ SPARK</span>
        <div class="slim-tug-track">
          <div class="slim-tug-fill player" style="width: {struggleProgress}%"></div>
          <div class="slim-tug-fill boss" style="width: {100 - struggleProgress}%"></div>
          <div class="slim-clash-icon" style="left: {struggleProgress}%">⚔️</div>
        </div>
        <span class="stream-badge boss">RAY ☀️</span>
      </div>

      <div class="mash-key-box">
        <div class="animated-mash-key">
          <span class="key-letter">Z</span>
          <span class="key-tap-wave"></span>
        </div>
        <span class="mash-text">¡MASH!</span>
      </div>

      <div class="struggle-timer-badge">
        ⏱️ {struggleTimeLeft.toFixed(1)}s
      </div>
    </div>

    {#if isTouchDevice}
      <button
        class="mobile-struggle-corner-btn"
        ontouchstart={(e) => {
          e.preventDefault();
          onPushStruggle();
        }}
        onclick={onPushStruggle}
        aria-label="Push Struggle button"
      >
        ⚡<br /><small>MASH</small>
      </button>
    {/if}
  </div>
{/if}

{#if isStageClear}
  <div class="stage-clear-overlay">
    <div class="stage-clear-card">
      <div class="clear-badge">STAGE COMPLETE</div>
      <h1 class="clear-title">{stageClearTitle}</h1>
      <p class="clear-sub">{stageClearSubtext}</p>
      {#if stageClearMeta}
        <p class="clear-sub">{stageClearMeta}</p>
      {/if}
      <button class="stage-replay-btn" onclick={onRestartStage}>
        {stageClearButtonText}
      </button>
    </div>
  </div>
{/if}

{#if backendRequired && !backendConnected}
  <div class="backend-required-overlay" role="status" aria-live="polite">
    <div class="backend-required-card">
      <div class="backend-required-badge">MULTIPLAYER AUTORITATIVO</div>
      <h2>Backend no disponible</h2>
      <p>{backendStatusMessage}</p>
      <p class="backend-required-hint">Esta partida no corre fisicas en frontend. Levanta el backend host y reintenta.</p>
    </div>
  </div>
{/if}

<style>
  .stage-banner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 15;
  }

  .stage-banner-card {
    background: rgba(3, 2, 6, 0.85);
    border-top: 2px solid #00f2fe;
    border-bottom: 2px solid #00f2fe;
    padding: 16px 40px;
    text-align: center;
    box-shadow: 0 0 30px rgba(0, 242, 254, 0.3);
  }

  .stage-banner-badge {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: #00f2fe;
  }

  .stage-banner-title {
    font-size: 2rem;
    font-weight: 900;
    color: #ffffff;
    margin: 4px 0;
  }

  .stage-banner-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin: 6px 0;
  }

  .stage-banner-subtext {
    font-size: 0.85rem;
    color: #d4d4d8;
  }

  .boss-warning-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
    z-index: 15;
  }

  .hazard-bar {
    height: 14px;
    background: repeating-linear-gradient(45deg, #ef4444, #ef4444 14px, #000000 14px, #000000 28px);
  }

  .warning-content {
    background: rgba(239, 68, 68, 0.2);
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .warning-text {
    color: #ef4444;
    font-weight: 900;
    font-size: 1.2rem;
    letter-spacing: 1.5px;
    text-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
  }

  .spellcard-cutin-banner {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(239, 68, 68, 0.85);
    padding: 6px 14px;
    border-radius: 4px;
    border-left: 4px solid #ffffff;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.5);
    z-index: 12;
  }

  .spellcard-tag {
    font-size: 0.6rem;
    font-weight: 900;
    color: #ffffff;
    display: block;
  }

  .spellcard-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #ffffff;
  }

  .beam-clash-intro-banner {
    position: absolute;
    top: 25%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 208, 0, 0.9);
    color: #000000;
    padding: 12px 28px;
    border-radius: 8px;
    text-align: center;
    font-weight: 900;
    box-shadow: 0 0 30px rgba(255, 208, 0, 0.7);
    z-index: 25;
  }

  .beam-struggle-clean-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 25;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 12px;
    align-items: center;
  }

  .struggle-top-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(8px);
    padding: 6px 16px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .struggle-balance-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slim-tug-track {
    position: relative;
    width: 220px;
    height: 12px;
    background: #27272a;
    border-radius: 6px;
    overflow: hidden;
  }

  .slim-tug-fill.player {
    position: absolute;
    left: 0;
    height: 100%;
    background: #00f2fe;
  }

  .slim-tug-fill.boss {
    position: absolute;
    right: 0;
    height: 100%;
    background: #ef4444;
  }

  .slim-clash-icon {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.9rem;
  }

  .stream-badge {
    font-size: 0.65rem;
    font-weight: 800;
  }

  .stream-badge.player { color: #00f2fe; }
  .stream-badge.boss { color: #ef4444; }

  .mash-key-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .animated-mash-key {
    width: 26px;
    height: 26px;
    background: #ffd000;
    color: #000000;
    font-weight: 900;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 0 #b45309;
    animation: mashKeyAnim 0.15s infinite alternate;
  }

  @keyframes mashKeyAnim {
    from { transform: translateY(0); }
    to { transform: translateY(2px); }
  }

  .mash-text {
    font-size: 0.75rem;
    font-weight: 900;
    color: #ffd000;
  }

  .struggle-timer-badge {
    font-size: 0.75rem;
    font-weight: 800;
    color: #ffffff;
  }

  .mobile-struggle-corner-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 65px;
    height: 65px;
    border-radius: 50%;
    background: #ffd000;
    color: #000000;
    font-weight: 900;
    border: none;
    pointer-events: auto;
    box-shadow: 0 4px 15px rgba(255, 208, 0, 0.6);
  }

  .stage-clear-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
  }

  .backend-required-overlay {
    position: absolute;
    inset: 0;
    z-index: 40;
    background: rgba(6, 6, 10, 0.86);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
  }

  .backend-required-card {
    width: min(92vw, 560px);
    background: rgba(18, 18, 24, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-left: 4px solid #ef4444;
    border-radius: 14px;
    padding: 20px 22px;
    text-align: left;
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
  }

  .backend-required-badge {
    color: #fca5a5;
    font-size: 0.72rem;
    letter-spacing: 1.3px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .backend-required-card h2 {
    margin: 0 0 10px;
    color: #f4f4f5;
    font-size: 1.35rem;
    font-weight: 900;
  }

  .backend-required-card p {
    margin: 0;
    color: #d4d4d8;
    line-height: 1.45;
  }

  .backend-required-hint {
    margin-top: 10px !important;
    color: #fda4af !important;
    font-size: 0.92rem;
  }

  .stage-clear-card {
    background: #111116;
    border: 2px solid #ffd000;
    border-radius: 12px;
    padding: 28px 40px;
    text-align: center;
    box-shadow: 0 0 40px rgba(255, 208, 0, 0.4);
  }

  .clear-badge {
    color: #ffd000;
    font-weight: 800;
    font-size: 0.8rem;
    letter-spacing: 2px;
  }

  .clear-title {
    font-size: 2rem;
    font-weight: 900;
    color: #ffffff;
    margin: 8px 0;
  }

  .clear-sub {
    color: #a1a1aa;
    font-size: 0.95rem;
    margin-bottom: 24px;
  }

  .stage-replay-btn {
    background: #10b981;
    color: #ffffff;
    font-weight: 800;
    border: none;
    padding: 12px 28px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    transition: background 0.2s, transform 0.2s;
  }

  .stage-replay-btn:hover {
    background: #059669;
    transform: scale(1.03);
  }
</style>
