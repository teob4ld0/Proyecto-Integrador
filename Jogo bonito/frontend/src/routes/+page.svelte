<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Difficulty, PlayerRole } from '$lib/game/session/gameRuntimeSession';
  import { GameRuntimeSession, readSessionQuery } from '$lib/game/session/gameRuntimeSession';
  import { createDefaultCompanionSlots, mergeCompanionSnapshot, type CompanionSlot } from '$lib/game/session/squadState';
  import GameHudHeader from '$lib/components/game/GameHudHeader.svelte';
  import GameArenaOverlays from '$lib/components/game/GameArenaOverlays.svelte';
  import TouchControlsOverlay from '$lib/components/game/TouchControlsOverlay.svelte';
  import FloatingControlsBar from '$lib/components/game/FloatingControlsBar.svelte';
  import AdFooter from '$lib/components/game/AdFooter.svelte';
  import PortraitLockOverlay from '$lib/components/game/PortraitLockOverlay.svelte';

  let canvasRef: HTMLCanvasElement;
  let session: GameRuntimeSession | null = null;

  let roomId = '';
  let classId = 'attack';
  let token = '';
  let selectedDifficulty: Difficulty = 'normal';
  let selectedClass = $state<PlayerRole>('DPS');

  let stageBanner = $state<{ text: string; subtext: string } | null>(null);
  let bossWarningActive = $state(false);
  let spellcardBanner = $state<{ active: boolean; name: string } | null>(null);
  let isStageClear = $state(false);
  let showBossHpBar = $state(false);
  let isBackendAuthoritative = $state(false);
  let backendStatusMessage = $state('Conectando al backend de la partida...');

  function restartStage() {
    session?.restartStage();
  }

  function startBeamStruggleTest() {
    session?.startBeamStruggleTest();
  }

  function spawnBossNow() {
    session?.spawnBossNow();
  }

  function selectRole(role: PlayerRole) {
    if (session) {
      session.selectRole(role);
      return;
    }
    selectedClass = role;
  }

  function triggerSkill() {
    session?.triggerSkill();
  }

  let playerHp = $state(100);
  let playerMaxHp = $state(100);
  let playerSp = $state(0);
  let playerMaxSp = $state(1000);
  let bossRemainingStocks = $state(4);
  let isBossRefilling = $state(false);
  let bossDisplayHpPercent = $state(100);
  let spellcardName = $state('Twilight Non-Spell "Evening Flutter"');

  let playerHpPercent = $derived(
    Math.max(0, Math.min(100, (playerHp / (playerMaxHp || 100)) * 100))
  );
  let playerSpPercent = $derived(
    Math.max(0, Math.min(100, (playerSp / (playerMaxSp || 1000)) * 100))
  );
  let isUltiReady = $derived(playerSpPercent >= 100);

  let playerAvatarSrc = $derived(
    selectedClass === 'Tank' ? '/assets/sprites/tank.png' :
    selectedClass === 'Support' ? '/assets/sprites/support.png' :
    selectedClass === 'Special_Attack' ? '/assets/sprites/spatk.png' :
    '/assets/sprites/dps.png'
  );

  let companionSlots = $state<CompanionSlot[]>(createDefaultCompanionSlots());

  let isBeamStruggle = $state(false);
  let isStruggleAligning = $state(false);
  let struggleProgress = $state(50);
  let struggleTimeLeft = $state(3.5);

  function handlePushStruggle() {
    session?.pushStruggle();
  }

  let isFullscreen = $state(false);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        isFullscreen = true;
      } else {
        await document.exitFullscreen();
        isFullscreen = false;
      }
    } catch {
      // Ignorar
    }
  }

  async function ensureFullscreenOnInteraction() {
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        isFullscreen = true;
      } catch {
        // Ignorar
      }
    }
  }

  function handleFullscreenChange() {
    if (typeof document !== 'undefined') {
      isFullscreen = !!document.fullscreenElement;
    }
  }

  let isTouchDevice = $state(false);
  let touchDx = $state(0);
  let touchDy = $state(0);
  let touchFiring = $state(false);
  let touchFocus = $state(false);
  let joystickActive = $state(false);
  let joystickBasePos = { x: 0, y: 0 };
  let joystickStickPos = $state({ x: 0, y: 0 });
  let isPortraitWarning = $state(false);

  function checkOrientation() {
    if (typeof window !== 'undefined') {
      isPortraitWarning = isTouchDevice && window.innerHeight > window.innerWidth;
    }
  }

  async function requestLandscapeMode() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        // @ts-ignore
        await screen.orientation.lock('landscape');
      }
    } catch {
      // Ignorar
    }
  }

  function handleJoystickStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickBasePos = { x: centerX, y: centerY };
    joystickActive = true;
    updateJoystickTouch(touch.clientX, touch.clientY, centerX, centerY, rect.width / 2);
  }

  function handleJoystickMove(e: TouchEvent) {
    e.preventDefault();
    if (!joystickActive) return;
    const touch = e.changedTouches[0];
    updateJoystickTouch(touch.clientX, touch.clientY, joystickBasePos.x, joystickBasePos.y, 42);
  }

  function handleJoystickEnd(e: TouchEvent) {
    e.preventDefault();
    joystickActive = false;
    touchDx = 0;
    touchDy = 0;
    joystickStickPos = { x: 0, y: 0 };
  }

  function updateJoystickTouch(clientX: number, clientY: number, centerX: number, centerY: number, maxRadius: number) {
    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedRadius = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    joystickStickPos = {
      x: Math.cos(angle) * clampedRadius,
      y: Math.sin(angle) * clampedRadius,
    };

    const deadzone = 0.08;
    const normalizedDist = Math.min(1, dist / maxRadius);
    if (normalizedDist > deadzone) {
      const factor = (normalizedDist - deadzone) / (1 - deadzone);
      touchDx = Math.cos(angle) * factor;
      touchDy = Math.sin(angle) * factor;
    } else {
      touchDx = 0;
      touchDy = 0;
    }
  }

  function toggleTouchFocus() {
    touchFocus = !touchFocus;
  }

  function setTouchFiring(active: boolean) {
    touchFiring = active;
  }

  onMount(() => {
    const params = readSessionQuery(window.location.search);
    roomId = params.roomId;
    classId = params.classId;
    token = params.token;
    selectedDifficulty = params.difficulty;

    checkOrientation();
    if (!canvasRef) return;

    session = new GameRuntimeSession({
      canvas: canvasRef,
      roomId,
      classId,
      token,
      difficulty: selectedDifficulty,
      testMode: params.testMode,
      authorityMode: 'backend-only',
      getSelectedRole: () => selectedClass,
      setSelectedRole: (role) => {
        selectedClass = role;
      },
      getFrameInput: () => ({ touchDx, touchDy, touchFiring, touchFocus }),
      onTouchDeviceChange: (touch) => {
        isTouchDevice = touch;
      },
      onFirstTouch: ensureFullscreenOnInteraction,
      onOrientationChange: checkOrientation,
      onFullscreenChange: handleFullscreenChange,
      onToggleFullscreen: toggleFullscreen,
      onAuthorityStateChange: (isAuthoritative) => {
        isBackendAuthoritative = isAuthoritative;
        if (isAuthoritative) {
          backendStatusMessage = 'Backend conectado. Sincronizando partida...';
        }
      },
      onBackendUnavailable: (err) => {
        const reason = err instanceof Error && err.message ? err.message : 'No se pudo conectar al backend host.';
        backendStatusMessage = `No se pudo iniciar la partida: ${reason}`;
      },
      onPlayersSnapshot: (players, myPlayerId) => {
        companionSlots = mergeCompanionSnapshot(companionSlots, players, myPlayerId);
      },
      onEngineFrame: (engine) => {
        playerHp = engine.playerHp;
        playerMaxHp = engine.playerMaxHp;
        playerSp = engine.playerSp;
        playerMaxSp = engine.playerMaxSp;
        bossRemainingStocks = engine.remainingStocks;
        isBossRefilling = engine.isRefillingHp;
        bossDisplayHpPercent = engine.displayHpPercent;
        spellcardName = engine.spellcardName;
        showBossHpBar = engine.showBossHpBar;
        stageBanner = engine.stageBanner ? { text: engine.stageBanner.text, subtext: engine.stageBanner.subtext } : null;
        bossWarningActive = engine.bossWarningActive;
        spellcardBanner = engine.spellcardBanner.active ? { active: true, name: engine.spellcardBanner.name } : null;
        isStageClear = engine.isStageClear;
        isBeamStruggle = engine.isBeamStruggle;
        isStruggleAligning = engine.isStruggleAligning;
        struggleProgress = engine.struggleProgress;
        struggleTimeLeft = engine.struggleTimeLeft;
      },
    });

    session.start();
  });

  onDestroy(() => {
    session?.stop();
    session = null;
  });
