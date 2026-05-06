import { Texture } from './textures';
import { SpriteType } from './sprite';

const SPRITE_TEXTURE_SIZE = 64;

type EnemyPose = 'idle' | 'walk' | 'attack';
type EnemyView = 'front' | 'frontQuarter' | 'side' | 'backQuarter' | 'back';

/**
 * Result of generateSpriteTextures:
 * - flat: single-frame texture arrays per type (Items + Decor + Enemy fallback)
 * - enemyAngleViews: [poseIdx 0..2][angleIdx 0..7] for ENEMY 8-direction rendering
 */
export interface SpriteTextureSet {
  flat: Map<SpriteType, Texture[]>;
  enemyAngleViews: Texture[][];
}

export const corpseTexture = generateCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

export function generateSpriteTextures(): SpriteTextureSet {
  const flat = new Map<SpriteType, Texture[]>();

  // Enemy: legacy frontal frames as fallback (idle/walk/attack)
  flat.set(SpriteType.ENEMY, [
    generateEnemyTexture('idle', 'front', false),
    generateEnemyTexture('walk', 'front', false),
    generateEnemyTexture('attack', 'front', false)
  ]);

  // Enemy: 8-direction angle views per pose
  const poses: EnemyPose[] = ['idle', 'walk', 'attack'];
  const enemyAngleViews: Texture[][] = poses.map(pose => buildEnemyAngleViews(pose));

  // Rotating items: 8 frames each
  flat.set(SpriteType.AMMO, buildRotatingItemFrames(generateAmmoFront, generateAmmoBack));
  flat.set(SpriteType.HEALTH, buildRotatingItemFrames(generateHealthFront, generateHealthBack));
  flat.set(SpriteType.KEYCARD, buildRotatingItemFrames(generateKeycardFront, generateKeycardBack));

   // Weapon pickups: 8-frame rotating sprites
   flat.set(SpriteType.WEAPON_SHOTGUN, buildRotatingItemFrames(generateShotgunFront, generateShotgunBack));
   flat.set(SpriteType.WEAPON_ROCKETLAUNCHER, buildRotatingItemFrames(generateRocketLauncherFront, generateRocketLauncherBack));

   // Decor (single frame, no shadow baked in)
   flat.set(SpriteType.BARREL, [generateBarrelTexture()]);
   flat.set(SpriteType.TERMINAL, [generateTerminalTexture()]);
   flat.set(SpriteType.LAMP, [generateLampTexture()]);
   flat.set(SpriteType.DEBRIS, [generateDebrisTexture()]);

   return { flat, enemyAngleViews };
}

/* ------------------------------------------------------------------ */
/* Enemy 8-direction generation                                        */
/* ------------------------------------------------------------------ */

function buildEnemyAngleViews(pose: EnemyPose): Texture[] {
  // Indices: 0=front, 1=frontQuarter, 2=side, 3=backQuarter, 4=back,
  //          5=backQuarter mirrored, 6=side mirrored, 7=frontQuarter mirrored
  return [
    generateEnemyTexture(pose, 'front', false),
    generateEnemyTexture(pose, 'frontQuarter', false),
    generateEnemyTexture(pose, 'side', false),
    generateEnemyTexture(pose, 'backQuarter', false),
    generateEnemyTexture(pose, 'back', false),
    generateEnemyTexture(pose, 'backQuarter', true),
    generateEnemyTexture(pose, 'side', true),
    generateEnemyTexture(pose, 'frontQuarter', true)
  ];
}

function generateEnemyTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const attacking = pose === 'attack';
  const walking = pose === 'walk';
  const headY = attacking ? 12 : 13;
  const torsoY = attacking ? 23 : 24;
  const legKick = walking ? 2 : 0;
  const armSwing = walking ? 3 : 0;

  switch (view) {
    case 'front':
      drawEnemyFront(ctx, cx, headY, torsoY, attacking, legKick, armSwing);
      break;
    case 'frontQuarter':
      drawEnemyQuarter(ctx, cx, headY, torsoY, attacking, legKick, armSwing, /*back*/ false);
      break;
    case 'side':
      drawEnemySide(ctx, cx, headY, torsoY, attacking, legKick, armSwing);
      break;
    case 'backQuarter':
      drawEnemyQuarter(ctx, cx, headY, torsoY, attacking, legKick, armSwing, /*back*/ true);
      break;
    case 'back':
      drawEnemyBack(ctx, cx, headY, torsoY, attacking, legKick, armSwing);
      break;
  }

  applySpriteRimLight(ctx, view);

  if (mirror) {
    return mirrorTextureHorizontal(canvas);
  }

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

