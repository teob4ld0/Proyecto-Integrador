<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { Stage1Engine } from '$lib/engine/Stage1Engine';
  import { GameWSClient, type GameSnapshot } from '$lib/network/wsClient';
  import { APIClient } from '$lib/network/apiClient';

  let canvasRef: HTMLCanvasElement;
  let engine: Stage1Engine | null = null;
  let gameClient: GameWSClient | null = null;

  // Parámetros de Partida
  let roomId = $state('');
  let classId = $state('attack');
  let token = $state('');
  let selectedClass = $state<'Tank' | 'Support' | 'DPS' | 'Special_Attack'>('DPS');

  // Director de Stage y Avisos
  let stageBanner = $state<{ text: string; subtext: string } | null>(null);
  let bossWarningActive = $state(false);
  let spellcardBanner = $state<{ active: boolean; name: string } | null>(null);
  let isStageClear = $state(false);
  let showBossHpBar = $state(false);

  function restartStage() {
    engine?.restartStage();
  }

  function startBeamStruggleTest() {
    selectedClass = 'Special_Attack';
    engine?.startBeamStruggleTest();
  }

  function selectRole(role: 'Tank' | 'Support' | 'DPS' | 'Special_Attack') {
    selectedClass = role;
    engine?.setCharacterClass(role);
  }

  function triggerSkill() {
    if (engine && !(engine.isBackendConnected && engine.useBackendBullets)) {
      engine.triggerCharacterSkill();
    }
    if (gameClient) {
      const action = selectedClass === 'Tank' ? 'wall' : (selectedClass === 'Special_Attack' ? 'laser' : 'special');
      gameClient.sendInput(0, 0, action);
    }
  }

  // Estadísticas HUD Horizontal Bullet Hell
  let score = $state(0);
  let hiScore = $state(90039210);
  let playerLives = $state(3);
  let playerBombs = $state(3);
  let power = $state(0);
  let graze = $state(0);
  let playerHp = $state(100);
  let playerMaxHp = $state(100);
  let playerSp = $state(0);
  let playerMaxSp = $state(1000);
  let bossHp = $state(110);
  let maxBossHp = $state(110);
  let bossRemainingStocks = $state(4);
  let isBossRefilling = $state(false);
  let bossDisplayHpPercent = $state(100);
  let isBossSpellCard = $state(false);
  let spellcardName = $state('Twilight Non-Spell "Evening Flutter"');
  let isFocus = $state(false);

  // Estado Beam Struggle QTE
  let isBeamStruggle = $state(false);
  let isStruggleAligning = $state(false);
  let struggleProgress = $state(50);
  let struggleTimeLeft = $state(3.5);

  function handlePushStruggle() {
    if (gameClient) {
      gameClient.sendInput(0, 0, 'struggle_push');
      return;
    }
    engine?.pushStruggle(4.5);
  }

  // Controles Táctiles y Móvil
  let isTouchDevice = $state(false);
  let touchDx = $state(0);
  let touchDy = $state(0);
  let touchFiring = $state(false);
  let touchFocus = $state(false);
  let joystickActive = $state(false);
  let joystickBasePos = $state({ x: 0, y: 0 });
  let joystickStickPos = $state({ x: 0, y: 0 });
  let isPortraitWarning = $state(false);

  const keys: Record<string, boolean> = {};
  let animFrameId: number;
  let lastTime = performance.now();
  let myPlayerId = $state('');

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
      // Ignorar si el navegador no permite bloqueo programático
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

  onMount(() => {
    // Detectar si el usuario está en un dispositivo móvil/touch real sin ratón
    if (typeof window !== 'undefined') {
      const isCoarse = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      isTouchDevice = isCoarse && hasTouch;

      const onFirstTouch = () => {
        isTouchDevice = true;
        checkOrientation();
        window.removeEventListener('touchstart', onFirstTouch);
      };
      window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
    }

    // 1. Recibir roomId, token y class desde el Frontend Principal
    const searchParams = new URLSearchParams(window.location.search);
    roomId = searchParams.get('roomId') || searchParams.get('room') || 'default-room';
    classId = searchParams.get('class') || searchParams.get('character') || 'attack';
    token = searchParams.get('token') || APIClient.getToken() || '';

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    if (!canvasRef) return;

    // 2. Inicializar Motor Danmaku Horizontal (Canvas 1024x576)
    engine = new Stage1Engine(canvasRef, 1024, 576);
    engine.setCharacterClass(classId);

    // 3. Conexión WebSocket al servidor de juego (/game) con el roomId recibido
    if (token && roomId) {
      gameClient = new GameWSClient(token);
      gameClient.connect(
        roomId,
        (playerId, initialState) => {
          myPlayerId = playerId;
          console.log('[JogoBonito] Conectado al juego con ID:', playerId, 'en Sala:', roomId);
          if (engine && initialState) {
            if (initialState.players) engine.applyBackendSnapshot(initialState.players, myPlayerId);
            if (initialState.bullets) engine.applyBackendBullets(initialState.bullets);
            if (initialState.lasers) engine.applyBackendLasers(initialState.lasers);
            if (initialState.boss) engine.applyBackendBoss(initialState.boss);
            if (initialState.struggle) engine.applyBackendStruggle(initialState.struggle);
          }
        },
        (snapshot: GameSnapshot) => {
          if (engine) {
            if (snapshot.players) engine.applyBackendSnapshot(snapshot.players, myPlayerId);
            if (snapshot.bullets) engine.applyBackendBullets(snapshot.bullets);
            if (snapshot.lasers) engine.applyBackendLasers(snapshot.lasers);
            if (snapshot.boss) engine.applyBackendBoss(snapshot.boss);
            if (snapshot.struggle) engine.applyBackendStruggle(snapshot.struggle);
          }
        }
      ).catch((err) => {
        console.warn('[JogoBonito] Ejecutando juego en modo Standalone / Singleplayer:', err);
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Si se pasa ?test=beam o ?test=struggle en la URL, iniciar prueba inmediata
    const testMode = searchParams.get('test');
    if (testMode === 'beam' || testMode === 'struggle') {
      setTimeout(() => startBeamStruggleTest(), 120);
    }

    // 4. Game Loop principal (60 FPS)
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (engine) {
        let dx = 0;
        let dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || keys['a'] || keys['A']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD'] || keys['d'] || keys['D']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['w'] || keys['W']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS'] || keys['s'] || keys['S']) dy += 1;

        if (touchDx !== 0 || touchDy !== 0) {
          dx = touchDx;
          dy = touchDy;
        }

        const isShooting = !!keys['KeyZ'] || !!keys['Space'] || !!keys['z'] || !!keys['Z'] || touchFiring;
        const isFocusing = !!keys['ShiftLeft'] || !!keys['ShiftRight'] || !!keys['Shift'] || !!keys['shift'] || touchFocus;

        const effectiveKeys: Record<string, boolean> = {
          ...keys,
          KeyZ: isShooting,
          Space: isShooting,
          ShiftLeft: isFocusing,
          ShiftRight: isFocusing,
          Shift: isFocusing,
          focus: isFocusing,
          isFocus: isFocusing,
        };

        // Pasar dirección y teclas al motor
        engine.update(dt, effectiveKeys, { dx, dy });

        const action = isShooting ? 'shoot' : null;
        if (gameClient) {
          gameClient.sendInput(dx, dy, action);
        }

        // Sincronizar UI
        score = engine.score;
        hiScore = engine.hiScore;
        playerLives = engine.playerLives;
        playerBombs = engine.playerBombs;
        power = engine.power;
        graze = engine.graze;
        playerHp = engine.playerHp;
        playerMaxHp = engine.playerMaxHp;
        playerSp = engine.playerSp;
        playerMaxSp = engine.playerMaxSp;
        bossHp = engine.bossHp;
        maxBossHp = engine.maxBossHp;
        bossRemainingStocks = engine.remainingStocks;
        isBossRefilling = engine.isRefillingHp;
        bossDisplayHpPercent = engine.displayHpPercent;
        isBossSpellCard = engine.isSpellCard;
        spellcardName = engine.spellcardName;
        isFocus = engine.isFocus;
        showBossHpBar = engine.showBossHpBar;
        stageBanner = engine.stageBanner ? { text: engine.stageBanner.text, subtext: engine.stageBanner.subtext } : null;
        bossWarningActive = engine.bossWarningActive;
        spellcardBanner = engine.spellcardBanner.active ? { active: true, name: engine.spellcardBanner.name } : null;
        isStageClear = engine.isStageClear;

        // Sincronizar Beam Struggle QTE
        isBeamStruggle = engine.isBeamStruggle;
        isStruggleAligning = engine.isStruggleAligning;
        struggleProgress = engine.struggleProgress;
        struggleTimeLeft = engine.struggleTimeLeft;
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      cancelAnimationFrame(animFrameId);
      gameClient?.disconnect();
      engine?.destroy();
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    keys[e.code] = true;
    keys[e.key] = true;
    if (e.shiftKey || e.key === 'Shift') {
      keys['Shift'] = true;
      keys['ShiftLeft'] = true;
      keys['ShiftRight'] = true;
    }
    if (e.code === 'Digit1') selectRole('Tank');
    if (e.code === 'Digit2') selectRole('Support');
    if (e.code === 'Digit3') selectRole('DPS');
    if (e.code === 'Digit4') selectRole('Special_Attack');
    if (e.code === 'KeyX') triggerSkill();
    if (e.code === 'KeyT') startBeamStruggleTest();
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
    keys[e.key] = false;
    if (!e.shiftKey && e.key === 'Shift') {
      keys['Shift'] = false;
      keys['ShiftLeft'] = false;
      keys['ShiftRight'] = false;
    }
  }

  function formatScore(val: number): string {
    return Math.floor(val).toString().padStart(9, '0');
  }
</script>

<svelte:head>
  <title>Jogo Bonito - Danmaku Stage</title>
</svelte:head>

<div class="horizontal-screen">
  <div class="game-wrapper">
    <!-- BARRA SUPERIOR HUD DE JEFE CON STOCKS TOUHOU -->
    {#if showBossHpBar}
      <div class="boss-top-hud {isBossRefilling ? 'refilling' : ''}">
        <div class="boss-info">
          <div class="boss-title-row">
            <div class="boss-stocks-stars" title="Vidas restantes del Jefe">
              {#each Array.from({ length: Math.max(0, bossRemainingStocks) }) as _}
                <span class="stock-star">★</span>
              {/each}
            </div>
            <span class="boss-name">FIRST BOSS (RUMIA)</span>
            {#if isBossSpellCard}
              <span class="spell-badge">SPELL CARD</span>
            {:else}
              <span class="nonspell-badge">NON-SPELL</span>
            {/if}
          </div>
          <span class="spell-name">{spellcardName}</span>
        </div>
        <div class="boss-hp-track">
          <div 
            class="boss-hp-fill {isBossSpellCard ? 'spell' : 'nonspell'}" 
            style="width: {bossDisplayHpPercent}%"
          ></div>
        </div>
      </div>
    {/if}

    <!-- SELECTOR RÁPIDO DE PERSONAJES / DEBUG BARRA -->
    <div class="role-selector-bar">
      <span class="role-label">CLASS:</span>
      <button class="role-btn {selectedClass === 'Tank' ? 'active' : ''}" onclick={() => selectRole('Tank')}>
        🛡️ TANK [1]
      </button>
      <button class="role-btn {selectedClass === 'Support' ? 'active' : ''}" onclick={() => selectRole('Support')}>
        💖 SUPPORT [2]
      </button>
      <button class="role-btn {selectedClass === 'DPS' ? 'active' : ''}" onclick={() => selectRole('DPS')}>
        ⚔️ DPS [3]
      </button>
      <button class="role-btn {selectedClass === 'Special_Attack' ? 'active' : ''}" onclick={() => selectRole('Special_Attack')}>
        ⚡ SP.ATK [4]
      </button>
      <button class="role-skill-btn" onclick={triggerSkill} title="Habilidad: Muro o Láser Ultimate">
        ⭐ SKILL [X]
      </button>
      <button class="test-struggle-hud-btn" onclick={startBeamStruggleTest} title="Probar Choque de Rayos Inmediatamente [T]">
        ⚡ TEST STRUGGLE [T]
      </button>
      {#if isStageClear}
        <button class="replay-hud-btn" onclick={restartStage}>
          🔄 REPLAY
        </button>
      {/if}
    </div>

    <!-- CANVAS PRINCIPAL DANMAKU HORIZONTAL -->
    <div class="canvas-container">
      <canvas bind:this={canvasRef}></canvas>

      <!-- ANUNCIO DE STAGE TITLE CARD -->
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

      <!-- ALERTA DE JEFE / BOSS WARNING -->
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

      <!-- BANNER DE CORTE SPELLCARD -->
      {#if spellcardBanner && spellcardBanner.active}
        <div class="spellcard-cutin-banner">
          <span class="spellcard-tag">SPELL CARD</span>
          <span class="spellcard-title">{spellcardBanner.name}</span>
        </div>
      {/if}

      <!-- AVISO DRAMÁTICO DURANTE LA ANIMACIÓN DE ENTRADA AL CENTRO -->
      {#if isStruggleAligning}
        <div class="beam-clash-intro-banner">
          <div class="clash-intro-badge">⚡ BEAM CLASH INCOMING ⚡</div>
          <div class="clash-intro-sub">¡PREPÁRATE PARA MACHACAR [Z]!</div>
        </div>
      {/if}

      <!-- OVERLAY DE CHOQUE DE RAYOS (HUD SUPERIOR LIMPIO CON TECLA Z ANIMADA) -->
      {#if isBeamStruggle}
        <div class="beam-struggle-clean-overlay">
          <!-- Barra superior estilizada que NO tapa el centro -->
          <div class="struggle-top-bar">
            <!-- Barra de Tira y Afloja compacta -->
            <div class="struggle-balance-line">
              <span class="stream-badge player">⚡ SPARK</span>
              <div class="slim-tug-track">
                <div class="slim-tug-fill player" style="width: {struggleProgress}%"></div>
                <div class="slim-tug-fill boss" style="width: {100 - struggleProgress}%"></div>
                <div class="slim-clash-icon" style="left: {struggleProgress}%">⚔️</div>
              </div>
              <span class="stream-badge boss">RAY ☀️</span>
            </div>

            <!-- Indicador Central: Tecla Z animada presionándose a toda velocidad -->
            <div class="mash-key-box">
              <div class="animated-mash-key">
                <span class="key-letter">Z</span>
                <span class="key-tap-wave"></span>
              </div>
              <span class="mash-text">¡MASH!</span>
            </div>

            <!-- Temporizador restante -->
            <div class="struggle-timer-badge">
              ⏱️ {struggleTimeLeft.toFixed(1)}s
            </div>
          </div>

          <!-- Botón de Machaque Táctil en Celular (Discreto en esquina inferior derecha) -->
          {#if isTouchDevice}
            <button 
              class="mobile-struggle-corner-btn" 
              ontouchstart={(e) => { e.preventDefault(); handlePushStruggle(); }} 
              onclick={handlePushStruggle}
              aria-label="Push Struggle button"
            >
              ⚡<br/><small>MASH</small>
            </button>
          {/if}
        </div>
      {/if}

      <!-- OVERLAY DE VICTORIA / STAGE CLEAR -->
      {#if isStageClear}
        <div class="stage-clear-overlay">
          <div class="stage-clear-card">
            <div class="clear-badge">STAGE COMPLETE</div>
            <h1 class="clear-title">STAGE 1 CLEARED!</h1>
            <p class="clear-sub">The dark mist in the forest recedes into the moonlight.</p>
            <div class="clear-stats-grid">
              <div class="clear-stat-box">
                <span class="stat-label">TOTAL SCORE</span>
                <span class="stat-num glow">{formatScore(score)}</span>
              </div>
              <div class="clear-stat-box">
                <span class="stat-label">GRAZE COUNT</span>
                <span class="stat-num">{graze}</span>
              </div>
              <div class="clear-stat-box">
                <span class="stat-label">FINAL POWER</span>
                <span class="stat-num cyan">{power} / 128</span>
              </div>
              <div class="clear-stat-box">
                <span class="stat-label">REMAINING LIVES</span>
                <span class="stat-num pink">{playerLives} ★</span>
              </div>
            </div>
            <button class="stage-replay-btn" onclick={restartStage}>
              🔄 JUGAR OTRA VEZ (REPLAY)
            </button>
          </div>
        </div>
      {/if}

      <!-- CONTROLES TÁCTILES VIRTUALES (Solo en móviles / tablets) -->
      {#if isTouchDevice}
        <div class="touch-controls-overlay">
          <!-- Joystick Virtual (Izquierda) -->
          <div 
            class="touch-joystick-zone"
            ontouchstart={handleJoystickStart}
            ontouchmove={handleJoystickMove}
            ontouchend={handleJoystickEnd}
            ontouchcancel={handleJoystickEnd}
            role="button"
            tabindex="0"
            aria-label="Virtual Joystick"
          >
            <div class="joystick-base {joystickActive ? 'active' : ''}">
              <div 
                class="joystick-stick"
                style="transform: translate({joystickStickPos.x}px, {joystickStickPos.y}px);"
              ></div>
            </div>
          </div>

          <!-- Botones de Acción (Derecha) -->
          <div class="touch-buttons-zone">
            <button 
              class="touch-btn skill-touch-btn"
              ontouchstart={(e) => { e.preventDefault(); triggerSkill(); }}
              aria-label="Skill mode"
            >
              SKILL
            </button>
            <button 
              class="touch-btn focus-btn {touchFocus ? 'active' : ''}"
              ontouchstart={(e) => { e.preventDefault(); touchFocus = !touchFocus; }}
              aria-label="Focus mode"
            >
              FOCUS
            </button>
            <button 
              class="touch-btn fire-btn {touchFiring ? 'active' : ''}"
              ontouchstart={(e) => { e.preventDefault(); touchFiring = true; }}
              ontouchend={(e) => { e.preventDefault(); touchFiring = false; }}
              ontouchcancel={(e) => { e.preventDefault(); touchFiring = false; }}
              aria-label="Fire bullets"
            >
              FIRE
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- BARRA INFERIOR DE ESTADÍSTICAS HUD -->
    <div class="bottom-hud">
      <div class="hud-item">
        <span class="hud-title">SCORE</span>
        <span class="hud-val">{formatScore(score)}</span>
      </div>
      <div class="hud-item">
        <span class="hud-title">POWER</span>
        <span class="hud-val power-val">{power}<small style="font-size:0.6rem;color:#888;">/128</small></span>
      </div>
      <div class="hud-item">
        <span class="hud-title">HP</span>
        <span class="hud-val">{Math.max(0, playerHp).toFixed(0)}<small style="font-size:0.6rem;color:#888;">/{playerMaxHp.toFixed(0)}</small></span>
      </div>
      <div class="hud-item">
        <span class="hud-title">SP</span>
        <span class="hud-val">{Math.max(0, playerSp).toFixed(0)}<small style="font-size:0.6rem;color:#888;">/{playerMaxSp.toFixed(0)}</small></span>
      </div>
      <div class="hud-item hide-on-mobile">
        <span class="hud-title">HI-SCORE</span>
        <span class="hud-val">{formatScore(hiScore)}</span>
      </div>
      <div class="hud-item">
        <span class="hud-title">PLAYER</span>
        <div class="stars">
          {#each Array.from({ length: Math.max(0, playerLives) }) as _}
            <span class="star red">★</span>
          {/each}
        </div>
      </div>
      <div class="hud-item">
        <span class="hud-title">BOMB</span>
        <div class="stars">
          {#each Array.from({ length: Math.max(0, playerBombs) }) as _}
            <span class="star green">★</span>
          {/each}
        </div>
      </div>
      <div class="hud-item hide-on-mobile">
        <span class="hud-title">GRAZE</span>
        <span class="hud-val small">{graze}</span>
      </div>
      <div class="hud-item focus-indicator {isFocus ? 'active' : ''}">
        <span>{isFocus ? 'FOCUS' : 'NORMAL'}</span>
      </div>
    </div>
  </div>

  <!-- AVISO / BLOQUEO EN MODO VERTICAL (PORTRAIT) -->
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
        <h2 class="rotate-title">GIRÁ TU TELÉFONO</h2>
        <p class="rotate-desc">El Bullet Hell horizontal está optimizado para pantalla apaisada (Landscape).</p>
        <button class="fullscreen-btn" onclick={requestLandscapeMode}>
          🔄 PANTALLA COMPLETA
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #030206;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    font-family: 'Courier New', monospace;
  }

  .horizontal-screen {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #0e091a 0%, #030206 100%);
    overflow: hidden;
    box-sizing: border-box;
    padding: 6px;
    touch-action: none;
  }

  .game-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #000000;
    padding: 6px;
    border-radius: 10px;
    border: 2px solid #261f3d;
    box-shadow: 0 0 45px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 43, 91, 0.25);
    width: min(96vw, 1060px);
    max-width: 100%;
    box-sizing: border-box;
    touch-action: none;
  }

  .boss-top-hud {
    background: rgba(14, 10, 26, 0.92);
    padding: 5px 12px;
    border-radius: 6px 6px 0 0;
    border: 1px solid rgba(255, 43, 91, 0.4);
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 4px;
    flex-shrink: 0;
    transition: border-color 0.2s;
  }

  .boss-top-hud.refilling {
    border-color: #00f2fe;
    box-shadow: 0 0 14px rgba(0, 242, 254, 0.5);
    animation: refillGlow 0.4s infinite alternate;
  }

  @keyframes refillGlow {
    0% { background: rgba(14, 10, 26, 0.92); }
    100% { background: rgba(20, 28, 55, 0.95); }
  }

  .boss-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .boss-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .boss-stocks-stars {
    display: flex;
    gap: 2px;
  }

  .stock-star {
    color: #ff2b5b;
    font-size: 0.85rem;
    line-height: 1;
    text-shadow: 0 0 6px rgba(255, 43, 91, 0.9);
  }

  .spell-badge {
    font-size: 0.55rem;
    background: linear-gradient(135deg, #ff2b5b, #7928ca);
    color: #ffffff;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 1px;
    font-weight: 900;
    box-shadow: 0 0 6px rgba(255, 43, 91, 0.6);
  }

  .nonspell-badge {
    font-size: 0.55rem;
    background: rgba(0, 242, 254, 0.15);
    color: #00f2fe;
    border: 1px solid rgba(0, 242, 254, 0.6);
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.5px;
    font-weight: 700;
  }

  .boss-name {
    color: #ff2b5b;
    font-weight: 900;
    letter-spacing: 0.5px;
  }

  .spell-name {
    color: #00f2fe;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 55%;
    text-align: right;
    font-family: monospace;
    font-size: 0.72rem;
  }

  .boss-hp-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .boss-hp-fill {
    height: 100%;
    transition: width 0.08s linear;
  }

  .boss-hp-fill.spell {
    background: linear-gradient(90deg, #ff2b5b, #00f2fe 70%, #ffdd00 100%);
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.8);
  }

  .boss-hp-fill.nonspell {
    background: linear-gradient(90deg, #ff2b5b, #ff8800);
  }

  .canvas-container {
    position: relative;
    border: 2px solid #1a162b;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #06040a;
    display: flex;
    justify-content: center;
    align-items: center;
    touch-action: none;
  }

  canvas {
    width: 100%;
    height: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    touch-action: none;
  }

  /* Controles Táctiles */
  .touch-controls-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    pointer-events: none;
    justify-content: space-between;
    align-items: flex-end;
    padding: 12px;
    box-sizing: border-box;
    z-index: 20;
  }

  .touch-joystick-zone {
    pointer-events: auto;
    width: 110px;
    height: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .joystick-base {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: rgba(14, 10, 26, 0.45);
    border: 2px solid rgba(0, 242, 254, 0.35);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: border-color 0.2s;
  }

  .joystick-base.active {
    border-color: rgba(0, 242, 254, 0.8);
    background: rgba(14, 10, 26, 0.65);
  }

  .joystick-stick {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle, #00f2fe 0%, #0d4a75 100%);
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.6);
    pointer-events: none;
  }

  .touch-buttons-zone {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
    touch-action: none;
  }

  .touch-btn {
    border: none;
    border-radius: 50%;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
    touch-action: none;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    transition: transform 0.1s, background-color 0.1s, box-shadow 0.1s;
  }

  .touch-btn:active, .touch-btn.active {
    transform: scale(0.92);
  }

  .fire-btn {
    width: 60px;
    height: 60px;
    font-size: 0.8rem;
    background: rgba(255, 43, 91, 0.35);
    border: 2px solid #ff2b5b;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(255, 43, 91, 0.4);
  }

  .fire-btn:active, .fire-btn.active {
    background: rgba(255, 43, 91, 0.75);
    box-shadow: 0 0 18px rgba(255, 43, 91, 0.8);
  }

  .focus-btn {
    width: 48px;
    height: 48px;
    font-size: 0.65rem;
    background: rgba(0, 242, 254, 0.25);
    border: 2px solid #00f2fe;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.3);
  }

  .focus-btn.active {
    background: rgba(0, 242, 254, 0.6);
    box-shadow: 0 0 16px rgba(0, 242, 254, 0.7);
  }

  /* Bottom HUD */
  .bottom-hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #090714;
    padding: 4px 10px;
    margin-top: 4px;
    border-radius: 0 0 6px 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .hud-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .hud-title {
    font-size: 0.55rem;
    color: #888;
    letter-spacing: 1px;
  }

  .hud-val {
    font-size: 0.85rem;
    font-weight: bold;
    color: #ffffff;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.4);
  }

  .hud-val.small {
    font-size: 0.8rem;
    color: #00f2fe;
  }

  .stars {
    display: flex;
    gap: 2px;
    font-size: 0.8rem;
  }

  .star.red {
    color: #ff3355;
    text-shadow: 0 0 6px #ff3355;
  }

  .star.green {
    color: #00ff88;
    text-shadow: 0 0 6px #00ff88;
  }

  .focus-indicator {
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.6rem;
    color: #888;
  }

  .focus-indicator.active {
    background: rgba(255, 43, 91, 0.2);
    border-color: #ff2b5b;
    color: #ffffff;
  }

  /* Overlay de Bloqueo Portrait */
  .portrait-lock-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: rgba(4, 2, 8, 0.96);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
  }

  .rotate-phone-card {
    background: #0d091a;
    border: 2px solid #ff2b5b;
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    box-shadow: 0 0 30px rgba(255, 43, 91, 0.4);
    max-width: 300px;
  }

  .rotate-icon-wrapper {
    animation: rotatePhone 2.2s ease-in-out infinite alternate;
  }

  @keyframes rotatePhone {
    0% { transform: rotate(0deg); }
    30% { transform: rotate(0deg); }
    70% { transform: rotate(90deg); }
    100% { transform: rotate(90deg); }
  }

  .rotate-title {
    margin: 0;
    font-size: 1.1rem;
    color: #ff2b5b;
    letter-spacing: 2px;
    font-weight: bold;
  }

  .rotate-desc {
    margin: 0;
    font-size: 0.8rem;
    color: #c4c0d0;
    line-height: 1.4;
  }

  .fullscreen-btn {
    background: linear-gradient(135deg, #ff2b5b, #00f2fe);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 25px;
    font-weight: bold;
    font-size: 0.8rem;
    cursor: pointer;
    letter-spacing: 1px;
    box-shadow: 0 0 15px rgba(0, 242, 254, 0.4);
    transition: transform 0.1s;
  }

  .fullscreen-btn:active {
    transform: scale(0.95);
  }

  /* Role Selector Bar */
  .role-selector-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 3px 6px;
    background: rgba(10, 8, 20, 0.85);
    border: 1px solid rgba(0, 242, 254, 0.25);
    border-radius: 6px;
    margin-bottom: 2px;
    z-index: 10;
  }

  .role-label {
    font-family: monospace;
    font-size: 0.65rem;
    font-weight: bold;
    color: #888;
    margin-right: 2px;
  }

  .role-btn {
    background: rgba(25, 20, 45, 0.8);
    color: #c4c0d0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 3px 7px;
    font-size: 0.62rem;
    font-family: monospace;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .role-btn:hover {
    background: rgba(0, 242, 254, 0.2);
    border-color: #00f2fe;
    color: #fff;
  }

  .role-btn.active {
    background: linear-gradient(135deg, rgba(0, 242, 254, 0.4), rgba(255, 43, 91, 0.4));
    border-color: #00f2fe;
    color: #00f2fe;
    font-weight: bold;
    box-shadow: 0 0 8px rgba(0, 242, 254, 0.3);
  }

  .role-skill-btn {
    background: linear-gradient(135deg, #ff8800, #ff2b5b);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 3px 9px;
    font-size: 0.65rem;
    font-weight: bold;
    font-family: monospace;
    cursor: pointer;
    margin-left: 4px;
    box-shadow: 0 0 10px rgba(255, 136, 0, 0.4);
    transition: transform 0.1s;
  }

  .role-skill-btn:active {
    transform: scale(0.95);
  }

  .test-struggle-hud-btn {
    background: linear-gradient(135deg, #ffdd00, #ff2b5b);
    color: #000;
    border: 1px solid #fff;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 0.65rem;
    font-weight: 900;
    font-family: monospace;
    cursor: pointer;
    margin-left: 6px;
    box-shadow: 0 0 12px rgba(255, 221, 0, 0.7);
    animation: struggleBtnGlow 0.8s infinite alternate;
  }

  @keyframes struggleBtnGlow {
    0% { transform: scale(1); box-shadow: 0 0 10px rgba(255, 221, 0, 0.6); }
    100% { transform: scale(1.05); box-shadow: 0 0 18px rgba(255, 43, 91, 0.9); }
  }

  .test-struggle-hud-btn:active {
    transform: scale(0.95);
  }

  .skill-touch-btn {
    width: 46px;
    height: 46px;
    font-size: 0.6rem;
    background: linear-gradient(135deg, rgba(255, 136, 0, 0.5), rgba(255, 43, 91, 0.6));
    border-color: #ff8800;
    color: #fff;
    font-weight: bold;
    box-shadow: 0 0 12px rgba(255, 136, 0, 0.35);
  }

  @media (max-width: 600px) {
    .role-selector-bar {
      gap: 3px;
      padding: 2px 4px;
    }
    .role-label {
      display: none;
    }
    .role-btn {
      padding: 2px 4px;
      font-size: 0.55rem;
    }
    .role-skill-btn {
      padding: 2px 6px;
      font-size: 0.55rem;
    }
    .hide-on-mobile {
      display: none;
    }
    .game-wrapper {
      padding: 3px;
    }
    .boss-top-hud {
      padding: 2px 6px;
    }
    .bottom-hud {
      padding: 2px 6px;
    }
    .touch-joystick-zone {
      width: 90px;
      height: 90px;
    }
    .joystick-base {
      width: 70px;
      height: 70px;
    }
    .joystick-stick {
      width: 28px;
      height: 28px;
    }
    .fire-btn {
      width: 50px;
      height: 50px;
      font-size: 0.7rem;
    }
    .focus-btn {
      width: 40px;
      height: 40px;
      font-size: 0.55rem;
    }
  }

  /* ── Overlays Estilo Touhou ─────────────────────────────────────────── */

  .replay-hud-btn {
    background: linear-gradient(135deg, #00f2fe, #7928ca);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 0.62rem;
    font-weight: bold;
    font-family: monospace;
    cursor: pointer;
    margin-left: auto;
    box-shadow: 0 0 8px rgba(0, 242, 254, 0.4);
  }

  .power-val {
    color: #ff3366 !important;
    font-weight: bold;
  }

  /* Stage Intro Banner */
  .stage-banner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 25;
    animation: fadeInOut 4.5s ease forwards;
  }

  .stage-banner-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(8, 6, 18, 0.85);
    border-top: 2px solid #ff2b5b;
    border-bottom: 2px solid #00f2fe;
    padding: 18px 45px;
    border-radius: 8px;
    box-shadow: 0 0 35px rgba(0, 0, 0, 0.9), 0 0 15px rgba(255, 43, 91, 0.3);
    backdrop-filter: blur(8px);
  }

  .stage-banner-badge {
    font-size: 0.7rem;
    letter-spacing: 3px;
    color: #ffdd00;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .stage-banner-title {
    margin: 0;
    font-size: 2.2rem;
    font-weight: 900;
    letter-spacing: 6px;
    background: linear-gradient(135deg, #ffffff 0%, #00f2fe 50%, #ff2b5b 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 20px rgba(0, 242, 254, 0.5);
  }

  .stage-banner-divider {
    width: 80%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ff2b5b, #00f2fe, transparent);
    margin: 8px 0;
  }

  .stage-banner-subtext {
    margin: 0;
    font-size: 0.95rem;
    color: #e0e0ff;
    letter-spacing: 2px;
    font-style: italic;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: scale(0.92); }
    15% { opacity: 1; transform: scale(1); }
    75% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.05); }
  }

  /* Boss Warning Alert */
  .boss-warning-overlay {
    position: absolute;
    top: 20%;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    z-index: 30;
    animation: warningPulse 0.4s infinite alternate;
  }

  .hazard-bar {
    width: 100%;
    height: 8px;
    background: repeating-linear-gradient(
      -45deg,
      #ffdd00,
      #ffdd00 12px,
      #111 12px,
      #111 24px
    );
  }

  .warning-content {
    background: rgba(220, 20, 60, 0.92);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 10px 0;
    box-shadow: 0 0 25px rgba(255, 43, 91, 0.8);
  }

  .warning-text {
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 3px;
    color: #ffffff;
    text-shadow: 0 0 8px #000;
  }

  .warning-siren {
    font-size: 1.3rem;
  }

  @keyframes warningPulse {
    0% { opacity: 0.85; }
    100% { opacity: 1.0; }
  }

  /* Spellcard Cut-In */
  .spellcard-cutin-banner {
    position: absolute;
    top: 14px;
    right: 14px;
    background: rgba(12, 8, 24, 0.88);
    border-left: 4px solid #ff2b5b;
    border-bottom: 1px solid rgba(0, 242, 254, 0.5);
    padding: 8px 16px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    pointer-events: none;
    z-index: 24;
    box-shadow: 0 0 16px rgba(255, 43, 91, 0.35);
    animation: slideInRight 0.35s ease-out;
  }

  .spellcard-tag {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 2px;
    color: #ffdd00;
  }

  .spellcard-title {
    font-size: 0.85rem;
    font-weight: bold;
    color: #00f2fe;
    letter-spacing: 1px;
    text-shadow: 0 0 6px rgba(0, 242, 254, 0.5);
  }

  @keyframes slideInRight {
    from { transform: translateX(60px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* Stage Clear Victory Screen */
  .stage-clear-overlay {
    position: absolute;
    inset: 0;
    background: rgba(5, 3, 12, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
    animation: fadeIn 0.5s ease-out;
  }

  .stage-clear-card {
    background: rgba(18, 14, 32, 0.95);
    border: 2px solid #00f2fe;
    border-radius: 12px;
    padding: 24px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 0 40px rgba(0, 242, 254, 0.3), 0 0 20px rgba(255, 43, 91, 0.2);
    max-width: 480px;
    width: 90%;
  }

  .clear-badge {
    font-size: 0.75rem;
    letter-spacing: 3px;
    color: #00f2fe;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .clear-title {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: 4px;
    background: linear-gradient(135deg, #fff, #ffdd00, #ff2b5b);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .clear-sub {
    margin: 6px 0 16px 0;
    color: #999;
    font-size: 0.78rem;
    font-style: italic;
    text-align: center;
  }

  .clear-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    margin-bottom: 18px;
  }

  .clear-stat-box {
    background: rgba(26, 20, 48, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-label {
    font-size: 0.62rem;
    color: #888;
    letter-spacing: 1px;
  }

  .stat-num {
    font-size: 1.05rem;
    font-weight: bold;
    color: #fff;
    margin-top: 2px;
  }

  .stat-num.glow {
    color: #ffdd00;
    text-shadow: 0 0 8px rgba(255, 221, 0, 0.5);
  }

  .stat-num.cyan {
    color: #00f2fe;
  }

  .stat-num.pink {
    color: #ff2b5b;
  }

  .stage-replay-btn {
    background: linear-gradient(135deg, #00f2fe, #ff2b5b);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 0.85rem;
    font-weight: bold;
    font-family: monospace;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 0 0 16px rgba(0, 242, 254, 0.4);
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .stage-replay-btn:hover {
    transform: scale(1.04);
    box-shadow: 0 0 24px rgba(0, 242, 254, 0.6);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  /* ── BEAM CLASH INTRO BANNER ───────────────────────────────────────────── */
  .beam-clash-intro-banner {
    position: absolute;
    top: 24%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    z-index: 50;
    animation: clashIntroPop 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .clash-intro-badge {
    background: linear-gradient(90deg, #ff0055, #00f2fe, #ffdd00);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: 3px;
    text-shadow: 0 0 25px rgba(0, 242, 254, 0.8);
    animation: rainbowShift 1.2s infinite linear;
  }

  .clash-intro-sub {
    font-size: 0.9rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.9), 0 0 20px #00f2fe;
    background: rgba(4, 2, 12, 0.75);
    padding: 3px 14px;
    border-radius: 20px;
    border: 1px solid rgba(0, 242, 254, 0.6);
  }

  @keyframes clashIntroPop {
    0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
    40% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
    80% { transform: translate(-50%, -50%) scale(1.0); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.9; }
  }

  @keyframes rainbowShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* ── BEAM STRUGGLE CINEMATIC QTE OVERLAY ──────────────────────────────── */
  /* ── BEAM STRUGGLE TOP HUD (NO INTRUSIVO CON TECLA Z PULSANDO) ───────── */
  .beam-struggle-clean-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    z-index: 45;
  }

  .struggle-top-bar {
    width: 96%;
    margin-top: 6px;
    background: rgba(8, 5, 18, 0.88);
    backdrop-filter: blur(6px);
    border: 1.5px solid #00f2fe;
    border-radius: 8px;
    padding: 4px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 0 20px rgba(0, 242, 254, 0.35);
    box-sizing: border-box;
    animation: topBarGlow 0.6s infinite alternate;
  }

  @keyframes topBarGlow {
    0% { border-color: #00f2fe; box-shadow: 0 0 15px rgba(0, 242, 254, 0.3); }
    100% { border-color: #ffdd00; box-shadow: 0 0 22px rgba(255, 221, 0, 0.5); }
  }

  .struggle-balance-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 440px;
  }

  .stream-badge {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .stream-badge.player {
    color: #00f2fe;
    text-shadow: 0 0 6px rgba(0, 242, 254, 0.8);
  }

  .stream-badge.boss {
    color: #ffdd00;
    text-shadow: 0 0 6px rgba(255, 221, 0, 0.8);
  }

  .slim-tug-track {
    position: relative;
    flex: 1;
    height: 10px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    overflow: visible;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  .slim-tug-fill {
    transition: width 0.04s linear;
  }

  .slim-tug-fill.player {
    height: 100%;
    background: linear-gradient(90deg, #00f2fe, #00ff88);
    border-radius: 5px 0 0 5px;
    box-shadow: 0 0 10px rgba(0, 242, 254, 0.8);
  }

  .slim-tug-fill.boss {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    background: linear-gradient(90deg, #ff2b5b, #ffdd00);
    border-radius: 0 5px 5px 0;
    box-shadow: 0 0 10px rgba(255, 221, 0, 0.8);
  }

  .slim-clash-icon {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    font-size: 1rem;
    line-height: 1;
    filter: drop-shadow(0 0 6px #fff);
    animation: clashShake 0.06s infinite alternate;
  }

  @keyframes clashShake {
    0% { transform: translate(-50%, -50%) rotate(-6deg); }
    100% { transform: translate(-50%, -50%) rotate(6deg); }
  }

  .mash-key-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 10px;
    background: rgba(0, 242, 254, 0.08);
    border: 1px solid rgba(0, 242, 254, 0.35);
    border-radius: 6px;
  }

  .animated-mash-key {
    position: relative;
    width: 32px;
    height: 32px;
    background: linear-gradient(180deg, #2a2040, #140e24);
    border: 2px solid #00f2fe;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 0 #0088aa, 0 0 12px rgba(0, 242, 254, 0.8);
    animation: keyMashAction 0.14s infinite alternate ease-in-out;
  }

  @keyframes keyMashAction {
    0% { 
      transform: translateY(0) scale(1); 
      box-shadow: 0 4px 0 #0088aa, 0 0 10px rgba(0, 242, 254, 0.8);
      background: linear-gradient(180deg, #2a2040, #140e24);
    }
    100% { 
      transform: translateY(3px) scale(0.92); 
      box-shadow: 0 1px 0 #0088aa, 0 0 20px rgba(255, 221, 0, 1);
      background: #00f2fe;
    }
  }

  .key-letter {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 900;
    color: #00f2fe;
    animation: keyLetterColor 0.14s infinite alternate;
  }

  @keyframes keyLetterColor {
    0% { color: #00f2fe; }
    100% { color: #000000; }
  }

  .mash-text {
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: #ffdd00;
    text-shadow: 0 0 8px rgba(255, 221, 0, 0.9);
    animation: textPulse 0.14s infinite alternate;
  }

  @keyframes textPulse {
    0% { transform: scale(0.95); opacity: 0.9; }
    100% { transform: scale(1.08); opacity: 1; text-shadow: 0 0 14px rgba(255, 221, 0, 1); }
  }

  .struggle-timer-badge {
    font-family: monospace;
    font-size: 0.8rem;
    font-weight: bold;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 7px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .mobile-struggle-corner-btn {
    position: absolute;
    right: 14px;
    bottom: 14px;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    pointer-events: auto;
    background: linear-gradient(135deg, #ff2b5b, #ffdd00);
    color: #ffffff;
    font-weight: 900;
    font-size: 1rem;
    border: 2px solid #ffffff;
    box-shadow: 0 0 22px rgba(255, 221, 0, 0.9);
    cursor: pointer;
    animation: cornerBtnBounce 0.2s infinite alternate;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
  }

  @keyframes cornerBtnBounce {
    0% { transform: scale(0.96); }
    100% { transform: scale(1.08); box-shadow: 0 0 30px rgba(255, 221, 0, 1); }
  }
</style>