</script>

<svelte:head>
  <title>Jogo Bonito - Arena de Combate</title>
</svelte:head>

<div class="game-viewport" role="application" aria-label="Jogo Bonito Game Screen">
  <div class="main-layout-container">
    <GameHudHeader
      {selectedClass}
      {playerAvatarSrc}
      {playerHpPercent}
      {playerSpPercent}
      {isUltiReady}
      {companionSlots}
      {showBossHpBar}
      {bossRemainingStocks}
      {spellcardName}
      {isBossRefilling}
      {bossDisplayHpPercent}
    />

    <main class="combat-arena-wrapper">
      <div class="arena-frame-rail top-rail"></div>

      <div class="canvas-container">
        <canvas bind:this={canvasRef}></canvas>

        <GameArenaOverlays
          {stageBanner}
          {bossWarningActive}
          {spellcardBanner}
          {isStruggleAligning}
          {isBeamStruggle}
          {struggleProgress}
          {struggleTimeLeft}
          {isTouchDevice}
          {isStageClear}
          backendRequired={true}
          backendConnected={isBackendAuthoritative}
          {backendStatusMessage}
          onPushStruggle={handlePushStruggle}
          onRestartStage={restartStage}
        />

        {#if isTouchDevice}
          <TouchControlsOverlay
            {joystickActive}
            {joystickStickPos}
            {touchFocus}
            {touchFiring}
            onJoystickStart={handleJoystickStart}
            onJoystickMove={handleJoystickMove}
            onJoystickEnd={handleJoystickEnd}
            onTriggerSkill={triggerSkill}
            onToggleFocus={toggleTouchFocus}
            onFireStart={() => setTouchFiring(true)}
            onFireEnd={() => setTouchFiring(false)}
          />
        {/if}
      </div>

      <div class="arena-frame-rail bottom-rail"></div>
    </main>

    <AdFooter />

    <FloatingControlsBar
      {selectedClass}
      {isFullscreen}
      onSelectRole={selectRole}
      onTriggerSkill={triggerSkill}
      onSpawnBoss={spawnBossNow}
      onStartStruggle={startBeamStruggleTest}
      onToggleFullscreen={toggleFullscreen}
      showDebugActions={false}
    />
  </div>

  <PortraitLockOverlay
    {isPortraitWarning}
    onRequestLandscape={requestLandscapeMode}
  />
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: #09090b;
    color: #f4f4f5;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  .game-viewport {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: #060608;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  .main-layout-container {
    width: 100%;
    height: 100%;
    max-width: 1366px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    box-sizing: border-box;
    position: relative;
    padding: 6px 12px;
  }

  .combat-arena-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 0;
    width: 100%;
    background: #030304;
  }

  .arena-frame-rail {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #3f3f46, #71717a, #3f3f46);
    box-shadow: 0 0 6px rgba(113, 113, 122, 0.5);
    z-index: 5;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000000;
    overflow: hidden;
  }

  canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
