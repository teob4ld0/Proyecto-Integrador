export default function TouchControlsOverlay({
  joystickActive,
  joystickStickPos,
  touchFocus,
  touchFiring,
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  onTriggerSkill,
  onToggleFocus,
  onFireStart,
  onFireEnd,
}) {
  return (
    <div className="dk-touch-controls-overlay">
      <div
        className="dk-touch-joystick-zone"
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onTouchCancel={onJoystickEnd}
        role="button"
        tabIndex={0}
        aria-label="Virtual Joystick"
      >
        <div className={`dk-joystick-base ${joystickActive ? 'active' : ''}`}>
          <div
            className="dk-joystick-stick"
            style={{ transform: `translate(${joystickStickPos.x}px, ${joystickStickPos.y}px)` }}
          />
        </div>
      </div>

      <div className="dk-touch-buttons-zone">
        <button
          type="button"
          className="dk-touch-btn dk-skill-touch-btn"
          onTouchStart={(e) => {
            e.preventDefault();
            onTriggerSkill();
          }}
          aria-label="Skill mode"
        >
          SKILL
        </button>
        <button
          type="button"
          className={`dk-touch-btn dk-focus-btn ${touchFocus ? 'active' : ''}`}
          onTouchStart={(e) => {
            e.preventDefault();
            onToggleFocus();
          }}
          aria-label="Focus mode"
        >
          FOCUS
        </button>
        <button
          type="button"
          className={`dk-touch-btn dk-fire-btn ${touchFiring ? 'active' : ''}`}
          onTouchStart={(e) => {
            e.preventDefault();
            onFireStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onFireEnd();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            onFireEnd();
          }}
          aria-label="Fire bullets"
        >
          FIRE
        </button>
      </div>
    </div>
  );
}

