import * as PIXI from 'pixi.js';
import type { BulletSystem } from '../systems/BulletSystem';
import type { LaserSystem } from '../systems/LaserSystem';
import type { BossPhase } from '../types';

export interface BossPhaseDef {
  phase: BossPhase;
  name: string;
  isSpellCard: boolean;
  maxHp: number;
}

export const BOSS_PHASES: BossPhaseDef[] = [
  { phase: 1, name: 'Twilight Non-Spell "Evening Flutter"', isSpellCard: false, maxHp: 110 },
  { phase: 2, name: 'Moon Sign "Moonlight Ray"', isSpellCard: true, maxHp: 140 },
  { phase: 3, name: 'Night Non-Spell "Midnight Petal Barrage"', isSpellCard: false, maxHp: 130 },
  { phase: 4, name: 'Night Sign "Midnight Gaster Cage"', isSpellCard: true, maxHp: 160 },
  { phase: 5, name: 'Darkness Sign "Demarcation of the Dark Forest"', isSpellCard: true, maxHp: 200 },
];

export class Boss {
  public pos = { x: 1100, y: 288 };
  public targetPos = { x: 760, y: 288 };
  public hp = 110;
  public maxHp = 110;
  public phase: BossPhase = 1;
  public remainingStocks: number = 4; // 4 vidas restantes adicionales (5 fases en total)
  public spellcardName = BOSS_PHASES[0].name;
  public isSpellCard: boolean = false;
  public isActive: boolean = false;
  public isDefeated: boolean = false;

  // Estados de Recarga y Transición
  public isInvulnerable: boolean = false;
  public isRefilling: boolean = false;
  public isLockedForBeam: boolean = false;
  public refillTimer: number = 0;
  public displayHpPercent: number = 100;

  public get x(): number {
    return this.pos.x;
  }
  public set x(val: number) {
    this.pos.x = val;
  }

  public get y(): number {
    return this.pos.y;
  }
  public set y(val: number) {
    this.pos.y = val;
  }

  public setPosition(x: number, y: number): void {
    this.pos.x = x;
    this.pos.y = y;
    this.targetPos.x = x;
    this.targetPos.y = y;
    this.container.position.set(x, y);
  }

  public sprite!: PIXI.Sprite | PIXI.Graphics;
  public magicCircleGraphics = new PIXI.Graphics();
  public auraGraphics = new PIXI.Graphics();
  public container = new PIXI.Container();

  private shootTimer = 0;
  private laserTimer = 0;
  private specialTimer = 0;
  private darkOrbTimer = 0;
  private megaLaserTimer = 0;
  private animTimer = 0;
  private introProgress = 0;

  public onPhaseChange?: (newPhase: BossPhase, spellName: string, isSpellCard: boolean) => void;
  public onDefeated?: () => void;

  constructor(
    parentContainer: PIXI.Container,
    spriteUrl: string = '/assets/sprites/FirstBoss.png',
    initialHp: number = 110
  ) {
    this.hp = initialHp;
    this.maxHp = initialHp;
    parentContainer.addChild(this.container);
    this.container.addChild(this.auraGraphics);
    this.container.addChild(this.magicCircleGraphics);
    this.initSprite(spriteUrl);
    this.container.visible = false;
  }