function mirrorTextureHorizontal(srcCanvas: HTMLCanvasElement): Texture {
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

/* ----- Front view (original detailed look) ----- */

function drawEnemyFront(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  torsoY: number,
  attacking: boolean,
  legKick: number,
  armSwing: number
): void {
  drawLegsFront(ctx, cx, legKick);
  drawTorsoFront(ctx, cx, torsoY);
  drawShouldersFront(ctx, cx);
  drawArmsFront(ctx, cx, attacking, armSwing);
  drawHeadFront(ctx, cx, headY, attacking);
}

function drawLegsFront(ctx: CanvasRenderingContext2D, cx: number, legKick: number): void {
  ctx.fillStyle = '#130b08';
  ctx.fillRect(cx - 15 - legKick, 54, 11, 8);
  ctx.fillRect(cx + 4 + legKick, 54, 11, 8);

  ctx.fillStyle = '#3a1d12';
  ctx.fillRect(cx - 13 - legKick, 41, 9, 15);
  ctx.fillRect(cx + 4 + legKick, 41, 9, 15);

  ctx.fillStyle = '#6b3420';
  ctx.fillRect(cx - 12 - legKick, 43, 2, 8);
  ctx.fillRect(cx + 5 + legKick, 43, 2, 8);

  ctx.fillStyle = '#20100b';
  ctx.fillRect(cx - 16 - legKick, 58, 13, 4);
  ctx.fillRect(cx + 4 + legKick, 58, 13, 4);
}

function drawTorsoFront(ctx: CanvasRenderingContext2D, cx: number, torsoY: number): void {
  ctx.fillStyle = '#100707';
  ctx.beginPath();
  ctx.moveTo(cx - 18, torsoY);
  ctx.lineTo(cx + 18, torsoY);
  ctx.lineTo(cx + 15, 41);
  ctx.lineTo(cx - 15, 41);
  ctx.closePath();
  ctx.fill();

  const chest = ctx.createLinearGradient(cx - 18, torsoY, cx + 18, 41);
  chest.addColorStop(0, '#7a341f');
  chest.addColorStop(0.45, '#4b1d14');
  chest.addColorStop(1, '#23100c');
  ctx.fillStyle = chest;
  ctx.beginPath();
  ctx.moveTo(cx - 16, torsoY + 1);
  ctx.lineTo(cx + 16, torsoY + 1);
  ctx.lineTo(cx + 13, 39);
  ctx.lineTo(cx - 13, 39);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1d0c09';
  ctx.fillRect(cx - 2, torsoY + 2, 4, 16);

  ctx.fillStyle = '#9b6428';
  ctx.fillRect(cx - 12, 36, 24, 4);
  ctx.fillStyle = '#d09b39';
  ctx.fillRect(cx - 3, 35, 6, 6);

  ctx.fillStyle = '#8c2918';
  ctx.fillRect(cx - 9, 27, 6, 1);
  ctx.fillRect(cx + 3, 29, 7, 1);
  ctx.fillRect(cx - 6, 32, 4, 1);
}

function drawShouldersFront(ctx: CanvasRenderingContext2D, cx: number): void {
  ctx.fillStyle = '#120808';
  ctx.fillRect(cx - 25, 20, 11, 9);
  ctx.fillRect(cx + 14, 20, 11, 9);

  ctx.fillStyle = '#5f2619';
  ctx.fillRect(cx - 24, 19, 9, 9);
  ctx.fillRect(cx + 15, 19, 9, 9);

  ctx.fillStyle = '#9d4d2b';
  ctx.fillRect(cx - 23, 19, 3, 2);
  ctx.fillRect(cx + 16, 19, 3, 2);
}

function drawArmsFront(
  ctx: CanvasRenderingContext2D,
  cx: number,
  attacking: boolean,
  armSwing: number
): void {
  ctx.fillStyle = '#120808';

  if (attacking) {
    ctx.fillRect(cx - 29, 26, 17, 7);
    ctx.fillRect(cx + 12, 26, 17, 7);

    ctx.fillStyle = '#6b2d1c';
    ctx.fillRect(cx - 28, 25, 16, 7);
    ctx.fillRect(cx + 12, 25, 16, 7);

    ctx.fillStyle = '#d6b15a';
    ctx.fillRect(cx - 32, 23, 5, 3);
    ctx.fillRect(cx - 31, 27, 6, 2);
    ctx.fillRect(cx + 27, 23, 5, 3);
    ctx.fillRect(cx + 25, 27, 6, 2);
    return;
  }

  ctx.fillRect(cx - 24 - armSwing, 29, 8, 19);
  ctx.fillRect(cx + 16 + armSwing, 29, 8, 19);

  ctx.fillStyle = '#6b2d1c';
  ctx.fillRect(cx - 23 - armSwing, 29, 7, 17);
  ctx.fillRect(cx + 16 + armSwing, 29, 7, 17);

  ctx.fillStyle = '#d6b15a';
  ctx.fillRect(cx - 25 - armSwing, 46, 3, 5);
  ctx.fillRect(cx - 21 - armSwing, 46, 2, 6);
  ctx.fillRect(cx - 18 - armSwing, 46, 3, 5);
  ctx.fillRect(cx + 17 + armSwing, 46, 3, 5);
  ctx.fillRect(cx + 21 + armSwing, 46, 2, 6);
  ctx.fillRect(cx + 24 + armSwing, 46, 3, 5);
}

function drawHeadFront(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  attacking: boolean
): void {
  // Hair tufts
  ctx.fillStyle = '#130807';
  ctx.beginPath();
  ctx.moveTo(cx - 8, headY - 4);
  ctx.lineTo(cx - 17, 2);
  ctx.lineTo(cx - 12, 1);
  ctx.lineTo(cx - 5, headY - 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 8, headY - 4);
  ctx.lineTo(cx + 17, 2);
  ctx.lineTo(cx + 12, 1);
  ctx.lineTo(cx + 5, headY - 2);
  ctx.closePath();
  ctx.fill();

  // Head silhouette
  ctx.fillStyle = '#120707';
  ctx.beginPath();
  ctx.moveTo(cx - 12, headY - 5);
  ctx.lineTo(cx - 7, headY - 10);
  ctx.lineTo(cx + 7, headY - 10);
  ctx.lineTo(cx + 12, headY - 5);
  ctx.lineTo(cx + 13, headY + 5);
  ctx.lineTo(cx + 8, headY + 12);
  ctx.lineTo(cx - 8, headY + 12);
  ctx.lineTo(cx - 13, headY + 5);
  ctx.closePath();
  ctx.fill();

  const head = ctx.createLinearGradient(cx - 12, headY - 9, cx + 12, headY + 13);
  head.addColorStop(0, '#8b3b22');
  head.addColorStop(0.55, '#5a2017');
  head.addColorStop(1, '#2b0e0b');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.moveTo(cx - 10, headY - 5);
  ctx.lineTo(cx - 6, headY - 8);
  ctx.lineTo(cx + 6, headY - 8);
  ctx.lineTo(cx + 10, headY - 5);
  ctx.lineTo(cx + 11, headY + 5);
  ctx.lineTo(cx + 7, headY + 10);
  ctx.lineTo(cx - 7, headY + 10);
  ctx.lineTo(cx - 11, headY + 5);
  ctx.closePath();
  ctx.fill();

  // Eye sockets
  ctx.fillStyle = '#160606';
  ctx.fillRect(cx - 9, headY, 7, 4);
  ctx.fillRect(cx + 2, headY, 7, 4);

  // Glowing eyes
  ctx.shadowColor = '#ff2a00';
  ctx.shadowBlur = attacking ? 10 : 7;
  ctx.fillStyle = attacking ? '#ff2100' : '#ff4a12';
  ctx.fillRect(cx - 8, headY + 1, attacking ? 6 : 5, 2);
  ctx.fillRect(cx + 3, headY + 1, attacking ? 6 : 5, 2);
  ctx.fillStyle = '#ffd15a';
  ctx.fillRect(cx - 7, headY + 1, 2, 1);
  ctx.fillRect(cx + 4, headY + 1, 2, 1);
  ctx.shadowBlur = 0;

  // Mouth + teeth
  ctx.fillStyle = attacking ? '#ff2a00' : '#1a0706';
  ctx.fillRect(cx - 6, headY + 7, 12, attacking ? 4 : 3);
  ctx.fillStyle = '#d6c09a';
  ctx.fillRect(cx - 5, headY + 7, 2, 2);
  ctx.fillRect(cx - 1, headY + 7, 2, 2);
  ctx.fillRect(cx + 3, headY + 7, 2, 2);
}

/* ----- Quarter view (3/4 perspective) ----- */

function drawEnemyQuarter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  torsoY: number,
  attacking: boolean,
  legKick: number,
  armSwing: number,
  back: boolean
): void {
  const sx = 0.78; // horizontal compression
  const off = 3;   // body shifted slightly right (foreground)

  // Legs (compressed)
  ctx.fillStyle = '#130b08';
  ctx.fillRect(cx - Math.round(15 * sx) - legKick + off, 54, Math.round(11 * sx), 8);
  ctx.fillRect(cx + Math.round(4 * sx) + legKick + off, 54, Math.round(11 * sx), 8);
  ctx.fillStyle = '#3a1d12';
  ctx.fillRect(cx - Math.round(13 * sx) - legKick + off, 41, Math.round(9 * sx), 15);
  ctx.fillRect(cx + Math.round(4 * sx) + legKick + off, 41, Math.round(9 * sx), 15);
  ctx.fillStyle = '#20100b';
  ctx.fillRect(cx - Math.round(16 * sx) - legKick + off, 58, Math.round(13 * sx), 4);
  ctx.fillRect(cx + Math.round(4 * sx) + legKick + off, 58, Math.round(13 * sx), 4);

  // Torso (narrower, shifted)
  const tw = Math.round(18 * sx);
  ctx.fillStyle = '#100707';
  ctx.beginPath();
  ctx.moveTo(cx - tw + off, torsoY);
  ctx.lineTo(cx + tw + off, torsoY);
  ctx.lineTo(cx + tw - 3 + off, 41);
  ctx.lineTo(cx - tw + 3 + off, 41);
  ctx.closePath();
  ctx.fill();

  const chest = ctx.createLinearGradient(cx - tw + off, torsoY, cx + tw + off, 41);
  chest.addColorStop(0, back ? '#3d1a10' : '#7a341f');
  chest.addColorStop(0.5, back ? '#26120a' : '#4b1d14');
  chest.addColorStop(1, '#1a0a08');
  ctx.fillStyle = chest;
  ctx.beginPath();
  ctx.moveTo(cx - tw + 2 + off, torsoY + 1);
  ctx.lineTo(cx + tw - 2 + off, torsoY + 1);
  ctx.lineTo(cx + tw - 5 + off, 39);
  ctx.lineTo(cx - tw + 5 + off, 39);
  ctx.closePath();
  ctx.fill();

  if (!back) {
    // Belt buckle
    ctx.fillStyle = '#9b6428';
    ctx.fillRect(cx - 9 + off, 36, 18, 4);
    ctx.fillStyle = '#d09b39';
    ctx.fillRect(cx - 2 + off, 35, 4, 6);
    // Spine groove
    ctx.fillStyle = '#1d0c09';
    ctx.fillRect(cx - 1 + off, torsoY + 2, 3, 16);
  } else {
    // Spine groove down the back, more central
    ctx.fillStyle = '#0a0403';
    ctx.fillRect(cx - 1 + off, torsoY + 1, 2, 17);
    ctx.fillStyle = '#3a1810';
    ctx.fillRect(cx - 1 + off, torsoY + 6, 2, 8);
  }

  // Shoulders (asymmetric: foreground shoulder bigger)
  ctx.fillStyle = '#120808';
  ctx.fillRect(cx + Math.round(14 * sx) + off, 20, 11, 9); // foreground shoulder
  ctx.fillRect(cx - Math.round(25 * sx) + off, 21, 9, 8);  // far shoulder smaller
  ctx.fillStyle = '#5f2619';
  ctx.fillRect(cx + Math.round(15 * sx) + off, 19, 9, 9);
  ctx.fillRect(cx - Math.round(24 * sx) + off, 21, 7, 7);

  // Arms (asymmetric)
  if (attacking) {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx + 12 + off, 26, 17, 7);
    ctx.fillRect(cx - 24 + off, 27, 12, 6);
    ctx.fillStyle = '#6b2d1c';
    ctx.fillRect(cx + 12 + off, 25, 16, 7);
    ctx.fillRect(cx - 23 + off, 27, 11, 6);
    ctx.fillStyle = '#d6b15a';
    ctx.fillRect(cx + 27 + off, 23, 5, 3);
    ctx.fillRect(cx + 25 + off, 27, 6, 2);
  } else {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx + 16 + armSwing + off, 29, 8, 19);
    ctx.fillRect(cx - 18 - armSwing + off, 30, 6, 17);
    ctx.fillStyle = '#6b2d1c';
    ctx.fillRect(cx + 16 + armSwing + off, 29, 7, 17);
    ctx.fillRect(cx - 18 - armSwing + off, 30, 5, 15);
    ctx.fillStyle = '#d6b15a';
    ctx.fillRect(cx + 17 + armSwing + off, 46, 3, 5);
    ctx.fillRect(cx + 21 + armSwing + off, 46, 2, 6);
    ctx.fillRect(cx + 24 + armSwing + off, 46, 3, 5);
  }

  // Head (turned 3/4)
  drawHeadQuarter(ctx, cx + off, headY, attacking, back);
}

