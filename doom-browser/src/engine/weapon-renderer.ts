import { Weapon, WeaponState } from '../game/weapon';
import { WeaponInventory, WeaponType, WeaponDef } from '../game/weapons';
import { Texture } from './textures';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

export interface WeaponRendererContext {
  ctx: CanvasRenderingContext2D;
  weapon: Weapon;
  inventory: WeaponInventory;
  muzzleFlashTexture: Texture | null;
}

/**
 * Draws the current weapon at the bottom of the screen.
 * Called once per frame from the renderer.
 */
export function drawWeapon(ctx: WeaponRendererContext): void {
  const def = ctx.inventory.getCurrent();
  const bobY = ctx.weapon.getBobOffset();
  const bobX = ctx.weapon.getBobXOffset();
  const recoilY = ctx.weapon.getRecoilY();
  const recoilX = ctx.weapon.getRecoilX();

  const cx = SCREEN_WIDTH / 2 + bobX + recoilX;
  const baseY = SCREEN_HEIGHT + bobY + recoilY;

  if (def.type === WeaponType.PISTOL) {
    drawPistol(ctx.ctx, cx, baseY);
  } else if (def.type === WeaponType.SHOTGUN) {
    drawShotgun(ctx.ctx, cx, baseY);
  } else if (def.type === WeaponType.ROCKET_LAUNCHER) {
    drawRocketLauncher(ctx.ctx, cx, baseY);
  } else if (def.type === WeaponType.FIST) {
    drawFist(ctx.ctx, cx, baseY);
  }

  if (ctx.weapon.state === WeaponState.FIRING && ctx.muzzleFlashTexture && !def.isMelee) {
    drawMuzzleFlash(ctx.ctx, cx, baseY, def, ctx.weapon, ctx.muzzleFlashTexture);
  }
}

function drawPistol(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  ctx.fillStyle = '#5c3a1e';
  ctx.beginPath();
  ctx.moveTo(cx - 28, baseY - 100);
  ctx.lineTo(cx - 10, baseY - 100);
  ctx.lineTo(cx - 6, baseY - 10);
  ctx.lineTo(cx - 32, baseY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#6b4422';
  ctx.beginPath();
  ctx.moveTo(cx + 10, baseY - 100);
  ctx.lineTo(cx + 28, baseY - 100);
  ctx.lineTo(cx + 32, baseY - 10);
  ctx.lineTo(cx + 6, baseY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4a2a10';
  for (let i = 0; i < 7; i++) {
    const ly = baseY - 92 + i * 11;
    ctx.fillRect(cx - 26, ly, 16, 2);
    ctx.fillRect(cx + 10, ly, 16, 2);
  }

  ctx.fillStyle = 'rgba(255,220,180,0.12)';
  ctx.fillRect(cx - 27, baseY - 95, 2, 75);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx + 27, baseY - 95, 2, 75);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 34, baseY - 130, 68, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(cx - 33, baseY - 129, 66, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - 33, baseY - 99, 66, 2);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 5, baseY - 100, 10, 14);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 2, baseY - 96, 4, 8);

  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 36, baseY - 155, 72, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - 35, baseY - 154, 30, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(cx - 35, baseY - 129, 70, 2);

  ctx.fillStyle = '#3a3a3a';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(cx - 28 + i * 10, baseY - 148, 6, 2);
  }

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 14, baseY - 185, 28, 32);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 8, baseY - 183, 16, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cx - 13, baseY - 184, 3, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx + 10, baseY - 184, 3, 28);

  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 16, baseY - 186, 32, 4);
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 10, baseY - 186, 20, 3);

  ctx.fillStyle = '#777';
  ctx.fillRect(cx - 2, baseY - 189, 4, 5);
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 4, baseY - 158, 3, 4);
  ctx.fillRect(cx + 1, baseY - 158, 3, 4);

  ctx.fillStyle = '#777';
  ctx.fillRect(cx - 36, baseY - 120, 4, 6);
}

