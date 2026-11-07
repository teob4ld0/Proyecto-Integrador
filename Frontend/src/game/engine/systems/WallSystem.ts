import * as PIXI from 'pixi.js';
import type { WallBarrier, Bullet } from '../types';

export class WallSystem {
  public walls: WallBarrier[] = [];

  public spawnWall(x: number, y: number, vx: number = 45, vy: number = 0, width: number = 18, height: number = 64, hp: number = 25, ttl: number = 1.0): WallBarrier {
    const wall: WallBarrier = {
      id: `wall-${Date.now()}-${Math.random()}`,
      x,
      y,
      vx,
      vy,
      width,
      height,
      hp,
      maxHp: hp,
      ttl,
    };
    this.walls.push(wall);
    return wall;
  }

  public update(dt: number, bullets: Bullet[], onAbsorbBullet?: (bullet: Bullet, wall: WallBarrier) => void): void {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.ttl -= dt;

      if (w.ttl <= 0 || w.hp <= 0) {
        this.walls.splice(i, 1);
        continue;
      }

      // Absorción y eliminación de balas que crucen el muro
      for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
        const b = bullets[bIdx];
        if (b.isPlayerBullet) continue; // Los muros propios no bloquean balas aliadas

        const halfW = w.width * 0.5 + b.radius;
        const halfH = w.height * 0.5 + b.radius;

        if (Math.abs(b.x - w.x) <= halfW && Math.abs(b.y - w.y) <= halfH) {
          bullets.splice(bIdx, 1);
          if (onAbsorbBullet) {
            onAbsorbBullet(b, w);
          }
        }
      }
    }
  }

  public render(graphics: PIXI.Graphics, animTimer: number): void {
    graphics.clear();

    for (const w of this.walls) {
      const alphaPulse = 0.7 + 0.3 * Math.sin(animTimer * 20);

      // Glow exterior neón
      graphics.lineStyle(3, 0x00ff88, alphaPulse);
      graphics.beginFill(0x003322, 0.65);
      graphics.drawRoundedRect(w.x - w.width * 0.5, w.y - w.height * 0.5, w.width, w.height, 6);
      graphics.endFill();
      graphics.lineStyle(0);

      // Mini barra de vida del muro
      const hpRatio = Math.max(0, w.hp / w.maxHp);
      graphics.beginFill(0x00ff88, 0.9);
      graphics.drawRect(w.x - w.width * 0.5, w.y - w.height * 0.5 - 6, w.width * hpRatio, 3);
      graphics.endFill();
    }
  }

  public clear(): void {
    this.walls = [];
  }
}
