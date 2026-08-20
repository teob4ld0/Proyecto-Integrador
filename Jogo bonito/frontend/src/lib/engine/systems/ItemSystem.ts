import * as PIXI from 'pixi.js';
import type { ItemDrop, ItemType } from '../types';
import type { ParticleSystem } from './ParticleSystem';
import type { ServerItem } from '../../network/wsClient';

export class ItemSystem {
  public items: ItemDrop[] = [];
  public graphics: PIXI.Graphics;

  constructor(parentContainer?: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    if (parentContainer) {
      parentContainer.addChild(this.graphics);
    }
  }

  public applyBackendItems(serverItems: ServerItem[], scaleX: number, scaleY: number): void {
    this.items = serverItems.map(it => ({
      id: it.id,
      x: it.x * scaleX,
      y: it.y * scaleY,
      vx: 0,
      vy: 0,
      type: it.type as ItemType,
      value: it.type === 'power' ? 5 : (it.type === 'point' ? 1000 : 5000),
      magnetized: false,
    }));
  }

  public spawnItem(x: number, y: number, type: ItemType = 'power'): ItemDrop {
    const item: ItemDrop = {
      id: `item_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      vx: (Math.random() - 0.5) * 60 - 30, // ligero impulso a la izquierda
      vy: -150 - Math.random() * 80,       // impulso inicial hacia arriba
      type,
      value: type === 'power' ? 5 : (type === 'point' ? 1000 : 5000),
      magnetized: false,
    };
    this.items.push(item);
    return item;
  }

  public spawnItemFountain(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const type: ItemType = i % 2 === 0 ? 'power' : 'point';
      this.spawnItem(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, type);
    }
  }

  public update(
    dt: number,
    animTimer: number,
    playerPos: { x: number; y: number },
    isFocus: boolean,
    particleSystem?: ParticleSystem,
    onCollected?: (type: ItemType, value: number) => void
  ): void {
    // Línea de auto-recolección (Point of Collection horizontal en X < 250)
    const isAtPoC = playerPos.x < 250;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];

      // 1. Detección de imán
      const distToPlayer = Math.hypot(playerPos.x - it.x, playerPos.y - it.y);
      if (isAtPoC || (isFocus && distToPlayer < 240) || distToPlayer < 90) {
        it.magnetized = true;
      }

      // 2. Movimiento
      if (it.magnetized) {
        // Atracción rápida hacia el jugador
        const angle = Math.atan2(playerPos.y - it.y, playerPos.x - it.x);
        const magnetSpeed = 620;
        it.x += Math.cos(angle) * magnetSpeed * dt;
        it.y += Math.sin(angle) * magnetSpeed * dt;
      } else {
        // Gravedad y flotación
        it.vy = Math.min(180, it.vy + 380 * dt);
        it.x += it.vx * dt;
        it.y += it.vy * dt;
      }

      // 3. Colisión y Recolección
      if (distToPlayer < 24) {
        if (onCollected) onCollected(it.type, it.value);

        if (particleSystem) {
          const color = it.type === 'power' ? 0xff2b5b : (it.type === 'point' ? 0x00f2fe : 0xffdd00);
          for (let p = 0; p < 5; p++) {
            particleSystem.spawnSpark(
              it.x,
              it.y,
              (Math.random() - 0.5) * 120,
              (Math.random() - 0.5) * 120,
              color,
              3,
              0.22,
              true
            );
          }
        }

        this.items.splice(i, 1);
        continue;
      }

      // 4. Fuera de pantalla por abajo o izquierda
      if (it.y > 620 || it.x < -40) {
        this.items.splice(i, 1);
      }
    }

    // 5. Renderizar Ítems
    this.render(animTimer);
  }

  private render(animTimer: number): void {
    this.graphics.clear();

    for (const it of this.items) {
      const pulse = Math.sin(animTimer * 10) * 1.5;

      if (it.type === 'power') {
        // Ítem P (Rojo brillante)
        this.graphics.beginFill(0xff2b5b);
        this.graphics.drawRoundedRect(it.x - 8, it.y - 8, 16 + pulse, 16 + pulse, 3);
        this.graphics.endFill();

        this.graphics.lineStyle(1.5, 0xffffff, 0.95);
        this.graphics.drawRoundedRect(it.x - 8, it.y - 8, 16 + pulse, 16 + pulse, 3);
        this.graphics.lineStyle(0);

        // Letra 'P' vectorial
        this.graphics.beginFill(0xffffff);
        this.graphics.drawCircle(it.x, it.y - 2, 3);
        this.graphics.drawRect(it.x - 3, it.y - 4, 2, 8);
        this.graphics.endFill();
      } else if (it.type === 'point') {
        // Ítem Point (Azul Cyan)
        this.graphics.beginFill(0x00a8ff);
        this.graphics.drawRoundedRect(it.x - 8, it.y - 8, 16 + pulse, 16 + pulse, 3);
        this.graphics.endFill();

        this.graphics.lineStyle(1.5, 0xffffff, 0.95);
        this.graphics.drawRoundedRect(it.x - 8, it.y - 8, 16 + pulse, 16 + pulse, 3);
        this.graphics.lineStyle(0);

        // Símbolo diamante central
        this.graphics.beginFill(0xffffff);
        this.graphics.drawCircle(it.x, it.y, 3);
        this.graphics.endFill();
      } else {
        // Estrella de Vida / Bomba (Dorado)
        this.graphics.beginFill(0xffd700);
        this.graphics.drawCircle(it.x, it.y, 9 + pulse);
        this.graphics.endFill();

        this.graphics.lineStyle(1.5, 0xffffff, 0.95);
        this.graphics.drawCircle(it.x, it.y, 9 + pulse);
        this.graphics.lineStyle(0);
      }
    }
  }

  public clear(): void {
    this.items = [];
    this.graphics.clear();
  }
}
