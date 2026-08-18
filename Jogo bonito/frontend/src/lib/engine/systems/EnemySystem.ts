import * as PIXI from 'pixi.js';
import { Enemy, type EnemyConfig } from '../entities/Enemy';
import type { BulletSystem } from './BulletSystem';
import type { LaserSystem } from './LaserSystem';
import type { ItemType } from '../types';

export class EnemySystem {
  public enemies: Enemy[] = [];
  public container: PIXI.Container;
  private textures: Record<string, PIXI.Texture> = {};

  constructor(parentContainer?: PIXI.Container) {
    this.container = new PIXI.Container();
    if (parentContainer) {
      parentContainer.addChild(this.container);
    }
  }

  public setTextures(textures: Record<string, PIXI.Texture>): void {
    this.textures = textures;
  }

  public spawnEnemy(config: EnemyConfig): Enemy {
    let tex = config.texture;
    if (!tex && config.type) {
      if (config.type === 'green_fairy') tex = this.textures.fairyGreen;
      else if (config.type === 'red_fairy') tex = this.textures.fairyRed;
      else if (config.type === 'big_fairy') tex = this.textures.fairyBig;
    }

    const enemy = new Enemy(this.container, {
      ...config,
      texture: tex,
    });
    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * OLEADA 1: Fila senoidal de hadas verdes volando hacia la izquierda
   */
  public spawnSineWave(count: number = 5, startY: number = 180, amp: number = 70, delayBetween: number = 0.35): void {
    for (let i = 0; i < count; i++) {
      this.spawnEnemy({
        type: 'green_fairy',
        trajectory: 'sine',
        attackPattern: 'aimed_single',
        startX: 1060 + i * (delayBetween * 160),
        startY,
        speed: 160,
        hp: 12,
        itemDrop: i % 2 === 0 ? 'power' : 'point',
        customParams: { freq: 2.8, amp, phase: i * 0.4 },
      });
    }
  }

  /**
   * OLEADA 1: Doble Hélice Senoidal (Hadas verdes y amarillas entrelazadas)
   */
  public spawnDoubleHelixWave(countPerLine: number = 5): void {
    for (let i = 0; i < countPerLine; i++) {
      // Línea Superior
      this.spawnEnemy({
        type: 'green_fairy',
        trajectory: 'double_helix',
        attackPattern: 'aimed_single',
        startX: 1060 + i * 80,
        startY: 200,
        speed: 170,
        hp: 14,
        itemDrop: i % 2 === 0 ? 'power' : 'point',
        customParams: { freq: 3.2, amp: 85, phase: i * 0.4 },
      });

      // Línea Inferior en contrafase
      this.spawnEnemy({
        type: 'yellow_fairy',
        trajectory: 'double_helix',
        attackPattern: 'helix_stream',
        startX: 1060 + i * 80,
        startY: 376,
        speed: 170,
        hp: 16,
        itemDrop: 'power',
        customParams: { freq: 3.2, amp: 85, phase: i * 0.4 + Math.PI },
      });
    }
  }

  /**
   * OLEADA 2: Pinza Carmesí Avanzada (Abanicos florales pentagonales)
   */
  public spawnPincerWave(countPerSide: number = 3): void {
    for (let i = 0; i < countPerSide; i++) {
      // Pinza Superior
      this.spawnEnemy({
        type: 'red_fairy',
        trajectory: 'hover_retreat',
        attackPattern: 'flower_burst',
        startX: 1060 + i * 90,
        startY: 120 + i * 25,
        speed: 190,
        hp: 28,
        itemDrop: 'power',
        shootInterval: 1.1,
        customParams: { hoverX: 740 - i * 40, hoverTime: 3.8 },
      });

      // Pinza Inferior
      this.spawnEnemy({
        type: 'red_fairy',
        trajectory: 'hover_retreat',
        attackPattern: 'flower_burst',
        startX: 1060 + i * 90,
        startY: 440 - i * 25,
        speed: 190,
        hp: 28,
        itemDrop: 'point',
        shootInterval: 1.1,
        customParams: { hoverX: 740 - i * 40, hoverTime: 3.8 },
      });
    }
  }

  /**
   * OLEADA 3: Mini-Jefe / Gran Hada Comandante + Escoltas en espiral
   */
  public spawnCommanderWave(startX: number = 1080, startY: number = 288): void {
    // Gran Hada Comandante
    this.spawnEnemy({
      type: 'big_fairy',
      trajectory: 'hover_retreat',
      attackPattern: 'star_rings',
      startX,
      startY,
      speed: 80,
      hp: 130,
      radius: 30,
      scoreValue: 1200,
      itemDrop: 'life_frag',
      shootInterval: 0.75,
      customParams: { hoverX: 680, hoverTime: 7.5 },
    });

    // 4 Escoltas en espiral cuádruple
    for (let k = 0; k < 4; k++) {
      const phase = (Math.PI / 2) * k;
      this.spawnEnemy({
        type: k % 2 === 0 ? 'red_fairy' : 'purple_fairy',
        trajectory: 'spiral',
        attackPattern: 'cross_spread',
        startX: startX + 40,
        startY: startY + (k % 2 === 0 ? -120 : 120),
        speed: 140,
        hp: 35,
        itemDrop: k % 2 === 0 ? 'power' : 'bomb_frag',
        shootInterval: 0.95,
        customParams: { phase },
      });
    }
  }

  /**
   * OLEADA 4: Asalto Pesado Púrpura (Formación de 4 hadas pesadas)
   */
  public spawnPurpleAssaultWave(): void {
    const yPositions = [140, 240, 340, 440];
    for (let i = 0; i < yPositions.length; i++) {
      this.spawnEnemy({
        type: 'purple_fairy',
        trajectory: 'hover_retreat',
        attackPattern: 'ring_burst',
        startX: 1060 + i * 50,
        startY: yPositions[i],
        speed: 150,
        hp: 38,
        itemDrop: i % 2 === 0 ? 'power' : 'point',
        shootInterval: 0.9,
        customParams: { hoverX: 710 - (i % 2) * 50, hoverTime: 4.2 },
      });
    }
  }

  /**
   * OLEADA 5: Cortina de Fuego Cruzado en Zigzag
   */
  public spawnCrossfireWave(count: number = 8): void {
    for (let i = 0; i < count; i++) {
      const isTop = i % 2 === 0;
      this.spawnEnemy({
        type: 'green_fairy',
        trajectory: isTop ? 'cross_top' : 'cross_bottom',
        attackPattern: 'needle_stream',
        startX: 1050 + i * 65,
        startY: isTop ? 40 : 530,
        speed: 230,
        hp: 18,
        itemDrop: i % 3 === 0 ? 'power' : 'point',
        shootInterval: 0.8,
        shootDelay: 0.15 + i * 0.1,
      });
    }
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];
  }

