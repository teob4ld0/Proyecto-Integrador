import * as PIXI from 'pixi.js';
import type { Bullet } from '../types';

export class BulletSystem {
  public playerBullets: Bullet[] = [];
  public bullets: Bullet[] = [];

  public spawnPlayerBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number = 5,
    color: number = 0x00f2fe,
    damage: number = 0.5
  ): Bullet {
    const b: Bullet = {
      x,
      y,
      vx,
      vy,
      radius,
      color,
      damage,
      isPlayerBullet: true,
    };
    this.playerBullets.push(b);
    return b;
  }

  public spawnEnemyBullet(x: number, y: number, vx: number, vy: number, radius: number = 6, color: number = 0xff2b5b): Bullet {
    const b: Bullet = {
      x,
      y,
      vx,
      vy,
      radius,
      color,
      isPlayerBullet: false,
    };
    this.bullets.push(b);
    return b;
  }

  public spawnEnemyFan(originX: number, originY: number, targetX: number, targetY: number, offsets: number[] = [-0.25, 0, 0.25], speed: number = 300, color: number = 0xff2b5b): void {
    const baseAngle = Math.atan2(targetY - originY, targetX - originX);
    for (const offset of offsets) {
      const angle = baseAngle + offset;
      this.spawnEnemyBullet(
        originX,
        originY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        6,
        color
      );
    }
  }

  public update(
    dt: number,
    playerPos: { x: number; y: number },
    bossPos: { x: number; y: number; hp: number },
    callbacks?: {
      onPlayerHit?: () => void;
      onBossHit?: (dmg: number) => void;
      onPlayerBulletHit?: () => void;
    }
  ): void {
    // 1. Mover y evaluar Proyectiles del Jugador
    const bossX = (bossPos as any).pos?.x ?? bossPos.x;
    const bossY = (bossPos as any).pos?.y ?? bossPos.y;
    const bossHp = bossPos.hp;

    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const pb = this.playerBullets[i];
      pb.x += pb.vx * dt;
      pb.y += pb.vy * dt;

      if (pb.x > 1050 || pb.x < -30 || pb.y < -30 || pb.y > 600) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Daño al Jefe
      if (bossHp > 0 && Math.hypot(pb.x - bossX, pb.y - bossY) < 55) {
        if (callbacks?.onBossHit) callbacks.onBossHit(pb.damage ?? 0.5);
        if (callbacks?.onPlayerBulletHit) callbacks.onPlayerBulletHit();
        this.playerBullets.splice(i, 1);
      }
    }

    // 2. Mover y evaluar Proyectiles Enemigos
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -30 || b.x > 1050 || b.y < -30 || b.y > 600) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Impacto en el Jugador
      if (Math.hypot(b.x - playerPos.x, b.y - playerPos.y) < b.radius + 3) {
        this.bullets.splice(i, 1);
        if (callbacks?.onPlayerHit) callbacks.onPlayerHit();
      }
    }
  }

  public render(graphics: PIXI.Graphics): void {
    graphics.clear();

    // Dibujar balas de jugador (rectángulos / dardos horizontales)
    for (const pb of this.playerBullets) {
      graphics.beginFill(pb.color || 0x00f2fe);
      graphics.drawRect(pb.x, pb.y - 2, 22, 5);
      graphics.endFill();
    }

    // Dibujar balas enemigas (círculos Danmaku con borde blanco)
    for (const b of this.bullets) {
      graphics.beginFill(b.color);
      graphics.drawCircle(b.x, b.y, b.radius);
      graphics.endFill();
      graphics.lineStyle(1.5, 0xffffff, 0.8);
      graphics.drawCircle(b.x, b.y, b.radius);
      graphics.lineStyle(0);
    }
  }

  public clear(): void {
    this.playerBullets = [];
    this.bullets = [];
  }
}
