import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Application, Graphics } from 'pixi.js';
import InterpolationWorker from '../workers/interpolation.worker.js?worker';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Player circle colours: self = cyan, others = red variants
const SELF_COLOR = 0x00ffcc;
const OTHER_COLORS = [0xff4444, 0xff8800, 0xaa44ff, 0xffdd00];

function getWsUrl() {
  const base = import.meta.env.VITE_WS_URL || 'ws://localhost:9001';
  return `${base.replace(/\/$/, '')}/game`;
}

function makePlayerGraphic(isSelf, colorIndex) {
  const g = new Graphics();
  const color = isSelf ? SELF_COLOR : OTHER_COLORS[colorIndex % OTHER_COLORS.length];
  g.circle(0, 0, 10).fill(color);
  // Small direction indicator
  g.rect(0, -10, 3, 10).fill(isSelf ? 0xffffff : 0xffd0d0);
  return g;
}

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = location.state || {};
  const containerRef = useRef(null);
  const [status, setStatus] = useState('Conectando…');
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    if (!roomId) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const token = localStorage.getItem('danma_token') || '';
    let app;
    let ws;
    let worker;
    let inputInterval;
    let mounted = true;

    // playerId → { graphic, colorIndex }
    const sprites = new Map();
    let selfId = null;
    let colorCounter = 0;

    async function init() {
      // ── Pixi.js setup ──────────────────────────────────────────────────────
      app = new Application();
      await app.init({
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        backgroundColor: 0x0d0d1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      containerRef.current.appendChild(app.canvas);

      // Draw game field border
      const field = new Graphics();
      field.rect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4).stroke({ width: 3, color: 0x1e3a5f });
      // Corner markers
      [[0, 0], [WORLD_WIDTH, 0], [0, WORLD_HEIGHT], [WORLD_WIDTH, WORLD_HEIGHT]].forEach(([cx, cy]) => {
        field.circle(cx, cy, 8).fill(0x4a9eff);
      });
      app.stage.addChild(field);

      // ── Web Worker ──────────────────────────────────────────────────────────
      worker = new InterpolationWorker();

      worker.onmessage = (e) => {
        const { players } = e.data;
        const seen = new Set();

        for (const player of players) {
          seen.add(player.id);

          if (!sprites.has(player.id)) {
            const isSelf = player.id === selfId;
            const g = makePlayerGraphic(isSelf, colorCounter++);
            app.stage.addChild(g);
            sprites.set(player.id, g);
          }

          const g = sprites.get(player.id);
          g.x = player.x;
          g.y = player.y;
          g.rotation = player.angle;
        }

        // Remove sprites for players no longer in the snapshot
        for (const [id, g] of sprites) {
          if (!seen.has(id)) {
            app.stage.removeChild(g);
            g.destroy();
            sprites.delete(id);
          }
        }

        if (mounted) setPlayerCount(seen.size);
      };

      // ── WebSocket ───────────────────────────────────────────────────────────
      ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join-game', roomId }));
      };

      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }

        switch (msg.type) {
          case 'joined':
            selfId = msg.playerId;
            if (mounted) setStatus('Jugando');
            worker.postMessage({ type: 'snapshot', data: msg.initialState });
            break;
          case 'snapshot':
            worker.postMessage({ type: 'snapshot', data: msg });
            break;
          case 'player-left':
          case 'player-disconnected': {
            const g = sprites.get(msg.playerId);
            if (g) {
              // Dim the sprite on disconnect, remove on leave
              if (msg.type === 'player-left') {
                app.stage.removeChild(g);
                g.destroy();
                sprites.delete(msg.playerId);
              } else {
                g.alpha = 0.3;
              }
            }
            break;
          }
          case 'error':
            console.warn('[Game] Server error:', msg.message);
            break;
        }
      };

      ws.onerror = () => { if (mounted) setStatus('Error de conexión'); };
      ws.onclose = () => { if (mounted) setStatus('Desconectado'); };

      // ── Input loop ──────────────────────────────────────────────────────────
      const keys = new Set();
      const onKeyDown = (e) => { keys.add(e.code); };
      const onKeyUp = (e) => { keys.delete(e.code); };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      inputInterval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        let dx = 0;
        let dy = 0;
        if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
        if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
        if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
        if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
        ws.send(JSON.stringify({ type: 'input', dx, dy, action: null }));
      }, 1000 / 60);

      // Store for cleanup
      app._removeKeys = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }

    init().catch((err) => {
      console.error('[Game] Init error', err);
      if (mounted) setStatus('Error al iniciar');
    });

    return () => {
      mounted = false;
      clearInterval(inputInterval);
      app?._removeKeys?.();
      ws?.close();
      worker?.terminate();
      app?.destroy(true, { children: true });
    };
  }, [roomId, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#050510',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', gap: '24px', fontFamily: 'monospace', fontSize: '13px', color: '#4a9eff' }}>
        <span>{status}</span>
        <span>{playerCount} jugador{playerCount !== 1 ? 'es' : ''}</span>
        <span style={{ color: '#666', fontSize: '11px' }}>WASD / ↑↓←→ para mover</span>
      </div>
      <div
        ref={containerRef}
        style={{ border: '2px solid #1e3a5f', borderRadius: '2px' }}
      />
    </div>
  );
}
