import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Application, Graphics, Container } from 'pixi.js';
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
  const wsRef        = useRef(null);
  const phaseRef     = useRef('lobby'); // mirrors `phase` state for use inside closures
  const [status,       setStatus]       = useState('Conectando…');
  const [playerCount,  setPlayerCount]  = useState(0);
  const [phase,        setPhase]        = useState('lobby');
  const [readyPlayers, setReadyPlayers] = useState([]);  // [{ id, isReady }]
  const [countdownSec, setCountdownSec] = useState(5);
  const [isHost,       setIsHost]       = useState(false);

  // Styles reused by overlays
  const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(5,5,16,0.88)', backdropFilter: 'blur(4px)',
  };
  const btnStyle = {
    padding: '10px 28px', background: '#1e3a5f', color: '#4a9eff',
    border: '1px solid #4a9eff', borderRadius: '4px', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: '14px', letterSpacing: '1px',
  };
  const sendWs = (msg) => wsRef.current?.send(JSON.stringify(msg));

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
    // Bullet pool: inactive Graphics objects ready to be reused
    const bulletPool    = [];
    const bulletSprites = new Map(); // bulletId → Graphics
    let bulletContainer;
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

      // Dedicated container for bullet sprites (rendered above the field, below players)
      bulletContainer = new Container();
      app.stage.addChild(bulletContainer);

      // ── Web Worker ──────────────────────────────────────────────────────────
      worker = new InterpolationWorker();

      worker.onmessage = (e) => {
        const { players, bullets } = e.data;
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

        // ── Bullet rendering ──────────────────────────────────────────────────
        const seenBullets = new Set();
        for (const b of (bullets || [])) {
          seenBullets.add(b.id);
          if (!bulletSprites.has(b.id)) {
            // Reuse pooled graphic or create a new one
            let g = bulletPool.pop();
            if (!g) {
              g = new Graphics();
              g.circle(0, 0, b.radius).fill(0xff7744);
              bulletContainer.addChild(g);
            }
            g.visible = true;
            bulletSprites.set(b.id, g);
          }
          const g = bulletSprites.get(b.id);
          g.x = b.x;
          g.y = b.y;
        }

        // Return bullets no longer in the snapshot to pool
        for (const [id, g] of bulletSprites) {
          if (!seenBullets.has(id)) {
            g.visible = false;
            bulletSprites.delete(id);
            bulletPool.push(g);
          }
        }
      };

      // ── WebSocket ───────────────────────────────────────────────────────────
      ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join-game', roomId }));
      };

      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }

        switch (msg.type) {
          case 'joined': {
            selfId = msg.playerId;
            if (mounted) {
              setIsHost(msg.isHost || false);
              const initPhase = msg.initialState?.phase || 'lobby';
              phaseRef.current = initPhase;
              setPhase(initPhase);
              setStatus(initPhase === 'playing' ? 'Jugando' : 'En sala');
              if (msg.initialState?.players) {
                setReadyPlayers(msg.initialState.players.map(p => ({ id: p.id, isReady: p.isReady || false })));
              }
            }
            worker.postMessage({ type: 'snapshot', data: msg.initialState });
            break;
          }
          case 'snapshot': {
            if (mounted && msg.phase === 'countdown' && msg.countdownMs !== undefined) {
              setCountdownSec(Math.max(1, Math.ceil(msg.countdownMs / 1000)));
            }
            worker.postMessage({ type: 'snapshot', data: msg });
            break;
          }
          case 'phase': {
            if (!mounted) break;
            const { phase: newPhase, countdownMs, players } = msg;
            phaseRef.current = newPhase;
            setPhase(newPhase);
            if (newPhase === 'playing')    setStatus('Jugando');
            else if (newPhase === 'lobby') setStatus('En sala');
            else if (newPhase === 'countdown') {
              setCountdownSec(Math.ceil((countdownMs || 5000) / 1000));
            }
            if (players) setReadyPlayers(players);
            break;
          }
          case 'ready-status': {
            if (mounted && msg.players) setReadyPlayers(msg.players);
            break;
          }
          case 'player-joined': {
            // Reflected in next snapshot's player list
            break;
          }
          case 'hit': {
            // Flash the hit player sprite briefly (placeholder damage feedback)
            const hitSprite = sprites.get(msg.playerId);
            if (hitSprite) {
              hitSprite.tint = 0xff2222;
              setTimeout(() => { if (hitSprite) hitSprite.tint = 0xffffff; }, 150);
            }
            break;
          }
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
        if (phaseRef.current !== 'playing') return; // block inputs during pre-game phases
        let dx = 0;
        let dy = 0;
        if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
        if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
        if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
        if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
        const action = keys.has('Space') ? 'shoot' : null;
        ws.send(JSON.stringify({ type: 'input', dx, dy, action }));
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
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', background: '#050510', gap: '12px',
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#4a9eff' }}>
        {phase === 'playing'
          ? `${playerCount} jugador${playerCount !== 1 ? 'es' : ''} — WASD/flechas mover, Espacio disparar`
          : status}
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ border: '2px solid #1e3a5f', borderRadius: '2px' }} />

        {/* Lobby overlay */}
        {phase === 'lobby' && (
          <div style={overlayStyle}>
            <h2 style={{ color: '#4a9eff', margin: '0 0 12px', fontFamily: 'monospace' }}>En espera…</h2>
            <p style={{ color: '#aaa', margin: '0 0 24px', fontFamily: 'monospace' }}>
              {playerCount} jugador{playerCount !== 1 ? 'es' : ''} conectado{playerCount !== 1 ? 's' : ''}
            </p>
            {isHost ? (
              <button style={btnStyle} onClick={() => sendWs({ type: 'start-ready' })}>
                Iniciar ready check
              </button>
            ) : (
              <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '12px' }}>
                Esperando al host…
              </p>
            )}
          </div>
        )}

        {/* Ready overlay */}
        {phase === 'ready' && (
          <div style={overlayStyle}>
            <h2 style={{ color: '#4a9eff', margin: '0 0 20px', fontFamily: 'monospace' }}>¿Listos?</h2>
            <div style={{ marginBottom: '24px' }}>
              {readyPlayers.map(p => (
                <div key={p.id} style={{
                  color: p.isReady ? '#00ffcc' : '#ff4444',
                  fontFamily: 'monospace', marginBottom: '6px', fontSize: '13px',
                }}>
                  {p.isReady ? '✓' : '○'} {p.id.slice(0, 10)}…
                </div>
              ))}
            </div>
            <button style={btnStyle} onClick={() => sendWs({ type: 'ready' })}>
              ¡Listo!
            </button>
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'countdown' && (
          <div style={overlayStyle}>
            <div style={{
              fontSize: '120px', fontWeight: 'bold', color: '#fff',
              fontFamily: 'monospace', lineHeight: 1,
              textShadow: '0 0 40px #4a9eff, 0 0 80px #4a9eff',
            }}>
              {countdownSec}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
