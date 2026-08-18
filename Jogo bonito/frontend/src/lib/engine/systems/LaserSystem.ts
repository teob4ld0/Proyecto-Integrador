import * as PIXI from 'pixi.js';
import type { LaserBeam, Bullet, WallBarrier } from '../types';
import type { ParticleSystem } from './ParticleSystem';
import { renderCharging, renderFading, renderFiring, renderClashVortex } from './laser/LaserVisuals';
import { clearEnemyBulletsInPlayerBeam, getBossHitDamage, shouldHitPlayer } from './laser/LaserCombat';

export class LaserSystem {
  public lasers: LaserBeam[] = [];

  public spawnLaser(
    sourceX: number,
    sourceY: number,
    targetY: number,
    options: Partial<LaserBeam> = {}
  ): LaserBeam {
    const laser: LaserBeam = {
      id: options.id || `laser-${Date.now()}-${Math.random()}`,
      ownerId: options.ownerId || 'boss',
      direction: options.direction || 'left',
      sourceX,
      sourceY,
      targetY,
      state: 'charging',
      timer: 0,
      chargeDuration: options.chargeDuration ?? 0.7,
      fireDuration: options.fireDuration ?? 1.0,
      fadeDuration: options.fadeDuration ?? 0.3,
      maxWidth: options.maxWidth ?? 34,
      currentWidth: 0,
      alpha: 1.0,
      color: options.color ?? 0xff2b5b,
      podType: options.podType ?? 'top',
    };
    this.lasers.push(laser);
    return laser;
  }

