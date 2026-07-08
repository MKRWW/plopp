import { Texture } from '../textures';
import { SPRITE_TEXTURE_SIZE, EnemyPose, EnemyView, mirrorTextureHorizontal, applySpriteRimLight, texFromCanvas } from './shared';

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

/* ------------------------------------------------------------------ */
/* Enemy 8-direction generation                                        */
/* ------------------------------------------------------------------ */

export function buildHuskAngleViews(pose: EnemyPose): Texture[] {
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

export function generateHuskTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

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

export const huskCorpseTexture = generateHuskCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