function drawShotgun(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  ctx.fillStyle = '#6B4226';
  ctx.beginPath();
  ctx.moveTo(cx - 30, baseY - 70);
  ctx.lineTo(cx - 10, baseY - 70);
  ctx.lineTo(cx - 6, baseY - 10);
  ctx.lineTo(cx - 34, baseY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#5A3520';
  ctx.fillRect(cx - 28, baseY - 65, 12, 2);
  ctx.fillRect(cx - 26, baseY - 55, 14, 2);
  ctx.fillRect(cx - 24, baseY - 45, 12, 2);
  ctx.fillRect(cx - 22, baseY - 35, 10, 2);
  ctx.fillRect(cx - 20, baseY - 25, 10, 2);

  ctx.fillStyle = 'rgba(255,220,180,0.10)';
  ctx.fillRect(cx - 29, baseY - 68, 2, 55);

  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 16, baseY - 95, 36, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(cx - 15, baseY - 94, 34, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - 15, baseY - 67, 34, 2);

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 10, baseY - 65, 24, 8);
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 8, baseY - 63, 20, 5);

  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx - 12, baseY - 155, 12, 62);
  ctx.fillStyle = '#6B4A20';
  ctx.fillRect(cx - 10, baseY - 153, 8, 58);

  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx + 2, baseY - 155, 12, 62);
  ctx.fillStyle = '#6B4A20';
  ctx.fillRect(cx + 4, baseY - 153, 8, 58);

  ctx.fillStyle = '#777';
  ctx.fillRect(cx - 14, baseY - 157, 14, 5);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx + 2, baseY - 157, 14, 5);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 12, baseY - 156, 10, 3);
  ctx.fillRect(cx + 4, baseY - 156, 10, 3);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(cx - 11, baseY - 154, 2, 50);
  ctx.fillRect(cx + 3, baseY - 154, 2, 50);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 2, baseY - 95, 6, 12);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx, baseY - 92, 2, 8);

  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 2, baseY - 100, 3, 4);
  ctx.fillRect(cx + 3, baseY - 100, 3, 4);
}

function drawRocketLauncher(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  ctx.fillStyle = '#5A3520';
  ctx.beginPath();
  ctx.moveTo(cx - 34, baseY - 80);
  ctx.lineTo(cx - 12, baseY - 80);
  ctx.lineTo(cx - 8, baseY - 10);
  ctx.lineTo(cx - 38, baseY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4a2a15';
  ctx.fillRect(cx - 32, baseY - 75, 14, 2);
  ctx.fillRect(cx - 30, baseY - 65, 12, 2);
  ctx.fillRect(cx - 28, baseY - 55, 10, 2);
  ctx.fillRect(cx - 26, baseY - 45, 10, 2);
  ctx.fillRect(cx - 24, baseY - 35, 8, 2);

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 20, baseY - 160, 60, 36);
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 18, baseY - 158, 56, 12);
  ctx.fillStyle = '#444';
  ctx.fillRect(cx - 18, baseY - 132, 56, 12);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 20, baseY - 148, 60, 3);
  ctx.fillRect(cx - 20, baseY - 138, 60, 3);

  ctx.fillStyle = '#cc2222';
  ctx.beginPath();
  ctx.moveTo(cx + 38, baseY - 160);
  ctx.lineTo(cx + 58, baseY - 142);
  ctx.lineTo(cx + 38, baseY - 124);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ee3333';
  ctx.beginPath();
  ctx.moveTo(cx + 39, baseY - 156);
  ctx.lineTo(cx + 52, baseY - 142);
  ctx.lineTo(cx + 39, baseY - 144);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.fillRect(cx + 55, baseY - 144, 4, 4);

  ctx.fillStyle = '#228B22';
  ctx.fillRect(cx - 8, baseY - 118, 28, 16);
  ctx.fillStyle = '#2EA02E';
  ctx.fillRect(cx - 6, baseY - 116, 24, 8);

  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(cx + 4, baseY - 118, 4, 16);

  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 2, baseY - 164, 10, 6);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx, baseY - 163, 4, 2);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 8, baseY - 100, 20, 16);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 2, baseY - 98, 4, 10);

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx + 4, baseY - 88, 6, 0, Math.PI);
  ctx.stroke();
}

