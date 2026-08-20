<script lang="ts">
  let {
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
  } = $props<{
    joystickActive: boolean;
    joystickStickPos: { x: number; y: number };
    touchFocus: boolean;
    touchFiring: boolean;
    onJoystickStart: (e: TouchEvent) => void;
    onJoystickMove: (e: TouchEvent) => void;
    onJoystickEnd: (e: TouchEvent) => void;
    onTriggerSkill: () => void;
    onToggleFocus: () => void;
    onFireStart: () => void;
    onFireEnd: () => void;
  }>();
</script>

<div class="touch-controls-overlay">
  <div
    class="touch-joystick-zone"
    ontouchstart={onJoystickStart}
    ontouchmove={onJoystickMove}
    ontouchend={onJoystickEnd}
    ontouchcancel={onJoystickEnd}
    role="button"
    tabindex="0"
    aria-label="Virtual Joystick"
  >
    <div class="joystick-base {joystickActive ? 'active' : ''}">
      <div class="joystick-stick" style="transform: translate({joystickStickPos.x}px, {joystickStickPos.y}px);"></div>
    </div>
  </div>

  <div class="touch-buttons-zone">
    <button
      class="touch-btn skill-touch-btn"
      ontouchstart={(e) => {
        e.preventDefault();
        onTriggerSkill();
      }}
      aria-label="Skill mode"
    >
      SKILL
    </button>
    <button
      class="touch-btn focus-btn {touchFocus ? 'active' : ''}"
      ontouchstart={(e) => {
        e.preventDefault();
        onToggleFocus();
      }}
      aria-label="Focus mode"
    >
      FOCUS
    </button>
    <button
      class="touch-btn fire-btn {touchFiring ? 'active' : ''}"
      ontouchstart={(e) => {
        e.preventDefault();
        onFireStart();
      }}
      ontouchend={(e) => {
        e.preventDefault();
        onFireEnd();
      }}
      ontouchcancel={(e) => {
        e.preventDefault();
        onFireEnd();
      }}
      aria-label="Fire bullets"
    >
      FIRE
    </button>
  </div>
</div>

<style>
  .touch-controls-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    display: flex;
    justify-content: space-between;
    padding: 20px;
  }

  .touch-joystick-zone {
    width: 130px;
    height: 130px;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .joystick-base {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .joystick-stick {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #00f2fe;
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
  }

  .touch-buttons-zone {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    pointer-events: auto;
  }

  .touch-btn {
    width: 55px;
    height: 55px;
    border-radius: 50%;
    border: none;
    font-weight: 800;
    font-size: 0.75rem;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  }

  .fire-btn { background: #ef4444; }
  .focus-btn { background: #3b82f6; }
  .skill-touch-btn { background: #ffd000; color: #000000; }
</style>
