import * as PIXI from 'pixi.js';
import type { EnemyType, TrajectoryType, AttackPatternType, ItemType } from '../types';
import type { BulletSystem } from '../systems/BulletSystem';

export interface EnemyConfig {
  id?: string;
  type?: EnemyType;
  trajectory?: TrajectoryType;
  attackPattern?: AttackPatternType;
  startX: number;
  startY: number;
  hp?: number;
  speed?: number;
  radius?: number;
  scoreValue?: number;
  itemDrop?: ItemType;
  shootInterval?: number;
  shootDelay?: number;
  texture?: PIXI.Texture;
  customParams?: Record<string, any>;
}

export class Enemy {
  public id: string;
  public pos: { x: number; y: number };
  public initialPos: { x: number; y: number };
  public hp: number;
  public maxHp: number;
  public type: EnemyType;
  public trajectory: TrajectoryType;
  public attackPattern: AttackPatternType;
  public speed: number;
  public radius: number;
  public scoreValue: number;
  public itemDrop: ItemType;
  public shootInterval: number;
  public shootTimer: number;
  public lifetime: number = 0;
  public isDead: boolean = false;
  public isOffscreen: boolean = false;
  public flashTimer: number = 0;
  public customParams: Record<string, any>;

  public container = new PIXI.Container();
  private sprite: PIXI.Sprite | PIXI.Graphics;
  private wingGlow = new PIXI.Graphics();
  private baseScale: number = 1.0;