function drawFist(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  ctx.fillStyle = '#4a3520';
  ctx.beginPath();
  ctx.moveTo(cx + 40, baseY);
  ctx.lineTo(cx + 15, baseY - 60);
  ctx.lineTo(cx + 5, baseY - 60);
  ctx.lineTo(cx - 10, baseY - 60);
  ctx.lineTo(cx - 15, baseY - 20);
  ctx.lineTo(cx - 20, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#3a2515';
  ctx.fillRect(cx - 12, baseY - 50, 16, 3);
  ctx.fillRect(cx - 8, baseY - 35, 14, 3);
  ctx.fillRect(cx - 5, baseY - 20, 12, 3);

  ctx.fillStyle = '#3d2b1a';
  ctx.beginPath();
  ctx.moveTo(cx - 20, baseY - 85);
  ctx.lineTo(cx + 15, baseY - 85);
  ctx.lineTo(cx + 18, baseY - 60);
  ctx.lineTo(cx + 12, baseY - 55);
  ctx.lineTo(cx - 18, baseY - 55);
  ctx.lineTo(cx - 22, baseY - 60);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4d3b2a';
  ctx.fillRect(cx - 18, baseY - 82, 32, 5);

  ctx.fillStyle = '#5d4b3a';
  ctx.beginPath();
  ctx.arc(cx - 12, baseY - 78, 4, 0, Math.PI * 2);
  ctx.arc(cx - 2, baseY - 79, 4, 0, Math.PI * 2);
  ctx.arc(cx + 8, baseY - 78, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a3520';
  ctx.beginPath();
  ctx.moveTo(cx - 22, baseY - 72);
  ctx.lineTo(cx - 30, baseY - 65);
  ctx.lineTo(cx - 28, baseY - 58);
  ctx.lineTo(cx - 18, baseY - 58);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 16, baseY - 75);
  ctx.lineTo(cx + 10, baseY - 75);
  ctx.stroke();
}

function drawMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  def: WeaponDef,
  weapon: Weapon,
  muzzleFlashTexture: Texture
): void {
  let flashSize: number;
  let flashY: number;
  let rMul: number, gMul: number, bMul: number;
  let coreSize: number;

  if (def.type === WeaponType.ROCKET_LAUNCHER) {
    flashSize = 180 * weapon.flashScale;
    flashY = baseY - 178;
    rMul = 1.5; gMul = 0.9; bMul = 0.4;
    coreSize = 50 * weapon.flashScale;
  } else if (def.type === WeaponType.SHOTGUN) {
    flashSize = 100 * weapon.flashScale;
    flashY = baseY - 178;
    rMul = 1.3; gMul = 1.3; bMul = 0.8;
    coreSize = 25 * weapon.flashScale;
  } else {
    flashSize = 120 * weapon.flashScale;
    flashY = baseY - 210;
    rMul = 1.3; gMul = 1.3; bMul = 1.1;
    coreSize = 30 * weapon.flashScale;
  }

  const flashX = cx - 4 - flashSize / 2 + weapon.flashOffsetX;
  const offsetY = weapon.flashOffsetY;

  const texData = muzzleFlashTexture.data.data;
  for (let ty = 0; ty < muzzleFlashTexture.height; ty++) {
    for (let tx = 0; tx < muzzleFlashTexture.width; tx++) {
      const srcIdx = (ty * muzzleFlashTexture.width + tx) * 4;
      const alpha = texData[srcIdx + 3];
      if (alpha > 0) {
        const screenX = Math.floor(flashX + (tx / muzzleFlashTexture.width) * flashSize);
        const screenY = Math.floor(flashY + offsetY + (ty / muzzleFlashTexture.height) * flashSize);
        if (screenX >= 0 && screenX < SCREEN_WIDTH && screenY >= 0 && screenY < SCREEN_HEIGHT) {
          const r = Math.min(255, texData[srcIdx] * rMul);
          const g = Math.min(255, texData[srcIdx + 1] * gMul);
          const b = Math.min(255, texData[srcIdx + 2] * bMul);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
          const pxSize = Math.ceil(flashSize / muzzleFlashTexture.width);
          ctx.fillRect(screenX, screenY, pxSize, pxSize);
        }
      }
    }
  }

  const coreColor0 = def.type === WeaponType.ROCKET_LAUNCHER ? 'rgba(255,140,40,0.9)' : 'rgba(255,255,255,0.9)';
  const coreColor1 = def.type === WeaponType.ROCKET_LAUNCHER ? 'rgba(255,80,0,0)' : 'rgba(255,150,0,0)';
  const coreGrad = ctx.createRadialGradient(
    cx + weapon.flashOffsetX,
    flashY + offsetY + 20,
    0,
    cx + weapon.flashOffsetX,
    flashY + offsetY + 20,
    coreSize / 2
  );
  coreGrad.addColorStop(0, coreColor0);
  coreGrad.addColorStop(0.5, def.type === WeaponType.ROCKET_LAUNCHER ? 'rgba(255,200,50,0.5)' : 'rgba(255,240,150,0.5)');
  coreGrad.addColorStop(1, coreColor1);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(
    cx + weapon.flashOffsetX,
    flashY + offsetY + 20,
    coreSize / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
}
