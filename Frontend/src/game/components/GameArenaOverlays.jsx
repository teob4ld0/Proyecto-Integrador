export default function GameArenaOverlays({
  stageBanner,
  bossWarningActive,
  spellcardBanner,
  isStruggleAligning,
  isBeamStruggle,
  struggleProgress,
  struggleTimeLeft,
  isTouchDevice,
  isStageClear,
  isPlayerDefeated = false,
  stageClearTitle = 'STAGE 1 CLEARED!',
  stageClearSubtext = '¡Misión completada con éxito!',
  stageClearMeta = '',
  stageClearButtonText = '🔄 JUGAR OTRA VEZ (REPLAY)',
  onPushStruggle,
  onRestartStage,
  onExitLobby,
}) {
  return (
    <>
      {stageBanner && (
        <div className="dk-stage-banner-overlay">
          <div className="dk-stage-banner-card">
            <div className="dk-stage-banner-badge">DANMAKREW STAGE</div>
            <h1 className="dk-stage-banner-title">{stageBanner.text}</h1>
            <div className="dk-stage-banner-divider" />
            <p className="dk-stage-banner-subtext">{stageBanner.subtext}</p>
          </div>
        </div>
      )}

      {bossWarningActive && (
        <div className="dk-boss-warning-overlay">
          <div className="dk-hazard-bar" />
          <div className="dk-warning-content">
            <span className="dk-warning-siren">⚠️</span>
            <span className="dk-warning-text">WARNING! HIGH-ENERGY BOSS APPROACHING</span>
            <span className="dk-warning-siren">⚠️</span>
          </div>
          <div className="dk-hazard-bar" />
        </div>
      )}

      {spellcardBanner && spellcardBanner.active && (
        <div className="dk-spellcard-cutin-banner">
          <span className="dk-spellcard-tag">SPELL CARD</span>
          <span className="dk-spellcard-title">{spellcardBanner.name}</span>
        </div>
      )}

      {isStruggleAligning && (
        <div className="dk-beam-clash-intro-banner">
          <div className="dk-clash-intro-badge">⚡ BEAM CLASH INCOMING ⚡</div>
          <div className="dk-clash-intro-sub">¡PREPÁRATE PARA MACHACAR [Z]!</div>
        </div>
      )}

      {isBeamStruggle && (
        <div className="dk-beam-struggle-clean-overlay">
          <div className="dk-struggle-top-bar">
            <div className="dk-struggle-balance-line">
              <span className="dk-stream-badge player">⚡ SPARK</span>
              <div className="dk-slim-tug-track">
                <div className="dk-slim-tug-fill player" style={{ width: `${struggleProgress}%` }} />
                <div className="dk-slim-tug-fill boss" style={{ width: `${100 - struggleProgress}%` }} />
                <div className="dk-slim-clash-icon" style={{ left: `${struggleProgress}%` }}>⚔️</div>
              </div>
              <span className="dk-stream-badge boss">RAY ☀️</span>
            </div>

            <div className="dk-mash-key-box">
              <div className="dk-animated-mash-key">
                <span className="dk-key-letter">Z</span>
              </div>
              <span className="dk-mash-text">¡MASH!</span>
            </div>

            <div className="dk-struggle-timer-badge">
              ⏱️ {struggleTimeLeft.toFixed(1)}s
            </div>
          </div>

          {isTouchDevice && (
            <button
              type="button"
              className="dk-mobile-struggle-corner-btn"
              onTouchStart={(e) => {
                e.preventDefault();
                onPushStruggle();
              }}
              onClick={onPushStruggle}
              aria-label="Push Struggle button"
            >
              ⚡<br /><small>MASH</small>
            </button>
          )}
        </div>
      )}

      {isPlayerDefeated && !isStageClear && (
        <div className="dk-stage-clear-overlay">
          <div className="dk-stage-clear-card defeated">
            <div className="dk-clear-badge defeated">SQUAD DOWN</div>
            <h1 className="dk-clear-title">CAÍSTE EN COMBATE</h1>
            <p className="dk-clear-sub">Reintenta el escenario o vuelve al lobby de selección.</p>
            <div className="dk-overlay-actions">
              <button type="button" className="dk-stage-replay-btn" onClick={onRestartStage}>
                🔄 REINTENTAR STAGE
              </button>
              <button type="button" className="dk-stage-exit-btn" onClick={onExitLobby}>
                ← VOLVER AL LOBBY
              </button>
            </div>
          </div>
        </div>
      )}

      {isStageClear && (
        <div className="dk-stage-clear-overlay">
          <div className="dk-stage-clear-card">
            <div className="dk-clear-badge">STAGE COMPLETE</div>
            <h1 className="dk-clear-title">{stageClearTitle}</h1>
            <p className="dk-clear-sub">{stageClearSubtext}</p>
            {stageClearMeta && <p className="dk-clear-meta">{stageClearMeta}</p>}
            <div className="dk-overlay-actions">
              <button type="button" className="dk-stage-replay-btn" onClick={onRestartStage}>
                {stageClearButtonText}
              </button>
              <button type="button" className="dk-stage-exit-btn" onClick={onExitLobby}>
                ← VOLVER AL LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

