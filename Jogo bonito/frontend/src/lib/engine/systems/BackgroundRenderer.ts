import * as PIXI from 'pixi.js';

export class BackgroundRenderer {
  public bgScrollX: number = 0;
  private bgGraphics: PIXI.Graphics = new PIXI.Graphics();

  constructor(container: PIXI.Container) {
    container.addChild(this.bgGraphics);
  }

  public update(dt: number, speed: number = 120): void {
    this.bgScrollX += speed * dt;
    this.render();
  }

  public render(width: number = 1024, height: number = 576): void {
    this.bgGraphics.clear();
    this.bgGraphics.beginFill(0x080612);
    this.bgGraphics.drawRect(0, 0, width, height);
    this.bgGraphics.endFill();

    const offsetX = this.bgScrollX % 64;
    this.bgGraphics.lineStyle(1, 0x1f1738, 0.4);
    for (let x = -64; x < width + 64; x += 64) {
      const px = x - offsetX;
      this.bgGraphics.moveTo(px, 0);
      this.bgGraphics.lineTo(px, height);
    }
    this.bgGraphics.lineStyle(0);
  }
}