function drawHeadQuarter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  attacking: boolean,
  back: boolean
): void {
  // Hair tufts (asymmetric — far tuft smaller)
  ctx.fillStyle = '#130807';
  ctx.beginPath();
  ctx.moveTo(cx - 6, headY - 4);
  ctx.lineTo(cx - 13, 2);
  ctx.lineTo(cx - 9, 1);
  ctx.lineTo(cx - 4, headY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 7, headY - 4);
  ctx.lineTo(cx + 16, 1);
  ctx.lineTo(cx + 11, 0);
  ctx.lineTo(cx + 5, headY - 2);
  ctx.closePath();
  ctx.fill();

  // Head silhouette (narrower, shifted)
  ctx.fillStyle = '#120707';
  ctx.beginPath();
  ctx.moveTo(cx - 9, headY - 5);
  ctx.lineTo(cx - 5, headY - 9);
  ctx.lineTo(cx + 8, headY - 9);
  ctx.lineTo(cx + 11, headY - 5);
  ctx.lineTo(cx + 12, headY + 5);
  ctx.lineTo(cx + 7, headY + 11);
  ctx.lineTo(cx - 7, headY + 11);
  ctx.lineTo(cx - 11, headY + 5);
  ctx.closePath();
  ctx.fill();

  const head = ctx.createLinearGradient(cx - 9, headY - 9, cx + 11, headY + 13);
  head.addColorStop(0, back ? '#3a1810' : '#8b3b22');
  head.addColorStop(0.55, back ? '#1a0908' : '#5a2017');
  head.addColorStop(1, '#1a0a08');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.moveTo(cx - 8, headY - 5);
  ctx.lineTo(cx - 4, headY - 7);
  ctx.lineTo(cx + 7, headY - 7);
  ctx.lineTo(cx + 9, headY - 5);
  ctx.lineTo(cx + 10, headY + 5);
  ctx.lineTo(cx + 6, headY + 9);
  ctx.lineTo(cx - 6, headY + 9);
  ctx.lineTo(cx - 10, headY + 5);
  ctx.closePath();
  ctx.fill();

  if (!back) {
    // Eyes (foreground eye prominent, far eye partly turned away)
    ctx.fillStyle = '#160606';
    ctx.fillRect(cx - 7, headY, 5, 4);
    ctx.fillRect(cx + 2, headY, 6, 4);
    ctx.shadowColor = '#ff2a00';
    ctx.shadowBlur = attacking ? 10 : 7;
    ctx.fillStyle = attacking ? '#ff2100' : '#ff4a12';
    ctx.fillRect(cx - 6, headY + 1, 3, 2);
    ctx.fillRect(cx + 3, headY + 1, attacking ? 5 : 4, 2);
    ctx.shadowBlur = 0;
    // Mouth
    ctx.fillStyle = attacking ? '#ff2a00' : '#1a0706';
    ctx.fillRect(cx - 4, headY + 7, 10, attacking ? 4 : 3);
    ctx.fillStyle = '#d6c09a';
    ctx.fillRect(cx - 3, headY + 7, 2, 2);
    ctx.fillRect(cx + 1, headY + 7, 2, 2);
    ctx.fillRect(cx + 4, headY + 7, 2, 2);
  } else {
    // Hair covering most of head, occasional skull texture
    ctx.fillStyle = '#0e0606';
    ctx.fillRect(cx - 8, headY - 5, 18, 8);
    ctx.fillStyle = '#2a1208';
    ctx.fillRect(cx - 5, headY + 1, 3, 2);
    ctx.fillRect(cx + 1, headY + 2, 4, 1);
    // Ear silhouette
    ctx.fillStyle = '#1a0a08';
    ctx.fillRect(cx + 9, headY + 3, 2, 4);
  }
}

