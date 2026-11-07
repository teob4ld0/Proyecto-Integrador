export default function FloatingControlsBar({
  selectedClass,
  isFullscreen,
  canSwitchRole = false,
  showDebugActions = false,
  onSelectRole,
  onTriggerSkill,
  onSpawnBoss,
  onStartStruggle,
  onToggleFullscreen,
}) {
  return (
    <div className="dk-floating-controls-bar">
      {canSwitchRole && (
        <div className="dk-roles-quick-group">
          <button
            type="button"
            className={`dk-quick-role-btn ${selectedClass === 'DPS' ? 'active' : ''}`}
            onClick={() => onSelectRole('DPS')}
          >
            ⚔️ DPS [1]
          </button>
          <button
            type="button"
            className={`dk-quick-role-btn ${selectedClass === 'Tank' ? 'active' : ''}`}
            onClick={() => onSelectRole('Tank')}
          >
            🛡️ TANK [2]
          </button>
          <button
            type="button"
            className={`dk-quick-role-btn ${selectedClass === 'Support' ? 'active' : ''}`}
            onClick={() => onSelectRole('Support')}
          >
            💖 SUPPORT [3]
          </button>
          <button
            type="button"
            className={`dk-quick-role-btn ${selectedClass === 'Special_Attack' ? 'active' : ''}`}
            onClick={() => onSelectRole('Special_Attack')}
          >
            ⚡ SP.ATK [4]
          </button>
        </div>
      )}

      <div className="dk-controls-hint-group">
        <span className="dk-hint-chip">WASD / FLECHAS: MOVER</span>
        <span className="dk-hint-chip">[Z]: DISPARAR</span>
        <span className="dk-hint-chip">[SHIFT]: FOCUS</span>
      </div>

      <div className="dk-actions-quick-group">
        <button
          type="button"
          className="dk-action-btn dk-skill-act-btn"
          onClick={onTriggerSkill}
          title="Activar Habilidad Especial de Clase [X]"
        >
          ⭐ SKILL [X]
        </button>
        {showDebugActions && (
          <>
            <button
              type="button"
              className="dk-action-btn dk-boss-act-btn"
              onClick={onSpawnBoss}
              title="Invocar Jefe Ahora [B]"
            >
              👹 BOSS [B]
            </button>
            <button
              type="button"
              className="dk-action-btn dk-struggle-act-btn"
              onClick={onStartStruggle}
              title="Probar Choque de Rayos [T]"
            >
              ⚡ CLASH [T]
            </button>
          </>
        )}
        <button
          type="button"
          className="dk-action-btn dk-fullscreen-toggle-btn"
          onClick={onToggleFullscreen}
          title="Pantalla Completa [F]"
        >
          {isFullscreen ? '🗗 SALIR FULL' : '⛶ FULLSCREEN [F]'}
        </button>
      </div>
    </div>
  );
}

