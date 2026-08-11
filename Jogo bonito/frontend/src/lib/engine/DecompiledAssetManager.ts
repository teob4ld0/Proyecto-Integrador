import * as PIXI from 'pixi.js';

export interface TouhouStage1Assets {
  rumiaIdle: PIXI.Texture[];
  rumiaSpell: PIXI.Texture;
  fairyGreen: PIXI.Texture;
  fairyRed: PIXI.Texture;
  fairyBig: PIXI.Texture;
  bgFloorTile: PIXI.Texture;
  bgWallLeft: PIXI.Texture;
  bgWallRight: PIXI.Texture;
  faceRumia: PIXI.Texture;
}

/**
 * Procesa imágenes RGB + Alpha Mask de Touhou 6 eliminando fondos blancos o transparentes.
 */
function safeLoadTexture(colorUrl: string, alphaUrl?: string): Promise<PIXI.BaseTexture> {
  return new Promise((resolve) => {
    const imgColor = new Image();
    imgColor.crossOrigin = 'anonymous';
    imgColor.src = colorUrl;

    imgColor.onload = () => {
      try {
        const w = imgColor.width || 256;
        const h = imgColor.height || 256;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(PIXI.BaseTexture.from(imgColor));
          return;
        }

        ctx.drawImage(imgColor, 0, 0);

        if (alphaUrl) {
          const imgAlpha = new Image();
          imgAlpha.crossOrigin = 'anonymous';
          imgAlpha.src = alphaUrl;

          imgAlpha.onload = () => {
            try {
              const alphaCanvas = document.createElement('canvas');
              alphaCanvas.width = w;
              alphaCanvas.height = h;
              const alphaCtx = alphaCanvas.getContext('2d');

              if (alphaCtx) {
                alphaCtx.drawImage(imgAlpha, 0, 0);
                const colorData = ctx.getImageData(0, 0, w, h);
                const alphaData = alphaCtx.getImageData(0, 0, w, h);

                for (let i = 0; i < colorData.data.length; i += 4) {
                  const r = colorData.data[i];
                  const g = colorData.data[i + 1];
                  const b = colorData.data[i + 2];
                  const aVal = alphaData.data[i];

                  // Si el pixel es el fondo blanco del atlas o transparente en la máscara alpha
                  if ((r > 230 && g > 230 && b > 230) || aVal < 15) {
                    colorData.data[i + 3] = 0;
                  } else {
                    colorData.data[i + 3] = aVal;
                  }
                }
                ctx.putImageData(colorData, 0, 0);
              }
              resolve(PIXI.BaseTexture.from(canvas));
            } catch {
              resolve(PIXI.BaseTexture.from(imgColor));
            }
          };

          imgAlpha.onerror = () => resolve(PIXI.BaseTexture.from(imgColor));
        } else {
          try {
            const colorData = ctx.getImageData(0, 0, w, h);
            for (let i = 0; i < colorData.data.length; i += 4) {
              const r = colorData.data[i];
              const g = colorData.data[i + 1];
              const b = colorData.data[i + 2];
              if (r > 230 && g > 230 && b > 230) {
                colorData.data[i + 3] = 0;
              }
            }
            ctx.putImageData(colorData, 0, 0);
            resolve(PIXI.BaseTexture.from(canvas));
          } catch {
            resolve(PIXI.BaseTexture.from(imgColor));
          }
        }
      } catch {
        resolve(PIXI.BaseTexture.from(imgColor));
      }
    };

    imgColor.onerror = () => {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = 64;
      fallbackCanvas.height = 64;
      resolve(PIXI.BaseTexture.from(fallbackCanvas));
    };
  });
}

export async function loadDecompiledStage1Assets(): Promise<TouhouStage1Assets> {
  const [rumiaBase, fairyBase, bgBase, faceBase] = await Promise.all([
    safeLoadTexture('/assets/stage1/stg1enm.png', '/assets/stage1/stg1enm_a.png'),
    safeLoadTexture('/assets/stage1/stg1enm2.png', '/assets/stage1/stg1enm2_a.png'),
    safeLoadTexture('/assets/stage1/stg1bg.png', '/assets/stage1/stg1bg_a.png'),
    safeLoadTexture('/assets/stage1/face03a.png', '/assets/stage1/face03a_a.png')
  ]);

  // Recorte exacto de fotogramas de Rumia (32x48px)
  const rumiaIdle = [
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(0, 0, 32, 48)),
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(32, 0, 32, 48)),
    new PIXI.Texture(rumiaBase, new PIXI.Rectangle(64, 0, 32, 48))
  ];
  const rumiaSpell = new PIXI.Texture(rumiaBase, new PIXI.Rectangle(0, 96, 32, 48));

  // Recorte exacto de fotogramas de Hadas (32x32px y 64x64px)
  const fairyGreen = new PIXI.Texture(fairyBase, new PIXI.Rectangle(0, 0, 32, 32));
  const fairyRed = new PIXI.Texture(fairyBase, new PIXI.Rectangle(0, 32, 32, 32));
  const fairyBig = new PIXI.Texture(fairyBase, new PIXI.Rectangle(128, 0, 64, 64));

  // Recorte del mosaico del camino del bosque de stg1bg.png (128x128px) sin bordes blancos ni bloques sueltos
  const bgFloorTile = new PIXI.Texture(bgBase, new PIXI.Rectangle(0, 0, 128, 128));

  // Paredes del bosque lateral (64x128px)
  const bgWallLeft = new PIXI.Texture(bgBase, new PIXI.Rectangle(128, 0, 64, 128));
  const bgWallRight = new PIXI.Texture(bgBase, new PIXI.Rectangle(192, 0, 64, 128));

  const faceRumia = new PIXI.Texture(faceBase);

  return {
    rumiaIdle,
    rumiaSpell,
    fairyGreen,
    fairyRed,
    fairyBig,
    bgFloorTile,
    bgWallLeft,
    bgWallRight,
    faceRumia
  };
}
