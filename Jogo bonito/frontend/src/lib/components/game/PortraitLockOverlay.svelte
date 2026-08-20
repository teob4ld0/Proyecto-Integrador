<script lang="ts">
  let {
    isPortraitWarning,
    onRequestLandscape,
  } = $props<{
    isPortraitWarning: boolean;
    onRequestLandscape: () => void;
  }>();
</script>

{#if isPortraitWarning}
  <div class="portrait-lock-overlay" role="dialog" aria-modal="true">
    <div class="rotate-phone-card">
      <div class="rotate-icon-wrapper">
        <svg viewBox="0 0 100 100" width="70" height="70">
          <rect x="32" y="15" width="36" height="70" rx="6" ry="6" fill="none" stroke="#00f2fe" stroke-width="4"/>
          <circle cx="50" cy="74" r="3" fill="#00f2fe"/>
          <path d="M 18 50 A 32 32 0 0 1 50 18" fill="none" stroke="#ff2b5b" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 4"/>
          <polygon points="50,12 60,18 50,24" fill="#ff2b5b"/>
        </svg>
      </div>
      <h2 class="rotate-title">GIRA TU TELEFONO</h2>
      <p class="rotate-desc">El juego esta optimizado para pantalla apaisada (Landscape).</p>
      <button class="fullscreen-btn" onclick={onRequestLandscape}>
        PANTALLA COMPLETA
      </button>
    </div>
  </div>
{/if}

<style>
  .portrait-lock-overlay {
    position: fixed;
    inset: 0;
    background: #06040a;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }

  .rotate-phone-card {
    text-align: center;
    max-width: 320px;
  }

  .rotate-title {
    color: #ffffff;
    margin: 12px 0 6px 0;
  }

  .rotate-desc {
    color: #a1a1aa;
    font-size: 0.85rem;
    margin-bottom: 16px;
  }

  .fullscreen-btn {
    background: #00f2fe;
    color: #000000;
    font-weight: 800;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
  }
</style>
