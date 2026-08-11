<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { Stage1Engine } from '$lib/engine/Stage1Engine';
  import { GameWSClient, type GameSnapshot } from '$lib/network/wsClient';
  import { APIClient } from '$lib/network/apiClient';

  let canvasRef: HTMLCanvasElement;
  let engine: Stage1Engine | null = null;
  let gameClient: GameWSClient | null = null;

  // URL Params
  let roomId = $state('');
  let classId = $state('attack');
  let token = $state('');

  // Estadísticas para HUD Horizontal
  let score = $state(0);
  let hiScore = $state(90039210);
  let playerLives = $state(3);
  let playerBombs = $state(3);
  let power = $state(0);
  let graze = $state(0);
  let bossHp = $state(100);
  let maxBossHp = $state(100);
  let spellcardName = $state('Night Sign "Demon Night Walk"');
  let isFocus = $state(false);

  const keys: Record<string, boolean> = {};
  let animFrameId: number;
  let lastTime = performance.now();
  let myPlayerId = $state('');

  onMount(() => {
    // 1. Extraer URL params
    const searchParams = new URLSearchParams(window.location.search);
    roomId = searchParams.get('roomId') || searchParams.get('room') || 'default-room';
    classId = searchParams.get('class') || searchParams.get('character') || 'attack';
    token = searchParams.get('token') || APIClient.getToken() || '';

    if (!canvasRef) return;

    // 2. Inicializar Motor Danmaku Horizontal (Canvas 1024x576)
    engine = new Stage1Engine(canvasRef, 1024, 576);
    engine.setCharacterClass(classId);

    // 3. Conectar a Game WebSocket en /game
    if (token && roomId) {
      gameClient = new GameWSClient(token);
      gameClient.connect(
        roomId,
        (playerId, initialState) => {
          myPlayerId = playerId;
          console.log('[Play] Unid@ a la partida multijugador con ID:', playerId);
          if (engine && initialState?.players) {
            engine.applyBackendSnapshot(initialState.players, myPlayerId);
          }
        },
        (snapshot: GameSnapshot) => {
          if (engine && snapshot.players) {
            engine.applyBackendSnapshot(snapshot.players, myPlayerId);
          }
        }
      ).catch((err) => {
        console.warn('[Play] Modo single-player activo (No se pudo conectar a WS de juego):', err);
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 4. Bucle principal del juego
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (engine) {
        engine.update(dt, keys);

        let dx = 0;
        let dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

        if (gameClient) {
          gameClient.sendInput(dx, dy);
        }

        // Sincronización HUD
        score = engine.score;
        hiScore = engine.hiScore;
        playerLives = engine.playerLives;
        playerBombs = engine.playerBombs;
        power = engine.power;
        graze = engine.graze;
        bossHp = engine.bossHp;
        maxBossHp = engine.maxBossHp;
        spellcardName = engine.spellcardName;
        isFocus = engine.isFocus;
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animFrameId);
      gameClient?.disconnect();
      engine?.destroy();
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    keys[e.code] = true;
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function formatScore(val: number): string {
    return val.toString().padStart(9, '0');
  }
</script>

<svelte:head>
  <title>Jogo Bonito - Stage 1 (Bullet Hell Horizontal)</title>
</svelte:head>

<div class="horizontal-screen">
  <div class="game-wrapper">
    <!-- BARRA SUPERIOR HUD DE JEFE -->
    <div class="boss-top-hud">
      <div class="boss-info">
        <span class="boss-name">FIRST BOSS (RUMIA)</span>
        <span class="spell-name">{spellcardName}</span>
      </div>
      <div class="boss-hp-track">
        <div class="boss-hp-fill" style="width: {(bossHp / maxBossHp) * 100}%"></div>
      </div>
    </div>

    <!-- CANVAS PRINCIPAL DANMAKU HORIZONTAL CON FIT DE VENTANA COMPLETO -->
    <div class="canvas-container">
      <canvas bind:this={canvasRef}></canvas>
    </div>

    <!-- BARRA INFERIOR DE ESTADÍSTICAS HUD -->
    <div class="bottom-hud">
      <div class="hud-item">
        <span class="hud-title">SCORE</span>
        <span class="hud-val">{formatScore(score)}</span>
      </div>
      <div class="hud-item">
        <span class="hud-title">HI-SCORE</span>
        <span class="hud-val">{formatScore(hiScore)}</span>
      </div>
      <div class="hud-item">
        <span class="hud-title">PLAYER</span>
        <div class="stars">
          {#each Array(playerLives) as _}
            <span class="star red">★</span>
          {/each}
        </div>
      </div>
      <div class="hud-item">
        <span class="hud-title">BOMB</span>
        <div class="stars">
          {#each Array(playerBombs) as _}
            <span class="star green">★</span>
          {/each}
        </div>
      </div>
      <div class="hud-item">
        <span class="hud-title">GRAZE</span>
        <span class="hud-val small">{graze}</span>
      </div>
      <div class="hud-item focus-indicator {isFocus ? 'active' : ''}">
        <span>{isFocus ? 'FOCUS MODE' : 'NORMAL'}</span>
      </div>
    </div>
  </div>
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
    padding: 8px;
  }

  .game-wrapper {
    display: flex;
    flex-direction: column;
    background: #000000;
    padding: 8px;
    border-radius: 10px;
    border: 2px solid #261f3d;
    box-shadow: 0 0 45px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 43, 91, 0.25);
    max-width: 98vw;
    max-height: 96vh;
    max-height: 96dvh;
    box-sizing: border-box;
    overflow: hidden;
  }

  .boss-top-hud {
    background: rgba(14, 10, 26, 0.9);
    padding: 4px 12px;
    border-radius: 6px 6px 0 0;
    border: 1px solid rgba(255, 43, 91, 0.4);
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 4px;
    flex-shrink: 0;
  }

  .boss-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .boss-name {
    color: #ff2b5b;
  }

  .spell-name {
    color: #00f2fe;
  }

  .boss-hp-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .boss-hp-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff2b5b, #ffdd44);
    transition: width 0.1s linear;
  }

  .canvas-container {
    position: relative;
    border: 2px solid #1a162b;
    border-radius: 4px;
    overflow: hidden;
    line-height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1 1 auto;
    min-height: 0;
  }

  canvas {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    display: block;
  }

  .bottom-hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #090714;
    padding: 6px 12px;
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
    font-size: 0.6rem;
    color: #888;
    letter-spacing: 1px;
  }

  .hud-val {
    font-size: 0.95rem;
    font-weight: bold;
    color: #ffffff;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.4);
  }

  .hud-val.small {
    font-size: 0.85rem;
    color: #00f2fe;
  }

  .stars {
    display: flex;
    gap: 3px;
    font-size: 0.9rem;
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
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.65rem;
    color: #888;
  }

  .focus-indicator.active {
    background: rgba(255, 43, 91, 0.2);
    border-color: #ff2b5b;
    color: #ffffff;
  }
</style>
