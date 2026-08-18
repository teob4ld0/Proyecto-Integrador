import * as PIXI from 'pixi.js';
import type { SparkParticle } from '../types';

export class ParticleSystem {
  public particles: SparkParticle[] = [];

  public spawnSpark(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    size: number,
    maxLife: number,
    isStar: boolean = false
  ): void {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      size,
      color,
      alpha: 1.0,
      life: maxLife,
      maxLife,
      isStar,
    });
  }

  public spawnBurst(x: number, y: number, count: number, speed: number, colors: number[], isStar: boolean = true): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.8);
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.spawnSpark(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        3 + Math.random() * 3,
        0.25 + Math.random() * 0.2,
        isStar
      );
    }
  }

  public update(dt: number, graphics: PIXI.Graphics): void {
    graphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.isStar) {
        // Estrella mágica de 4 puntas de Marisa
        const s = p.size * p.alpha;
        graphics.lineStyle(1.5, p.color, p.alpha);
        graphics.moveTo(p.x - s * 2, p.y);
        graphics.lineTo(p.x + s * 2, p.y);
        graphics.moveTo(p.x, p.y - s * 2);
        graphics.lineTo(p.x, p.y + s * 2);
        graphics.lineStyle(0);

        graphics.beginFill(0xffffff, p.alpha);
        graphics.drawCircle(p.x, p.y, s * 0.6);
        graphics.endFill();
      } else {
        // Chispa circular brillante
        graphics.beginFill(p.color, p.alpha * 0.7);
        graphics.drawCircle(p.x, p.y, p.size);
        graphics.endFill();
        graphics.beginFill(0xffffff, p.alpha);
        graphics.drawCircle(p.x, p.y, p.size * 0.4);
        graphics.endFill();
      }
    }
  }

  public clear(): void {
    this.particles = [];
  }
}
