/**
 * Raycaster module.
 * Extracted from renderer.ts to keep it manageable.
 * Uses free functions + explicit context object (no new classes).
 */
import { Player } from '../player/player';
import { TextureManager, Texture } from './textures';
import { ZBuffer } from './zbuffer';
import { worldState, MAP_WIDTH, MAP_HEIGHT } from './world';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

/** Context object for raycasting */
export interface RaycasterContext {
  ctx: CanvasRenderingContext2D;
  player: Player;
  textureManager: TextureManager;
  zBuffer: ZBuffer;
}

/**
 * Raycasting kernel: casts one ray per screen column.
 * Uses the DDA algorithm for efficient grid tracing.
 * Considers door animations visually.
 */
export function castRays(ctx: RaycasterContext): void {
  ctx.zBuffer.clear();

  for (let x = 0; x < SCREEN_WIDTH; x++) {
    // Camera X position (-1 left, 0 center, 1 right)
    const cameraX = 2 * (x / SCREEN_WIDTH) - 1;

    // Ray direction
    const rayDirX = ctx.player.dirX + ctx.player.planeX * cameraX;
    const rayDirY = ctx.player.dirY + ctx.player.planeY * cameraX;

    // Current grid cell
    let mapX = Math.floor(ctx.player.x);
    let mapY = Math.floor(ctx.player.y);

    // Length of the ray from one side-step to the next
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    let sideDistX: number;
    let sideDistY: number;
    let stepX: number;
    let stepY: number;
    let side = 0; // 0 = NS, 1 = EW

    // Calculate steps and initial sideDist
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (ctx.player.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - ctx.player.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (ctx.player.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - ctx.player.y) * deltaDistY;
    }

    // DDA search until wall found
    let hit = 0;
    let doorProgress = 0; // Door progress for animation
    while (hit === 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      // Boundary check (uses dynamic WorldState for doors)
      if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        hit = 1; // Outside the map = wall
      } else if (worldState.isSolidTile(mapX, mapY)) {
        hit = worldState.getTile(mapX, mapY);
        // Store door progress for visual animation
        const door = worldState.getDoor(mapX, mapY);
        if (door && door.state === 'opening') {
          doorProgress = door.progress;
        }
      }
    }

    // Perpendicular distance calculation (avoids fisheye)
    let perpWallDist: number;
    if (side === 0) {
      perpWallDist = (sideDistX - deltaDistX);
    } else {
      perpWallDist = (sideDistY - deltaDistY);
    }

    // Store in Z-buffer
    ctx.zBuffer.set(x, perpWallDist);

    // Calculate wall height
    const lineHeight = Math.floor(SCREEN_HEIGHT / perpWallDist);

    // Start/end of wall drawing
    let drawStart = Math.floor(-lineHeight / 2 + SCREEN_HEIGHT / 2);
    if (drawStart < 0) drawStart = 0;
    let drawEnd = Math.floor(lineHeight / 2 + SCREEN_HEIGHT / 2);
    if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;

    // --- Texture Coordinate Calculation ---
    // Where did the ray hit the wall? (0.0 - 1.0 within the tile)
    let wallX: number;
    if (side === 0) {
      wallX = ctx.player.y + perpWallDist * rayDirY;
    } else {
      wallX = ctx.player.x + perpWallDist * rayDirX;
    }
    wallX -= Math.floor(wallX); // Normalize to 0.0-1.0

    // U-coordinate (0 = left of texture, 1 = right).
    // Flip convention chosen so that natural texture orientation
    // (texts/asymmetries like the "EXIT" sign) is displayed correctly.
    let u = wallX;
    if ((side === 0 && rayDirX < 0) || (side === 1 && rayDirY > 0)) {
      u = 1.0 - u;
    }

    // Get texture
    const texture = ctx.textureManager.getTexture(hit);

    // Calculate brightness (distance fog + side shading + door animation)
    const sideShade = side === 1 ? 0.7 : 1.0;
    let brightness = Math.min(1.0, 2.0 / (1.0 + perpWallDist * 0.3)) * sideShade;

    // Door animation: during "opening" the door opens from bottom to top
    // - Upper half remains visible (door "drops" down)
    // - Brightness increases with progress (door becomes brighter/more transparent)
    if (doorProgress > 0 && doorProgress < 1) {
      const doorShade = 1.0 - doorProgress * 0.6; // up to 60% brighter
      brightness *= doorShade;
    }

    // Draw texture column
    if (texture) {
      drawTexturedColumn(ctx, x, drawStart, drawEnd, lineHeight, texture, u, brightness, doorProgress);
    } else {
      // Fallback: single-color wall (shouldn't happen)
      const baseColor = hit === 1 ? [180, 50, 50] : (hit === 2 ? [50, 180, 50] : [200, 50, 50]);
      let r = Math.floor(baseColor[0] * brightness);
      let g = Math.floor(baseColor[1] * brightness);
      let b = Math.floor(baseColor[2] * brightness);
      // Door animation in fallback
      if (doorProgress > 0 && doorProgress < 1) {
        const doorShade = 1.0 - doorProgress * 0.6;
        r = Math.floor(r * doorShade);
        g = Math.floor(g * doorShade);
        b = Math.floor(b * doorShade);
      }
      ctx.ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
    }
  }
}