  public update(
    dt: number,
    animTimer: number,
    playerPos: { x: number; y: number },
    bulletSystem: BulletSystem,
    onEnemyDefeated?: (x: number, y: number, score: number, itemDrop: ItemType) => void
  ): void {
    // 1. Actualizar enemigos y limpiar muertos / fuera de pantalla
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, animTimer, playerPos, bulletSystem);

      if (enemy.isOffscreen) {
        enemy.destroy();
        this.enemies.splice(i, 1);
        continue;
      }
    }

    // 2. Colisión Proyectiles de Jugador -> Enemigos
    for (let i = bulletSystem.playerBullets.length - 1; i >= 0; i--) {
      const pb = bulletSystem.playerBullets[i];
      let bulletHit = false;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (enemy.isDead) continue;

        const dist = Math.hypot(pb.x - enemy.pos.x, pb.y - enemy.pos.y);
        if (dist < enemy.radius + 6) {
          bulletHit = true;
          const isKilled = enemy.takeDamage(1.5);

          if (isKilled) {
            if (onEnemyDefeated) {
              onEnemyDefeated(enemy.pos.x, enemy.pos.y, enemy.scoreValue, enemy.itemDrop);
            }
            enemy.destroy();
            this.enemies.splice(j, 1);
          }
          break;
        }
      }

      if (bulletHit) {
        bulletSystem.playerBullets.splice(i, 1);
      }
    }
  }

  public checkLaserHits(
    laserSystem: LaserSystem,
    onEnemyDefeated?: (x: number, y: number, score: number, itemDrop: ItemType) => void
  ): void {
    for (const laser of laserSystem.lasers) {
      if (laser.state !== 'firing' || laser.ownerId !== 'player') continue;

      const beamHalfWidth = laser.currentWidth / 2;
      const laserY = laser.sourceY;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (enemy.isDead) continue;

        // Comprobar si el enemigo está en el rango horizontal del rayo y en su ancho vertical
        if (enemy.pos.x >= laser.sourceX && Math.abs(enemy.pos.y - laserY) < beamHalfWidth + enemy.radius) {
          const isKilled = enemy.takeDamage(8.0);
          if (isKilled) {
            if (onEnemyDefeated) {
              onEnemyDefeated(enemy.pos.x, enemy.pos.y, enemy.scoreValue, enemy.itemDrop);
            }
            enemy.destroy();
            this.enemies.splice(j, 1);
          }
        }
      }
    }
  }

  public get activeCount(): number {
    return this.enemies.length;
  }
}
