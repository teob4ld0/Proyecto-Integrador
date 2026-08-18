import * as PIXI from 'pixi.js';
import type { LaserBeam } from '../../types';
import type { ParticleSystem } from '../ParticleSystem';

export function renderCharging(
  graphics: PIXI.Graphics,
  laser: LaserBeam,
  endX: number,
  animTimer: number,
  isMasterSpark: boolean,
  isBossMegaStyle: boolean
): void {
  const progress = laser.timer / laser.chargeDuration;

  if (isMasterSpark) {
    const rot1 = animTimer * 8;
    const rot2 = -animTimer * 12;
    const runeRadius = 38 + progress * 14;

    graphics.lineStyle(2.5, 0x00f2fe, 0.85);
    graphics.drawCircle(laser.sourceX, laser.sourceY, runeRadius);
    for (let r = 0; r < 8; r++) {
      const angle = rot1 + (Math.PI / 4) * r;
      const rx = laser.sourceX + Math.cos(angle) * runeRadius;
      const ry = laser.sourceY + Math.sin(angle) * runeRadius;
      graphics.moveTo(laser.sourceX, laser.sourceY);
      graphics.lineTo(rx, ry);
    }

    graphics.lineStyle(2, 0xffdd00, 0.9);
    for (let s = 0; s < 8; s++) {
      const a1 = rot2 + (Math.PI / 4) * s;
      const a2 = rot2 + (Math.PI / 4) * (s + 3);
      const x1 = laser.sourceX + Math.cos(a1) * (runeRadius * 0.7);
      const y1 = laser.sourceY + Math.sin(a1) * (runeRadius * 0.7);
      const x2 = laser.sourceX + Math.cos(a2) * (runeRadius * 0.7);
      const y2 = laser.sourceY + Math.sin(a2) * (runeRadius * 0.7);
      graphics.moveTo(x1, y1);
      graphics.lineTo(x2, y2);
    }
    graphics.lineStyle(0);

    const chargeRadius = 6 + progress * 24;
    graphics.beginFill(0x00f2fe, 0.7);
    graphics.drawCircle(laser.sourceX, laser.sourceY, chargeRadius);
    graphics.endFill();
    graphics.beginFill(0xffffff, 1.0);
    graphics.drawCircle(laser.sourceX, laser.sourceY, chargeRadius * 0.5);
    graphics.endFill();

    const guideAlpha = 0.4 + 0.6 * Math.sin(animTimer * 30);
    graphics.lineStyle(3, 0x00f2fe, guideAlpha);
    graphics.moveTo(laser.sourceX, laser.sourceY);
    graphics.lineTo(endX, laser.targetY);
    graphics.lineStyle(0);
    return;
  }

  if (isBossMegaStyle) {
    const rot = -animTimer * 10;
    const chargeRad = 36 + progress * 18;
    graphics.lineStyle(2.5, 0xffdd00, 0.9);
    graphics.drawCircle(laser.sourceX, laser.sourceY, chargeRad);
    for (let r = 0; r < 8; r++) {
      const angle = rot + (Math.PI / 4) * r;
      graphics.moveTo(laser.sourceX, laser.sourceY);
      graphics.lineTo(
        laser.sourceX + Math.cos(angle) * chargeRad,
        laser.sourceY + Math.sin(angle) * chargeRad
      );
    }
    graphics.lineStyle(0);
    return;
  }

  const guideAlpha = 0.3 + progress * 0.5;
  graphics.lineStyle(2, laser.color, guideAlpha);
  graphics.moveTo(laser.sourceX, laser.sourceY);
  graphics.lineTo(endX, laser.targetY);
  graphics.lineStyle(0);

  const chargeRadius = 3 + progress * 16;
  graphics.beginFill(laser.color, guideAlpha);
  graphics.drawCircle(laser.sourceX, laser.sourceY, chargeRadius);
  graphics.endFill();
  graphics.beginFill(0xffffff, guideAlpha);
  graphics.drawCircle(laser.sourceX, laser.sourceY, chargeRadius * 0.5);
  graphics.endFill();
}

