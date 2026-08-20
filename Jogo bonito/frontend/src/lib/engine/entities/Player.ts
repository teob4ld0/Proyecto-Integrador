import * as PIXI from 'pixi.js';
import type { CharacterClass } from '../types';
import type { BulletSystem } from '../systems/BulletSystem';
import type { WallSystem } from '../systems/WallSystem';
import type { LaserSystem } from '../systems/LaserSystem';
import type { ParticleSystem } from '../systems/ParticleSystem';
import { getCharacterStats, type CharacterCombatStats } from '../CharacterStats';

export class Player {
  public pos = { x: 100, y: 300 };
  public targetPos = { x: 100, y: 300 };
  public characterClassId: CharacterClass = 'DPS';
  public isFocus: boolean = false;
  public stats: CharacterCombatStats;
  public hp: number;
  public sp: number;

  public container = new PIXI.Container();
  private sprite: PIXI.Sprite | PIXI.Graphics = new PIXI.Graphics();
  private hitbox = new PIXI.Graphics();

  private baseScale = 0.25;
  private shootTimer = 0;
  private skillCooldownTimer = 0;

  constructor(parentContainer: PIXI.Container, initialClass: CharacterClass = 'DPS') {
    this.stats = getCharacterStats(initialClass);
    this.hp = this.stats.hpMax;
    this.sp = 0;
    this.initGraphics();
    parentContainer.addChild(this.container);
    this.setCharacterClass(initialClass);
  }

  public get maxHp(): number {
    return this.stats.hpMax;
  }

  public get maxSp(): number {
    return this.stats.spMax;
  }

  public get defensePercent(): number {
    return this.stats.defensePercent;
  }

  public get bombDamage(): number {
    return this.stats.bombDamage;
  }

  public isBombReady(): boolean {
    return this.sp >= this.maxSp;
  }

  public resetCombatResources(): void {
    this.hp = this.maxHp;
    this.sp = 0;
  }

  public gainSp(amount: number): void {
    if (amount <= 0) return;
    this.sp = Math.min(this.maxSp, this.sp + amount);
  }

  public consumeBombGauge(): boolean {
    if (!this.isBombReady()) return false;
    this.sp = 0;
    return true;
  }

  public applyIncomingDamage(rawDamage: number, ignoreDefense: boolean = false): number {
    const mitigation = ignoreDefense ? 0 : Math.max(0, Math.min(1, this.defensePercent / 100));
    const finalDamage = rawDamage * (1 - mitigation);
    this.hp = Math.max(0, this.hp - finalDamage);
    return finalDamage;
  }

