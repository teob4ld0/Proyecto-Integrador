import * as PIXI from 'pixi.js';
import type { RemotePlayer } from './types';
import type { ServerBullet, ServerLaser, ServerBoss, ServerWall } from '../network/wsClient';
import { BackgroundRenderer } from './systems/BackgroundRenderer';
import { ParticleSystem } from './systems/ParticleSystem';
import { WallSystem } from './systems/WallSystem';
import { LaserSystem } from './systems/LaserSystem';
import { BulletSystem } from './systems/BulletSystem';
import { SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from './physics/RenderConstants';

export class BaseStageEngine {
  public app: PIXI.Application;

  // Factores de escalado: Backend (800x600) -> Frontend (1024x576)
  public readonly SCALE_X = SCALE_X;
  public readonly SCALE_Y = SCALE_Y;

  // Capas WebGL
  public bgContainer = new PIXI.Container();
  public playfieldContainer = new PIXI.Container();
  public enemyContainer = new PIXI.Container();
  public wallGraphics = new PIXI.Graphics();
  public laserGraphics = new PIXI.Graphics();
  public fxGraphics = new PIXI.Graphics();
  public bulletGraphics = new PIXI.Graphics();
  public spellcardOverlayGraphics = new PIXI.Graphics();
  public remotePlayersContainer = new PIXI.Container();
  public playerContainer = new PIXI.Container();
  public uiContainer = new PIXI.Container();

  // Sistemas Modulares
  public backgroundRenderer: BackgroundRenderer;
  public particleSystem: ParticleSystem;
  public wallSystem: WallSystem;
  public laserSystem: LaserSystem;
  public bulletSystem: BulletSystem;

  // Sprites de jugadores remotos (Multijugador)
  protected remotePlayerSprites = new Map<string, PIXI.Container>();

  // Estado compartido
  public stageTime: number = 0;
  public animTimer: number = 0;
  public score: number = 0;
  public hiScore: number = 90039210;
  public playerLives: number = 3;
  public playerBombs: number = 3;
  public power: number = 0;
  public graze: number = 0;
  public shakeTimer: number = 0;
  public freezeTimer: number = 0;
  public isLaserFiring: boolean = false;

  public isBackendConnected: boolean = false;
  public useBackendBullets: boolean = false;

  constructor(canvas: HTMLCanvasElement, width: number = 1024, height: number = 576) {
    this.app = new PIXI.Application({
      view: canvas,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0x06040a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    // Añadir capas en orden de profundidad
    this.app.stage.addChild(this.bgContainer);
    this.app.stage.addChild(this.playfieldContainer);
    this.playfieldContainer.addChild(this.enemyContainer);
    this.playfieldContainer.addChild(this.wallGraphics);
    this.playfieldContainer.addChild(this.laserGraphics);
    this.playfieldContainer.addChild(this.bulletGraphics);
    this.playfieldContainer.addChild(this.spellcardOverlayGraphics);
    this.playfieldContainer.addChild(this.remotePlayersContainer);
    this.playfieldContainer.addChild(this.playerContainer);
    this.playfieldContainer.addChild(this.fxGraphics);
    this.app.stage.addChild(this.uiContainer);

    // Inicializar sistemas
    this.backgroundRenderer = new BackgroundRenderer(this.bgContainer);
    this.particleSystem = new ParticleSystem();
    this.wallSystem = new WallSystem();
    this.laserSystem = new LaserSystem();
    this.bulletSystem = new BulletSystem();
  }

  private static readonly AVAILABLE_SOUNDS = new Set([
    '/assets/sounds/gasterfire.wav',
    '/assets/sounds/gasterintro.wav',
    '/assets/sounds/masterspark_charge.wav',
    '/assets/sounds/masterspark_fire.wav',
  ]);

  public playSound(soundPath: string, volume: number = 0.5): void {
    if (typeof window !== 'undefined' && BaseStageEngine.AVAILABLE_SOUNDS.has(soundPath)) {
      try {
        const audio = new Audio(soundPath);
        audio.volume = volume;
        audio.play().catch(() => {});
      } catch {
        // Fallback
      }
    }
  }

  public applyScreenShake(dt: number, magnitude: number = 10): void {
    if (this.isLaserFiring) {
      // Muy ligero y fluido shake de pantalla continuo al disparar el Master Spark
      const subtleX = Math.sin(this.animTimer * 50) * 2.8 + (Math.random() - 0.5) * 1.5;
      const subtleY = Math.cos(this.animTimer * 42) * 2.5 + (Math.random() - 0.5) * 1.5;
      this.playfieldContainer.position.set(subtleX, subtleY);
    } else if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.playfieldContainer.position.set(
        (Math.random() - 0.5) * magnitude,
        (Math.random() - 0.5) * magnitude
      );
    } else {
      this.playfieldContainer.position.set(0, 0);
    }
  }

  public applyBackendSnapshot(players: RemotePlayer[], myPlayerId: string, onTargetPlayerPos?: (x: number, y: number) => void): void {
    this.isBackendConnected = true;
    this.useBackendBullets = true;
    const currentIds = new Set(players.map(p => p.id));

    for (const [id, sprite] of this.remotePlayerSprites.entries()) {
      if (!currentIds.has(id)) {
        this.remotePlayersContainer.removeChild(sprite);
        this.remotePlayerSprites.delete(id);
      }
    }

    for (const p of players) {
      const scaledX = p.x * this.SCALE_X;
      const scaledY = p.y * this.SCALE_Y;

      if (p.id === myPlayerId) {
        if (onTargetPlayerPos) onTargetPlayerPos(scaledX, scaledY);
      } else {
        let sprite = this.remotePlayerSprites.get(p.id);
        if (!sprite) {
          const container = new PIXI.Container();
          const spriteImg = new PIXI.Sprite();
          spriteImg.anchor.set(0.5);
          spriteImg.scale.set(0.25);

          const role = (p.character || 'DPS').toLowerCase();
          const spriteUrl = role.includes('tank') || role.includes('def')
            ? '/assets/sprites/defence.png'
            : role.includes('sup') || role.includes('heal')
            ? '/assets/sprites/healer.png'
            : role.includes('spatk') || role.includes('special')
            ? '/assets/sprites/specialattack.png'
            : '/assets/sprites/physicalattack.png';

          try {
            spriteImg.texture = PIXI.Texture.from(spriteUrl);
          } catch {
            const g = new PIXI.Graphics();
            g.beginFill(0x00f2fe, 0.85);
            g.drawCircle(0, 0, 14);
            g.endFill();
            container.addChild(g);
          }

          // Aura indicator
          const aura = new PIXI.Graphics();
          aura.lineStyle(1.5, 0x00f2fe, 0.6);
          aura.drawCircle(0, 0, 18);
          container.addChild(aura);
          container.addChild(spriteImg);

          sprite = container;
          this.remotePlayerSprites.set(p.id, sprite);
          this.remotePlayersContainer.addChild(sprite);
        }
        sprite.position.set(scaledX, scaledY);
      }
    }
  }

  public applyBackendBullets(bullets: ServerBullet[]): void {
    if (!bullets) return;
    this.useBackendBullets = true;
    this.bulletSystem.playerBullets = [];
    this.bulletSystem.bullets = [];

    for (const b of bullets) {
      const scaledX = b.x * this.SCALE_X;
      const scaledY = b.y * this.SCALE_Y;
      const scaledRadius = Math.max(3, (b.radius || 4) * this.SCALE_X);

      if (b.ownerId && b.ownerId !== 'boss') {
        const bulletColor = b.type === 'autoaim' ? 0xff00ff : 0x00f2fe;
        this.bulletSystem.spawnPlayerBullet(scaledX, scaledY, 0, 0, scaledRadius, bulletColor, 0.5);
      } else {
        this.bulletSystem.spawnEnemyBullet(
          scaledX,
          scaledY,
          0,
          0,
          scaledRadius,
          typeof b.color === 'number' ? b.color : 0xff2b5b
        );
      }
    }
  }

  public applyBackendWalls(walls: ServerWall[]): void {
    if (!walls) return;
    this.wallSystem.walls = walls.map((w) => ({
      id: w.id,
      x: w.x * this.SCALE_X,
      y: w.y * this.SCALE_Y,
      vx: 0,
      vy: 0,
      width: (w.width || 14) * this.SCALE_X,
      height: (w.height || 48) * this.SCALE_Y,
      hp: w.hp ?? 25,
      maxHp: w.maxHp ?? 25,
      ttl: w.ttl ?? 1.0,
    }));
  }

  public applyBackendLasers(lasers: ServerLaser[]): void {
    if (!lasers) return;
    this.laserSystem.lasers = lasers.map((l) => ({
      id: l.id,
      ownerId: l.ownerId === 'boss' ? 'boss' : 'player',
      direction: l.direction || (l.ownerId === 'boss' ? 'left' : 'right'),
      sourceX: l.sourceX * this.SCALE_X,
      sourceY: l.sourceY * this.SCALE_Y,
      targetY: l.targetY * this.SCALE_Y,
      state: l.state,
      timer: l.timer,
      chargeDuration: l.chargeDuration,
      fireDuration: l.fireDuration,
      fadeDuration: l.fadeDuration,
      maxWidth: l.maxWidth * this.SCALE_Y,
      currentWidth: l.maxWidth * this.SCALE_Y,
      alpha: 1.0,
      color: l.color || 0xff2b5b,
      podType: (l.sourceY < 300 ? 'top' : 'bottom') as 'top' | 'bottom',
    }));
  }

  public destroy(): void {
    this.app.destroy(true, { children: true, texture: false });
  }
}