export function renderFiring(
  graphics: PIXI.Graphics,
  laser: LaserBeam,
  endX: number,
  pulseWidth: number,
  isMasterSpark: boolean,
  isBossMegaStyle: boolean
): void {
  const r1 = pulseWidth * 1.0;
  const r2 = pulseWidth * 0.78;
  const r3 = pulseWidth * 0.32;

  const r0_1 = Math.min(r1, 22);
  const r0_2 = Math.min(r2, 16);
  const r0_3 = Math.min(r3, 8);

  if (isMasterSpark) {
    const sx = laser.sourceX;
    const sy = laser.sourceY;
    const flareEndX = Math.min(endX, sx + 140);

    graphics.beginFill(0x0044ff, 0.62);
    graphics.moveTo(sx, sy - r0_1);
    graphics.quadraticCurveTo(sx + 60, sy - r1, flareEndX, sy - r1);
    graphics.lineTo(endX, sy - r1);
    graphics.lineTo(endX, sy + r1);
    graphics.lineTo(flareEndX, sy + r1);
    graphics.quadraticCurveTo(sx + 60, sy + r1, sx, sy + r0_1);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0x00f2fe, 0.95);
    graphics.moveTo(sx, sy - r0_2);
    graphics.quadraticCurveTo(sx + 50, sy - r2, flareEndX, sy - r2);
    graphics.lineTo(endX, sy - r2);
    graphics.lineTo(endX, sy + r2);
    graphics.lineTo(flareEndX, sy + r2);
    graphics.quadraticCurveTo(sx + 50, sy + r2, sx, sy + r0_2);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0xffffff, 1.0);
    graphics.moveTo(sx, sy - r0_3);
    graphics.quadraticCurveTo(sx + 35, sy - r3, flareEndX, sy - r3);
    graphics.lineTo(endX, sy - r3);
    graphics.lineTo(endX, sy + r3);
    graphics.lineTo(flareEndX, sy + r3);
    graphics.quadraticCurveTo(sx + 35, sy + r3, sx, sy + r0_3);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0x00f2fe, 0.95);
    graphics.drawCircle(sx, sy, Math.min(r2 * 0.9, 36));
    graphics.endFill();
    graphics.beginFill(0xffffff, 1.0);
    graphics.drawCircle(sx, sy, Math.min(r3 * 1.2, 18));
    graphics.endFill();
    return;
  }

  if (isBossMegaStyle) {
    const sx = laser.sourceX;
    const sy = laser.sourceY;
    const flareEndX = Math.max(endX, sx - 140);

    graphics.beginFill(0xff6600, 0.62);
    graphics.moveTo(sx, sy - r0_1);
    graphics.quadraticCurveTo(sx - 60, sy - r1, flareEndX, sy - r1);
    graphics.lineTo(endX, sy - r1);
    graphics.lineTo(endX, sy + r1);
    graphics.lineTo(flareEndX, sy + r1);
    graphics.quadraticCurveTo(sx - 60, sy + r1, sx, sy + r0_1);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0xffdd00, 0.95);
    graphics.moveTo(sx, sy - r0_2);
    graphics.quadraticCurveTo(sx - 50, sy - r2, flareEndX, sy - r2);
    graphics.lineTo(endX, sy - r2);
    graphics.lineTo(endX, sy + r2);
    graphics.lineTo(flareEndX, sy + r2);
    graphics.quadraticCurveTo(sx - 50, sy + r2, sx, sy + r0_2);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0xffffff, 1.0);
    graphics.moveTo(sx, sy - r0_3);
    graphics.quadraticCurveTo(sx - 35, sy - r3, flareEndX, sy - r3);
    graphics.lineTo(endX, sy - r3);
    graphics.lineTo(endX, sy + r3);
    graphics.lineTo(flareEndX, sy + r3);
    graphics.quadraticCurveTo(sx - 35, sy + r3, sx, sy + r0_3);
    graphics.closePath();
    graphics.endFill();

    graphics.beginFill(0xffdd00, 0.95);
    graphics.drawCircle(sx, sy, Math.min(r2 * 0.9, 36));
    graphics.endFill();
    graphics.beginFill(0xffffff, 1.0);
    graphics.drawCircle(sx, sy, Math.min(r3 * 1.2, 18));
    graphics.endFill();
    return;
  }

  graphics.lineStyle(pulseWidth * 1.6, laser.color, 0.35);
  graphics.moveTo(laser.sourceX, laser.sourceY);
  graphics.lineTo(endX, laser.targetY);

  graphics.lineStyle(pulseWidth, laser.color, 0.85);
  graphics.moveTo(laser.sourceX, laser.sourceY);
  graphics.lineTo(endX, laser.targetY);

  graphics.lineStyle(pulseWidth * 0.45, 0xffffff, 1.0);
  graphics.moveTo(laser.sourceX, laser.sourceY);
  graphics.lineTo(endX, laser.targetY);
  graphics.lineStyle(0);
}

