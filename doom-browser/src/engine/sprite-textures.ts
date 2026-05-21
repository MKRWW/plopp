import { Texture } from './textures';
import { SpriteType } from './sprite';

const SPRITE_TEXTURE_SIZE = 64;

const HUSK_SHADOW    = '#05080a';
const HUSK_CARAPACE  = '#0a0d10';
const HUSK_PLATE     = '#173e4a';
const HUSK_PLATE_LIT = '#246079';
const HUSK_UNDERSIDE = '#1a2228';
const HUSK_EYE_DIM   = '#1c4a55';
const HUSK_EYE       = '#3aa7b8';
const HUSK_EYE_HOT   = '#7be8f8';
const HUSK_BLADE     = '#2b2f33';
const HUSK_BLADE_LIT = '#4d575e';

const SPITTER_SHADOW     = '#070410';
const SPITTER_FLESH      = '#1a0f1f';
const SPITTER_FLESH_LIT  = '#3b1d4a';
const SPITTER_FLESH_RIM  = '#7a3a8a';
const SPITTER_LEG        = '#15090d';
const SPITTER_LEG_LIT    = '#2a161b';
const SPITTER_EYE_WHITE  = '#d8c7b5';
const SPITTER_EYE_IRIS   = '#1a0a0a';
const SPITTER_EMITTER    = '#5a6618';
const SPITTER_BIO        = '#c8e040';
const SPITTER_BIO_HOT    = '#f4ff8a';

type EnemyPose = 'idle' | 'walk' | 'attack';
type EnemyView = 'front' | 'frontQuarter' | 'side' | 'backQuarter' | 'back';

/**
 * Result of generateSpriteTextures:
 * - flat: single-frame texture arrays per type (Items + Decor + Enemy fallback)
 * - huskAngleViews: [poseIdx 0..2][angleIdx 0..7] for ENEMY (Grunt/Husk) 8-direction rendering
 * - spitterAngleViews: [poseIdx 0..2][angleIdx 0..7] for SHOOTER (Spitter) 8-direction rendering
 */
export interface SpriteTextureSet {
  flat: Map<SpriteType, Texture[]>;
  huskAngleViews: Texture[][];
  spitterAngleViews: Texture[][];
}

export const huskCorpseTexture = generateHuskCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

export const spitterCorpseTexture = generateSpitterCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

export function generateSpriteTextures(): SpriteTextureSet {
  const flat = new Map<SpriteType, Texture[]>();

  // Husk (Grunt): legacy frontal frames as fallback (idle/walk/attack)
  flat.set(SpriteType.ENEMY, [
    generateHuskTexture('idle', 'front', false),
    generateHuskTexture('walk', 'front', false),
    generateHuskTexture('attack', 'front', false)
  ]);

  // Spitter (Shooter): frontal frames as fallback (idle/walk/attack)
  flat.set(SpriteType.SHOOTER, [
    generateSpitterTexture('idle', 'front', false),
    generateSpitterTexture('walk', 'front', false),
    generateSpitterTexture('attack', 'front', false)
  ]);

  // 8-direction angle views per pose for both enemy types
  const poses: EnemyPose[] = ['idle', 'walk', 'attack'];
  const huskAngleViews: Texture[][] = poses.map(pose => buildHuskAngleViews(pose));
  const spitterAngleViews: Texture[][] = poses.map(pose => buildSpitterAngleViews(pose));

  // Rotating items: 8 frames each
  flat.set(SpriteType.AMMO, buildRotatingItemFrames(generateAmmoFront, generateAmmoBack));
  flat.set(SpriteType.HEALTH, buildRotatingItemFrames(generateHealthFront, generateHealthBack));
  flat.set(SpriteType.KEYCARD, buildRotatingItemFrames(generateKeycardFront, generateKeycardBack));
  flat.set(SpriteType.YELLOW_KEYCARD, buildRotatingItemFrames(generateYellowKeycardFront, generateYellowKeycardBack));

   // Weapon pickups: 8-frame rotating sprites
   flat.set(SpriteType.WEAPON_SHOTGUN, buildRotatingItemFrames(generateShotgunFront, generateShotgunBack));
   flat.set(SpriteType.WEAPON_ROCKETLAUNCHER, buildRotatingItemFrames(generateRocketLauncherFront, generateRocketLauncherBack));

   // Decor (single frame, no shadow baked in)
   flat.set(SpriteType.BARREL, [generateBarrelTexture()]);
   flat.set(SpriteType.TERMINAL, [generateTerminalTexture()]);
   flat.set(SpriteType.LAMP, [generateLampTexture()]);
   flat.set(SpriteType.DEBRIS, [generateDebrisTexture()]);

   return { flat, huskAngleViews, spitterAngleViews };
}

/* ------------------------------------------------------------------ */
/* Enemy 8-direction generation                                        */
/* ------------------------------------------------------------------ */

function buildHuskAngleViews(pose: EnemyPose): Texture[] {
  // Indices: 0=front, 1=frontQuarter, 2=side, 3=backQuarter, 4=back,
  //          5=backQuarter mirrored, 6=side mirrored, 7=frontQuarter mirrored
  return [
    generateHuskTexture(pose, 'front', false),
    generateHuskTexture(pose, 'frontQuarter', false),
    generateHuskTexture(pose, 'side', false),
    generateHuskTexture(pose, 'backQuarter', false),
    generateHuskTexture(pose, 'back', false),
    generateHuskTexture(pose, 'backQuarter', true),
    generateHuskTexture(pose, 'side', true),
    generateHuskTexture(pose, 'frontQuarter', true)
  ];
}

function buildSpitterAngleViews(pose: EnemyPose): Texture[] {
  // Indices: 0=front, 1=frontQuarter, 2=side, 3=backQuarter, 4=back,
  //          5=backQuarter mirrored, 6=side mirrored, 7=frontQuarter mirrored
  return [
    generateSpitterTexture(pose, 'front', false),
    generateSpitterTexture(pose, 'frontQuarter', false),
    generateSpitterTexture(pose, 'side', false),
    generateSpitterTexture(pose, 'backQuarter', false),
    generateSpitterTexture(pose, 'back', false),
    generateSpitterTexture(pose, 'backQuarter', true),
    generateSpitterTexture(pose, 'side', true),
    generateSpitterTexture(pose, 'frontQuarter', true)
  ];
}

function generateHuskTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
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
      drawHuskFront(ctx, pose);
      break;
    case 'frontQuarter':
      drawHuskFrontQuarter(ctx, pose);
      break;
    case 'side':
      drawHuskSide(ctx, pose);
      break;
    case 'backQuarter':
      drawHuskBackQuarter(ctx, pose);
      break;
    case 'back':
      drawHuskBack(ctx, pose);
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

function generateSpitterTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  switch (view) {
    case 'front':
      drawSpitterFront(ctx, pose);
      break;
    case 'frontQuarter':
      drawSpitterFrontQuarter(ctx, pose);
      break;
    case 'side':
      drawSpitterSide(ctx, pose);
      break;
    case 'backQuarter':
      drawSpitterBackQuarter(ctx, pose);
      break;
    case 'back':
      drawSpitterBack(ctx, pose);
      break;
  }

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

/* ----- Husk Front view (insectoid alien) ----- */

function drawHuskFront(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  drawHuskShadow(ctx);
  drawHuskLegs(ctx, pose);
  drawHuskBody(ctx, pose);
  drawHuskMantisArms(ctx, pose);
  drawHuskEyeBand(ctx, pose);
}

function drawHuskShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = HUSK_SHADOW;
  ctx.beginPath();
  ctx.ellipse(32, 58, 12, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHuskLegs(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  let leftThighX: number;
  let rightThighX: number;
  let leftShinX: number;
  let rightShinX: number;
  let leftClaw1X: number, leftClaw2X: number;
  let rightClaw1X: number, rightClaw2X: number;

  if (pose === 'attack') {
    leftThighX = cx - 18;  rightThighX = cx + 14;
    leftShinX  = cx - 22;  rightShinX  = cx + 18;
    leftClaw1X = cx - 24;  leftClaw2X  = cx - 20;
    rightClaw1X = cx + 20; rightClaw2X = cx + 24;
  } else if (pose === 'walk') {
    leftThighX = cx - 13;  rightThighX = cx + 11;
    leftShinX  = cx - 15;  rightShinX  = cx + 14;
    leftClaw1X = cx - 17;  leftClaw2X  = cx - 13;
    rightClaw1X = cx + 14; rightClaw2X = cx + 18;
  } else {
    leftThighX = cx - 15;  rightThighX = cx + 11;
    leftShinX  = cx - 18;  rightShinX  = cx + 14;
    leftClaw1X = cx - 20;  leftClaw2X  = cx - 16;
    rightClaw1X = cx + 14; rightClaw2X = cx + 18;
  }

  // Oberschenkel
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(leftThighX,  42, 4, 10);
  ctx.fillRect(rightThighX, 42, 4, 10);

  // Unterschenkel
  ctx.fillStyle = HUSK_PLATE;
  ctx.fillRect(leftShinX,  50, 4, 8);
  ctx.fillRect(rightShinX, 50, 4, 8);

  // Klauen (je 2 pro Bein)
  ctx.fillStyle = HUSK_BLADE;
  ctx.fillRect(leftClaw1X,  57, 3, 2);
  ctx.fillRect(leftClaw2X,  57, 3, 2);
  ctx.fillRect(rightClaw1X, 57, 3, 2);
  ctx.fillRect(rightClaw2X, 57, 3, 2);
}

function drawHuskBody(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  // Merged thorax + head: oval, segmented, ~24 px tall, ~26 px wide
  const bodyTop = pose === 'attack' ? 17 : 18;
  const bodyBottom = 42;

  // Base silhouette - dark carapace
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(cx, (bodyTop + bodyBottom) / 2, 13, (bodyBottom - bodyTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 horizontal carapace segments
  const segHeight = (bodyBottom - bodyTop) / 3;
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    const segBottom = segTop + segHeight;

    // Segment fill
    ctx.fillStyle = HUSK_PLATE;
    ctx.beginPath();
    ctx.ellipse(cx, (segTop + segBottom) / 2, 12, segHeight / 2 - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top rim highlight
    ctx.fillStyle = HUSK_PLATE_LIT;
    ctx.fillRect(cx - 11, segTop, 22, 1);
  }

  // Underside shadow at bottom
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.beginPath();
  ctx.ellipse(cx, bodyBottom - 2, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHuskMantisArms(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  if (pose === 'attack') {
    // Arms raised and forward, blades above head

    // Left arm segments
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, 28);
    ctx.lineTo(cx - 18, 20);
    ctx.lineTo(cx - 22, 10);
    ctx.stroke();

    // Right arm segments
    ctx.beginPath();
    ctx.moveTo(cx + 12, 28);
    ctx.lineTo(cx + 18, 20);
    ctx.lineTo(cx + 22, 10);
    ctx.stroke();

    // Scythe blades
    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 22, 10);
    ctx.quadraticCurveTo(cx - 26, 4, cx - 20, 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 22, 10);
    ctx.quadraticCurveTo(cx + 26, 4, cx + 20, 2);
    ctx.stroke();

    // Blade edge highlight
    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 21, 9);
    ctx.quadraticCurveTo(cx - 24, 5, cx - 20, 3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 21, 9);
    ctx.quadraticCurveTo(cx + 24, 5, cx + 20, 3);
    ctx.stroke();

    ctx.lineWidth = 1;
  } else {
    // Arms hanging diagonally forward-down, slightly bent (idle/walk)

    // Left arm
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, 28);
    ctx.lineTo(cx - 16, 38);
    ctx.lineTo(cx - 18, 48);
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx + 12, 28);
    ctx.lineTo(cx + 16, 38);
    ctx.lineTo(cx + 18, 48);
    ctx.stroke();

    // Scythe blades (curved, pointing down-forward)
    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 18, 48);
    ctx.quadraticCurveTo(cx - 20, 52, cx - 16, 56);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 18, 48);
    ctx.quadraticCurveTo(cx + 20, 52, cx + 16, 56);
    ctx.stroke();

    // Blade edge highlight
    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 17, 49);
    ctx.quadraticCurveTo(cx - 19, 52, cx - 16, 55);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 17, 49);
    ctx.quadraticCurveTo(cx + 19, 52, cx + 16, 55);
    ctx.stroke();

    ctx.lineWidth = 1;
  }
}

function drawHuskEyeBand(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const y = 24;

  let eyeColor: string;
  if (pose === 'idle') eyeColor = HUSK_EYE_DIM;
  else if (pose === 'walk') eyeColor = HUSK_EYE;
  else {
    eyeColor = HUSK_EYE_HOT;
    ctx.shadowColor = HUSK_EYE_HOT;
    ctx.shadowBlur = 6;
  }

  ctx.fillStyle = eyeColor;

  // 3 glow points, each 2x2 px
  ctx.fillRect(cx - 7, y, 2, 2);
  ctx.fillRect(cx - 1, y, 2, 2);
  ctx.fillRect(cx + 5, y, 2, 2);

  // Always reset shadow
  ctx.shadowBlur = 0;
}

/* ----- Spitter Front view (tripod alien) ----- */

function drawSpitterFront(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  drawSpitterShadow(ctx);
  drawSpitterTripodLegs(ctx, pose);
  drawSpitterThorax(ctx, pose);
  drawSpitterEmitterArm(ctx, pose);
  drawSpitterEyeStalk(ctx, pose);
}

function drawSpitterShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SPITTER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(32, 60, 14, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpitterTripodLeg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, footX: number, footY: number): void {
  const kneeY = hipY + (footY - hipY) * 0.5;
  const kneeX = hipX + (footX - hipX) * 0.5;

  // Upper segment
  ctx.strokeStyle = SPITTER_LEG;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.stroke();

  // Lower segment
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  // Outer-edge highlight
  ctx.strokeStyle = SPITTER_LEG_LIT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hipX + (footX < hipX ? -1 : 1), hipY);
  ctx.lineTo(footX + (footX < hipX ? -1 : 1), footY);
  ctx.stroke();

  ctx.lineWidth = 1;
}

