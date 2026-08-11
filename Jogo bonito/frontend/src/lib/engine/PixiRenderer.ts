import * as PIXI from 'pixi.js';

export interface BulletData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
}

export class PixiDanmakuRenderer {
  public app: PIXI.Application;
  
  // Capas de renderizado
  private bgContainer = new PIXI.Container();
  private bossContainer = new PIXI.Container();
  private bulletGraphics = new PIXI.Graphics();
  private playerContainer = new PIXI.Container();
  private fxContainer = new PIXI.Container();

  // Elementos visuales
  private bossSprite = new PIXI.Graphics();
  private playerSprite = new PIXI.Graphics();
  private playerHitbox = new PIXI.Graphics();
  private starfield: Array<{ x: number; y: number; speed: number; size: number }> = [];

  constructor(canvas: HTMLCanvasElement, width: number = 800, height: number = 900) {
    this.app = new PIXI.Application({
      view: canvas,
      width,
      height,
      backgroundColor: 0x060814,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    });

    // Agregar capas al escenario en orden de dibujo
    this.app.stage.addChild(this.bgContainer);
    this.app.stage.addChild(this.bossContainer);
    this.app.stage.addChild(this.bulletGraphics);
    this.app.stage.addChild(this.playerContainer);
    this.app.stage.addChild(this.fxContainer);

    this.initBackground(width, height);
    this.initBoss();
    this.initPlayer();
  }

  private initBackground(w: number, h: number) {
    // Generar campo de estrellas animado para sensación de velocidad Danmaku
    for (let i = 0; i < 120; i++) {
      this.starfield.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 1 + Math.random() * 3,
        size: Math.random() > 0.8 ? 2 : 1
      });
    }
  }

  private initBoss() {
    // Dibujar gráfico de Jefe placeholder estilizado (Remilia Scarlet style)
    this.bossSprite.clear();
    this.bossSprite.beginFill(0xff2b5b);
    this.bossSprite.drawCircle(0, 0, 24);
    this.bossSprite.endFill();
    this.bossSprite.lineStyle(2, 0xffffff, 0.8);
    this.bossSprite.drawCircle(0, 0, 32);
    
    // Aura brillante
    this.bossSprite.lineStyle(4, 0x7928ca, 0.4);
    this.bossSprite.drawCircle(0, 0, 42);

    this.bossContainer.addChild(this.bossSprite);
    this.bossContainer.position.set(400, 180);
  }

  private initPlayer() {
    // Nave / Personaje del jugador (Reimu Hakurei style)
    this.playerSprite.clear();
    this.playerSprite.beginFill(0x00f2fe);
    this.playerSprite.moveTo(0, -18);
    this.playerSprite.lineTo(14, 14);
    this.playerSprite.lineTo(0, 8);
    this.playerSprite.lineTo(-14, 14);
    this.playerSprite.closePath();
    this.playerSprite.endFill();

    // Hitbox central roja visible en modo Focus (Shift)
    this.playerHitbox.clear();
    this.playerHitbox.beginFill(0xff0055);
    this.playerHitbox.drawCircle(0, 0, 5);
    this.playerHitbox.endFill();
    this.playerHitbox.lineStyle(1.5, 0xffffff, 1);
    this.playerHitbox.drawCircle(0, 0, 8);
    this.playerHitbox.visible = false;

    this.playerContainer.addChild(this.playerSprite);
    this.playerContainer.addChild(this.playerHitbox);
    this.playerContainer.position.set(400, 700);
  }

  renderFrame(
    playerPos: { x: number; y: number },
    isFocus: boolean,
    bossPos: { x: number; y: number },
    bullets: BulletData[]
  ) {
    // 1. Animación del fondo (Estrellas)
    this.bgContainer.removeChildren();
    const bgG = new PIXI.Graphics();
    bgG.beginFill(0xffffff, 0.6);
    for (const star of this.starfield) {
      star.y += star.speed;
      if (star.y > 900) star.y = 0;
      bgG.drawCircle(star.x, star.y, star.size);
    }
    bgG.endFill();
    this.bgContainer.addChild(bgG);

    // 2. Actualizar Jugador y Hitbox
    this.playerContainer.position.set(playerPos.x, playerPos.y);
    this.playerHitbox.visible = isFocus;
    if (isFocus) {
      this.playerHitbox.rotation += 0.05; // Rotación sutil de la hitbox en modo enfoque
    }

    // 3. Actualizar Jefe
    this.bossContainer.position.set(bossPos.x, bossPos.y);
    this.bossSprite.rotation += 0.02;

    // 4. Renderizado masivo de Proyectiles (Bullets)
    this.bulletGraphics.clear();
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      this.bulletGraphics.beginFill(b.color);
      this.bulletGraphics.drawCircle(b.x, b.y, b.radius);
      this.bulletGraphics.endFill();
    }
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}