export function renderFading(
  graphics: PIXI.Graphics,
  laser: LaserBeam,
  endX: number,
  isMasterSpark: boolean,
  isBossMegaStyle: boolean
): void {
  if (isMasterSpark) {
    const sx = laser.sourceX;
    const sy = laser.sourceY;
    const flareEndX = Math.min(endX, sx + 130);
    const r1 = laser.currentWidth * 0.9;
    const r0_1 = 12;

    graphics.beginFill(0x00f2fe, laser.alpha * 0.4);
    graphics.moveTo(sx, sy - r0_1);
    graphics.quadraticCurveTo(sx + 50, sy - r1, flareEndX, sy - r1);
    graphics.lineTo(endX, sy - r1);
    graphics.lineTo(endX, sy + r1);
    graphics.lineTo(flareEndX, sy + r1);
    graphics.quadraticCurveTo(sx + 50, sy + r1, sx, sy + r0_1);
    graphics.closePath();
    graphics.endFill();
    return;
  }

  if (isBossMegaStyle) {
    const sx = laser.sourceX;
    const sy = laser.sourceY;
    const flareEndX = Math.max(endX, sx - 130);
    const r1 = laser.currentWidth * 0.9;
    const r0_1 = 12;

    graphics.beginFill(0xffdd00, laser.alpha * 0.4);
    graphics.moveTo(sx, sy - r0_1);
    graphics.quadraticCurveTo(sx - 50, sy - r1, flareEndX, sy - r1);
    graphics.lineTo(endX, sy - r1);
    graphics.lineTo(endX, sy + r1);
    graphics.lineTo(flareEndX, sy + r1);
    graphics.quadraticCurveTo(sx - 50, sy + r1, sx, sy + r0_1);
    graphics.closePath();
    graphics.endFill();
    return;
  }

  graphics.lineStyle(laser.currentWidth, laser.color, laser.alpha * 0.5);
  graphics.moveTo(laser.sourceX, laser.sourceY);
  graphics.lineTo(endX, laser.targetY);
  graphics.lineStyle(0);
}

