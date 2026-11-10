export default function GameHudHeader({
  selectedClass,
  playerAvatarSrc,
  playerHpPercent,
  playerSpPercent,
  isUltiReady,
  companionSlots = [],
  showBossHpBar,
  bossRemainingStocks,
  spellcardName,
  isBossRefilling,
  bossDisplayHpPercent,
  workerModeLabel,
  difficultyLabel = 'Normal',
  world = 1,
  stage = 1,
  onExitLobby,
}) {
  return (
    <header className={`dk-top-hud-bar ${showBossHpBar ? 'mode-boss' : 'mode-squad'}`}>
      <div className={`dk-squad-container ${showBossHpBar ? 'squad-compact' : 'squad-full'}`}>
        <button
          type="button"
          className="dk-exit-lobby-btn"
          onClick={onExitLobby}
          title="Salir al Lobby"
        >
          ← LOBBY
        </button>

        <div className="dk-player-hud-card" title={`Tu Personaje: ${selectedClass}`}>
          <div className="dk-avatar-box dk-player-avatar-box">
            <img src={playerAvatarSrc} alt="Tu Personaje" className="dk-avatar-img" />
            <span className="dk-avatar-role-tag">
              {selectedClass === 'Special_Attack' ? 'SP.ATK' : selectedClass}
            </span>
          </div>

          <div className="dk-resource-bars-column dk-player-bars">
            <div className="dk-capsule-bar-track dk-hp-track">
              <div
                className="dk-capsule-bar-fill dk-hp-fill"
                style={{ width: `${playerHpPercent}%` }}
              />
              <div className="dk-capsule-bar-content">
                <span className="dk-bar-name">HP</span>
                <span className="dk-bar-percent">{Math.round(playerHpPercent)}%</span>
              </div>
            </div>

            <div className={`dk-capsule-bar-track dk-ulti-track ${isUltiReady ? 'ulti-ready' : ''}`}>
              <div
                className="dk-capsule-bar-fill dk-ulti-fill"
                style={{ width: `${playerSpPercent}%` }}
              />
              <div className="dk-capsule-bar-content">
                <span className="dk-bar-name">SKILL</span>
                <span className="dk-bar-percent">
                  {isUltiReady ? 'READY [X]' : `${Math.round(playerSpPercent)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="dk-companions-group">
          {companionSlots.map((companion) => {
            const compHpPct = Math.max(0, Math.min(100, Math.round((companion.hp / (companion.maxHp || 1)) * 100)));
            const compSpPct = Math.max(0, Math.min(100, Math.round((companion.sp / (companion.maxSp || 1000)) * 100)));

            if (!showBossHpBar) {
              return (
                <div
                  key={companion.id}
                  className="dk-companion-full-card"
                  style={{ '--comp-accent': companion.color }}
                >
                  <div className="dk-avatar-box dk-companion-avatar-box">
                    <img src={companion.icon} alt={companion.name} className="dk-avatar-img" />
                    <span
                      className="dk-avatar-role-tag"
                      style={{ color: companion.color, borderColor: companion.color }}
                    >
                      {companion.role}
                    </span>
                    <span className="dk-online-indicator-dot" />
                  </div>
                  <div className="dk-resource-bars-column">
                    <div className="dk-capsule-bar-track dk-hp-track">
                      <div className="dk-capsule-bar-fill dk-hp-fill" style={{ width: `${compHpPct}%` }} />
                      <div className="dk-capsule-bar-content">
                        <span className="dk-bar-name">{companion.name}</span>
                        <span className="dk-bar-percent">{compHpPct}%</span>
                      </div>
                    </div>
                    <div className="dk-capsule-bar-track dk-ulti-track">
                      <div className="dk-capsule-bar-fill dk-ulti-fill" style={{ width: `${compSpPct}%` }} />
                      <div className="dk-capsule-bar-content">
                        <span className="dk-bar-name">SKILL</span>
                        <span className="dk-bar-percent">{compSpPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={companion.id}
                className="dk-companion-mini-card"
                style={{ '--comp-accent': companion.color }}
              >
                <div className="dk-avatar-box dk-mini-avatar-box">
                  <img src={companion.icon} alt={companion.name} className="dk-avatar-img" />
                  <span
                    className="dk-avatar-role-tag dk-mini-tag"
                    style={{ color: companion.color, borderColor: companion.color }}
                  >
                    {companion.role}
                  </span>
                  <span className="dk-online-indicator-dot" />
                </div>
                <div className="dk-mini-bars-col">
                  <div
                    className="dk-capsule-bar-track dk-mini-track dk-hp-track"
                    title={`Vida ${companion.name}: ${compHpPct}%`}
                  >
                    <div className="dk-capsule-bar-fill dk-hp-fill" style={{ width: `${compHpPct}%` }} />
                    <div className="dk-capsule-bar-content dk-mini-content">
                      <span className="dk-bar-name">HP</span>
                      <span className="dk-bar-percent">{compHpPct}%</span>
                    </div>
                  </div>
                  <div
                    className="dk-capsule-bar-track dk-mini-track dk-ulti-track"
                    title={`Skill ${companion.name}: ${compSpPct}%`}
                  >
                    <div className="dk-capsule-bar-fill dk-ulti-fill" style={{ width: `${compSpPct}%` }} />
                    <div className="dk-capsule-bar-content dk-mini-content">
                      <span className="dk-bar-name">SKL</span>
                      <span className="dk-bar-percent">{compSpPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!showBossHpBar && (
        <div className="dk-hud-status-cluster">
          <div
            className="dk-stage-hud-pill"
            title={`Dificultad ${difficultyLabel} — Mundo ${world}, Nivel ${stage}`}
          >
            <span>{String(difficultyLabel).toUpperCase()}</span>
            <span className="dk-stage-hud-sep">·</span>
            <span>NIVEL {world}-{stage}</span>
          </div>
          {workerModeLabel && (
            <div className="dk-worker-status-pill" title={workerModeLabel}>
              <span className="dk-worker-dot" />
              <span>{workerModeLabel}</span>
            </div>
          )}
        </div>
      )}

      {showBossHpBar && (
        <>
          <div className="dk-hud-center-spacer" />
          <div className="dk-boss-hud-card" title={`Jefe del Escenario: ${spellcardName}`}>
            <div className="dk-boss-meta-column">
              <div className="dk-boss-header-row">
                <div className="dk-boss-stocks-stars">
                  {Array.from({ length: Math.max(0, bossRemainingStocks) }).map((_, i) => (
                    <span key={i} className="dk-stock-star">★</span>
                  ))}
                </div>
                <div className="dk-boss-title-badge">
                  <span className="dk-boss-name">{spellcardName || 'STAGE BOSS'}</span>
                  <span className="dk-boss-tag">BOSS</span>
                </div>
              </div>

              <div className={`dk-capsule-bar-track dk-boss-hp-track ${isBossRefilling ? 'boss-refilling' : ''}`}>
                <div
                  className="dk-capsule-bar-fill dk-boss-hp-fill"
                  style={{ width: `${bossDisplayHpPercent}%` }}
                />
                <div className="dk-capsule-bar-content">
                  <span className="dk-bar-name">BOSS HP</span>
                  <span className="dk-bar-percent">
                    {isBossRefilling ? 'CHARGING...' : `${Math.round(bossDisplayHpPercent)}%`}
                  </span>
                </div>
              </div>
            </div>

            <div className="dk-avatar-box dk-boss-avatar-box">
              <img src="/assets/sprites/FirstBoss.png" alt="Jefe" className="dk-avatar-img dk-boss-img" />
              <span className="dk-boss-active-pulse" />
            </div>
          </div>
        </>
      )}
    </header>
  );
}