  private initSprite(spriteUrl: string): void {
    PIXI.Texture.fromURL(spriteUrl).then((tex) => {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(0.42);
      sprite.position.set(0, 0);
      this.sprite = sprite;
      this.container.addChild(sprite);
    }).catch(() => {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xff2b5b);
      fallback.drawCircle(0, 0, 32);
      fallback.endFill();
      fallback.lineStyle(2, 0xffffff, 0.9);
      fallback.drawCircle(0, 0, 32);
      fallback.lineStyle(0);
      fallback.position.set(0, 0);
      this.sprite = fallback;
      this.container.addChild(fallback);
    });
  }

  public spawn(targetX: number = 760, targetY: number = 288): void {
    this.isActive = true;
    this.container.visible = true;
    this.pos.x = 1100;
    this.pos.y = targetY;
    this.targetPos = { x: targetX, y: targetY };
    this.introProgress = 0;
    this.phase = 1;
    this.remainingStocks = 4;
    this.hp = BOSS_PHASES[0].maxHp;
    this.maxHp = BOSS_PHASES[0].maxHp;
    this.spellcardName = BOSS_PHASES[0].name;
    this.isSpellCard = BOSS_PHASES[0].isSpellCard;
    this.isDefeated = false;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.refillTimer = 0;
    this.displayHpPercent = 100;
  }

  public reset(initialHp: number = 110): void {
    this.phase = 1;
    this.remainingStocks = 4;
    this.hp = BOSS_PHASES[0].maxHp;
    this.maxHp = BOSS_PHASES[0].maxHp;
    this.spellcardName = BOSS_PHASES[0].name;
    this.isSpellCard = false;
    this.isActive = false;
    this.isDefeated = false;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.container.visible = false;
    this.pos = { x: 1100, y: 288 };
    this.magicCircleGraphics.clear();
    this.auraGraphics.clear();
  }

  public update(
    dt: number,
    playerPos: { x: number; y: number },
    bulletSystem: BulletSystem,
    laserSystem: LaserSystem,
    scaleX: number = 1.28,
    scaleY: number = 0.96
  ): void {
    if (!this.isActive || this.isDefeated) return;

    this.animTimer += dt;

    // 1. Animación de Entrada
    if (this.introProgress < 1.0) {
      this.introProgress = Math.min(1.0, this.introProgress + dt * 0.9);
      const ease = 1 - Math.pow(1 - this.introProgress, 3);
      this.pos.x = 1100 + (this.targetPos.x - 1100) * ease;
      this.pos.y = this.targetPos.y;
      this.container.position.set(this.pos.x, this.pos.y);
      return;
    }

    // 2. Animación de Recarga de Barra de Vida / Transición
    if (this.isRefilling) {
      this.refillTimer -= dt;
      const progress = 1 - Math.max(0, this.refillTimer / 1.2);
      this.displayHpPercent = Math.min(100, progress * 100);

      // Aura de recarga resplandeciente
      this.renderRefillAura(this.animTimer, progress);

      if (this.refillTimer <= 0) {
        this.isRefilling = false;
        this.isInvulnerable = false;
        this.displayHpPercent = (this.hp / this.maxHp) * 100;
        this.auraGraphics.clear();
      }
      this.container.position.set(this.pos.x, this.pos.y);
      return;
    } else {
      this.displayHpPercent = (this.hp / this.maxHp) * 100;
    }

    // 3. Movimiento Flotante Armónico según Fase (Bloqueado durante disparo de Mega Láser / Pugna)
    if (this.isLockedForBeam) {
      this.pos.x = this.targetPos.x;
      this.pos.y = this.targetPos.y;
    } else if (this.phase === 1) {
      // Oscilación vertical suave
      this.pos.y = this.targetPos.y + Math.sin(this.animTimer * 2.2) * 50;
      this.pos.x = this.targetPos.x + Math.cos(this.animTimer * 1.1) * 15;
    } else if (this.phase === 2) {
      // Movimiento en 8 infinito horizontal
      this.pos.x = this.targetPos.x + Math.cos(this.animTimer * 1.8) * 45;
      this.pos.y = this.targetPos.y + Math.sin(this.animTimer * 3.6) * 60;
    } else if (this.phase === 3) {
      // Deriva lateral rápida con retroceso
      this.pos.x = this.targetPos.x + Math.sin(this.animTimer * 3.0) * 35;
      this.pos.y = this.targetPos.y + Math.cos(this.animTimer * 2.0) * 75;
    } else if (this.phase === 4) {
      // Posición de anclaje firme con vibración
      this.pos.x = this.targetPos.x + Math.sin(this.animTimer * 5.0) * 15;
      this.pos.y = this.targetPos.y + Math.cos(this.animTimer * 2.8) * 40;
    } else {
      // FASE 5 (FINAL): Vórtice central agresivo
      this.pos.x = this.targetPos.x + Math.cos(this.animTimer * 2.5) * 55;
      this.pos.y = this.targetPos.y + Math.sin(this.animTimer * 2.5) * 75;
    }

    this.container.position.set(this.pos.x, this.pos.y);

    // 4. Renderizar Círculo Mágico de Spell Card (Phases 2, 4, 5)
    this.renderMagicCircle(this.animTimer);

    // Si el Jefe está cargando/disparando el Mega Láser o en Beam Struggle, NO disparar Danmaku ni lásers secundarios
    if (this.isLockedForBeam) {
      this.shootTimer = 0;
      this.laserTimer = 0;
      this.specialTimer = 0;
      this.darkOrbTimer = 0;
      return;
    }

    // 5. Temporizadores de Danmaku
    this.shootTimer += dt;
    this.laserTimer += dt;
    this.specialTimer += dt;
    this.darkOrbTimer += dt;

    // 6. Patrones Danmaku de las 5 Fases
    switch (this.phase) {
      case 1: {
        // FASE 1 (NON-SPELL 1): "Twilight Flutter"
        if (this.shootTimer >= 0.38) {
          this.shootTimer = 0;
          bulletSystem.spawnEnemyFan(
            this.pos.x - 30,
            this.pos.y,
            playerPos.x,
            playerPos.y,
            [-0.35, -0.18, 0, 0.18, 0.35],
            270,
            0xff3366
          );
        }

        if (this.specialTimer >= 1.6) {
          this.specialTimer = 0;
          bulletSystem.spawnEnemyFan(
            this.pos.x - 30,
            this.pos.y,
            playerPos.x,
            playerPos.y,
            [-0.5, 0.5],
            320,
            0x00f2fe
          );
        }

        if (this.laserTimer >= 5.0) {
          this.laserTimer = 0;
          this.triggerRhombusLasers(laserSystem, playerPos, scaleX, scaleY, 'targeted');
        }
        break;
      }

      case 2: {
        // FASE 2 (SPELL CARD 1): Moon Sign "Moonlight Ray"
        if (this.shootTimer >= 0.3) {
          this.shootTimer = 0;
          bulletSystem.spawnEnemyFan(
            this.pos.x - 30,
            this.pos.y,
            playerPos.x,
            playerPos.y,
            [-0.22, 0.22],
            330,
            0x00f2fe
          );
        }

        // Anillos expansivos de estrellas
        if (this.specialTimer >= 1.4) {
          this.specialTimer = 0;
          const count = 18;
          const speed = 200;
          const baseAngle = this.animTimer * 1.8;
          for (let i = 0; i < count; i++) {
            const a = baseAngle + (Math.PI * 2 * i) / count;
            bulletSystem.spawnEnemyBullet(
              this.pos.x,
              this.pos.y,
              Math.cos(a) * speed,
              Math.sin(a) * speed,
              6,
              0xffdd00
            );
          }
        }

        if (this.laserTimer >= 3.8) {
          this.laserTimer = 0;
          this.triggerRhombusLasers(laserSystem, playerPos, scaleX, scaleY, 'targeted');
        }

        this.megaLaserTimer += dt;
        if (this.megaLaserTimer >= 6.5) {
          this.megaLaserTimer = 0;
          this.triggerMegaGoldLaser(laserSystem);
        }
        break;
      }

      case 3: {
        // FASE 3 (NON-SPELL 2): "Midnight Petal Barrage"
        if (this.shootTimer >= 0.22) {
          this.shootTimer = 0;
          const angle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
          const wave = Math.sin(this.animTimer * 9) * 0.45;
          bulletSystem.spawnEnemyBullet(
            this.pos.x - 25,
            this.pos.y,
            Math.cos(angle + wave) * 280,
            Math.sin(angle + wave) * 280,
            5.5,
            0xff00aa
          );
          bulletSystem.spawnEnemyBullet(
            this.pos.x - 25,
            this.pos.y,
            Math.cos(angle - wave) * 280,
            Math.sin(angle - wave) * 280,
            5.5,
            0x00f2fe
          );
        }

        if (this.specialTimer >= 1.1) {
          this.specialTimer = 0;
          bulletSystem.spawnEnemyFan(
            this.pos.x - 30,
            this.pos.y,
            playerPos.x,
            playerPos.y,
            [-0.3, 0, 0.3],
            340,
            0xffffff
          );
        }
        break;
      }

      case 4: {
        // FASE 4 (SPELL CARD 2): Night Sign "Midnight Gaster Cage"
        if (this.shootTimer >= 0.16) {
          this.shootTimer = 0;
          // Tormenta espiral continua de 6 brazos
          const rot = this.animTimer * 5.5;
          for (let arm = 0; arm < 6; arm++) {
            const a = rot + (Math.PI / 3) * arm;
            bulletSystem.spawnEnemyBullet(
              this.pos.x - 20,
              this.pos.y,
              Math.cos(a) * 240,
              Math.sin(a) * 240,
              5.5,
              arm % 2 === 0 ? 0xff2b5b : 0x9900ff
            );
          }
        }

        // Rayos Paralelos Continuos
        if (this.laserTimer >= 3.2) {
          this.laserTimer = 0;
          this.triggerRhombusLasers(laserSystem, playerPos, scaleX, scaleY, 'both');
        }

        this.megaLaserTimer += dt;
        if (this.megaLaserTimer >= 6.0) {
          this.megaLaserTimer = 0;
          this.triggerMegaGoldLaser(laserSystem);
        }
        break;
      }

      case 5: {
        // FASE 5 (FINAL SPELL CARD): Darkness Sign "Demarcation of the Dark Forest"
        // 1. Espiral densa de estrellas de 8 brazos
        if (this.shootTimer >= 0.14) {
          this.shootTimer = 0;
          const rot = this.animTimer * 4.2;
          for (let arm = 0; arm < 8; arm++) {
            const a = rot + (Math.PI / 4) * arm;
            bulletSystem.spawnEnemyBullet(
              this.pos.x,
              this.pos.y,
              Math.cos(a) * 220,
              Math.sin(a) * 220,
              6,
              arm % 2 === 0 ? 0xffea00 : 0xff3366
            );
          }
        }

        // 2. Orbes Oscuros Expansivos en Cruz
        if (this.darkOrbTimer >= 1.5) {
          this.darkOrbTimer = 0;
          const count = 12;
          const baseA = this.animTimer * 2.0;
          for (let i = 0; i < count; i++) {
            const a = baseA + (Math.PI * 2 * i) / count;
            bulletSystem.spawnEnemyBullet(
              this.pos.x,
              this.pos.y,
              Math.cos(a) * 160,
              Math.sin(a) * 160,
              7,
              0x00f2fe
            );
          }
        }

        // 3. Rayos Láser Frecuentes
        if (this.laserTimer >= 3.0) {
          this.laserTimer = 0;
          this.triggerRhombusLasers(laserSystem, playerPos, scaleX, scaleY, 'both');
        }

        this.megaLaserTimer += dt;
        if (this.megaLaserTimer >= 5.5) {
          this.megaLaserTimer = 0;
          this.triggerMegaGoldLaser(laserSystem);
        }
        break;
      }
    }
  }

  public triggerMegaGoldLaser(laserSystem: LaserSystem): void {
    this.isLockedForBeam = true;
    this.pos.x = 940;
    this.targetPos.x = 940;
    this.targetPos.y = this.pos.y;

    // Rumia carga un rayo dorado colosal con origen exacto en su centro (mismo ancho de 96px que el Master Spark)
    laserSystem.spawnLaser(this.pos.x, this.pos.y, this.pos.y, {
      ownerId: 'boss',
      direction: 'left',
      chargeDuration: 1.25,
      fireDuration: 1.8,
      fadeDuration: 0.4,
      maxWidth: 96,
      color: 0xffdd00,
      isMegaBeam: true,
    });
  }

  public loseFullHealthBar(): void {
    if (!this.isActive || this.isDefeated) return;
    this.isInvulnerable = false;
    this.isRefilling = false;
    this.takeDamage(this.hp + 999);
  }

  private renderRefillAura(animTimer: number, progress: number): void {
    this.auraGraphics.clear();
    const rad = 45 + Math.sin(animTimer * 20) * 8 + progress * 25;
    this.auraGraphics.beginFill(0x00f2fe, 0.25 * (1 - progress * 0.5));
    this.auraGraphics.drawCircle(0, 0, rad);
    this.auraGraphics.endFill();

    this.auraGraphics.lineStyle(2, 0xffffff, 0.9);
    this.auraGraphics.drawCircle(0, 0, rad * 0.85);
    this.auraGraphics.lineStyle(0);
  }

  private renderMagicCircle(animTimer: number): void {
    this.magicCircleGraphics.clear();

    // Solo mostrar círculo mágico en fases de Spell Card normales cuando no está en Mega Láser / Struggle
    if (this.phase === 1 || this.phase === 3 || this.isLockedForBeam) return;

    const rot = animTimer * 2.2;
    const circleColor = this.phase === 5 ? 0xffdd00 : (this.phase === 4 ? 0xff2b5b : 0x00f2fe);
    const radius = 68 + Math.sin(animTimer * 6) * 5;

    // Anillo Exterior
    this.magicCircleGraphics.lineStyle(2.5, circleColor, 0.8);
    this.magicCircleGraphics.drawCircle(0, 0, radius);
    this.magicCircleGraphics.lineStyle(1.2, 0xffffff, 0.6);
    this.magicCircleGraphics.drawCircle(0, 0, radius * 0.78);

    // Runas / Polígonos Sagrados Giratorios
    this.magicCircleGraphics.lineStyle(1.5, circleColor, 0.7);
    const points = this.phase === 5 ? 8 : 6;
    for (let i = 0; i < points; i++) {
      const a1 = rot + (Math.PI * 2 * i) / points;
      const a2 = rot + (Math.PI * 2 * (i + 2)) / points;
      const x1 = Math.cos(a1) * radius;
      const y1 = Math.sin(a1) * radius;
      const x2 = Math.cos(a2) * radius;
      const y2 = Math.sin(a2) * radius;
      this.magicCircleGraphics.moveTo(x1, y1);
      this.magicCircleGraphics.lineTo(x2, y2);
    }
    this.magicCircleGraphics.lineStyle(0);
  }

  public triggerRhombusLasers(
    laserSystem: LaserSystem,
    playerPos: { x: number; y: number },
    scaleX: number,
    scaleY: number,
    pattern: 'both' | 'targeted' = 'both'
  ): void {
    const podX = 665 * scaleX;
    const topPodY = 252 * scaleY;
    const bottomPodY = 348 * scaleY;

    if (pattern === 'both') {
      laserSystem.spawnLaser(podX, topPodY, topPodY, {
        ownerId: 'boss',
        direction: 'left',
        chargeDuration: 0.6,
        fireDuration: 1.0,
        fadeDuration: 0.3,
        maxWidth: 38,
        color: this.phase >= 4 ? 0xff2b5b : 0xff3366,
        podType: 'top',
      });

      laserSystem.spawnLaser(podX, bottomPodY, bottomPodY, {
        ownerId: 'boss',
        direction: 'left',
        chargeDuration: 0.6,
        fireDuration: 1.0,
        fadeDuration: 0.3,
        maxWidth: 38,
        color: this.phase >= 4 ? 0xff2b5b : 0xff3366,
        podType: 'bottom',
      });
    } else {
      const podY = playerPos.y < this.pos.y ? topPodY : bottomPodY;
      laserSystem.spawnLaser(podX, podY, playerPos.y, {
        ownerId: 'boss',
        direction: 'left',
        chargeDuration: 0.5,
        fireDuration: 1.0,
        fadeDuration: 0.3,
        maxWidth: 46,
        color: 0x00f2fe,
        podType: playerPos.y < this.pos.y ? 'top' : 'bottom',
      });
    }
  }

  public takeDamage(amount: number): void {
    if (!this.isActive || this.isDefeated || this.isInvulnerable || this.isRefilling) return;

    this.hp = Math.max(0, Number((this.hp - amount).toFixed(1)));

    // Si la barra actual llega a 0 HP
    if (this.hp <= 0) {
      if (this.phase < 5) {
        // Transición a la siguiente barra de vida
        const nextPhaseIndex = this.phase; // 1 -> index 1 (phase 2)
        const nextDef = BOSS_PHASES[nextPhaseIndex];
        this.phase = nextDef.phase;
        this.remainingStocks = 5 - this.phase;
        this.spellcardName = nextDef.name;
        this.isSpellCard = nextDef.isSpellCard;
        this.hp = nextDef.maxHp;
        this.maxHp = nextDef.maxHp;

        // Activar invulnerabilidad y animación de recarga
        this.isInvulnerable = true;
        this.isRefilling = true;
        this.refillTimer = 1.2;

        if (this.onPhaseChange) {
          this.onPhaseChange(this.phase, this.spellcardName, this.isSpellCard);
        }
      } else if (!this.isDefeated) {
        // Derrota final del Jefe
        this.isDefeated = true;
        this.isActive = false;
        this.container.visible = false;
        if (this.onDefeated) {
          this.onDefeated();
        }
      }
    }
  }
}


