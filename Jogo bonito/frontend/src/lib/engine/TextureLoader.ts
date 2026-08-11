import * as PIXI from 'pixi.js';

/**
 * Carga una imagen RGB (ej. stg1enm.png) y su máscara Alpha (ej. stg1enm_a.png),
 * combinándolas en un HTMLCanvasElement con transparencia real de 32-bit.
 */
export async function createTransparentTexture(
  colorUrl: string,
  alphaUrl?: string
): Promise<PIXI.BaseTexture> {
  return new Promise((resolve) => {
    const imgColor = new Image();
    imgColor.crossOrigin = 'Anonymous';
    imgColor.src = colorUrl;

    imgColor.onload = () => {
      if (!alphaUrl) {
        resolve(PIXI.BaseTexture.from(imgColor));
        return;
      }

      const imgAlpha = new Image();
      imgAlpha.crossOrigin = 'Anonymous';
      imgAlpha.src = alphaUrl;

      imgAlpha.onload = () => {
        const canvas = document.createElement('canvas');
        const w = imgColor.width;
        const h = imgColor.height;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(PIXI.BaseTexture.from(imgColor));
          return;
        }

        // Dibujar color RGB
        ctx.drawImage(imgColor, 0, 0);
        const colorData = ctx.getImageData(0, 0, w, h);

        // Dibujar máscara Alpha
        const canvasAlpha = document.createElement('canvas');
        canvasAlpha.width = w;
        canvasAlpha.height = h;
        const ctxAlpha = canvasAlpha.getContext('2d');
        if (ctxAlpha) {
          ctxAlpha.drawImage(imgAlpha, 0, 0);
          const alphaData = ctxAlpha.getImageData(0, 0, w, h);

          // Combinar el canal RGB con el canal Alpha (stg1enm_a.png)
          for (let i = 0; i < colorData.data.length; i += 4) {
            // Si el pixel es blanco en la imagen de color o transparente en la máscara
            const r = colorData.data[i];
            const g = colorData.data[i + 1];
            const b = colorData.data[i + 2];
            const aVal = alphaData.data[i]; // Intensidad de la máscara alpha

            // Si es fondo blanco o alpha negro -> hacer transparente
            if ((r > 240 && g > 240 && b > 240) || aVal < 20) {
              colorData.data[i + 3] = 0;
            } else {
              colorData.data[i + 3] = aVal;
            }
          }

          ctx.putImageData(colorData, 0, 0);
        }

        resolve(PIXI.BaseTexture.from(canvas));
      };

      imgAlpha.onerror = () => {
        resolve(PIXI.BaseTexture.from(imgColor));
      };
    };

    imgColor.onerror = () => {
      resolve(PIXI.BaseTexture.from(colorUrl));
    };
  });
}

/**
 * Recorta un frame específico de la hoja de sprites (Spritesheet)
 */
export function getSpriteFrame(
  baseTexture: PIXI.BaseTexture,
  x: number,
  y: number,
  width: number,
  height: number
): PIXI.Texture {
  return new PIXI.Texture(baseTexture, new PIXI.Rectangle(x, y, width, height));
}