function drawSpitterTripodLegs(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  let blHipX: number, blHipY: number, blFootX: number, blFootY: number;
  let brHipX: number, brHipY: number, brFootX: number, brFootY: number;
  let fcHipX: number, fcHipY: number, fcFootX: number, fcFootY: number;

  if (pose === 'walk') {
    // Front-center leg lifted 2px
    blHipX = cx - 10; blHipY = 36;  blFootX = cx - 12; blFootY = 58;
    brHipX = cx + 10; brHipY = 36;  brFootX = cx + 12; brFootY = 58;
    fcHipX = cx;      fcHipY = 36;  fcFootX = cx;      fcFootY = 57;
  } else if (pose === 'attack') {
    // All legs in standard fixed position
    blHipX = cx - 10; blHipY = 36;  blFootX = cx - 12; blFootY = 58;
    brHipX = cx + 10; brHipY = 36;  brFootX = cx + 12; brFootY = 58;
    fcHipX = cx;      fcHipY = 38;  fcFootX = cx;      fcFootY = 59;
  } else {
    // idle — standard tripod
    blHipX = cx - 10; blHipY = 36;  blFootX = cx - 12; blFootY = 58;
    brHipX = cx + 10; brHipY = 36;  brFootX = cx + 12; brFootY = 58;
    fcHipX = cx;      fcHipY = 38;  fcFootX = cx;      fcFootY = 59;
  }

  // Back legs first (drawn behind), then front leg (foreground)
  drawSpitterTripodLeg(ctx, blHipX, blHipY, blFootX, blFootY);
  drawSpitterTripodLeg(ctx, brHipX, brHipY, brFootX, brFootY);
  drawSpitterTripodLeg(ctx, fcHipX, fcHipY, fcFootX, fcFootY);
}