/**
 * Draws a single texture column on the canvas.
 *
 * @param ctx Raycaster context
 * @param screenX Screen column
 * @param drawStart Top edge of the wall
 * @param drawEnd Bottom edge of the wall
 * @param wallLineHeight Original projected wall height before screen clipping
 * @param texture The texture
 * @param u Texture coordinate (0.0 - 1.0)
 * @param brightness Brightness factor
 * @param doorProgress Door opening progress 0..1 (for visible animation)
 */
export function drawTexturedColumn(
  ctx: RaycasterContext,
  screenX: number,
  drawStart: number,
  drawEnd: number,
  wallLineHeight: number,
  texture: Texture,
  u: number,
  brightness: number,
  doorProgress: number = 0
): void {
  const texWidth = texture.width;
  const texHeight = texture.height;
  const texData = texture.data.data;

  // Texture X position (pixel index)
  const texX = Math.floor(u * texWidth) & (texWidth - 1); // Bitmask for power-of-2

  const visibleHeight = drawEnd - drawStart;
  if (visibleHeight <= 0) return;

  // Create ImageData for this column
  const columnData = new ImageData(1, visibleHeight);
  const colPixels = columnData.data;
  const texStep = texHeight / wallLineHeight;
  let texPos = (drawStart - SCREEN_HEIGHT / 2 + wallLineHeight / 2) * texStep;

  // Door animation: Calculate the visible area
  // At progress > 0, the door is "opened" from bottom to top
  // - Upper areas remain visible
  // - Lower areas are freed (floor visible)
  let doorClipY = 0; // From which y-value (relative to drawStart) the door is still visible
  if (doorProgress > 0 && doorProgress < 1) {
    // Door opens from bottom to top
    // At progress=0.5 the lower half is gone, at progress=1 everything is gone
    doorClipY = Math.floor(visibleHeight * (1.0 - doorProgress));
  }

  for (let y = 0; y < visibleHeight; y++) {
    // Vertical texture coordinate
    const texY = Math.floor(texPos) & (texHeight - 1);
    texPos += texStep;

    // Destination index in the column
    const dstIdx = y * 4;

    // Door clip: If y >= doorClipY, then this area is already "opened"
    if (doorProgress > 0 && doorProgress < 1 && y >= doorClipY) {
      // Scanline illusion: alternating darkened/brighter stripes
      // simulate the floor becoming visible without transparency
      const isScanline = (y % 4) < 2;
      const scanlineDarken = isScanline ? 0.35 : 0.65;
      // Read source pixel from texture
      const srcIdx = (texY * texWidth + texX) * 4;
      colPixels[dstIdx]     = texData[srcIdx] * brightness * scanlineDarken;
      colPixels[dstIdx + 1] = texData[srcIdx + 1] * brightness * scanlineDarken;
      colPixels[dstIdx + 2] = texData[srcIdx + 2] * brightness * scanlineDarken;
      colPixels[dstIdx + 3] = 255; // Always opaque
      continue;
    }

    // Read source pixel from texture
    const srcIdx = (texY * texWidth + texX) * 4;

    // Multiply color with brightness
    colPixels[dstIdx] = texData[srcIdx] * brightness;
    colPixels[dstIdx + 1] = texData[srcIdx + 1] * brightness;
    colPixels[dstIdx + 2] = texData[srcIdx + 2] * brightness;
    colPixels[dstIdx + 3] = 255; // Fully opaque
  }

  // Draw column to canvas
  ctx.ctx.putImageData(columnData, screenX, drawStart);
}