  public update(
    dt: number,
    animTimer: number,
    graphics: PIXI.Graphics,
    bullets: Bullet[],
    walls: WallBarrier[],
    playerPos: { x: number; y: number },
    bossPos: { x: number; y: number; hp: number },
    particleSystem?: ParticleSystem,
    callbacks?: {
      onPlayerHit?: () => void;
      onBossHit?: (dmg: number) => void;
      onShake?: (intensity: number) => void;
      onSound?: (soundPath: string, volume: number) => void;
      onClashActive?: (clashX: number, clashY: number) => void;
    },
    struggleState?: {
      active: boolean;
      isAligning?: boolean;
      balance: number; // 0 a 100
      clashX: number;
      clashY: number;
      playerTipX?: number;
      bossTipX?: number;
      vortexX?: number;
      vortexY?: number;
      winner: 'player' | 'boss' | null;
      resolutionTimer?: number;
    }
  ): void {
    graphics.clear();

    // 1. Detectar si hay Choque de Rayos (Beam Struggle)
    const playerLaser = this.lasers.find(l => l.ownerId === 'player');
    const bossMegaLaser = this.lasers.find(l => l.ownerId === 'boss' && (l.isMegaBeam || l.maxWidth >= 80));
    const isAligning = !!(struggleState?.isAligning && playerLaser && bossMegaLaser);
    const isClashing = !!(struggleState?.active && playerLaser && bossMegaLaser);
    const isStruggleOngoing = isAligning || isClashing;

    const isSpellcardCharging = !isStruggleOngoing && this.lasers.some(l => l.ownerId === 'player' && l.state === 'charging');

    let currentClashX = struggleState ? struggleState.clashX : 512;
    let currentClashY = 288; // Eje horizontal central alineado perfectamente

    if (isClashing && callbacks?.onClashActive) {
      callbacks.onClashActive(currentClashX, currentClashY);
    }

    const resolvedBossPos = {
      x: (bossPos as any).pos?.x ?? bossPos.x,
      y: (bossPos as any).pos?.y ?? bossPos.y,
      hp: bossPos.hp,
    };

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      const isRightward = laser.direction === 'right';
      const isMasterSpark = laser.ownerId === 'player';
      const isBossMegaStyle = laser.ownerId === 'boss' && (laser.isMegaBeam || (laser.color === 0xffdd00 && laser.maxWidth >= 80));
      let endX = isRightward ? 1024 : 0;

      // El Master Spark sigue fielmente la posición del jugador
      if (isMasterSpark) {
        laser.sourceX = playerPos.x + 22;
        laser.sourceY = playerPos.y;
        laser.targetY = playerPos.y;

        if (struggleState?.winner === 'player') {
          endX = 1040;
          laser.state = 'firing';
        } else if (struggleState?.winner === 'boss') {
          this.lasers.splice(i, 1);
          continue;
        } else if (isClashing) {
          endX = currentClashX;
          laser.state = 'firing';
        } else if (isAligning) {
          endX = struggleState.playerTipX ?? currentClashX;
          laser.state = 'firing';
        }
      }

      // El Mega Láser del jefe sigue fielmente la posición del jefe durante la alineación y choque
      if (isBossMegaStyle) {
        laser.sourceX = resolvedBossPos.x;
        laser.sourceY = resolvedBossPos.y;
        laser.targetY = resolvedBossPos.y;

        if (struggleState?.winner === 'boss') {
          endX = -20;
          laser.state = 'firing';
        } else if (struggleState?.winner === 'player') {
          this.lasers.splice(i, 1);
          continue;
        } else if (isClashing) {
          endX = currentClashX;
          laser.state = 'firing';
        } else if (isAligning) {
          endX = struggleState.bossTipX ?? currentClashX;
          laser.state = 'firing';
        }
      }

      // Si el Master Spark está cargando, los láseres enemigos se congelan
      const effectiveDt = (isSpellcardCharging && !isMasterSpark) ? 0 : dt;
      laser.timer += effectiveDt;

      // ── 1. ESTADO: CARGANDO ───────────────────────────────────────────────
      if (laser.state === 'charging') {
        renderCharging(graphics, laser, endX, animTimer, isMasterSpark, isBossMegaStyle);

        if (laser.timer >= laser.chargeDuration) {
          laser.state = 'firing';
          laser.timer = 0;
          laser.currentWidth = laser.maxWidth;

          if (callbacks?.onShake) callbacks.onShake(isMasterSpark ? 0.6 : (isBossMegaStyle ? 0.8 : 0.3));
          if (callbacks?.onSound) {
            callbacks.onSound(isMasterSpark ? '/assets/sounds/masterspark_fire.wav' : '/assets/sounds/gasterfire.wav', isMasterSpark ? 1.0 : 0.85);
          }
        }
      }

      // ── 2. ESTADO: DISPARANDO ─────────────────────────────────────────────
      else if (laser.state === 'firing') {
        // Mismo ancho base exacto y masivo para ambos rayos durante la pugna
        let pulseWidth = 115 + Math.sin(animTimer * 40) * 8;

        // Bonificación de tamaño: Si el jugador o el boss gana, el rayo se vuelve gigante
        if (struggleState?.winner === 'player' && isMasterSpark) {
          pulseWidth = 240 + Math.sin(animTimer * 30) * 12;
        } else if (struggleState?.winner === 'boss' && isBossMegaStyle) {
          // Mantiene el mismo perfil de ancho que el rayo del jugador para igualdad visual.
          pulseWidth = 240 + Math.sin(animTimer * 30) * 12;
        }

        // Suavizado de desvanecimiento hacia el final de la resolución
        if (struggleState?.winner && struggleState.resolutionTimer !== undefined && struggleState.resolutionTimer < 0.4) {
          const fadeRatio = Math.max(0, struggleState.resolutionTimer / 0.4);
          pulseWidth *= fadeRatio;
        }
        renderFiring(graphics, laser, endX, pulseWidth, isMasterSpark, isBossMegaStyle);

        // Limpieza de balas por el rayo del jugador
        if (isMasterSpark) {
          clearEnemyBulletsInPlayerBeam(laser, bullets, endX, pulseWidth);
        }

        // Daño al Jugador (Láser de Boss) - solo si no está en pugna activa
        if (shouldHitPlayer(laser, playerPos, pulseWidth, isClashing, effectiveDt)) {
          if (callbacks?.onPlayerHit) callbacks.onPlayerHit();
        }

        // Daño al Boss (Láser de SP.ATK) - solo si no está en pugna activa
        const bossDamage = getBossHitDamage(laser, resolvedBossPos, pulseWidth, dt, isClashing);
        if (bossDamage > 0 && callbacks?.onBossHit) {
          callbacks.onBossHit(bossDamage);
        }

        if (laser.timer >= laser.fireDuration && !isClashing) {
          laser.state = 'fading';
          laser.timer = 0;
        }
      }

      // ── 3. ESTADO: DESVANECIENDO ─────────────────────────────────────────
      else if (laser.state === 'fading') {
        const fadeProgress = laser.timer / laser.fadeDuration;
        laser.alpha = 1 - fadeProgress;
        laser.currentWidth = laser.maxWidth * (1 + fadeProgress * 0.5);
        renderFading(graphics, laser, endX, isMasterSpark, isBossMegaStyle);

        if (laser.timer >= laser.fadeDuration) {
          this.lasers.splice(i, 1);
        }
      }
    }

    // ── 4. RENDERIZADO DEL VÓRTICE DE CHOQUE (CLASH VORTEX) ───────────────────
    if (isStruggleOngoing && !struggleState?.winner) {
      const vX = struggleState?.vortexX ?? currentClashX;
      const vY = struggleState?.vortexY ?? currentClashY;
      renderClashVortex(graphics, vX, vY, animTimer, particleSystem);
    }
  }

  public clear(): void {
    this.lasers = [];
  }
}