/* ----- Side view (profile) ----- */

function drawEnemySide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  torsoY: number,
  attacking: boolean,
  legKick: number,
  armSwing: number
): void {
  // Single-leg-forward profile silhouette
  ctx.fillStyle = '#130b08';
  ctx.fillRect(cx - 5, 54, 10, 8);
  ctx.fillRect(cx + 1 + legKick, 56, 10, 6);
  ctx.fillStyle = '#3a1d12';
  ctx.fillRect(cx - 4, 41, 8, 15);
  ctx.fillRect(cx + 2 + legKick, 43, 7, 13);
  ctx.fillStyle = '#20100b';
  ctx.fillRect(cx - 6, 58, 12, 4);
  ctx.fillRect(cx + 1 + legKick, 60, 11, 2);

  // Narrow torso (profile column)
  ctx.fillStyle = '#100707';
  ctx.beginPath();
  ctx.moveTo(cx - 6, torsoY);
  ctx.lineTo(cx + 8, torsoY);
  ctx.lineTo(cx + 7, 41);
  ctx.lineTo(cx - 5, 41);
  ctx.closePath();
  ctx.fill();

  const chest = ctx.createLinearGradient(cx - 6, torsoY, cx + 8, 41);
  chest.addColorStop(0, '#3a1810');
  chest.addColorStop(0.5, '#5f2619');
  chest.addColorStop(1, '#23100c');
  ctx.fillStyle = chest;
  ctx.beginPath();
  ctx.moveTo(cx - 5, torsoY + 1);
  ctx.lineTo(cx + 7, torsoY + 1);
  ctx.lineTo(cx + 6, 39);
  ctx.lineTo(cx - 4, 39);
  ctx.closePath();
  ctx.fill();

  // Belt edge (visible from side)
  ctx.fillStyle = '#9b6428';
  ctx.fillRect(cx - 5, 36, 13, 4);
  ctx.fillStyle = '#d09b39';
  ctx.fillRect(cx + 6, 35, 4, 6);

  // Single near shoulder
  ctx.fillStyle = '#120808';
  ctx.fillRect(cx - 3, 19, 11, 10);
  ctx.fillStyle = '#5f2619';
  ctx.fillRect(cx - 2, 19, 9, 9);

  // Single arm — forward swing
  if (attacking) {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx, 26, 18, 7);
    ctx.fillStyle = '#6b2d1c';
    ctx.fillRect(cx + 1, 25, 17, 7);
    ctx.fillStyle = '#d6b15a';
    ctx.fillRect(cx + 17, 23, 5, 3);
    ctx.fillRect(cx + 15, 27, 6, 2);
  } else {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx + 1 - armSwing, 29, 7, 19);
    ctx.fillStyle = '#6b2d1c';
    ctx.fillRect(cx + 1 - armSwing, 29, 6, 17);
    ctx.fillStyle = '#d6b15a';
    ctx.fillRect(cx + 1 - armSwing, 46, 3, 5);
    ctx.fillRect(cx + 5 - armSwing, 46, 2, 6);
  }

  // Head profile
  drawHeadSide(ctx, cx, headY, attacking);
}

