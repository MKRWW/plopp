import { Player } from '../player/player';
import { ZBuffer } from './zbuffer';
import { Texture } from './textures';
import { Sprite, SpriteType, LatcherState } from './sprite';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const CORPSE_SCALE = 0.18;

export interface SpriteRendererContext {
  ctx: CanvasRenderingContext2D;
  player: Player;
  sprites: Sprite[];
  zBuffer: ZBuffer;
}

/**
 * Renders all sprites (enemies, pickups, corpses) with billboarding,
 * z-buffer testing, hit-flash coloring, death animation, and shadow casting.
 * Sorts sprites by distance first (Painter's algorithm).
 */
export function renderSprites(ctx: SpriteRendererContext): void {
  sortSpritesByDistance(ctx.player, ctx.sprites);

  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;
  const planeX = ctx.player.planeX;
  const planeY = ctx.player.planeY;
  const px = ctx.player.x;
  const py = ctx.player.y;

  const invDet = 1.0 / (planeX * dirY - dirX * planeY);

  for (const sprite of ctx.sprites) {
    let floatingOffset = sprite.getFloatingOffset();
    if ((sprite.isEnemy) && sprite.isAlive) {
      floatingOffset += Math.sin(sprite.floatingPhase) * 0.02;
    }

    let deathProgress = 0;
    if (sprite.isDying) {
      deathProgress = 1.0 - (sprite.deathTimer / sprite.deathDuration);
      floatingOffset -= deathProgress * 0.3;
    }

    const spriteX = sprite.x - px;
    const spriteY = sprite.y + floatingOffset - py;

    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.1) continue;

    const spriteScreenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

    let spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY));
    if (sprite.isDying) {
      spriteHeight = Math.floor(spriteHeight * (1.0 - deathProgress * 0.5));
    }
    const spriteWidth = spriteHeight;

    let verticalScreenOffset = 0;
    if (sprite.type === SpriteType.LATCHER && sprite.latcherState === LatcherState.LEAP) {
      const arcHeight = Math.sin(sprite.leapProgress * Math.PI) * 0.6;
      verticalScreenOffset = -arcHeight * (SCREEN_HEIGHT / transformY);
    }

    let drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2 + verticalScreenOffset;
    if (drawStartY < 0) drawStartY = 0;
    let drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2 + verticalScreenOffset;
    if (drawEndY >= SCREEN_HEIGHT) drawEndY = SCREEN_HEIGHT - 1;

    let drawStartX = -spriteWidth / 2 + spriteScreenX;
    if (drawStartX < 0) drawStartX = 0;
    let drawEndX = spriteWidth / 2 + spriteScreenX;
    if (drawEndX >= SCREEN_WIDTH) drawEndX = SCREEN_WIDTH - 1;

    const baseBrightness = Math.min(1.0, 2.0 / (1.0 + transformY * 0.3));

    let texture: Texture | null = sprite.texture;
    if (
      (sprite.isEnemy) &&
      sprite.angleViews.length > 0 &&
      !sprite.isDying &&
      !sprite.isDead
    ) {
      const angleToCamera = Math.atan2(py - sprite.y, px - sprite.x);
      const rel = angleToCamera - sprite.facingAngle;
      const norm = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const angleIdx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8;
      const poseIdx = Math.min(sprite.currentFrame, sprite.angleViews.length - 1);
      const views = sprite.angleViews[poseIdx];
      if (views && views[angleIdx]) {
        texture = views[angleIdx];
      }
    }

    // Corpse rendering: flat, small, anchored to floor
    if ((sprite.isEnemy) && sprite.isDead && sprite.corpseTexture) {
      texture = sprite.corpseTexture;
      const fullSpriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY));
      spriteHeight = fullSpriteHeight * CORPSE_SCALE;
      const spriteWidthCorpse = spriteHeight;
      const corpseDrawEndY = SCREEN_HEIGHT / 2 + Math.floor(fullSpriteHeight / 2);
      const corpseDrawStartY = Math.max(0, Math.floor(corpseDrawEndY - spriteHeight));
      const corpseDrawStartX = Math.floor(spriteScreenX - spriteWidthCorpse / 2);
      const corpseDrawEndX = Math.floor(spriteScreenX + spriteWidthCorpse / 2);

      const baseCorpseBrightness = Math.min(1.0, 2.0 / (1.0 + transformY * 0.3));
      const stripeWidth = corpseDrawEndX - corpseDrawStartX;
      const corpseCenterX = (corpseDrawStartX + corpseDrawEndX) / 2;
      const corpseHalfWidth = Math.max(1, (corpseDrawEndX - corpseDrawStartX) / 2);

      for (let stripe = Math.max(0, corpseDrawStartX); stripe < Math.min(SCREEN_WIDTH, corpseDrawEndX); stripe++) {
        if (transformY < ctx.zBuffer.get(stripe)) {
          const texX = Math.floor(((stripe - corpseDrawStartX) * texture.width) / Math.max(1, stripeWidth));
          const edgeDist = Math.abs(stripe - corpseCenterX) / corpseHalfWidth;
          const volumeShade = 1.0 - 0.35 * edgeDist * edgeDist;
          const brightness = baseCorpseBrightness * volumeShade;

          for (let y = corpseDrawStartY; y < Math.min(SCREEN_HEIGHT - 1, corpseDrawEndY); y++) {
            const texY = Math.floor(((y - corpseDrawStartY) * texture.height) / Math.max(1, corpseDrawEndY - corpseDrawStartY));
            const srcIdx = (texY * texture.width + texX) * 4;
            const srcData = texture.data.data;
            const alpha = srcData[srcIdx + 3];
            if (alpha > 0) {
              const r = Math.min(255, Math.floor(srcData[srcIdx] * brightness));
              const g = Math.min(255, Math.floor(srcData[srcIdx + 1] * brightness));
              const b = Math.min(255, Math.floor(srcData[srcIdx + 2] * brightness));
              ctx.ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
              ctx.ctx.fillRect(stripe, y, 1, 1);
            }
          }
        }
      }
      continue;
    }

    // Shadow
    if (!sprite.isDying || deathProgress < 0.5) {
      const shadowCenterY = SCREEN_HEIGHT / 2 + spriteHeight / 2;
      const shadowRX = Math.max(2, spriteWidth * 0.32);
      const shadowRY = Math.max(1, spriteHeight * 0.06);
      const shadowAlpha = 0.5 * baseBrightness;
      ctx.ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      const sxStart = Math.floor(spriteScreenX - shadowRX);
      const sxEnd = Math.ceil(spriteScreenX + shadowRX);
      for (let sx = sxStart; sx <= sxEnd; sx++) {
        if (sx < 0 || sx >= SCREEN_WIDTH) continue;
        if (transformY >= ctx.zBuffer.get(sx)) continue;
        const dxNorm = (sx - spriteScreenX) / shadowRX;
        if (dxNorm < -1 || dxNorm > 1) continue;
        const halfH = shadowRY * Math.sqrt(Math.max(0, 1 - dxNorm * dxNorm));
        const y0 = Math.floor(shadowCenterY - halfH);
        const y1 = Math.floor(shadowCenterY + halfH);
        const yClamped0 = Math.max(0, y0);
        const yClamped1 = Math.min(SCREEN_HEIGHT - 1, y1);
        if (yClamped1 >= yClamped0) {
          ctx.ctx.fillRect(sx, yClamped0, 1, yClamped1 - yClamped0 + 1);
        }
      }
    }

    // Main sprite rendering (z-buffer test per column)
    const spriteCenterX = (drawStartX + drawEndX) / 2;
    const halfSpriteWidth = Math.max(1, (drawEndX - drawStartX) / 2);
    const stripeWidth = drawEndX - drawStartX;

    for (let stripe = Math.floor(drawStartX); stripe < drawEndX; stripe++) {
      if (transformY < ctx.zBuffer.get(stripe)) {
        const texX = Math.floor(((stripe - drawStartX) * texture!.width) / stripeWidth);
        const edgeDist = Math.abs(stripe - spriteCenterX) / halfSpriteWidth;
        const volumeShade = 1.0 - 0.35 * edgeDist * edgeDist;
        const brightness = baseBrightness * volumeShade;

        for (let y = Math.floor(drawStartY); y < drawEndY; y++) {
          const texY = Math.floor(((y - drawStartY) * texture!.height) / (drawEndY - drawStartY));
          const srcIdx = (texY * texture!.width + texX) * 4;
          const srcData = texture!.data.data;
          const alpha = srcData[srcIdx + 3];
          if (alpha > 0) {
            let r = srcData[srcIdx] * brightness;
            let g = srcData[srcIdx + 1] * brightness;
            let b = srcData[srcIdx + 2] * brightness;

            if (sprite.hitFlashTimer > 0) {
              if (sprite.type === SpriteType.SHOOTER) {
                r = Math.min(255, r + 120);
                g = Math.min(255, g + 200);
                b = Math.min(255, b + 60);
              } else if (sprite.type === SpriteType.ENEMY) {
                r = Math.min(255, r + 50);
                g = Math.min(255, g + 180);
                b = Math.min(255, b + 220);
              } else if (sprite.type === SpriteType.BOSS) {
                r = Math.min(255, r + 200);
                g = Math.min(255, g + 120);
                b = Math.min(255, b + 30);
              } else {
                r = Math.min(255, r + 180);
                g = Math.min(255, g + 120);
                b = Math.min(255, b + 80);
              }
            }

            if (sprite.isDying) {
              const fade = 1.0 - deathProgress * 0.6;
              r = r * fade + 80 * deathProgress;
              g = g * fade * 0.4;
              b = b * fade * 0.3;
            }

            ctx.ctx.fillStyle = `rgba(${Math.min(255, Math.floor(r))},${Math.min(255, Math.floor(g))},${Math.min(255, Math.floor(b))},${alpha / 255})`;
            ctx.ctx.fillRect(stripe, y, 1, 1);
          }
        }
      }
    }
  }
}

/**
 * Sorts sprites by distance to the player (farthest first = Painter's algorithm).
 */
function sortSpritesByDistance(player: Player, sprites: Sprite[]): void {
  const px = player.x;
  const py = player.y;
  sprites.sort((a, b) => {
    const distA = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
    const distB = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
    return distB - distA;
  });
}
