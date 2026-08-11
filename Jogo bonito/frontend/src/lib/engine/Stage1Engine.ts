import * as PIXI from 'pixi.js';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  isPlayerBullet?: boolean;
}

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  characterColor?: string;
}

export interface Stage1Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: 'green' | 'red' | 'big';
}

export class Stage1Engine {
  public app: PIXI.Application;

  // Capas WebGL
  private bgContainer = new PIXI.Container();
  private playfieldContainer = new PIXI.Container();
  private enemyContainer = new PIXI.Container();
  private bulletGraphics = new PIXI.Graphics();
  private enemyGraphics = new PIXI.Graphics();
  private playerContainer = new PIXI.Container();
  private remotePlayersContainer = new PIXI.Container();
  private uiContainer = new PIXI.Container();

  // Sprites
  private playerSprite: PIXI.Sprite | PIXI.Graphics = new PIXI.Graphics();
  private playerHitbox = new PIXI.Graphics();
  private bossSprite!: PIXI.Sprite;
  private bgGraphics = new PIXI.Graphics();

  // Contenedor de jugadores remotos
  private remotePlayerSprites = new Map<string, PIXI.Sprite | PIXI.Graphics>();

  // Estado del juego (Bullet Hell Horizontal con Física Autoritativa de Backend)
  public stageTime: number = 0;
  public score: number = 0;
  public hiScore: number = 90039210;
  public playerLives: number = 3;
  public playerBombs: number = 3;
  public power: number = 0;
  public graze: number = 0;
  public bossHp: number = 100;
  public maxBossHp: number = 100;
  public spellcardName: string = 'Night Sign "Demon Night Walk"';
  public showBossHpBar: boolean = true;

  // Posiciones Horizontales (Mapeadas a física del backend)
  public playerPos = { x: 100, y: 300 };
  public targetPlayerPos = { x: 100, y: 300 };
  public bossPos = { x: 720, y: 300 };
  public isFocus: boolean = false;
  public characterClassId: string = 'attack';
  public isBackendConnected: boolean = false;

  // Entidades
  public bullets: Bullet[] = [];
  public playerBullets: Bullet[] = [];
  public enemies: Stage1Enemy[] = [];

  private bgScrollX = 0;
  private animTimer = 0;

  constructor(canvas: HTMLCanvasElement, width: number = 1024, height: number = 576) {
    this.app = new PIXI.Application({
      view: canvas,
      width,
      height,
      backgroundColor: 0x06040a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    });

    this.app.stage.addChild(this.bgContainer);
    this.app.stage.addChild(this.playfieldContainer);
    this.playfieldContainer.addChild(this.enemyContainer);
    this.playfieldContainer.addChild(this.bulletGraphics);
    this.enemyContainer.addChild(this.enemyGraphics);
    this.playfieldContainer.addChild(this.remotePlayersContainer);
    this.playfieldContainer.addChild(this.playerContainer);
    this.app.stage.addChild(this.uiContainer);

    this.initPlayer();
    this.initBoss();
  }

  public setCharacterClass(classId: string) {
    this.characterClassId = classId;
    const spritePath = this.getSpriteUrl(classId);

    PIXI.Texture.fromURL(spritePath).then((texture) => {
      this.playerContainer.removeChildren();

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.scale.set(0.25);
      // Sin rotación extra para mantener la orientación natural del sprite
      sprite.rotation = 0;

      this.playerSprite = sprite;
      this.playerContainer.addChild(sprite);
      this.playerContainer.addChild(this.playerHitbox);
    }).catch(() => {
      // Fallback
    });
  }

  private getSpriteUrl(classId: string): string {
    switch (classId) {
      case 'defense': return '/assets/sprites/defence.png';
      case 'healer': return '/assets/sprites/healer.png';
      case 'physical': return '/assets/sprites/physicalattack.png';
      case 'attack':
      default: return '/assets/sprites/specialattack.png';
    }
  }