function drawHeadSide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  attacking: boolean
): void {
  // Hair tuft (back)
  ctx.fillStyle = '#130807';
  ctx.beginPath();
  ctx.moveTo(cx - 7, headY - 3);
  ctx.lineTo(cx - 13, 1);
  ctx.lineTo(cx - 9, 0);
  ctx.lineTo(cx - 3, headY - 4);
  ctx.closePath();
  ctx.fill();

  // Head profile silhouette with nose protrusion
  ctx.fillStyle = '#120707';
  ctx.beginPath();
  ctx.moveTo(cx - 7, headY - 5);
  ctx.lineTo(cx - 4, headY - 9);
  ctx.lineTo(cx + 5, headY - 9);
  ctx.lineTo(cx + 8, headY - 4);
  ctx.lineTo(cx + 10, headY);     // nose tip
  ctx.lineTo(cx + 8, headY + 3);
  ctx.lineTo(cx + 9, headY + 6);
  ctx.lineTo(cx + 6, headY + 11);
  ctx.lineTo(cx - 5, headY + 11);
  ctx.lineTo(cx - 8, headY + 5);
  ctx.closePath();
  ctx.fill();

  // Inner head fill
  const head = ctx.createLinearGradient(cx - 7, headY - 9, cx + 8, headY + 11);
  head.addColorStop(0, '#8b3b22');
  head.addColorStop(0.55, '#5a2017');
  head.addColorStop(1, '#2b0e0b');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.moveTo(cx - 5, headY - 5);
  ctx.lineTo(cx - 3, headY - 7);
  ctx.lineTo(cx + 4, headY - 7);
  ctx.lineTo(cx + 7, headY - 3);
  ctx.lineTo(cx + 8, headY);
  ctx.lineTo(cx + 6, headY + 3);
  ctx.lineTo(cx + 7, headY + 6);
  ctx.lineTo(cx + 4, headY + 9);
  ctx.lineTo(cx - 3, headY + 9);
  ctx.lineTo(cx - 6, headY + 4);
  ctx.closePath();
  ctx.fill();

  // Single eye in profile
  ctx.fillStyle = '#160606';
  ctx.fillRect(cx, headY, 5, 3);
  ctx.shadowColor = '#ff2a00';
  ctx.shadowBlur = attacking ? 10 : 7;
  ctx.fillStyle = attacking ? '#ff2100' : '#ff4a12';
  ctx.fillRect(cx + 1, headY + 1, 3, 2);
  ctx.shadowBlur = 0;

  // Mouth/jaw line
  ctx.fillStyle = attacking ? '#ff2a00' : '#1a0706';
  ctx.fillRect(cx + 1, headY + 7, 6, attacking ? 3 : 2);
}

/* ----- Back view ----- */

function drawEnemyBack(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  torsoY: number,
  attacking: boolean,
  legKick: number,
  armSwing: number
): void {
  // Legs (same silhouette, no front detail)
  ctx.fillStyle = '#130b08';
  ctx.fillRect(cx - 15 - legKick, 54, 11, 8);
  ctx.fillRect(cx + 4 + legKick, 54, 11, 8);
  ctx.fillStyle = '#3a1d12';
  ctx.fillRect(cx - 13 - legKick, 41, 9, 15);
  ctx.fillRect(cx + 4 + legKick, 41, 9, 15);
  ctx.fillStyle = '#20100b';
  ctx.fillRect(cx - 16 - legKick, 58, 13, 4);
  ctx.fillRect(cx + 4 + legKick, 58, 13, 4);

  // Torso (back: spine groove down center, no buckle, darker)
  ctx.fillStyle = '#100707';
  ctx.beginPath();
  ctx.moveTo(cx - 18, torsoY);
  ctx.lineTo(cx + 18, torsoY);
  ctx.lineTo(cx + 15, 41);
  ctx.lineTo(cx - 15, 41);
  ctx.closePath();
  ctx.fill();

  const back = ctx.createLinearGradient(cx - 18, torsoY, cx + 18, 41);
  back.addColorStop(0, '#3d1a10');
  back.addColorStop(0.5, '#26120a');
  back.addColorStop(1, '#180806');
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(cx - 16, torsoY + 1);
  ctx.lineTo(cx + 16, torsoY + 1);
  ctx.lineTo(cx + 13, 39);
  ctx.lineTo(cx - 13, 39);
  ctx.closePath();
  ctx.fill();

  // Spine groove
  ctx.fillStyle = '#0a0403';
  ctx.fillRect(cx - 1, torsoY + 1, 2, 17);
  ctx.fillStyle = '#3a1810';
  ctx.fillRect(cx - 1, torsoY + 6, 2, 8);

  // Shoulder blades
  ctx.fillStyle = '#1a0a08';
  ctx.fillRect(cx - 12, torsoY + 3, 8, 6);
  ctx.fillRect(cx + 4, torsoY + 3, 8, 6);

  // Shoulders (back)
  ctx.fillStyle = '#120808';
  ctx.fillRect(cx - 25, 20, 11, 9);
  ctx.fillRect(cx + 14, 20, 11, 9);
  ctx.fillStyle = '#3a1810';
  ctx.fillRect(cx - 24, 19, 9, 9);
  ctx.fillRect(cx + 15, 19, 9, 9);

  // Arms from back (no hands shown)
  if (attacking) {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx - 29, 26, 17, 7);
    ctx.fillRect(cx + 12, 26, 17, 7);
    ctx.fillStyle = '#3a1810';
    ctx.fillRect(cx - 28, 25, 16, 7);
    ctx.fillRect(cx + 12, 25, 16, 7);
  } else {
    ctx.fillStyle = '#120808';
    ctx.fillRect(cx - 24 - armSwing, 29, 8, 19);
    ctx.fillRect(cx + 16 + armSwing, 29, 8, 19);
    ctx.fillStyle = '#3a1810';
    ctx.fillRect(cx - 23 - armSwing, 29, 7, 17);
    ctx.fillRect(cx + 16 + armSwing, 29, 7, 17);
  }

  // Head — back of head only (hair, no face)
  drawHeadBack(ctx, cx, headY);
}