  public heal(amount: number): void {
    if (amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  private initGraphics(): void {
    const defaultGraphic = new PIXI.Graphics();
    defaultGraphic.beginFill(0xff2b5b);
    defaultGraphic.drawCircle(0, 0, 16);
    defaultGraphic.endFill();
    this.sprite = defaultGraphic;

    this.hitbox.clear();
    this.hitbox.beginFill(0xffffff);
    this.hitbox.drawCircle(0, 0, 4);
    this.hitbox.endFill();
    this.hitbox.lineStyle(1.5, 0x00f2fe, 1);
    this.hitbox.drawCircle(0, 0, 7);
    this.hitbox.visible = false;

    this.container.addChild(this.sprite);
    this.container.addChild(this.hitbox);
    this.container.position.set(this.pos.x, this.pos.y);
  }

  public setPosition(x: number, y: number): void {
    this.pos.x = x;
    this.pos.y = y;
    this.targetPos.x = x;
    this.targetPos.y = y;
    this.container.position.set(x, y);
  }

  public setCharacterClass(classId: CharacterClass): void {
    this.characterClassId = classId;
    this.stats = getCharacterStats(classId);
    this.hp = this.stats.hpMax;
    this.sp = 0;
    this.shootTimer = 0;
    const spritePath = this.getSpriteUrl(classId);

    PIXI.Texture.fromURL(spritePath).then((texture) => {
      this.container.removeChildren();

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.scale.set(this.baseScale);
      sprite.rotation = 0;

      this.sprite = sprite;
      this.container.addChild(sprite);
      this.container.addChild(this.hitbox);
    }).catch(() => {
      // Fallback a gráficos vectoriales si no carga
    });
  }

  private getSpriteUrl(classId: string): string {
    const id = (classId || '').toLowerCase();
    switch (id) {
      case 'tank':
      case 'defense': return '/assets/sprites/defence.png';
      case 'support':
      case 'healer': return '/assets/sprites/healer.png';
      case 'dps':
      case 'physical': return '/assets/sprites/physicalattack.png';
      case 'special_attack':
      case 'attack':
      default: return '/assets/sprites/specialattack.png';
    }
  }

  public update(
    dt: number,
    animTimer: number,
    keys: Record<string, boolean>,
    moveVec?: { dx: number; dy: number },
    isBackendControlled: boolean = true
  ): { dx: number; dy: number } {
    this.shootTimer += dt;
    this.skillCooldownTimer = Math.max(0, this.skillCooldownTimer - dt);

    const prevX = this.pos.x;
    const prevY = this.pos.y;
    this.pos.x += (this.targetPos.x - this.pos.x) * 0.75;
    this.pos.y += (this.targetPos.y - this.pos.y) * 0.75;
    const dx = Math.sign(this.pos.x - prevX);
    const dy = Math.sign(this.pos.y - prevY);

    this.isFocus = !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['Shift'] || keys['focus'] || (keys as any).isFocus);
    this.container.position.set(this.pos.x, this.pos.y);
    this.hitbox.visible = this.isFocus;
    if (this.isFocus) this.hitbox.rotation += 0.08;

    this.applySquashAndStretch(dt, animTimer, dx, dy);

    return { dx, dy };
  }

  private applySquashAndStretch(dt: number, animTimer: number, dx: number, dy: number): void {
    if (!(this.sprite instanceof PIXI.Sprite)) return;

    let targetScaleX = this.baseScale;
    let targetScaleY = this.baseScale;
    let targetRotation = 0;

    if (dx !== 0 || dy !== 0) {
      if (dx > 0) {
        targetScaleX = this.baseScale * 1.04;
        targetScaleY = this.baseScale * 0.96;
        targetRotation = 0.05;
      } else if (dx < 0) {
        targetScaleX = this.baseScale * 0.96;
        targetScaleY = this.baseScale * 1.04;
        targetRotation = -0.05;
      }

      if (dy < 0) {
        targetScaleY *= 1.04;
        targetScaleX *= 0.96;
      } else if (dy > 0) {
        targetScaleY *= 0.96;
        targetScaleX *= 1.04;
      }
    } else {
      const breath = Math.sin(animTimer * 4) * 0.003;
      targetScaleX = this.baseScale + breath;
      targetScaleY = this.baseScale - breath;
      targetRotation = 0;
    }

    const lerpSpeed = Math.min(1, 24 * dt);
    this.sprite.scale.x += (targetScaleX - this.sprite.scale.x) * lerpSpeed;
    this.sprite.scale.y += (targetScaleY - this.sprite.scale.y) * lerpSpeed;
    this.sprite.rotation += (targetRotation - this.sprite.rotation) * lerpSpeed;
  }

  public shoot(bulletSystem: BulletSystem, targetPos: { x: number; y: number }): void {
    const shootInterval = 1 / Math.max(0.1, this.stats.shotsPerSecond);
    if (this.shootTimer < shootInterval) return;
    this.shootTimer = 0;

    const normClass = (this.characterClassId || '').toLowerCase();

    if (normClass === 'support' || normClass === 'healer') {
      // Support: Autoaim dirigido al objetivo más cercano (hadas o jefe)
      const angle = Math.atan2(targetPos.y - this.pos.y, targetPos.x - this.pos.x);
      bulletSystem.spawnPlayerBullet(
        this.pos.x + 20,
        this.pos.y,
        Math.cos(angle) * 1100,
        Math.sin(angle) * 1100,
        6,
        0xff00ff,
        this.stats.bulletDamage
      );
    } else if (normClass === 'tank' || normClass === 'defense') {
      // Tank: Disparo pesado
      bulletSystem.spawnPlayerBullet(
        this.pos.x + 20,
        this.pos.y,
        950,
        0,
        7,
        0x00ff88,
        this.stats.bulletDamage
      );
    } else {
      // DPS / SP.ATK base: 5 balas por segundo de 5 de dano cada una (placeholder).
      bulletSystem.spawnPlayerBullet(this.pos.x + 20, this.pos.y, 1200, 0, 5, 0x00f2fe, this.stats.bulletDamage);
    }
  }

  public triggerSkill(
    wallSystem: WallSystem,
    laserSystem: LaserSystem,
    particleSystem: ParticleSystem,
    bulletSystem: BulletSystem,
    bossPos: { x: number; y: number },
    onSound?: (path: string, volume: number) => void
  ): boolean {
    if (this.skillCooldownTimer > 0) return false;
    if (!this.consumeBombGauge()) return false;
    this.skillCooldownTimer = 1.0;

    const normClass = (this.characterClassId || '').toLowerCase();

    if (normClass === 'tank' || normClass === 'defense') {
      // Tank: Despliega Muro de 25 HP con 2.5s de duración
      wallSystem.spawnWall(this.pos.x + 35, this.pos.y, 45, 0, 18, 64, 25, 2.5);
      particleSystem.spawnBurst(this.pos.x + 35, this.pos.y, 12, 90, [0x00ff88, 0x88ffcc], false);
      if (onSound) onSound('/assets/sounds/powerup.wav', 0.6);
      return true;
    }

    if (normClass === 'special_attack' || normClass === 'attack') {
      // SP.ATK: MARISA KIRISAME MASTER SPARK (1.0s de acumulación y congelamiento)
      laserSystem.spawnLaser(this.pos.x + 22, this.pos.y, this.pos.y, {
        ownerId: 'player',
        direction: 'right',
        chargeDuration: 1.0,
        fireDuration: 1.25,
        fadeDuration: 0.35,
        maxWidth: 96,
        color: 0x00f2fe,
      });

      if (onSound) onSound('/assets/sounds/masterspark_charge.wav', 0.95);
      return true;
    }

    if (normClass === 'support' || normClass === 'healer') {
      // Support: Ráfaga Super Autoaim
      for (let i = 0; i < 6; i++) {
        const angle = Math.atan2(bossPos.y - this.pos.y, bossPos.x - this.pos.x) + (i - 2.5) * 0.14;
        bulletSystem.spawnPlayerBullet(
          this.pos.x + 20,
          this.pos.y,
          Math.cos(angle) * 1100,
          Math.sin(angle) * 1100,
          6,
          0xff00ff
        );
      }
      if (onSound) onSound('/assets/sounds/powerup.wav', 0.5);
      return true;
    }

    // DPS: Turbo Stream
    for (let i = 0; i < 4; i++) {
      bulletSystem.spawnPlayerBullet(
        this.pos.x + 15 + i * 15,
        this.pos.y + (i % 2 === 0 ? -10 : 10),
        1300,
        0,
        5,
        0x00f2fe
      );
    }
    if (onSound) onSound('/assets/sounds/powerup.wav', 0.5);
    return true;
  }
}