  private initPlayer() {
    const defaultGraphic = new PIXI.Graphics();
    defaultGraphic.beginFill(0xff2b5b);
    defaultGraphic.drawCircle(0, 0, 16);
    defaultGraphic.endFill();
    this.playerSprite = defaultGraphic;

    this.playerHitbox.clear();
    this.playerHitbox.beginFill(0xffffff);
    this.playerHitbox.drawCircle(0, 0, 4);
    this.playerHitbox.endFill();
    this.playerHitbox.lineStyle(1.5, 0x00f2fe, 1);
    this.playerHitbox.drawCircle(0, 0, 7);
    this.playerHitbox.visible = false;

    this.playerContainer.addChild(this.playerSprite);
    this.playerContainer.addChild(this.playerHitbox);
    this.playerContainer.position.set(this.playerPos.x, this.playerPos.y);
  }

  private initBoss() {
    PIXI.Texture.fromURL('/assets/sprites/FirstBoss.png').then((tex) => {
      this.bossSprite = new PIXI.Sprite(tex);
      this.bossSprite.anchor.set(0.5);
      this.bossSprite.scale.set(0.35);
      this.bossSprite.position.set(this.bossPos.x, this.bossPos.y);
      this.enemyContainer.addChild(this.bossSprite);
    }).catch(() => {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xff2b5b);
      fallback.drawCircle(0, 0, 30);
      fallback.endFill();
      fallback.position.set(this.bossPos.x, this.bossPos.y);
      this.enemyContainer.addChild(fallback);
    });
  }

  // Actualizar posiciones desde las físicas del Backend (Planck.js)
  public applyBackendSnapshot(players: RemotePlayer[], myPlayerId: string) {
    this.isBackendConnected = true;
    const currentIds = new Set(players.map(p => p.id));

    // Limpiar desconectados
    for (const [id, sprite] of this.remotePlayerSprites.entries()) {
      if (!currentIds.has(id)) {
        this.remotePlayersContainer.removeChild(sprite);
        this.remotePlayerSprites.delete(id);
      }
    }

    for (const p of players) {
      if (p.id === myPlayerId) {
        // Sincronizar posición del propio jugador con la simulación Planck.js del servidor
        this.targetPlayerPos.x = p.x;
        this.targetPlayerPos.y = p.y;
      } else {
        // Jugadores Remotos
        let sprite = this.remotePlayerSprites.get(p.id);
        if (!sprite) {
          const g = new PIXI.Graphics();
          g.beginFill(0x00f2fe, 0.85);
          g.drawCircle(0, 0, 14);
          g.endFill();
          sprite = g;
          this.remotePlayerSprites.set(p.id, sprite);
          this.remotePlayersContainer.addChild(sprite);
        }
        sprite.position.set(p.x, p.y);
      }
    }
  }

  public update(dt: number, keys: Record<string, boolean>) {
    this.stageTime += dt;
    this.animTimer += dt;
    this.bgScrollX += 120 * dt;

    // 1. Render Fondo Horizontal Procedural
    this.renderProceduralBackground();

    // 2. Movimiento del Jugador:
    // Si estamos conectados al backend, interpolar suavemente hacia la física del servidor
    if (this.isBackendConnected) {
      this.playerPos.x += (this.targetPlayerPos.x - this.playerPos.x) * 0.3;
      this.playerPos.y += (this.targetPlayerPos.y - this.playerPos.y) * 0.3;
    } else {
      // Standalone Fallback si el backend no está activo
      let dx = 0;
      let dy = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
      if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
      if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

      const speed = this.isFocus ? 200 : 380;
      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      this.playerPos.x = Math.max(30, Math.min(990, this.playerPos.x + dx * speed * dt));
      this.playerPos.y = Math.max(30, Math.min(546, this.playerPos.y + dy * speed * dt));
    }

    this.isFocus = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
    this.playerContainer.position.set(this.playerPos.x, this.playerPos.y);
    this.playerHitbox.visible = this.isFocus;
    if (this.isFocus) this.playerHitbox.rotation += 0.08;

    // 3. Disparo Horizontal hacia la Derecha (KeyZ / Space)
    if (keys['KeyZ'] || keys['Space']) {
      if (Math.floor(this.stageTime * 60) % 5 === 0) {
        this.playerBullets.push({
          x: this.playerPos.x + 20,
          y: this.playerPos.y - 8,
          vx: 1100,
          vy: 0,
          radius: 5,
          color: 0x00f2fe,
          isPlayerBullet: true
        });
        this.playerBullets.push({
          x: this.playerPos.x + 20,
          y: this.playerPos.y + 8,
          vx: 1100,
          vy: 0,
          radius: 5,
          color: 0x00f2fe,
          isPlayerBullet: true
        });
      }
    }

    // 4. Mover Proyectiles Jugador
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const pb = this.playerBullets[i];
      pb.x += pb.vx * dt;

      if (pb.x > 1050) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Daño al Jefe
      if (Math.hypot(pb.x - this.bossPos.x, pb.y - this.bossPos.y) < 45) {
        this.bossHp = Math.max(0, this.bossHp - 0.4);
        this.score += 15;
        this.playerBullets.splice(i, 1);
      }
    }

    // 5. Patrón de Disparo Horizontal del Jefe (Hacia la Izquierda)
    if (Math.floor(this.stageTime * 60) % 25 === 0 && this.bossHp > 0) {
      const baseAngle = Math.atan2(this.playerPos.y - this.bossPos.y, this.playerPos.x - this.bossPos.x);
      for (let angleOffset of [-0.3, -0.15, 0, 0.15, 0.3]) {
        const angle = baseAngle + angleOffset;
        const bSpeed = 320;
        this.bullets.push({
          x: this.bossPos.x - 30,
          y: this.bossPos.y,
          vx: Math.cos(angle) * bSpeed,
          vy: Math.sin(angle) * bSpeed,
          radius: 6,
          color: 0xff2b5b
        });
      }
    }

    // 6. Mover Proyectiles Enemigos
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -30 || b.x > 1050 || b.y < -30 || b.y > 600) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (Math.hypot(b.x - this.playerPos.x, b.y - this.playerPos.y) < b.radius + 3) {
        this.bullets.splice(i, 1);
        this.playerLives = Math.max(0, this.playerLives - 1);
        this.graze += 1;
      }
    }

    // 7. Renderizar Dibujos de Balas
    this.bulletGraphics.clear();

    for (const pb of this.playerBullets) {
      this.bulletGraphics.beginFill(0x00f2fe);
      this.bulletGraphics.drawRect(pb.x, pb.y - 2, 22, 5);
      this.bulletGraphics.endFill();
    }

    for (const b of this.bullets) {
      this.bulletGraphics.beginFill(b.color);
      this.bulletGraphics.drawCircle(b.x, b.y, b.radius);
      this.bulletGraphics.endFill();
      this.bulletGraphics.lineStyle(1.5, 0xffffff, 0.8);
      this.bulletGraphics.drawCircle(b.x, b.y, b.radius);
      this.bulletGraphics.lineStyle(0);
    }
  }

  private renderProceduralBackground() {
    this.bgGraphics.clear();
    this.bgGraphics.beginFill(0x080612);
    this.bgGraphics.drawRect(0, 0, 1024, 576);
    this.bgGraphics.endFill();

    const offsetX = this.bgScrollX % 64;
    this.bgGraphics.lineStyle(1, 0x1f1738, 0.4);
    for (let x = -64; x < 1024 + 64; x += 64) {
      const px = x - offsetX;
      this.bgGraphics.moveTo(px, 0);
      this.bgGraphics.lineTo(px, 576);
    }
    this.bgGraphics.lineStyle(0);

    this.bgContainer.removeChildren();
    this.bgContainer.addChild(this.bgGraphics);
  }

  public destroy() {
    this.app.destroy(true, { children: true, texture: false });
  }
}
