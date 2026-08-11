import * as PIXI from 'pixi.js';

export interface LoadedStage1Sprites {
  rumiaIdle: PIXI.Texture[];
  rumiaSpell: PIXI.Texture;
  fairyGreen: PIXI.Texture;
  fairyRed: PIXI.Texture;
  fairyBig: PIXI.Texture;
  bulletRed: PIXI.Texture;
  bulletBlue: PIXI.Texture;
  bulletPurple: PIXI.Texture;
  bgTexture: PIXI.Texture;
  faceRumia: PIXI.Texture;
  isReady: boolean;
}

/**
 * Combina la imagen RGB con su máscara de transparencia Alpha (_a.png)
 * y remueve cualquier colorkey blanco/negro de fondo.
 */
async function loadAndMaskImage(colorUrl: string, alphaUrl?: string): Promise<PIXI.BaseTexture> {
  return new Promise((resolve) => {
    const imgColor = new Image();
    imgColor.crossOrigin = 'Anonymous';
    imgColor.src = colorUrl;

    imgColor.onload = () => {
      const canvas = document.createElement('canvas');
      const w = imgColor.width;
      const h = imgColor.height;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(PIXI.BaseTexture.from(imgColor));
        return;
      }

      ctx.drawImage(imgColor, 0, 0);
      const colorData = ctx.getImageData(0, 0, w, h);

      if (alphaUrl) {
        const imgAlpha = new Image();
        imgAlpha.crossOrigin = 'Anonymous';
        imgAlpha.src = alphaUrl;

        imgAlpha.onload = () => {
          const alphaCanvas = document.createElement('canvas');
          alphaCanvas.width = w;
          alphaCanvas.height = h;
          const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
          if (alphaCtx) {
            alphaCtx.drawImage(imgAlpha, 0, 0);
            const alphaData = alphaCtx.getImageData(0, 0, w, h);

            for (let i = 0; i < colorData.data.length; i += 4) {
              const r = colorData.data[i];
              const g = colorData.data[i + 1];
              const b = colorData.data[i + 2];
              const maskAlpha = alphaData.data[i];

              // Si es fondo blanco o la máscara indica transparencia
              if ((r > 240 && g > 240 && b > 240) || maskAlpha < 20) {
                colorData.data[i + 3] = 0;
              } else {
                colorData.data[i + 3] = maskAlpha;
              }
            }
            ctx.putImageData(colorData, 0, 0);
          }
          resolve(PIXI.BaseTexture.from(canvas));
        };
        imgAlpha.onerror = () => {
          applyColorKey(ctx, colorData, w, h);
          resolve(PIXI.BaseTexture.from(canvas));
        };
      } else {
        applyColorKey(ctx, colorData, w, h);
        resolve(PIXI.BaseTexture.from(canvas));
      }
    };

    imgColor.onerror = () => {
      // Fallback si la imagen no existe
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = 64;
      fallbackCanvas.height = 64;
      resolve(PIXI.BaseTexture.from(fallbackCanvas));
    };
  });
}

function applyColorKey(ctx: CanvasRenderingContext2D, colorData: ImageData, w: number, h: number) {
  for (let i = 0; i < colorData.data.length; i += 4) {
    const r = colorData.data[i];
    const g = colorData.data[i + 1];
    const b = colorData.data[i + 2];
    if (r > 240 && g > 240 && b > 240) {
      colorData.data[i + 3] = 0;
    }
  }
  ctx.putImageData(colorData, 0, 0);
}

export async function loadStage1Sprites(): Promise<LoadedStage1Sprites> {
  const rumiaBase = await loadAndMaskImage('/assets/stage1/stg1enm.png', '/assets/stage1/stg1enm_a.png');
  const fairyBase = await loadAndMaskImage('/assets/stage1/stg1enm2.png', '/assets/stage1/stg1enm2_a.png');
  const bgBase = await loadAndMaskImage('/assets/stage1/stg1bg.png', '/assets/stage1/stg1bg_a.png');
  const effBase = await loadAndMaskImage('/assets/stage1/eff01.png');
  const faceBase = await loadAndMaskImage('/assets/stage1/face03a.png', '/assets/stage1/face03a_a.png');

  // Recortar fotogramas individuales de 32x48 para Rumia
  const rumiaIdle = [
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(0, 0, 32, 48)),
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(32, 0, 32, 48)),
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(64, 0, 32, 48))
  ];
  const rumiaSpell = new PIXI.Texture(rumiaBase, new PIXI.Rectangle(0, 96, 32, 48));

  // Recortar Hadas
  const fairyGreen = new PIXI.Texture(fairyBase, new PIXI.Rectangle(0, 0, 32, 32));
  const fairyRed = new PIXI.Texture(fairyBase, new PIXI.Rectangle(0, 32, 32, 32));
  const fairyBig = new PIXI.Texture(fairyBase, new PIXI.Rectangle(128, 0, 64, 64));

  // Recortar Proyectiles
  const bulletRed = new PIXI.Texture(effBase, new PIXI.Rectangle(0, 0, 16, 16));
  const bulletBlue = new PIXI.Texture(effBase, new PIXI.Rectangle(16, 0, 16, 16));
  const bulletPurple = new PIXI.Texture(effBase, new PIXI.Rectangle(32, 0, 16, 16));

  const bgTexture = new PIXI.Texture(bgBase);
  const faceRumia = new PIXI.Texture(faceBase);

  return {
    rumiaIdle,
    rumiaSpell,
    fairyGreen,
    fairyRed,
    fairyBig,
    bulletRed,
    bulletBlue,
    bulletPurple,
    bgTexture,
    faceRumia,
    isReady: true
  };
}