  constructor(parentContainer: PIXI.Container, config: EnemyConfig) {
    this.id = config.id || `enemy_${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type || 'green_fairy';
    this.trajectory = config.trajectory || 'sine';
    this.attackPattern = config.attackPattern || 'aimed_single';
    this.pos = { x: config.startX, y: config.startY };
    this.initialPos = { x: config.startX, y: config.startY };
    this.speed = config.speed ?? (this.type === 'big_fairy' ? 90 : 160);
    this.hp = config.hp ?? (this.type === 'big_fairy' ? 80 : (this.type === 'red_fairy' ? 25 : 12));
    this.maxHp = this.hp;
    this.radius = config.radius ?? (this.type === 'big_fairy' ? 28 : 16);
    this.scoreValue = config.scoreValue ?? (this.type === 'big_fairy' ? 500 : (this.type === 'red_fairy' ? 150 : 80));
    this.itemDrop = config.itemDrop ?? (this.type === 'big_fairy' ? 'bomb_frag' : (this.type === 'red_fairy' ? 'power' : 'point'));
    this.shootInterval = config.shootInterval ?? (this.type === 'big_fairy' ? 0.35 : 1.2);
    this.shootTimer = -(config.shootDelay ?? 0.4);
    this.customParams = config.customParams || {};

    parentContainer.addChild(this.container);

    if (config.texture) {
      const sprite = new PIXI.Sprite(config.texture);
      sprite.anchor.set(0.5);
      this.baseScale = this.type === 'big_fairy' ? 1.0 : 0.8;
      sprite.scale.set(this.baseScale);
      this.sprite = sprite;
      this.container.addChild(sprite);
    } else {
      this.sprite = this.createProceduralGraphics();
      this.container.addChild(this.wingGlow);
      this.container.addChild(this.sprite);
    }

    this.container.position.set(this.pos.x, this.pos.y);
  }

  private createProceduralGraphics(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const isBig = this.type === 'big_fairy';
    const isRed = this.type === 'red_fairy';
    const isPurple = this.type === 'purple_fairy';
    const isYellow = this.type === 'yellow_fairy';
    const color = isBig ? 0xffdd00 : (isRed ? 0xff2b5b : (isPurple ? 0x9933ff : (isYellow ? 0xffea00 : 0x00ff88)));

    g.clear();
    // Cuerpo del hada
    g.beginFill(color);
    g.drawCircle(0, 0, isBig ? 22 : 13);
    g.endFill();

    // Brillo central blanco
    g.beginFill(0xffffff, 0.85);
    g.drawCircle(0, 0, isBig ? 9 : 5);
    g.endFill();

    // Borde brillante
    g.lineStyle(2, 0xffffff, 0.9);
    g.drawCircle(0, 0, isBig ? 22 : 13);
    g.lineStyle(0);

    return g;
  }

  private renderWings(animTimer: number): void {
    if (this.sprite instanceof PIXI.Sprite) return;

    this.wingGlow.clear();
    const flap = Math.sin(animTimer * 18);
    const isBig = this.type === 'big_fairy';
    const isPurple = this.type === 'purple_fairy';
    const wingColor = this.type === 'red_fairy' ? 0xff5588 : (isBig ? 0xffea00 : (isPurple ? 0xcc66ff : 0x55ffaa));

    this.wingGlow.beginFill(wingColor, 0.5 + flap * 0.2);
    // Ala superior izquierda
    this.wingGlow.drawEllipse(-12, -10, (isBig ? 18 : 12) + flap * 3, isBig ? 10 : 6);
    // Ala superior derecha
    this.wingGlow.drawEllipse(12, -10, (isBig ? 18 : 12) + flap * 3, isBig ? 10 : 6);
    // Ala inferior izquierda
    this.wingGlow.drawEllipse(-10, 8, (isBig ? 12 : 8), isBig ? 7 : 4);
    // Ala inferior derecha
    this.wingGlow.drawEllipse(10, 8, (isBig ? 12 : 8), isBig ? 7 : 4);
    this.wingGlow.endFill();
  }

  public update(
    dt: number,
    animTimer: number,
    playerPos: { x: number; y: number },
    bulletSystem: BulletSystem
  ): void {
    if (this.isDead) return;

    this.lifetime += dt;
    this.shootTimer += dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // 1. Movimiento paramétrico
    this.updateTrajectory(dt);

    // 2. Comprobar fuera de pantalla
    if (this.pos.x < -100 || this.pos.x > 1200 || this.pos.y < -100 || this.pos.y > 700) {
      if (this.lifetime > 2.0) {
        this.isOffscreen = true;
      }
    }

    // 3. Lógica de Disparo
    if (this.pos.x > 50 && this.pos.x < 1000 && this.pos.y > 30 && this.pos.y < 546) {
      if (this.shootTimer >= this.shootInterval) {
        this.shootTimer = 0;
        this.executeAttack(playerPos, bulletSystem);
      }
    }

    // 4. Animación visual y posición
    this.container.position.set(this.pos.x, this.pos.y);
    this.renderWings(animTimer);

    if (this.sprite instanceof PIXI.Sprite) {
      const breath = Math.sin(animTimer * 12) * 0.05;
      this.sprite.scale.set(this.baseScale + breath, this.baseScale - breath);
      this.sprite.tint = this.flashTimer > 0 ? 0xffffff : 0xffffff;
    }
  }

  private updateTrajectory(dt: number): void {
    const t = this.lifetime;

    switch (this.trajectory) {
      case 'sine': {
        const freq = this.customParams.freq ?? 2.8;
        const amp = this.customParams.amp ?? 80;
        this.pos.x -= this.speed * dt;
        this.pos.y = this.initialPos.y + Math.sin(t * freq + (this.customParams.phase ?? 0)) * amp;
        break;
      }
      case 'double_helix': {
        const freq = this.customParams.freq ?? 3.2;
        const amp = this.customParams.amp ?? 95;
        this.pos.x -= this.speed * dt;
        this.pos.y = this.initialPos.y + Math.sin(t * freq + (this.customParams.phase ?? 0)) * amp;
        break;
      }
      case 'zigzag': {
        const seg = Math.floor(t * 1.5) % 2;
        this.pos.x -= this.speed * dt;
        this.pos.y += (seg === 0 ? 1 : -1) * (this.speed * 0.7) * dt;
        break;
      }
      case 'swoop': {
        const progress = Math.min(1, t / 1.8);
        const ease = 1 - Math.pow(1 - progress, 3);
        const targetX = this.initialPos.x - 450;
        const targetY = this.customParams.targetY ?? 288;
        if (progress < 1) {
          this.pos.x = this.initialPos.x + (targetX - this.initialPos.x) * ease;
          this.pos.y = this.initialPos.y + (targetY - this.initialPos.y) * ease;
        } else {
          this.pos.x -= this.speed * 1.3 * dt;
          this.pos.y += Math.sin(t * 3) * 20 * dt;
        }
        break;
      }
      case 'hover_retreat': {
        const hoverX = this.customParams.hoverX ?? 720;
        const hoverTime = this.customParams.hoverTime ?? 3.5;
        if (this.pos.x > hoverX) {
          this.pos.x -= this.speed * 1.5 * dt;
        } else if (t < hoverTime) {
          this.pos.y = this.initialPos.y + Math.sin(t * 2) * 60;
        } else {
          this.pos.x += this.speed * 1.6 * dt;
          this.pos.y -= this.speed * 0.4 * dt;
        }
        break;
      }
      case 'cross_top': {
        this.pos.x -= this.speed * dt;
        this.pos.y += this.speed * 0.55 * dt;
        break;
      }
      case 'cross_bottom': {
        this.pos.x -= this.speed * dt;
        this.pos.y -= this.speed * 0.55 * dt;
        break;
      }
      case 'spiral': {
        const rad = 60 + t * 30;
        const ang = t * 3 + (this.customParams.phase ?? 0);
        this.pos.x = this.initialPos.x - this.speed * 0.6 * t + Math.cos(ang) * rad;
        this.pos.y = this.initialPos.y + Math.sin(ang) * rad * 0.5;
        break;
      }
      case 'straight':
      default: {
        this.pos.x -= this.speed * dt;
        break;
      }
    }
  }

  private executeAttack(playerPos: { x: number; y: number }, bulletSystem: BulletSystem): void {
    const isBig = this.type === 'big_fairy';
    const isRed = this.type === 'red_fairy';
    const isPurple = this.type === 'purple_fairy';
    const isYellow = this.type === 'yellow_fairy';
    const bulletColor = isBig ? 0xffd700 : (isRed ? 0xff2b5b : (isPurple ? 0xaa33ff : (isYellow ? 0xffdd00 : 0x00f2fe)));

    switch (this.attackPattern) {
      case 'aimed_single': {
        const angle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
        const speed = 220;
        bulletSystem.spawnEnemyBullet(
          this.pos.x - 10,
          this.pos.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          5,
          bulletColor
        );
        break;
      }
      case 'aimed_spread': {
        const offsets = isBig ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.3, -0.15, 0, 0.15, 0.3];
        bulletSystem.spawnEnemyFan(
          this.pos.x - 10,
          this.pos.y,
          playerPos.x,
          playerPos.y,
          offsets,
          240,
          bulletColor
        );
        break;
      }
      case 'flower_burst': {
        const petals = isBig ? 10 : 6;
        const speed = 210;
        const baseAngle = this.lifetime * 1.5;
        for (let i = 0; i < petals; i++) {
          const a = baseAngle + (Math.PI * 2 * i) / petals;
          bulletSystem.spawnEnemyBullet(
            this.pos.x,
            this.pos.y,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            5.5,
            0xff3399
          );
          bulletSystem.spawnEnemyBullet(
            this.pos.x,
            this.pos.y,
            Math.cos(a + 0.1) * (speed * 0.75),
            Math.sin(a + 0.1) * (speed * 0.75),
            4.5,
            0x00f2fe
          );
        }
        break;
      }
      case 'helix_stream': {
        const angle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
        const wave = Math.sin(this.lifetime * 8) * 0.35;
        const speed = 270;
        bulletSystem.spawnEnemyBullet(
          this.pos.x - 10,
          this.pos.y,
          Math.cos(angle + wave) * speed,
          Math.sin(angle + wave) * speed,
          5,
          0xffdd00
        );
        bulletSystem.spawnEnemyBullet(
          this.pos.x - 10,
          this.pos.y,
          Math.cos(angle - wave) * speed,
          Math.sin(angle - wave) * speed,
          5,
          0x00f2fe
        );
        break;
      }
      case 'cross_spread': {
        const speed = 230;
        const angles = [-0.6, -0.2, 0.2, 0.6];
        const aimAngle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
        for (const off of angles) {
          const a = aimAngle + off;
          bulletSystem.spawnEnemyBullet(
            this.pos.x - 10,
            this.pos.y,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            5,
            0xbf00ff
          );
        }
        break;
      }
      case 'star_rings': {
        const count = 12;
        const speed = 190;
        const rot = this.lifetime * 3.0;
        for (let i = 0; i < count; i++) {
          const a = rot + (Math.PI * 2 * i) / count;
          bulletSystem.spawnEnemyBullet(
            this.pos.x,
            this.pos.y,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            6,
            0xffea00
          );
        }
        break;
      }
      case 'ring_burst': {
        const count = isBig ? 14 : 8;
        const speed = 190;
        const baseAngle = this.lifetime * 2;
        for (let i = 0; i < count; i++) {
          const a = baseAngle + (Math.PI * 2 * i) / count;
          bulletSystem.spawnEnemyBullet(
            this.pos.x,
            this.pos.y,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            isBig ? 6 : 5,
            bulletColor
          );
        }
        break;
      }
      case 'spiral_barrage': {
        const arms = 4;
        const speed = 220;
        const rot = this.lifetime * 4.5;
        for (let a = 0; a < arms; a++) {
          const angle = rot + (Math.PI * 2 * a) / arms;
          bulletSystem.spawnEnemyBullet(
            this.pos.x,
            this.pos.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            5.5,
            bulletColor
          );
        }
        break;
      }
      case 'needle_stream': {
        const angle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
        const speed = 360;
        bulletSystem.spawnEnemyBullet(
          this.pos.x - 12,
          this.pos.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          4,
          0xffffff
        );
        break;
      }
      case 'none':
      default:
        break;
    }
  }

  public takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.flashTimer = 0.08;
    if (this.hp <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  public destroy(): void {
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }
}
