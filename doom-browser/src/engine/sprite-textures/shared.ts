import { Texture } from '../textures';

export const SPRITE_TEXTURE_SIZE = 64;

export type EnemyPose = 'idle' | 'walk' | 'attack';
export type EnemyView = 'front' | 'frontQuarter' | 'side' | 'backQuarter' | 'back';

export function mirrorTextureHorizontal(srcCanvas: HTMLCanvasElement): Texture {
  const dst = document.createElement('canvas');
  dst.width = SPRITE_TEXTURE_SIZE;
  dst.height = SPRITE_TEXTURE_SIZE;
  const dctx = dst.getContext('2d')!;
  dctx.translate(SPRITE_TEXTURE_SIZE, 0);
  dctx.scale(-1, 1);
  dctx.drawImage(srcCanvas, 0, 0);
  return {
    canvas: dst,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: dctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

export function applySpriteRimLight(ctx: CanvasRenderingContext2D, view: EnemyView): void {
  // Rim light comes from upper-left consistently in world space.
  // When viewed from different angles, rim direction stays the same.
  // For simplicity we keep the same gradient — per-column volume shading
  // in the renderer handles the directional cue.
  if (view === 'side') {
    // Profile: lit from top-front
    const gradient = ctx.createLinearGradient(0, 0, SPRITE_TEXTURE_SIZE, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,0.32)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,190,130,0.13)');
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
    ctx.restore();
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, SPRITE_TEXTURE_SIZE, 0);
  gradient.addColorStop(0, 'rgba(255,190,130,0.13)');
  gradient.addColorStop(0.38, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.66, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.38)');

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Rotating items (8 frames, vertical-axis rotation)                   */
/* ------------------------------------------------------------------ */

export function buildRotatingItemFrames(
  frontFn: () => Texture,
  backFn: () => Texture
): Texture[] {
  const front = frontFn();
  const back = backFn();
  const frames: Texture[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const widthScale = Math.max(0.08, Math.abs(cosA));
    const useBack = cosA < 0;
    frames.push(scaleTextureHorizontal(useBack ? back.canvas : front.canvas, widthScale));
  }
  return frames;
}

function scaleTextureHorizontal(srcCanvas: HTMLCanvasElement, widthScale: number): Texture {
  const dst = document.createElement('canvas');
  dst.width = SPRITE_TEXTURE_SIZE;
  dst.height = SPRITE_TEXTURE_SIZE;
  const dctx = dst.getContext('2d')!;
  dctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const drawW = Math.max(2, SPRITE_TEXTURE_SIZE * widthScale);
  const drawX = (SPRITE_TEXTURE_SIZE - drawW) / 2;
  dctx.drawImage(srcCanvas, drawX, 0, drawW, SPRITE_TEXTURE_SIZE);
  return {
    canvas: dst,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: dctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

export function texFromCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Texture {
  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