function drawHeadBack(ctx: CanvasRenderingContext2D, cx: number, headY: number): void {
  // Hair tufts on top
  ctx.fillStyle = '#130807';
  ctx.beginPath();
  ctx.moveTo(cx - 8, headY - 4);
  ctx.lineTo(cx - 17, 2);
  ctx.lineTo(cx - 12, 1);
  ctx.lineTo(cx - 5, headY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 8, headY - 4);
  ctx.lineTo(cx + 17, 2);
  ctx.lineTo(cx + 12, 1);
  ctx.lineTo(cx + 5, headY - 2);
  ctx.closePath();
  ctx.fill();

  // Skull/scalp silhouette
  ctx.fillStyle = '#120707';
  ctx.beginPath();
  ctx.moveTo(cx - 12, headY - 5);
  ctx.lineTo(cx - 7, headY - 10);
  ctx.lineTo(cx + 7, headY - 10);
  ctx.lineTo(cx + 12, headY - 5);
  ctx.lineTo(cx + 13, headY + 5);
  ctx.lineTo(cx + 8, headY + 12);
  ctx.lineTo(cx - 8, headY + 12);
  ctx.lineTo(cx - 13, headY + 5);
  ctx.closePath();
  ctx.fill();

  // Hair-covered scalp
  const hair = ctx.createLinearGradient(cx, headY - 9, cx, headY + 12);
  hair.addColorStop(0, '#1a0908');
  hair.addColorStop(0.6, '#2b110b');
  hair.addColorStop(1, '#150705');
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(cx - 10, headY - 5);
  ctx.lineTo(cx - 6, headY - 8);
  ctx.lineTo(cx + 6, headY - 8);
  ctx.lineTo(cx + 10, headY - 5);
  ctx.lineTo(cx + 11, headY + 5);
  ctx.lineTo(cx + 7, headY + 10);
  ctx.lineTo(cx - 7, headY + 10);
  ctx.lineTo(cx - 11, headY + 5);
  ctx.closePath();
  ctx.fill();

  // Hair strands
  ctx.fillStyle = '#0a0403';
  ctx.fillRect(cx - 8, headY - 4, 1, 8);
  ctx.fillRect(cx - 4, headY - 6, 1, 10);
  ctx.fillRect(cx, headY - 7, 1, 12);
  ctx.fillRect(cx + 4, headY - 6, 1, 10);
  ctx.fillRect(cx + 8, headY - 4, 1, 8);

  // Ears poking out
  ctx.fillStyle = '#3a1810';
  ctx.fillRect(cx - 12, headY + 2, 2, 4);
  ctx.fillRect(cx + 10, headY + 2, 2, 4);
}

function applySpriteRimLight(ctx: CanvasRenderingContext2D, view: EnemyView): void {
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

function buildRotatingItemFrames(
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

function generateAmmoFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = SPRITE_TEXTURE_SIZE / 2;
  const cy = SPRITE_TEXTURE_SIZE / 2;

  ctx.fillStyle = '#c65';
  ctx.fillRect(cx - 12, cy - 10, 24, 24);
  ctx.fillStyle = '#a54';
  ctx.fillRect(cx - 12, cy - 10, 24, 4);
  ctx.fillStyle = '#ffe082';
  ctx.fillRect(cx - 2, cy - 4, 4, 12);
  ctx.fillRect(cx - 6, cy, 12, 4);
  ctx.fillStyle = '#fb8';
  ctx.fillRect(cx - 12, cy - 2, 3, 8);
  ctx.fillRect(cx + 9, cy - 2, 3, 8);
  ctx.strokeStyle = 'rgba(255,255,200,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 14);
  ctx.lineTo(cx - 12, cy - 10);
  ctx.lineTo(cx + 12, cy - 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 10);
  ctx.lineTo(cx + 12, cy + 14);
  ctx.lineTo(cx - 12, cy + 14);
  ctx.stroke();
  return texFromCanvas(canvas, ctx);
}

function generateAmmoBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = SPRITE_TEXTURE_SIZE / 2;
  const cy = SPRITE_TEXTURE_SIZE / 2;
  // Plain back of the box — no symbol
  ctx.fillStyle = '#a54';
  ctx.fillRect(cx - 12, cy - 10, 24, 24);
  ctx.fillStyle = '#823';
  ctx.fillRect(cx - 12, cy - 10, 24, 4);
  ctx.fillStyle = '#732';
  ctx.fillRect(cx - 11, cy - 6, 22, 18);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 12, cy - 10, 24, 24);
  return texFromCanvas(canvas, ctx);
}

function generateHealthFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = SPRITE_TEXTURE_SIZE / 2;
  const cy = SPRITE_TEXTURE_SIZE / 2;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(cx - 10, cy - 8, 20, 20);
  ctx.fillStyle = '#4c4';
  ctx.fillRect(cx - 3, cy - 6, 6, 12);
  ctx.fillRect(cx - 6, cy - 3, 12, 6);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(cx - 10, cy - 8, 20, 2);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#4c4';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(68,204,68,0.3)';
  ctx.fillRect(cx - 6, cy - 6, 12, 12);
  ctx.restore();
  return texFromCanvas(canvas, ctx);
}

function generateHealthBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = SPRITE_TEXTURE_SIZE / 2;
  const cy = SPRITE_TEXTURE_SIZE / 2;
  // Plain white box, no cross
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(cx - 10, cy - 8, 20, 20);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 10, cy - 8, 20, 2);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(cx - 9, cy - 6, 18, 16);
  return texFromCanvas(canvas, ctx);
}

function generateKeycardFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32;
  const cy = 32;
  const cardW = 36;
  const cardH = 26;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#1a5a9c');
  cardGrad.addColorStop(0.5, '#2070cc');
  cardGrad.addColorStop(1, '#1a5a9c');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();

  ctx.strokeStyle = '#5ab8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.stroke();

  ctx.fillStyle = '#d4a017';
  ctx.fillRect(cardX + 4, cardY + 4, 8, 6);
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(cardX + 5, cardY + 5, 6, 4);

  ctx.strokeStyle = '#5ab8ff';
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 5);
  ctx.lineTo(cardX + 28, cardY + 5);
  ctx.lineTo(cardX + 30, cardY + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 10);
  ctx.lineTo(cardX + 26, cardY + 10);
  ctx.stroke();

  ctx.fillStyle = '#5ab8ff';
  ctx.fillRect(cardX + 4, cardY + 16, 2, 8);
  ctx.fillRect(cardX + 8, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 11, cardY + 16, 3, 8);
  ctx.fillRect(cardX + 16, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 19, cardY + 16, 2, 8);
  ctx.fillRect(cardX + 23, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 26, cardY + 16, 3, 8);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#5ab8ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(90, 184, 255, 0.35)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateKeycardBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32;
  const cy = 32;
  const cardW = 36;
  const cardH = 26;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#103a66');
  cardGrad.addColorStop(0.5, '#155090');
  cardGrad.addColorStop(1, '#103a66');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();

  ctx.strokeStyle = '#3a90d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.stroke();

  // Magnetic stripe across the back
  ctx.fillStyle = '#0a1a2a';
  ctx.fillRect(cardX + 2, cardY + 8, cardW - 4, 5);

  // Subtle edge highlight only
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(90, 184, 255, 0.10)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function texFromCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Texture {
  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/* ------------------------------------------------------------------ */
/* Decor (no shadows baked in)                                         */
/* ------------------------------------------------------------------ */

function generateBarrelTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.ellipse(cx, 40, 13, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(cx - 13, 0, cx + 13, 0);
  bodyGrad.addColorStop(0, '#3a2210');
  bodyGrad.addColorStop(0.3, '#7a4a20');
  bodyGrad.addColorStop(0.6, '#8a5528');
  bodyGrad.addColorStop(1, '#2a1508');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 40, 12, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(cx - 12, 28, 24, 3);
  ctx.fillRect(cx - 12, 38, 24, 3);
  ctx.fillRect(cx - 12, 48, 24, 3);

  ctx.fillStyle = '#b8960a';
  ctx.fillRect(cx - 11, 33, 22, 4);

  ctx.fillStyle = '#6a4020';
  ctx.beginPath();
  ctx.ellipse(cx, 21, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2a12';
  ctx.beginPath();
  ctx.ellipse(cx, 21, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8a3010';
  ctx.fillRect(cx - 8, 30, 3, 2);
  ctx.fillRect(cx + 4, 44, 4, 2);
  ctx.fillRect(cx - 5, 50, 2, 3);

  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(cx - 2, 34, 4, 3);

  return texFromCanvas(canvas, ctx);
}

function generateTerminalTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - 18, 48, 36, 6);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 18, 53, 36, 3);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 16, 18, 32, 32);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 15, 19, 30, 28);

  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(cx - 12, 22, 24, 22);

  ctx.fillStyle = '#33cc33';
  ctx.fillRect(cx - 10, 25, 14, 2);
  ctx.fillRect(cx - 10, 29, 10, 2);
  ctx.fillRect(cx - 10, 33, 16, 2);
  ctx.fillRect(cx - 10, 37, 8, 2);

  ctx.fillStyle = '#66ff66';
  ctx.fillRect(cx - 2, 37, 2, 2);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#33cc33';
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(51, 204, 51, 0.15)';
  ctx.fillRect(cx - 12, 22, 24, 22);
  ctx.restore();

  ctx.fillStyle = '#ff3300';
  ctx.fillRect(cx + 10, 46, 2, 2);

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 14, 44, 28, 4);
  ctx.fillStyle = '#666';
  for (let k = 0; k < 8; k++) {
    ctx.fillRect(cx - 12 + k * 3, 45, 2, 2);
  }

  return texFromCanvas(canvas, ctx);
}

function generateLampTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 2, 30, 4, 30);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - 7, 57, 14, 4);

  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 8, 18, 16, 14);

  ctx.fillStyle = '#ff8800';
  ctx.fillRect(cx - 6, 20, 12, 10);

  ctx.save();
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.8)';
  ctx.fillRect(cx - 5, 21, 10, 8);
  ctx.restore();

  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(cx - 3, 23, 6, 4);

  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 5, 16, 10, 3);

  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 8, 18, 2, 14);
  ctx.fillRect(cx + 6, 18, 2, 14);

  return texFromCanvas(canvas, ctx);
}

function generateDebrisTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(cx - 18, 48);
  ctx.lineTo(cx - 12, 38);
  ctx.lineTo(cx + 2, 35);
  ctx.lineTo(cx + 16, 40);
  ctx.lineTo(cx + 20, 48);
  ctx.lineTo(cx + 10, 50);
  ctx.lineTo(cx - 5, 50);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#6a3020';
  ctx.fillRect(cx - 10, 40, 6, 3);
  ctx.fillRect(cx + 6, 43, 5, 2);

  ctx.fillStyle = '#1a4a1a';
  ctx.fillRect(cx + 8, 36, 10, 8);
  ctx.fillStyle = '#2a6a2a';
  ctx.fillRect(cx + 10, 38, 6, 4);

  ctx.fillStyle = '#b8960a';
  ctx.fillRect(cx + 10, 37, 2, 1);
  ctx.fillRect(cx + 14, 37, 2, 1);

  ctx.strokeStyle = '#5a2020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 16, 44);
  ctx.quadraticCurveTo(cx - 22, 48, cx - 20, 52);
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 4, 36, 2, 2);
  ctx.fillRect(cx + 14, 38, 1, 2);

  return texFromCanvas(canvas, ctx);
}

/* ------------------------------------------------------------------ */
/* Weapon pickup textures                                              */
/* ------------------------------------------------------------------ */

function generateShotgunFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const cy = 36;

  // Main barrel (double barrel appearance - brown/orange cylinder)
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(cx - 22, cy - 4, 44, 8);

  // Barrel highlight
  ctx.fillStyle = '#A0703A';
  ctx.fillRect(cx - 20, cy - 3, 40, 3);

  // Barrel tip (metallic, right side)
  ctx.fillStyle = '#888';
  ctx.fillRect(cx + 20, cy - 5, 6, 10);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(cx + 22, cy - 4, 3, 8);

  // Dark opening
  ctx.fillStyle = '#222';
  ctx.fillRect(cx + 24, cy - 2, 2, 4);

  // Stock (wood, left side)
  ctx.fillStyle = '#6B4226';
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 4);
  ctx.lineTo(cx - 30, cy + 2);
  ctx.lineTo(cx - 30, cy + 10);
  ctx.lineTo(cx - 22, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Wood grain on stock
  ctx.fillStyle = '#7A5030';
  ctx.fillRect(cx - 28, cy + 3, 4, 1);
  ctx.fillRect(cx - 26, cy + 6, 3, 1);

  // Pump under barrel
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 5, cy + 4, 14, 5);
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 3, cy + 5, 10, 3);

  // Trigger guard
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - 10, cy + 10, 5, 0, Math.PI);
  ctx.stroke();

  // Subtle glow
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#ff8833';
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(255, 136, 51, 0.15)';
  ctx.fillRect(cx - 22, cy - 5, 44, 12);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateShotgunBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const cy = 36;

  // Simpler back view - barrel tube
  ctx.fillStyle = '#6B4226';
  ctx.fillRect(cx - 22, cy - 3, 44, 6);

  // Stock back
  ctx.fillStyle = '#5A3520';
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 3);
  ctx.lineTo(cx - 28, cy + 1);
  ctx.lineTo(cx - 28, cy + 9);
  ctx.lineTo(cx - 22, cy + 3);
  ctx.closePath();
  ctx.fill();

  // Pump back (darker)
  ctx.fillStyle = '#444';
  ctx.fillRect(cx - 5, cy + 3, 14, 4);

  // Darker overall tone (back is less lit)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateRocketLauncherFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const cy = 34;

  // Main tube (dark gray)
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 24, cy - 6, 40, 12);

  // Tube highlight
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 22, cy - 5, 36, 4);

  // Tube shadow
  ctx.fillStyle = '#444';
  ctx.fillRect(cx - 22, cy + 2, 36, 4);

  // Red warhead tip (right side)
  ctx.fillStyle = '#cc2222';
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 6);
  ctx.lineTo(cx + 28, cy);
  ctx.lineTo(cx + 16, cy + 6);
  ctx.closePath();
  ctx.fill();

  // Warhead highlight
  ctx.fillStyle = '#ee3333';
  ctx.beginPath();
  ctx.moveTo(cx + 17, cy - 4);
  ctx.lineTo(cx + 25, cy);
  ctx.lineTo(cx + 17, cy + 1);
  ctx.closePath();
  ctx.fill();

  // Dark opening
  ctx.fillStyle = '#222';
  ctx.fillRect(cx + 26, cy - 2, 3, 4);

  // Green fuel tank below tube
  ctx.fillStyle = '#228B22';
  ctx.fillRect(cx - 10, cy + 6, 20, 8);
  ctx.fillStyle = '#2EA02E';
  ctx.fillRect(cx - 8, cy + 7, 16, 4);

  // Tank stripe
  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(cx - 2, cy + 6, 4, 8);

  // Stock (left side)
  ctx.fillStyle = '#5A3520';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 6);
  ctx.lineTo(cx - 32, cy);
  ctx.lineTo(cx - 32, cy + 8);
  ctx.lineTo(cx - 24, cy + 6);
  ctx.closePath();
  ctx.fill();

  // Sight on top
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 2, cy - 8, 8, 3);
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 1, cy - 7, 2, 1);

  // Trigger guard
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 2, 4, 0, Math.PI);
  ctx.stroke();

  // Glow effect
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255, 68, 0, 0.15)';
  ctx.fillRect(cx - 24, cy - 7, 52, 22);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateRocketLauncherBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const cy = 34;

  // Tube back (darker)
  ctx.fillStyle = '#444';
  ctx.fillRect(cx - 24, cy - 5, 40, 10);

  // Tube shadow (underside)
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - 22, cy + 1, 36, 4);

  // Warhead back (no visible tip from behind, just blunt end)
  ctx.fillStyle = '#882222';
  ctx.fillRect(cx + 16, cy - 5, 6, 10);

  // Fuel tank
  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(cx - 10, cy + 5, 20, 7);
  ctx.fillStyle = '#1e7a1e';
  ctx.fillRect(cx - 8, cy + 6, 16, 3);

  // Tank stripe
  ctx.fillStyle = '#145214';
  ctx.fillRect(cx - 2, cy + 5, 4, 7);

  // Stock back
  ctx.fillStyle = '#4a2a15';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 5);
  ctx.lineTo(cx - 30, cy);
  ctx.lineTo(cx - 30, cy + 7);
  ctx.lineTo(cx - 24, cy + 5);
  ctx.closePath();
  ctx.fill();

  // Sight back (simpler)
  ctx.fillStyle = '#555';
  ctx.fillRect(cx, cy - 7, 6, 2);

  // Darker overall
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

/* ------------------------------------------------------------------ */
/* Corpse texture — flat top-down bloodied body                        */
/* ------------------------------------------------------------------ */

export function generateCorpseTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Blood pool — dark reddish-brown ellipse
  ctx.fillStyle = 'rgba(60, 15, 10, 0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 24, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer blood ring (darker, slightly larger)
  ctx.strokeStyle = 'rgba(40, 10, 8, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 26, 30, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Body silhouette — elongated blob, head at top, legs at bottom
  ctx.fillStyle = '#50140f';
  ctx.beginPath();
  // Head (rounded top)
  ctx.arc(cx, cy - 10, 9, 0, Math.PI * 2);
  ctx.fill();

  // Torso (widens from head)
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 2);
  ctx.quadraticCurveTo(cx - 14, cy + 4, cx - 13, cy + 10);
  ctx.lineTo(cx + 13, cy + 10);
  ctx.quadraticCurveTo(cx + 14, cy + 4, cx + 7, cy - 2);
  ctx.fill();

  // Arms — splayed out to sides
  ctx.fillStyle = '#50140f';
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy);
  ctx.quadraticCurveTo(cx - 18, cy - 4, cx - 22, cy + 2);
  ctx.quadraticCurveTo(cx - 24, cy + 6, cx - 18, cy + 8);
  ctx.quadraticCurveTo(cx - 14, cy + 4, cx - 7, cy + 6);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 7, cy);
  ctx.quadraticCurveTo(cx + 18, cy - 4, cx + 22, cy + 2);
  ctx.quadraticCurveTo(cx + 24, cy + 6, cx + 18, cy + 8);
  ctx.quadraticCurveTo(cx + 14, cy + 4, cx + 7, cy + 6);
  ctx.fill();

  // Legs — slightly separated, ending in feet
  ctx.fillStyle = '#401008';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 10);
  ctx.quadraticCurveTo(cx - 9, cy + 20, cx - 10, cy + 26);
  ctx.quadraticCurveTo(cx - 12, cy + 30, cx - 6, cy + 32);
  ctx.quadraticCurveTo(cx - 2, cy + 32, cx - 2, cy + 28);
  ctx.quadraticCurveTo(cx - 3, cy + 22, cx - 3, cy + 10);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 3, cy + 10);
  ctx.quadraticCurveTo(cx + 4, cy + 20, cx + 7, cy + 26);
  ctx.quadraticCurveTo(cx + 9, cy + 30, cx + 13, cy + 28);
  ctx.quadraticCurveTo(cx + 14, cy + 24, cx + 11, cy + 20);
  ctx.quadraticCurveTo(cx + 9, cy + 14, cx + 7, cy + 10);
  ctx.fill();

  // Darker shading in center
  ctx.fillStyle = 'rgba(40, 8, 5, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  return texFromCanvas(canvas, ctx);
}
