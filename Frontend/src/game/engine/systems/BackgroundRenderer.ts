import * as PIXI from 'pixi.js';

interface StarParticle {
  x: number;
  y: number;
  size: number;
  speedFactor: number;
  color: number;
  alpha: number;
}

export class BackgroundRenderer {
  public bgScrollX: number = 0;
  private container: PIXI.Container;
  private baseGraphics: PIXI.Graphics = new PIXI.Graphics();
  private bgTilingSprite: PIXI.TilingSprite | null = null;
  private overlayGraphics: PIXI.Graphics = new PIXI.Graphics();
  private stars: StarParticle[] = [];

  constructor(container: PIXI.Container) {
    this.container = container;
    this.container.addChild(this.baseGraphics);
    this.container.addChild(this.overlayGraphics);

    const palette = [0x00f2fe, 0xa855f7, 0xff2b5b, 0xffffff, 0xffd166];
    for (let i = 0; i < 48; i++) {
      const seed = (i * 9301 + 49297) % 233280;
      const r1 = seed / 233280;
      const r2 = ((i * 433 + 1777) % 1000) / 1000;
      this.stars.push({
        x: r1 * 1024,
        y: 18 + r2 * 540,
        size: i % 5 === 0 ? 2.2 : 1.3,
        speedFactor: 0.35 + (i % 4) * 0.28,
        color: palette[i % palette.length],
        alpha: 0.28 + (i % 4) * 0.14,
      });
    }

    this.render();
  }

  public setTexture(texture: PIXI.Texture, width: number = 1024, height: number = 576): void {
    if (!texture || this.bgTilingSprite) return;
    try {
      const tiling = new PIXI.TilingSprite(texture, width, height);
      tiling.tint = 0x6d5cae;
      tiling.alpha = 0.32;
      this.bgTilingSprite = tiling;
      // Insert between baseGraphics and overlayGraphics
      this.container.addChildAt(tiling, 1);
    } catch {
      // Fallback to procedural cyber-grid + starfield
    }
  }

  public update(dt: number, speed: number = 135): void {
    this.bgScrollX += speed * dt;
    if (this.bgTilingSprite) {
      this.bgTilingSprite.tilePosition.x = -this.bgScrollX * 0.55;
      this.bgTilingSprite.tilePosition.y = Math.sin(this.bgScrollX * 0.002) * 14;
    }
    this.render();
  }

  public render(width: number = 1024, height: number = 576): void {
    this.baseGraphics.clear();
    this.baseGraphics.beginFill(0x080614);
    this.baseGraphics.drawRect(0, 0, width, height);
    this.baseGraphics.endFill();

    // Atmospheric nebula bands so the arena never looks empty
    this.baseGraphics.beginFill(0x160d2e, 0.55);
    this.baseGraphics.drawRect(0, height * 0.18, width, height * 0.64);
    this.baseGraphics.endFill();

    this.baseGraphics.beginFill(0x231142, 0.35);
    this.baseGraphics.drawRect(0, height * 0.34, width, height * 0.32);
    this.baseGraphics.endFill();

    this.overlayGraphics.clear();

    // Scrolling tactical grid (vertical + horizontal lines)
    const offsetX = this.bgScrollX % 64;
    this.overlayGraphics.lineStyle(1, 0x2a1f4d, 0.45);
    for (let x = -64; x < width + 64; x += 64) {
      const px = x - offsetX;
      this.overlayGraphics.moveTo(px, 0);
      this.overlayGraphics.lineTo(px, height);
    }
    for (let y = 48; y < height; y += 64) {
      this.overlayGraphics.moveTo(0, y);
      this.overlayGraphics.lineTo(width, y);
    }

    // Subtle PoC (Point of Collection) tactical zone line on the left
    this.overlayGraphics.lineStyle(1, 0x00f2fe, 0.16);
    this.overlayGraphics.moveTo(250, 0);
    this.overlayGraphics.lineTo(250, height);
    this.overlayGraphics.lineStyle(0);

    // Parallax starfield
    for (const star of this.stars) {
      const sx = ((star.x - this.bgScrollX * star.speedFactor) % width + width) % width;
      this.overlayGraphics.beginFill(star.color, star.alpha);
      this.overlayGraphics.drawCircle(sx, star.y, star.size);
      this.overlayGraphics.endFill();
    }
  }
}