export function renderClashVortex(
  graphics: PIXI.Graphics,
  cx: number,
  cy: number,
  animTimer: number,
  particleSystem?: ParticleSystem
): void {
  const pulse = Math.sin(animTimer * 40) * 10;
  const baseRad = 52 + pulse;

  // 1. Aura exterior masiva de plasma difusa (Cian vs Dorado)
  graphics.beginFill(0x00f2fe, 0.35);
  graphics.drawEllipse(cx - 8, cy, baseRad * 1.6, baseRad * 1.3);
  graphics.endFill();

  graphics.beginFill(0xffdd00, 0.38);
  graphics.drawEllipse(cx + 8, cy, baseRad * 1.6, baseRad * 1.3);
  graphics.endFill();

  // 2. Chorro de cizallamiento vertical (Plasma Shearing Plumes hacia arriba y abajo en el plano de contacto)
  const plumeHeight = baseRad * 2.2 + Math.sin(animTimer * 50) * 18;
  const plumeWidth = 14 + Math.sin(animTimer * 30) * 4;

  graphics.beginFill(0x00f2fe, 0.6);
  graphics.drawEllipse(cx - 4, cy - plumeHeight * 0.5, plumeWidth, plumeHeight * 0.5);
  graphics.drawEllipse(cx - 4, cy + plumeHeight * 0.5, plumeWidth, plumeHeight * 0.5);
  graphics.endFill();

  graphics.beginFill(0xffdd00, 0.6);
  graphics.drawEllipse(cx + 4, cy - plumeHeight * 0.5, plumeWidth, plumeHeight * 0.5);
  graphics.drawEllipse(cx + 4, cy + plumeHeight * 0.5, plumeWidth, plumeHeight * 0.5);
  graphics.endFill();

  graphics.beginFill(0xffffff, 0.95);
  graphics.drawEllipse(cx, cy, plumeWidth * 0.7, plumeHeight * 0.85);
  graphics.endFill();

  // 3. Esferas de colisión de energía densa
  graphics.beginFill(0x00f2fe, 0.65);
  graphics.drawCircle(cx, cy, baseRad * 1.15);
  graphics.endFill();

  graphics.beginFill(0xffdd00, 0.75);
  graphics.drawCircle(cx, cy, baseRad * 0.9);
  graphics.endFill();

  // Núcleo blanco ultra brillante
  graphics.beginFill(0xffffff, 1.0);
  graphics.drawCircle(cx, cy, baseRad * 0.55);
  graphics.endFill();

  // 4. Múltiples anillos de onda de choque en expansión continua
  for (let r = 0; r < 3; r++) {
    const ringRad = ((animTimer * 160 + r * 45) % 110) + 12;
    const ringAlpha = Math.max(0, 1 - ringRad / 110);
    const ringColor = r % 2 === 0 ? 0x00f2fe : 0xffdd00;
    graphics.lineStyle(2.5, ringColor, ringAlpha * 0.85);
    graphics.drawCircle(cx, cy, ringRad);
    graphics.lineStyle(1.5, 0xffffff, ringAlpha);
    graphics.drawCircle(cx, cy, ringRad * 0.75);
  }
  graphics.lineStyle(0);

  // 5. Mandalas / Sellos mágicos giratorios en el vórtice
  const rot1 = animTimer * 12;
  const rot2 = -animTimer * 14;
  const runeRad = baseRad * 1.35;

  graphics.lineStyle(2, 0x00f2fe, 0.8);
  for (let s = 0; s < 6; s++) {
    const a1 = rot1 + (Math.PI / 3) * s;
    const a2 = rot1 + (Math.PI / 3) * (s + 2);
    graphics.moveTo(cx + Math.cos(a1) * runeRad, cy + Math.sin(a1) * runeRad);
    graphics.lineTo(cx + Math.cos(a2) * runeRad, cy + Math.sin(a2) * runeRad);
  }

  graphics.lineStyle(2, 0xffdd00, 0.85);
  for (let s = 0; s < 8; s++) {
    const a1 = rot2 + (Math.PI / 4) * s;
    const a2 = rot2 + (Math.PI / 4) * (s + 3);
    graphics.moveTo(cx + Math.cos(a1) * (runeRad * 0.8), cy + Math.sin(a1) * (runeRad * 0.8));
    graphics.lineTo(cx + Math.cos(a2) * (runeRad * 0.8), cy + Math.sin(a2) * (runeRad * 0.8));
  }
  graphics.lineStyle(0);

  // 6. Rayos y Arcos de Plasma de Alta Frecuencia
  const numLightning = 14;
  graphics.lineStyle(2.5, 0xffffff, 0.95);
  for (let l = 0; l < numLightning; l++) {
    const angle = animTimer * 8 + (Math.PI * 2 * l) / numLightning + (Math.random() - 0.5) * 0.5;
    const len = baseRad * 1.6 + Math.random() * 45;
    const midLen = len * 0.5;
    const midAngle = angle + (Math.random() - 0.5) * 0.7;

    const lx1 = cx + Math.cos(midAngle) * midLen;
    const ly1 = cy + Math.sin(midAngle) * midLen;
    const lx2 = cx + Math.cos(angle) * len;
    const ly2 = cy + Math.sin(angle) * len;

    graphics.moveTo(cx, cy);
    graphics.lineTo(lx1, ly1);
    graphics.lineTo(lx2, ly2);
  }
  graphics.lineStyle(0);

  // 7. Generación continua de chispas y esquirlas de energía en 360°
  if (particleSystem) {
    const sparkCount = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < sparkCount; p++) {
      const sparkAngle = Math.random() * Math.PI * 2;
      const sparkSpeed = 260 + Math.random() * 420;
      const palette = [0x00f2fe, 0xffdd00, 0xffffff, 0xff0055];
      const sparkColor = palette[Math.floor(Math.random() * palette.length)];
      particleSystem.spawnSpark(
        cx + (Math.random() - 0.5) * 24,
        cy + (Math.random() - 0.5) * 24,
        Math.cos(sparkAngle) * sparkSpeed,
        Math.sin(sparkAngle) * sparkSpeed,
        sparkColor,
        4.5 + Math.random() * 2.5,
        0.32,
        true
      );
    }
  }
}
