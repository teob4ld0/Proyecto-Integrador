/**
 * ── Constantes de Renderizado del Frontend ──────────────────────────────────
 *
 * Este módulo centraliza TODAS las constantes visuales del frontend.
 * NO replica la lógica del backend (physics.js). Solo define valores para:
 * - Dimensiones del canvas de renderizado
 * - Factores de escala backend → frontend
 * - Bounds del playfield para culling/clamping visual
 * - Radios visuales de hitbox (para dibujo, NO para colisión de gameplay)
 * - Velocidades de predicción local del jugador
 */

// ── Dimensiones del Canvas de Renderizado ──
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 576;

// ── Coordenadas del Backend (solo para escalar posiciones recibidas) ──
export const BACKEND_WIDTH = 800;
export const BACKEND_HEIGHT = 600;
export const SCALE_X = CANVAS_WIDTH / BACKEND_WIDTH;   // 1.28
export const SCALE_Y = CANVAS_HEIGHT / BACKEND_HEIGHT;  // 0.96

// ── Bounds del Playfield para clamping visual del jugador ──
export const PLAYFIELD_BOUNDS = {
  minX: 20,
  maxX: CANVAS_WIDTH - 20,   // 1004
  minY: 20,
  maxY: CANVAS_HEIGHT - 20,  // 556
} as const;

// ── Margen de culling (cuándo dejar de renderizar un objeto fuera de pantalla) ──
export const OFFSCREEN_MARGIN = 30;

// ── Radios Visuales de Hitbox (para dibujo, NO para colisión autoritativa) ──
export const VISUAL_HITBOX = {
  playerInner: 4,     // Punto blanco visible en focus mode
  playerOuter: 7,     // Anillo cian visible en focus mode
  enemyDefault: 16,   // Radio visual de hada normal
  enemyBig: 30,       // Radio visual de gran hada
  bossDefault: 55,    // Radio visual del boss
} as const;

// ── Velocidades de Predicción Local del Jugador ──
// Estas se usan SOLO para predicción local antes de que el backend confirme.
// En modo online el backend es autoritativo y estas se ignoran.
export const LOCAL_PLAYER_SPEED = {
  normal: 580,   // px/sec (respuesta rápida y ágil)
  focus: 190,    // px/sec (3x más lento para esquiva milimétrica precisa)
} as const;

// ── Constantes de la Campaña ──
export const DIFFICULTIES_COUNT = 3;
export const WORLDS_PER_DIFFICULTY = 3;
export const STAGES_PER_WORLD = 3;