/**
 * Render floor and ceiling.
 */
export function drawFloorAndCeiling(ctx: RaycasterContext): void {
  const floorTexture = ctx.textureManager.getFloorTexture();
  const ceilingTexture = ctx.textureManager.getCeilingTexture();

  if (!floorTexture || !ceilingTexture) {
    // Fallback if TextureManager is not ready yet.
    ctx.ctx.fillStyle = '#333';
    ctx.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
    ctx.ctx.fillStyle = '#555';
    ctx.ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
    return;
  }

  const frame = ctx.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  const pixels = frame.data;

  // Base colors also cover the horizon line, where floor-casting would be infinite.
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const isCeiling = y < SCREEN_HEIGHT / 2;
    const r = isCeiling ? 42 : 58;
    const g = isCeiling ? 28 : 58;
    const b = isCeiling ? 18 : 58;
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const idx = (y * SCREEN_WIDTH + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;
  const planeX = ctx.player.planeX;
  const planeY = ctx.player.planeY;

  const rayDirX0 = dirX - planeX;
  const rayDirY0 = dirY - planeY;
  const rayDirX1 = dirX + planeX;
  const rayDirY1 = dirY + planeY;

  const floorData = floorTexture.data.data;
  const ceilingData = ceilingTexture.data.data;
  const floorMaskX = floorTexture.width - 1;
  const floorMaskY = floorTexture.height - 1;
  const ceilingMaskX = ceilingTexture.width - 1;
  const ceilingMaskY = ceilingTexture.height - 1;
  const halfHeight = SCREEN_HEIGHT / 2;
  const posZ = 0.5 * SCREEN_HEIGHT;

  for (let y = Math.floor(halfHeight) + 1; y < SCREEN_HEIGHT; y++) {
    const p = y - halfHeight;
    const rowDistance = posZ / p;
    const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / SCREEN_WIDTH;
    const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / SCREEN_WIDTH;

    let floorX = ctx.player.x + rowDistance * rayDirX0;
    let floorY = ctx.player.y + rowDistance * rayDirY0;

    const floorBrightness = Math.min(1.0, 2.2 / (1.0 + rowDistance * 0.14));
    const ceilingBrightness = Math.min(0.78, 1.8 / (1.0 + rowDistance * 0.18));
    const ceilingY = SCREEN_HEIGHT - y - 1;

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const cellX = Math.floor(floorX);
      const cellY = Math.floor(floorY);

      const floorTexX = Math.floor(floorTexture.width * (floorX - cellX)) & floorMaskX;
      const floorTexY = Math.floor(floorTexture.height * (floorY - cellY)) & floorMaskY;
      const floorSrc = (floorTexY * floorTexture.width + floorTexX) * 4;
      const floorDst = (y * SCREEN_WIDTH + x) * 4;

      pixels[floorDst] = floorData[floorSrc] * floorBrightness;
      pixels[floorDst + 1] = floorData[floorSrc + 1] * floorBrightness;
      pixels[floorDst + 2] = floorData[floorSrc + 2] * floorBrightness;
      pixels[floorDst + 3] = 255;

      const ceilingTexX = Math.floor(ceilingTexture.width * (floorX - cellX)) & ceilingMaskX;
      const ceilingTexY = Math.floor(ceilingTexture.height * (floorY - cellY)) & ceilingMaskY;
      const ceilingSrc = (ceilingTexY * ceilingTexture.width + ceilingTexX) * 4;
      const ceilingDst = (ceilingY * SCREEN_WIDTH + x) * 4;

      pixels[ceilingDst] = ceilingData[ceilingSrc] * ceilingBrightness;
      pixels[ceilingDst + 1] = ceilingData[ceilingSrc + 1] * ceilingBrightness;
      pixels[ceilingDst + 2] = ceilingData[ceilingSrc + 2] * ceilingBrightness;
      pixels[ceilingDst + 3] = 255;

      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  ctx.ctx.putImageData(frame, 0, 0);
}
