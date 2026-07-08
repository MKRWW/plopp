import { Texture } from '../textures';
import { SPRITE_TEXTURE_SIZE, EnemyPose, EnemyView, mirrorTextureHorizontal, texFromCanvas } from './shared';

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

export function buildSpitterAngleViews(pose: EnemyPose): Texture[] {
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

export function generateSpitterTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
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

export const spitterCorpseTexture = generateSpitterCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
