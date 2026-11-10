/**
 * ── Helpers de Interpolación y Coordenadas del Frontend ─────────────────────
 *
 * Funciones utilitarias para:
 * - Interpolación visual de posiciones (lerp)
 * - Conversión de coordenadas backend → canvas
 * - Clamping visual al playfield
 * - Detección de objetos fuera de la zona de renderizado
 * - Normalización de vectores de dirección
 *
 * NO replica lógica del backend. Solo para renderizado y predicción local.
 */

import {
  SCALE_X,
  SCALE_Y,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYFIELD_BOUNDS,
  OFFSCREEN_MARGIN,
} from './RenderConstants';

/** Interpola linealmente entre dos valores (clamped a [0, 1]) */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** Interpola linealmente sin clamp (permite overshoot) */
export function lerpUnclamped(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Convierte posición del backend (800×600) a coordenadas del canvas (1024×576) */
export function backendToCanvas(x: number, y: number): { x: number; y: number } {
  return { x: x * SCALE_X, y: y * SCALE_Y };
}

/** Convierte escala del backend al canvas (para tamaños/radios) */
export function backendScaleToCanvas(value: number, axis: 'x' | 'y' = 'x'): number {
  return value * (axis === 'x' ? SCALE_X : SCALE_Y);
}

/** Clampea una posición visual dentro del playfield */
export function clampToPlayfield(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(PLAYFIELD_BOUNDS.minX, Math.min(PLAYFIELD_BOUNDS.maxX, x)),
    y: Math.max(PLAYFIELD_BOUNDS.minY, Math.min(PLAYFIELD_BOUNDS.maxY, y)),
  };
}

/** Determina si un punto está fuera de la zona de renderizado */
export function isOffscreen(x: number, y: number, margin: number = OFFSCREEN_MARGIN): boolean {
  return x < -margin || x > CANVAS_WIDTH + margin || y < -margin || y > CANVAS_HEIGHT + margin;
}

/** Normaliza un vector de dirección (para movimiento diagonal consistente) */
export function normalizeDir(dx: number, dy: number): { dx: number; dy: number } {
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  const invLen = 1 / Math.sqrt(dx * dx + dy * dy);
  return { dx: dx * invLen, dy: dy * invLen };
}

/** Calcula ángulo de un punto a otro */
export function angleTo(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX);
}

/** Calcula distancia al cuadrado entre dos puntos (evita sqrt para comparaciones) */
export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}
