<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GameEngine } from '$lib/engine/GameEngine';

  let canvasRef: HTMLCanvasElement;
  let engine: GameEngine | null = null;
  const keys: Record<string, boolean> = {};
  let animFrameId: number;
  let lastTime = performance.now();

  let isCharging = $state(false);

  onMount(() => {
    if (!canvasRef) return;
    engine = new GameEngine(canvasRef, 1024, 576);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (engine) {
        engine.update(dt, keys);
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
      engine?.destroy();
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    keys[e.code] = true;
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function fireBothLasers() {
    engine?.triggerRhombusLasers('both');
  }

  function fireTargetedLaser() {
    engine?.triggerRhombusLasers('targeted');
  }
</script>

<svelte:head>
  <title>TEST - Rayos Láser Romboides (Gaster Blasters)</title>
</svelte:head>

<div class="test-container">
  <div class="test-panel">
    <h2>PANEL DE PRUEBAS: LÁSERES GASTER BLASTER DEL JEFE</h2>
    <p>Prueba el lanzamiento de rayos láser desde los rombos extremidades de FirstBoss.png</p>

    <div class="canvas-box">
      <canvas bind:this={canvasRef}></canvas>
    </div>

    <div class="controls-bar">
      <button class="btn-laser" onclick={fireBothLasers}>
        ⚡ DISPARAR LÁSERES PARALELOS (ROMBO SUP + INF)
      </button>
      <button class="btn-laser targeted" onclick={fireTargetedLaser}>
        🎯 DISPARAR LÁSER DIRIGIDO AL JUGADOR
      </button>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #04030a;
    color: white;
    font-family: monospace;
  }

  .test-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .test-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    background: #090714;
    padding: 16px;
    border-radius: 10px;
    border: 2px solid #ff2b5b;
  }

  h2 {
    color: #ff2b5b;
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    color: #888;
    margin: 0;
    font-size: 0.85rem;
  }

  .canvas-box {
    border: 2px solid #1a162b;
    border-radius: 6px;
    overflow: hidden;
  }

  canvas {
    width: 900px;
    height: 506px;
    display: block;
  }

  .controls-bar {
    display: flex;
    gap: 14px;
  }

  .btn-laser {
    background: #ff2b5b;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    font-family: monospace;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-laser:hover {
    background: #ff5588;
    transform: scale(1.03);
  }

  .btn-laser.targeted {
    background: #00f2fe;
    color: #000;
  }

  .btn-laser.targeted:hover {
    background: #55f8ff;
  }
</style>