function drawSpitterThorax(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  const top = pose === 'attack' ? 11 : 12;
  const bottom = pose === 'attack' ? 37 : 36;
  const midW = pose === 'attack' ? 15 : 14;
  const topW = pose === 'attack' ? 7 : 6;
  const bottomW = pose === 'attack' ? 10 : 9;

  // Base fill
  ctx.fillStyle = SPITTER_FLESH;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // Gradient overlay
  const grad = ctx.createLinearGradient(cx, top, cx, bottom);
  grad.addColorStop(0, SPITTER_FLESH_LIT);
  grad.addColorStop(1, SPITTER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // Rim highlight top-right
  ctx.strokeStyle = SPITTER_FLESH_RIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 8, 14);
  ctx.lineTo(cx + 12, 22);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawSpitterEmitterArm(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  // Arm path: start → knee → end (orifice)
  ctx.strokeStyle = SPITTER_FLESH;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + 12, 28);
  ctx.quadraticCurveTo(cx + 16, 36, cx + 18, 44);
  ctx.stroke();

  // Top-edge highlight
  ctx.strokeStyle = SPITTER_FLESH_RIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 10, 27);
  ctx.quadraticCurveTo(cx + 14, 35, cx + 16, 43);
  ctx.stroke();

  // Orifice at end
  if (pose === 'attack') {
    ctx.shadowColor = SPITTER_BIO_HOT;
    ctx.shadowBlur = 8;
    ctx.fillStyle = SPITTER_BIO_HOT;
    ctx.beginPath();
    ctx.arc(cx + 18, 44, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = SPITTER_EMITTER;
    ctx.beginPath();
    ctx.arc(cx + 18, 44, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bio droplet in center
    ctx.fillStyle = SPITTER_BIO;
    ctx.beginPath();
    ctx.arc(cx + 18, 44, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpitterEyeStalk(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;

  // Stalk from thorax top to eye base
  ctx.strokeStyle = SPITTER_FLESH_LIT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 12);
  ctx.lineTo(cx, 4);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Eye at top of stalk
  let irisY: number;
  let scleraR: number;

  if (pose === 'idle') {
    irisY = 4;
    scleraR = 2.5;
  } else if (pose === 'walk') {
    irisY = 5;
    scleraR = 2.5;
  } else {
    // attack — eye wide open
    irisY = 6;
    scleraR = 3;
  }

  // Sclera
  ctx.fillStyle = SPITTER_EYE_WHITE;
  ctx.beginPath();
  ctx.arc(cx, 4, scleraR, 0, Math.PI * 2);
  ctx.fill();

  // Iris
  ctx.fillStyle = SPITTER_EYE_IRIS;
  ctx.beginPath();
  ctx.arc(cx, irisY, 1, 0, Math.PI * 2);
  ctx.fill();
}

/* ----- Spitter Quarter / Side / Back views ----- */

function drawSpitterFrontQuarter(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const sx = 0.85;
  const off = 3;
  const bodyCx = cx + off;
  const attacking = pose === 'attack';
  const walking = pose === 'walk';

  // Shadow (asymmetric, shifted toward foreground/right)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SPITTER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 2, 60, 12, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tripod legs (back first, front last)
  // Back-left leg
  ctx.strokeStyle = SPITTER_LEG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - Math.round(10 * sx) + off, 36);
  ctx.lineTo(cx - Math.round(12 * sx) + off, 58);
  ctx.stroke();

  // Back-right leg
  ctx.beginPath();
  ctx.moveTo(cx + Math.round(10 * sx) + off, 36);
  ctx.lineTo(cx + Math.round(12 * sx) + off, 58);
  ctx.stroke();

  // Front-center leg (largest, in foreground)
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (walking) {
    ctx.moveTo(cx + 3, 36);
    ctx.lineTo(cx + 3, 57);
  } else if (attacking) {
    ctx.moveTo(cx + 3, 38);
    ctx.lineTo(cx + 3, 59);
  } else {
    ctx.moveTo(cx + 3, 38);
    ctx.lineTo(cx + 3, 59);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  // Thorax (compressed droplet, shifted right)
  const top = attacking ? 11 : 12;
  const bottom = attacking ? 37 : 36;
  const midW = attacking ? Math.round(14 * sx) : Math.round(12 * sx);
  const topW = attacking ? Math.round(6 * sx) : Math.round(5 * sx);
  const bottomW = attacking ? Math.round(9 * sx) : Math.round(8 * sx);

  ctx.fillStyle = SPITTER_FLESH;
  ctx.beginPath();
  ctx.moveTo(bodyCx, top);
  ctx.quadraticCurveTo(bodyCx - midW, (top + 24) / 2, bodyCx - midW, 24);
  ctx.quadraticCurveTo(bodyCx - midW, (24 + bottom) / 2, bodyCx - bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx, bottom + 2, bodyCx + bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx + midW, (bottom + 24) / 2, bodyCx + midW, 24);
  ctx.quadraticCurveTo(bodyCx + midW, (24 + top) / 2, bodyCx + topW, top);
  ctx.quadraticCurveTo(bodyCx, top - 2, bodyCx, top);
  ctx.fill();

  // Gradient overlay
  const grad = ctx.createLinearGradient(bodyCx, top, bodyCx, bottom);
  grad.addColorStop(0, SPITTER_FLESH_LIT);
  grad.addColorStop(1, SPITTER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(bodyCx, top);
  ctx.quadraticCurveTo(bodyCx - midW, (top + 24) / 2, bodyCx - midW, 24);
  ctx.quadraticCurveTo(bodyCx - midW, (24 + bottom) / 2, bodyCx - bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx, bottom + 2, bodyCx + bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx + midW, (bottom + 24) / 2, bodyCx + midW, 24);
  ctx.quadraticCurveTo(bodyCx + midW, (24 + top) / 2, bodyCx + topW, top);
  ctx.quadraticCurveTo(bodyCx, top - 2, bodyCx, top);
  ctx.fill();

  // Rim highlight (compressed, shifted right)
  ctx.strokeStyle = SPITTER_FLESH_RIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyCx + Math.round(8 * sx), 14);
  ctx.lineTo(bodyCx + Math.round(12 * sx), 22);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Emitter arm (foreground/right, visible)
  ctx.strokeStyle = SPITTER_FLESH;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bodyCx + Math.round(10 * sx), 28);
  ctx.quadraticCurveTo(bodyCx + Math.round(14 * sx), 36, bodyCx + Math.round(16 * sx), 44);
  ctx.stroke();

  // Arm highlight
  ctx.strokeStyle = SPITTER_FLESH_RIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bodyCx + Math.round(8 * sx), 27);
  ctx.quadraticCurveTo(bodyCx + Math.round(12 * sx), 35, bodyCx + Math.round(14 * sx), 43);
  ctx.stroke();

  // Orifice
  if (attacking) {
    ctx.shadowColor = SPITTER_BIO_HOT;
    ctx.shadowBlur = 8;
    ctx.fillStyle = SPITTER_BIO_HOT;
    ctx.beginPath();
    ctx.arc(bodyCx + Math.round(16 * sx), 44, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = SPITTER_EMITTER;
    ctx.beginPath();
    ctx.arc(bodyCx + Math.round(16 * sx), 44, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SPITTER_BIO;
    ctx.beginPath();
    ctx.arc(bodyCx + Math.round(16 * sx), 44, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye stalk
  ctx.strokeStyle = SPITTER_FLESH_LIT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyCx, 4);
  ctx.lineTo(bodyCx, 12);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Iris Y from pose
  let irisY: number;
  if (walking) {
    irisY = 5;
  } else if (attacking) {
    irisY = 6;
  } else {
    irisY = 4;
  }

  // Sclera
  let scleraR = attacking ? 3 : 2.5;
  ctx.fillStyle = SPITTER_EYE_WHITE;
  ctx.beginPath();
  ctx.arc(bodyCx, 4, scleraR, 0, Math.PI * 2);
  ctx.fill();

  // Iris (offset slightly toward foreground = +1 px right)
  ctx.fillStyle = SPITTER_EYE_IRIS;
  ctx.beginPath();
  ctx.arc(bodyCx + 1, irisY, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpitterSide(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const attacking = pose === 'attack';
  const walking = pose === 'walk';

  // Shadow (narrower)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SPITTER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 1, 60, 10, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs (profile: front-center + 1 visible back + 1 hidden hint)
  // Hidden back leg (1px thin line)
  ctx.strokeStyle = SPITTER_LEG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, 36);
  ctx.lineTo(cx - 6, 58);
  ctx.stroke();

  // Visible back leg
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 4, 36);
  ctx.lineTo(cx - 6, 58);
  ctx.stroke();

  // Front-center leg
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (walking) {
    ctx.moveTo(cx, 36);
    ctx.lineTo(cx, 57);
  } else if (attacking) {
    ctx.moveTo(cx, 38);
    ctx.lineTo(cx, 59);
  } else {
    ctx.moveTo(cx, 38);
    ctx.lineTo(cx, 59);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  // Thorax (narrow profile ~14px wide)
  const top = attacking ? 11 : 12;
  const bottom = attacking ? 37 : 36;
  const midW = attacking ? 7 : 7;
  const topW = attacking ? 4 : 3;
  const bottomW = attacking ? 5 : 5;

  ctx.fillStyle = SPITTER_FLESH;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // Gradient overlay
  const grad = ctx.createLinearGradient(cx, top, cx, bottom);
  grad.addColorStop(0, SPITTER_FLESH_LIT);
  grad.addColorStop(1, SPITTER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // Rim highlight
  ctx.strokeStyle = SPITTER_FLESH_RIM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 5, 14);
  ctx.lineTo(cx + 7, 22);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Emitter arm (points FORWARD in movement direction = right)
  ctx.strokeStyle = SPITTER_FLESH;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 3, 28);
  ctx.quadraticCurveTo(cx + 10, 32, cx + 14, 36);
  ctx.stroke();

  // Orifice
  if (attacking) {
    ctx.shadowColor = SPITTER_BIO_HOT;
    ctx.shadowBlur = 8;
    ctx.fillStyle = SPITTER_BIO_HOT;
    ctx.beginPath();
    ctx.arc(cx + 14, 36, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = SPITTER_EMITTER;
    ctx.beginPath();
    ctx.arc(cx + 14, 36, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SPITTER_BIO;
    ctx.beginPath();
    ctx.arc(cx + 14, 36, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye stalk
  ctx.strokeStyle = SPITTER_FLESH_LIT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, 12);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Iris Y from pose
  let irisY: number;
  if (walking) {
    irisY = 5;
  } else if (attacking) {
    irisY = 6;
  } else {
    irisY = 4;
  }

  // Sclera (at top of stalk)
  let scleraR = attacking ? 3 : 2.5;
  ctx.fillStyle = SPITTER_EYE_WHITE;
  ctx.beginPath();
  ctx.arc(cx, 4, scleraR, 0, Math.PI * 2);
  ctx.fill();

  // Iris (turned toward side = +1 px toward movement direction)
  ctx.fillStyle = SPITTER_EYE_IRIS;
  ctx.beginPath();
  ctx.arc(cx + 1, irisY, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpitterBackQuarter(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const sx = 0.85;
  const off = 3;
  const bodyCx = cx + off;
  const attacking = pose === 'attack';
  const walking = pose === 'walk';

  // Shadow (asymmetric, shifted right)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SPITTER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 2, 60, 12, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tripod legs (no outer highlights — back is darker)
  // Back-left leg
  ctx.strokeStyle = SPITTER_LEG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - Math.round(10 * sx) + off, 36);
  ctx.lineTo(cx - Math.round(12 * sx) + off, 58);
  ctx.stroke();

  // Back-right leg
  ctx.beginPath();
  ctx.moveTo(cx + Math.round(10 * sx) + off, 36);
  ctx.lineTo(cx + Math.round(12 * sx) + off, 58);
  ctx.stroke();

  // Front-center leg
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (walking) {
    ctx.moveTo(cx + 3, 36);
    ctx.lineTo(cx + 3, 57);
  } else if (attacking) {
    ctx.moveTo(cx + 3, 38);
    ctx.lineTo(cx + 3, 59);
  } else {
    ctx.moveTo(cx + 3, 38);
    ctx.lineTo(cx + 3, 59);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  // Thorax back (same compressed droplet shape, no rim highlight)
  const top = attacking ? 11 : 12;
  const bottom = attacking ? 37 : 36;
  const midW = attacking ? Math.round(14 * sx) : Math.round(12 * sx);
  const topW = attacking ? Math.round(6 * sx) : Math.round(5 * sx);
  const bottomW = attacking ? Math.round(9 * sx) : Math.round(8 * sx);

  ctx.fillStyle = SPITTER_FLESH;
  ctx.beginPath();
  ctx.moveTo(bodyCx, top);
  ctx.quadraticCurveTo(bodyCx - midW, (top + 24) / 2, bodyCx - midW, 24);
  ctx.quadraticCurveTo(bodyCx - midW, (24 + bottom) / 2, bodyCx - bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx, bottom + 2, bodyCx + bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx + midW, (bottom + 24) / 2, bodyCx + midW, 24);
  ctx.quadraticCurveTo(bodyCx + midW, (24 + top) / 2, bodyCx + topW, top);
  ctx.quadraticCurveTo(bodyCx, top - 2, bodyCx, top);
  ctx.fill();

  // Gradient overlay (flesh_lit base, darker on back)
  const grad = ctx.createLinearGradient(bodyCx, top, bodyCx, bottom);
  grad.addColorStop(0, SPITTER_FLESH_LIT);
  grad.addColorStop(1, SPITTER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(bodyCx, top);
  ctx.quadraticCurveTo(bodyCx - midW, (top + 24) / 2, bodyCx - midW, 24);
  ctx.quadraticCurveTo(bodyCx - midW, (24 + bottom) / 2, bodyCx - bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx, bottom + 2, bodyCx + bottomW, bottom);
  ctx.quadraticCurveTo(bodyCx + midW, (bottom + 24) / 2, bodyCx + midW, 24);
  ctx.quadraticCurveTo(bodyCx + midW, (24 + top) / 2, bodyCx + topW, top);
  ctx.quadraticCurveTo(bodyCx, top - 2, bodyCx, top);
  ctx.fill();

  // 3 vertical sucking lines (darker on lighter base = SPITTER_FLESH on SPITTER_FLESH_LIT gradient)
  ctx.fillStyle = SPITTER_FLESH;
  ctx.fillRect(bodyCx - Math.round(5 * sx), 18, 1, 14);
  ctx.fillRect(bodyCx, 18, 1, 14);
  ctx.fillRect(bodyCx + Math.round(5 * sx), 18, 1, 14);

  // Emitter arm stump (short, no glow, no orifice)
  ctx.strokeStyle = SPITTER_FLESH;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bodyCx + Math.round(10 * sx), 28);
  ctx.lineTo(bodyCx + Math.round(14 * sx), 34);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Eye stalk (stalk + sclera only, no iris — looking away)
  ctx.strokeStyle = SPITTER_FLESH_LIT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyCx, 4);
  ctx.lineTo(bodyCx, 12);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Sclera (smaller, back of eye, uniformly light)
  ctx.fillStyle = SPITTER_EYE_WHITE;
  ctx.beginPath();
  ctx.arc(bodyCx, 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpitterBack(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const attacking = pose === 'attack';
  const walking = pose === 'walk';

  // Shadow (symmetric)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SPITTER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, 60, 14, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tripod legs (full width, symmetric, no outer highlights)
  let blHipX: number, blFootX: number;
  let brHipX: number, brFootX: number;
  let fcHipY: number, fcFootY: number;

  if (walking) {
    blHipX = cx - 10; blFootX = cx - 12;
    brHipX = cx + 10; brFootX = cx + 12;
    fcHipY = 36; fcFootY = 57;
  } else if (attacking) {
    blHipX = cx - 10; blFootX = cx - 12;
    brHipX = cx + 10; brFootX = cx + 12;
    fcHipY = 38; fcFootY = 59;
  } else {
    blHipX = cx - 10; blFootX = cx - 12;
    brHipX = cx + 10; brFootX = cx + 12;
    fcHipY = 38; fcFootY = 59;
  }

  // Back legs first
  ctx.strokeStyle = SPITTER_LEG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(blHipX, 36);
  ctx.lineTo(blFootX, 58);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(brHipX, 36);
  ctx.lineTo(brFootX, 58);
  ctx.stroke();

  // Front-center leg
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, fcHipY);
  ctx.lineTo(cx, fcFootY);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Thorax back (full width, no rim highlight)
  const top = attacking ? 11 : 12;
  const bottom = attacking ? 37 : 36;
  const midW = attacking ? 15 : 14;
  const topW = attacking ? 7 : 6;
  const bottomW = attacking ? 10 : 9;

  ctx.fillStyle = SPITTER_FLESH;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // Gradient overlay
  const grad = ctx.createLinearGradient(cx, top, cx, bottom);
  grad.addColorStop(0, SPITTER_FLESH_LIT);
  grad.addColorStop(1, SPITTER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx - midW, (top + 24) / 2, cx - midW, 24);
  ctx.quadraticCurveTo(cx - midW, (24 + bottom) / 2, cx - bottomW, bottom);
  ctx.quadraticCurveTo(cx, bottom + 2, cx + bottomW, bottom);
  ctx.quadraticCurveTo(cx + midW, (bottom + 24) / 2, cx + midW, 24);
  ctx.quadraticCurveTo(cx + midW, (24 + top) / 2, cx + topW, top);
  ctx.quadraticCurveTo(cx, top - 2, cx, top);
  ctx.fill();

  // 3 vertical sucking lines (centered)
  ctx.fillStyle = SPITTER_FLESH;
  ctx.fillRect(cx - 5, 18, 1, 14);
  ctx.fillRect(cx, 18, 1, 14);
  ctx.fillRect(cx + 5, 18, 1, 14);

  // No emitter arm (hidden behind body from right rear)

  // Eye stalk (stalk + sclera only, no iris)
  ctx.strokeStyle = SPITTER_FLESH_LIT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, 12);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Sclera (small, top partially obscured by body)
  ctx.fillStyle = SPITTER_EYE_WHITE;
  ctx.beginPath();
  ctx.arc(cx, 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

/* ----- Husk Quarter / Side / Back views ----- */

function drawHuskFrontQuarter(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const sx = 0.78;
  const off = 3;
  const bodyTop = pose === 'attack' ? 17 : 18;

  // Shadow (wider on foreground/right side)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = HUSK_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 2, 58, 14, 2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs (compressed, foreground leg slightly larger)
  let leftThighX: number, rightThighX: number;
  let leftShinX: number, rightShinX: number;
  let leftClaw1X: number, leftClaw2X: number;
  let rightClaw1X: number, rightClaw2X: number;

  if (pose === 'attack') {
    leftThighX  = cx - Math.round(18 * sx) + off;
    rightThighX = cx + Math.round(14 * sx) + off;
    leftShinX   = cx - Math.round(22 * sx) + off;
    rightShinX  = cx + Math.round(18 * sx) + off;
    leftClaw1X  = cx - Math.round(24 * sx) + off;  leftClaw2X  = cx - Math.round(20 * sx) + off;
    rightClaw1X = cx + Math.round(20 * sx) + off;  rightClaw2X = cx + Math.round(24 * sx) + off;
  } else if (pose === 'walk') {
    leftThighX  = cx - Math.round(13 * sx) + off;
    rightThighX = cx + Math.round(11 * sx) + off;
    leftShinX   = cx - Math.round(15 * sx) + off;
    rightShinX  = cx + Math.round(14 * sx) + off;
    leftClaw1X  = cx - Math.round(17 * sx) + off;  leftClaw2X  = cx - Math.round(13 * sx) + off;
    rightClaw1X = cx + Math.round(14 * sx) + off;  rightClaw2X = cx + Math.round(18 * sx) + off;
  } else {
    leftThighX  = cx - Math.round(15 * sx) + off;
    rightThighX = cx + Math.round(11 * sx) + off;
    leftShinX   = cx - Math.round(18 * sx) + off;
    rightShinX  = cx + Math.round(14 * sx) + off;
    leftClaw1X  = cx - Math.round(20 * sx) + off;  leftClaw2X  = cx - Math.round(16 * sx) + off;
    rightClaw1X = cx + Math.round(14 * sx) + off;  rightClaw2X = cx + Math.round(18 * sx) + off;
  }

  // Thighs (foreground leg slightly wider)
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(leftThighX,  42, Math.round(4 * sx), 10);
  ctx.fillRect(rightThighX, 42, 5, 10);

  // Shins
  ctx.fillStyle = HUSK_PLATE;
  ctx.fillRect(leftShinX,  50, Math.round(4 * sx), 8);
  ctx.fillRect(rightShinX, 50, 5, 8);

  // Claws
  ctx.fillStyle = HUSK_BLADE;
  ctx.fillRect(leftClaw1X,  57, Math.round(3 * sx), 2);
  ctx.fillRect(leftClaw2X,  57, Math.round(3 * sx), 2);
  ctx.fillRect(rightClaw1X, 57, 3, 2);
  ctx.fillRect(rightClaw2X, 57, 3, 2);

  // Body (compressed, shifted right)
  const bodyCx = cx + off;
  const bodyBottom = 42;
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(bodyCx, (bodyTop + bodyBottom) / 2, Math.round(13 * sx), (bodyBottom - bodyTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 horizontal carapace segments
  const segHeight = (bodyBottom - bodyTop) / 3;
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    const segBottom = segTop + segHeight;

    ctx.fillStyle = HUSK_PLATE;
    ctx.beginPath();
    ctx.ellipse(bodyCx, (segTop + segBottom) / 2, Math.round(12 * sx), segHeight / 2 - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top rim highlight (perspective: 1px left, 2px right)
    ctx.fillStyle = HUSK_PLATE_LIT;
    ctx.fillRect(bodyCx - Math.round(11 * sx), segTop, Math.round(22 * sx), 1);
    ctx.fillRect(bodyCx - 2, segTop, 3, 2);
  }

  // Underside shadow
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyBottom - 2, Math.round(10 * sx), 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mantis arms (foreground full, background reduced)
  // Foreground arm (right) - full size
  if (pose === 'attack') {
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.round(12 * sx) + off, 28);
    ctx.lineTo(cx + 18, 20);
    ctx.lineTo(cx + 22, 10);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 22, 10);
    ctx.quadraticCurveTo(cx + 26, 4, cx + 20, 2);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 21, 9);
    ctx.quadraticCurveTo(cx + 24, 5, cx + 20, 3);
    ctx.stroke();
  } else {
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.round(12 * sx) + off, 28);
    ctx.lineTo(cx + 16, 38);
    ctx.lineTo(cx + 18, 48);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 18, 48);
    ctx.quadraticCurveTo(cx + 20, 52, cx + 16, 56);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 17, 49);
    ctx.quadraticCurveTo(cx + 19, 52, cx + 16, 55);
    ctx.stroke();
  }

  // Background arm (left) - 50% width, darker
  ctx.strokeStyle = HUSK_UNDERSIDE;
  ctx.lineWidth = 1;
  if (pose === 'attack') {
    ctx.beginPath();
    ctx.moveTo(cx - Math.round(12 * sx) + off, 29);
    ctx.lineTo(cx - 16, 22);
    ctx.lineTo(cx - 18, 13);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - Math.round(12 * sx) + off, 29);
    ctx.lineTo(cx - 15, 38);
    ctx.lineTo(cx - 16, 46);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  // Eye band (only 2 visible glow points, left one hidden by carapace)
  let eyeColor: string;
  if (pose === 'idle') eyeColor = HUSK_EYE_DIM;
  else if (pose === 'walk') eyeColor = HUSK_EYE;
  else {
    eyeColor = HUSK_EYE_HOT;
    ctx.shadowColor = HUSK_EYE_HOT;
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = eyeColor;
  ctx.fillRect(cx - 1, 24, 2, 2);
  ctx.fillRect(cx + 5, 24, 2, 2);
  ctx.shadowBlur = 0;
}

function drawHuskSide(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const bodyTop = pose === 'attack' ? 17 : 18;
  const bodyBottom = 42;

  // Shadow (narrower, slightly offset)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = HUSK_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 1, 58, 10, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs (profile: 1 full leg, 1 thin line behind)
  let thighX: number, shinX: number;
  let claw1X: number, claw2X: number;

  if (pose === 'attack') {
    thighX = cx + 4;
    shinX  = cx + 8;
    claw1X = cx + 10;  claw2X = cx + 14;
  } else if (pose === 'walk') {
    thighX = cx + 2;
    shinX  = cx + 6;
    claw1X = cx + 8;   claw2X = cx + 12;
  } else {
    thighX = cx + 1;
    shinX  = cx + 4;
    claw1X = cx + 6;   claw2X = cx + 10;
  }

  // Visible leg (foreground)
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(thighX, 42, 4, 10);
  ctx.fillStyle = HUSK_PLATE;
  ctx.fillRect(shinX, 50, 4, 8);
  ctx.fillStyle = HUSK_BLADE;
  ctx.fillRect(claw1X, 57, 3, 2);
  ctx.fillRect(claw2X, 57, 3, 2);

  // Hidden leg (2px line behind in HUSK_CARAPACE)
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(cx - 4, 42, 2, 10);
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.fillRect(cx - 5, 50, 2, 8);

  // Body (compressed oval, ~14px wide)
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(cx, (bodyTop + bodyBottom) / 2, 7, (bodyBottom - bodyTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 segments (narrower)
  const segHeight = (bodyBottom - bodyTop) / 3;
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    const segBottom = segTop + segHeight;

    ctx.fillStyle = HUSK_PLATE;
    ctx.beginPath();
    ctx.ellipse(cx, (segTop + segBottom) / 2, 6, segHeight / 2 - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Segment lines (dark 1px lines across the narrow body)
    ctx.fillStyle = HUSK_UNDERSIDE;
    ctx.fillRect(cx - 5, segTop - 1, 10, 1);
  }

  // Top rim highlights
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    ctx.fillStyle = HUSK_PLATE_LIT;
    ctx.fillRect(cx - 5, segTop, 10, 1);
  }

  // Underside shadow
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.beginPath();
  ctx.ellipse(cx, bodyBottom - 2, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mantis arm (1 visible with full blade, 1 as short stump behind)
  if (pose === 'attack') {
    // Visible arm
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, 28);
    ctx.lineTo(cx + 14, 20);
    ctx.lineTo(cx + 18, 10);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 18, 10);
    ctx.quadraticCurveTo(cx + 22, 4, cx + 16, 2);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 17, 9);
    ctx.quadraticCurveTo(cx + 20, 5, cx + 16, 3);
    ctx.stroke();

    // Hidden arm (short dark stump)
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, 29);
    ctx.lineTo(cx - 7, 24);
    ctx.stroke();
  } else {
    // Visible arm
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, 28);
    ctx.lineTo(cx + 10, 38);
    ctx.lineTo(cx + 12, 48);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 12, 48);
    ctx.quadraticCurveTo(cx + 14, 52, cx + 10, 56);
    ctx.stroke();

    ctx.strokeStyle = HUSK_BLADE_LIT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 11, 49);
    ctx.quadraticCurveTo(cx + 13, 52, cx + 10, 55);
    ctx.stroke();

    // Hidden arm (short dark stump)
    ctx.strokeStyle = HUSK_CARAPACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, 29);
    ctx.lineTo(cx - 6, 34);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  // Eye band (single elongated glow strip from side)
  let eyeColor: string;
  if (pose === 'idle') eyeColor = HUSK_EYE_DIM;
  else if (pose === 'walk') eyeColor = HUSK_EYE;
  else {
    eyeColor = HUSK_EYE_HOT;
    ctx.shadowColor = HUSK_EYE_HOT;
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = eyeColor;
  ctx.fillRect(cx - 2, 24, 4, 2);
  ctx.shadowBlur = 0;
}

function drawHuskBackQuarter(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const sx = 0.78;
  const off = 3;
  const bodyTop = pose === 'attack' ? 17 : 18;
  const bodyBottom = 42;

  // Shadow (compressed, shifted right)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = HUSK_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx + 2, 58, Math.round(12 * sx), 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs (compressed, no claws visible from behind — slightly shorter)
  let leftThighX: number, rightThighX: number;
  let leftShinX: number, rightShinX: number;

  if (pose === 'attack') {
    leftThighX  = cx - Math.round(18 * sx) + off;
    rightThighX = cx + Math.round(14 * sx) + off;
    leftShinX   = cx - Math.round(22 * sx) + off;
    rightShinX  = cx + Math.round(18 * sx) + off;
  } else if (pose === 'walk') {
    leftThighX  = cx - Math.round(13 * sx) + off;
    rightThighX = cx + Math.round(11 * sx) + off;
    leftShinX   = cx - Math.round(15 * sx) + off;
    rightShinX  = cx + Math.round(14 * sx) + off;
  } else {
    leftThighX  = cx - Math.round(15 * sx) + off;
    rightThighX = cx + Math.round(11 * sx) + off;
    leftShinX   = cx - Math.round(18 * sx) + off;
    rightShinX  = cx + Math.round(14 * sx) + off;
  }

  // Thighs (darker from behind)
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.fillRect(leftThighX,  42, Math.round(4 * sx), 10);
  ctx.fillRect(rightThighX, 42, 4, 10);

  // Shins
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(leftShinX,  50, Math.round(4 * sx), 8);
  ctx.fillRect(rightShinX, 50, 4, 8);

  // Body (compressed, shifted)
  const bodyCx = cx + off;
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(bodyCx, (bodyTop + bodyBottom) / 2, Math.round(13 * sx), (bodyBottom - bodyTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 horizontal carapace segments from behind
  const segHeight = (bodyBottom - bodyTop) / 3;
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    const segBottom = segTop + segHeight;

    // Segment fill
    ctx.fillStyle = HUSK_PLATE;
    ctx.beginPath();
    ctx.ellipse(bodyCx, (segTop + segBottom) / 2, Math.round(12 * sx), segHeight / 2 - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top rim highlight (light from above-back)
    ctx.fillStyle = HUSK_PLATE_LIT;
    ctx.fillRect(bodyCx - Math.round(11 * sx), segTop, Math.round(22 * sx), 1);

    // Joint line between segments (1px dark line)
    if (i < 2) {
      ctx.fillStyle = HUSK_UNDERSIDE;
      ctx.fillRect(bodyCx - Math.round(9 * sx), segBottom - 1, Math.round(18 * sx), 1);
    }
  }

  // Underside shadow
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.beginPath();
  ctx.ellipse(bodyCx, bodyBottom - 2, Math.round(10 * sx), 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mantis arm stump from behind (shorter, darker, no visible blade)
  ctx.strokeStyle = HUSK_CARAPACE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.round(12 * sx) + off, 29);
  ctx.lineTo(cx + Math.round(16 * sx) + off, 36);
  ctx.stroke();
  ctx.lineWidth = 1;

  // No eye band from behind
}

function drawHuskBack(ctx: CanvasRenderingContext2D, pose: EnemyPose): void {
  const cx = 32;
  const bodyTop = pose === 'attack' ? 17 : 18;
  const bodyBottom = 42;

  // Shadow (symmetric)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = HUSK_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, 58, 12, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs (symmetric, claws slightly hidden — pointing forward)
  let leftThighX: number, rightThighX: number;
  let leftShinX: number, rightShinX: number;
  let leftClaw1X: number, leftClaw2X: number;
  let rightClaw1X: number, rightClaw2X: number;

  if (pose === 'attack') {
    leftThighX  = cx - 18;  rightThighX = cx + 14;
    leftShinX   = cx - 22;  rightShinX  = cx + 18;
    // Claws hidden (shorter, darker)
    leftClaw1X  = cx - 22;  leftClaw2X  = cx - 18;
    rightClaw1X = cx + 18;  rightClaw2X = cx + 22;
  } else if (pose === 'walk') {
    leftThighX  = cx - 13;  rightThighX = cx + 11;
    leftShinX   = cx - 15;  rightShinX  = cx + 14;
    leftClaw1X  = cx - 16;  leftClaw2X  = cx - 12;
    rightClaw1X = cx + 13;  rightClaw2X = cx + 17;
  } else {
    leftThighX  = cx - 15;  rightThighX = cx + 11;
    leftShinX   = cx - 18;  rightShinX  = cx + 14;
    leftClaw1X  = cx - 19;  leftClaw2X  = cx - 15;
    rightClaw1X = cx + 13;  rightClaw2X = cx + 17;
  }

  // Thighs (darker from behind)
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.fillRect(leftThighX,  42, 4, 10);
  ctx.fillRect(rightThighX, 42, 4, 10);

  // Shins
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.fillRect(leftShinX,  50, 4, 8);
  ctx.fillRect(rightShinX, 50, 4, 8);

  // Claws (shorter, darker — pointing forward away)
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.fillRect(leftClaw1X,  57, 2, 2);
  ctx.fillRect(leftClaw2X,  57, 2, 2);
  ctx.fillRect(rightClaw1X, 57, 2, 2);
  ctx.fillRect(rightClaw2X, 57, 2, 2);

  // Body (symmetric)
  ctx.fillStyle = HUSK_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(cx, (bodyTop + bodyBottom) / 2, 13, (bodyBottom - bodyTop) / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 horizontal carapace segments
  const segHeight = (bodyBottom - bodyTop) / 3;
  for (let i = 0; i < 3; i++) {
    const segTop = bodyTop + i * segHeight;
    const segBottom = segTop + segHeight;

    ctx.fillStyle = HUSK_PLATE;
    ctx.beginPath();
    ctx.ellipse(cx, (segTop + segBottom) / 2, 12, segHeight / 2 - 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top rim highlight (light from above)
    ctx.fillStyle = HUSK_PLATE_LIT;
    ctx.fillRect(cx - 11, segTop, 22, 1);
  }

  // Underside shadow
  ctx.fillStyle = HUSK_UNDERSIDE;
  ctx.beginPath();
  ctx.ellipse(cx, bodyBottom - 2, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mantis arms (2 diagonal strokes, no blades visible — pointing forward)
  ctx.strokeStyle = HUSK_CARAPACE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, 29);
  ctx.lineTo(cx - 20, 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 12, 29);
  ctx.lineTo(cx + 20, 40);
  ctx.stroke();
  ctx.lineWidth = 1;

  // No eye band from behind
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
  const cardW = 24;
  const cardH = 18;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#1a5a9c');
  cardGrad.addColorStop(0.5, '#2070cc');
  cardGrad.addColorStop(1, '#1a5a9c');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();

  ctx.strokeStyle = '#5ab8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.stroke();

  ctx.fillStyle = '#d4a017';
  ctx.fillRect(cardX + 2, cardY + 3, 5, 4);
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(cardX + 3, cardY + 3, 3, 2);

  ctx.strokeStyle = '#5ab8ff';
  ctx.beginPath();
  ctx.moveTo(cardX + 11, cardY + 3);
  ctx.lineTo(cardX + 19, cardY + 3);
  ctx.lineTo(cardX + 20, cardY + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cardX + 11, cardY + 7);
  ctx.lineTo(cardX + 17, cardY + 7);
  ctx.stroke();

  ctx.fillStyle = '#5ab8ff';
  ctx.fillRect(cardX + 2, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 5, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 7, cardY + 11, 2, 5);
  ctx.fillRect(cardX + 11, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 13, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 15, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 17, cardY + 11, 2, 5);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#5ab8ff';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(90, 184, 255, 0.35)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
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
  const cardW = 24;
  const cardH = 18;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#103a66');
  cardGrad.addColorStop(0.5, '#155090');
  cardGrad.addColorStop(1, '#103a66');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();

  ctx.strokeStyle = '#3a90d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.stroke();

  // Magnetic stripe across the back
  ctx.fillStyle = '#0a1a2a';
  ctx.fillRect(cardX + 1, cardY + 5, cardW - 2, 3);

  // Subtle edge highlight only
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(90, 184, 255, 0.10)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateYellowKeycardFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32;
  const cy = 32;
  const cardW = 24;
  const cardH = 18;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#9c7a1a');
  cardGrad.addColorStop(0.5, '#cc9a20');
  cardGrad.addColorStop(1, '#9c7a1a');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();

  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.stroke();

  ctx.fillStyle = '#d4a017';
  ctx.fillRect(cardX + 2, cardY + 3, 5, 4);
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(cardX + 3, cardY + 3, 3, 2);

  ctx.strokeStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(cardX + 11, cardY + 3);
  ctx.lineTo(cardX + 19, cardY + 3);
  ctx.lineTo(cardX + 20, cardY + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cardX + 11, cardY + 7);
  ctx.lineTo(cardX + 17, cardY + 7);
  ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.fillRect(cardX + 2, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 5, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 7, cardY + 11, 2, 5);
  ctx.fillRect(cardX + 11, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 13, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 15, cardY + 11, 1, 5);
  ctx.fillRect(cardX + 17, cardY + 11, 2, 5);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

function generateYellowKeycardBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32;
  const cy = 32;
  const cardW = 24;
  const cardH = 18;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#665510');
  cardGrad.addColorStop(0.5, '#806a15');
  cardGrad.addColorStop(1, '#665510');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.fill();

  ctx.strokeStyle = '#d8b83a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
  ctx.stroke();

  // Magnetic stripe across the back
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(cardX + 1, cardY + 5, cardW - 2, 3);

  // Subtle edge highlight only
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255, 215, 0, 0.10)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 2);
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
/* Husk corpse — chitinous pile with a faint cyan eye-band remnant     */
/* ------------------------------------------------------------------ */

export function generateHuskCorpseTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Floor pool — dark teal, larger and softer than blood
  ctx.fillStyle = 'rgba(23, 62, 74, 0.5)';  // HUSK_PLATE alpha 0.5
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pool outer rim — darker
  ctx.strokeStyle = 'rgba(26, 34, 40, 0.4)';  // HUSK_UNDERSIDE alpha 0.4
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 30, 10, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Chitin chunk 1 — irregular polygon, biggest, slightly left of center
  ctx.fillStyle = '#0a0d10';  // HUSK_CARAPACE
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 4);
  ctx.lineTo(cx - 4, cy - 6);
  ctx.lineTo(cx + 2, cy - 5);
  ctx.lineTo(cx + 4, cy - 1);
  ctx.lineTo(cx - 2, cy + 2);
  ctx.lineTo(cx - 8, cy + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#173e4a';  // HUSK_PLATE rim
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chitin chunk 2 — overlapping chunk 1, right side, slightly higher
  ctx.fillStyle = '#0a0d10';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 2);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx + 10, cy + 4);
  ctx.lineTo(cx + 3, cy + 5);
  ctx.lineTo(cx - 1, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#173e4a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chitin chunk 3 — smaller, bottom, partly in pool
  ctx.fillStyle = '#0a0d10';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 6);
  ctx.lineTo(cx, cy + 5);
  ctx.lineTo(cx + 5, cy + 8);
  ctx.lineTo(cx + 2, cy + 11);
  ctx.lineTo(cx - 4, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#173e4a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Faint cyan eye-band remnant — short streak across chunk 1
  ctx.fillStyle = 'rgba(28, 74, 85, 0.55)';  // HUSK_EYE_DIM alpha 0.55
  ctx.fillRect(cx - 5, cy - 3, 7, 1);

  // Scattered chitin splinters — small 2x2 fragments around the pile
  ctx.fillStyle = '#0a0d10';
  ctx.fillRect(cx - 14, cy + 2, 2, 2);
  ctx.fillRect(cx - 11, cy + 7, 2, 1);
  ctx.fillRect(cx + 13, cy - 3, 2, 2);
  ctx.fillRect(cx + 12, cy + 7, 1, 2);
  ctx.fillRect(cx + 7, cy - 8, 2, 1);

  return texFromCanvas(canvas, ctx);
}

/* ------------------------------------------------------------------ */
/* Spitter corpse — deflated bulb in a sickly green bio puddle         */
/* ------------------------------------------------------------------ */

export function generateSpitterCorpseTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Bio puddle — bigger and brighter than the Husk pool
  ctx.fillStyle = 'rgba(200, 224, 64, 0.6)';  // SPITTER_BIO alpha 0.6
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 32, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Puddle inner darker zone
  ctx.fillStyle = 'rgba(90, 102, 24, 0.45)';  // SPITTER_EMITTER alpha 0.45
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Deflated thorax silhouette — bauchige Blase, einseitig konkav
  ctx.fillStyle = '#1a0f1f';  // SPITTER_FLESH
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - 4);
  ctx.quadraticCurveTo(cx - 16, cy + 2, cx - 10, cy + 6);
  // Concave dent on the right (deflated side)
  ctx.quadraticCurveTo(cx - 2, cy + 3, cx + 4, cy + 6);
  ctx.quadraticCurveTo(cx + 12, cy + 5, cx + 14, cy);
  ctx.quadraticCurveTo(cx + 10, cy - 6, cx + 2, cy - 7);
  ctx.quadraticCurveTo(cx - 8, cy - 8, cx - 12, cy - 4);
  ctx.closePath();
  ctx.fill();

  // Highlight on the upper-left of the deflated bulb (gradient feel)
  ctx.fillStyle = '#3b1d4a';  // SPITTER_FLESH_LIT
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - 3, 7, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Concave dent shadow — darker inside the collapsed area
  ctx.fillStyle = 'rgba(7, 4, 16, 0.6)';  // SPITTER_SHADOW alpha 0.6
  ctx.beginPath();
  ctx.ellipse(cx + 1, cy + 2, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bio splatter droplets — scattered around the puddle
  ctx.fillStyle = '#c8e040';  // SPITTER_BIO
  ctx.beginPath();
  ctx.arc(cx - 18, cy + 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 22, cy + 8, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 18, cy + 9, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 22, cy + 2, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 12, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 6, cy + 13, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Detached eye stalk — lying sideways top-left of the bulb
  ctx.strokeStyle = '#3b1d4a';  // SPITTER_FLESH_LIT
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 10);
  ctx.lineTo(cx - 10, cy - 8);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Sclera at the stalk end — half-closed, no iris (lifeless)
  ctx.fillStyle = '#d8c7b5';  // SPITTER_EYE_WHITE
  ctx.beginPath();
  ctx.arc(cx - 19, cy - 10, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Faint eyelid suggestion — dark line across the sclera
  ctx.strokeStyle = '#1a0a0a';  // SPITTER_EYE_IRIS
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 21, cy - 10);
  ctx.lineTo(cx - 17, cy - 10);
  ctx.stroke();

  // Knocked-off legs — 2 thin dark strokes near the bottom
  ctx.strokeStyle = '#15090d';  // SPITTER_LEG
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy + 10);
  ctx.lineTo(cx + 22, cy + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 11);
  ctx.lineTo(cx - 20, cy + 15);
  ctx.stroke();
  ctx.lineWidth = 1;

  return texFromCanvas(canvas, ctx);
}
