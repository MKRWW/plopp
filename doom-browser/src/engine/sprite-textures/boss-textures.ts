import { Texture } from '../textures';
import { SPRITE_TEXTURE_SIZE, EnemyPose, EnemyView, mirrorTextureHorizontal, texFromCanvas } from './shared';

// Boss palette: chitin family (HUSK_PLATE base) with bio-glow accents (SPITTER_BIO_HOT).
// Boss is ~1.4x Husk, asymmetric mass, three-eyed silhouette.
const BOSS_CARAPACE        = '#0d1a21';   // deeper than Husk
const BOSS_PLATE           = '#173e4a';   // HUSK_PLATE
const BOSS_PLATE_LIT       = '#1f5060';   // lighter chitin highlight
const BOSS_UNDERSIDE       = '#0a1520';   // darker belly
const BOSS_MANDIBLE        = '#3a4545';   // arm/leg joint color
const BOSS_MANDIBLE_LIT    = '#5a6565';
const BOSS_EYE             = '#3aa7b8';   // teal eye (HUSK_EYE_HOT-ish)
const BOSS_EYE_HOT         = '#00ff88';   // bio-glow center (SPITTER_BIO_HOT)
const BOSS_BIO_ACCENT      = '#c8e040';   // yellow-green bio residue
const BOSS_BIO_HOT         = '#80ff40';   // hot bio glow
const BOSS_SHADOW          = 'rgba(0, 0, 0, 0.5)';


/* ------------------------------------------------------------------ */
/* Boss: large asymmetric chitin creature, three-eyed, bio-glow accents  */
/* ------------------------------------------------------------------ */

export function buildBossAngleViews(pose: EnemyPose): Texture[] {
  return [
    generateBossTexture(pose, 'front', false),
    generateBossTexture(pose, 'frontQuarter', false),
    generateBossTexture(pose, 'side', false),
    generateBossTexture(pose, 'backQuarter', false),
    generateBossTexture(pose, 'back', false),
    generateBossTexture(pose, 'backQuarter', true),
    generateBossTexture(pose, 'side', true),
    generateBossTexture(pose, 'frontQuarter', true)
  ];
}

export function generateBossTexture(pose: EnemyPose, view: EnemyView, mirror: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const attacking = pose === 'attack';
  const bodyTop = attacking ? 6 : 8;
  const bodyBottom = 50;
  const bodyRx = 18;
  const bodyRy = (bodyBottom - bodyTop) / 2;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = BOSS_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, 58, 16, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs
  const legSpread = attacking ? 20 : 18;
  ctx.fillStyle = BOSS_CARAPACE;
  ctx.fillRect(cx - legSpread - 2, 42, 5, 12);
  ctx.fillRect(cx + legSpread - 3, 42, 5, 12);
  ctx.fillStyle = BOSS_PLATE;
  ctx.fillRect(cx - legSpread - 4, 52, 5, 6);
  ctx.fillRect(cx + legSpread - 5, 52, 5, 6);
  // Claws
  ctx.fillStyle = BOSS_MANDIBLE;
  ctx.fillRect(cx - legSpread - 6, 57, 4, 2);
  ctx.fillRect(cx - legSpread - 1, 57, 4, 2);
  ctx.fillRect(cx + legSpread - 7, 57, 4, 2);
  ctx.fillRect(cx + legSpread - 2, 57, 4, 2);

  // Body
  ctx.fillStyle = BOSS_CARAPACE;
  ctx.beginPath();
  ctx.ellipse(cx - 2, (bodyTop + bodyBottom) / 2, bodyRx, bodyRy, 0.1, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createLinearGradient(cx, bodyTop, cx, bodyBottom);
  grad.addColorStop(0, BOSS_PLATE_LIT);
  grad.addColorStop(0.5, BOSS_PLATE);
  grad.addColorStop(1, BOSS_UNDERSIDE);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx - 1, (bodyTop + bodyBottom) / 2 - 1, bodyRx - 1, bodyRy - 1, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Left-side protrusion
  ctx.fillStyle = BOSS_PLATE;
  ctx.beginPath();
  ctx.ellipse(cx - bodyRx - 4, (bodyTop + bodyBottom) / 2 - 4, 8, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOSS_PLATE_LIT;
  ctx.beginPath();
  ctx.ellipse(cx - bodyRx - 3, (bodyTop + bodyBottom) / 2 - 5, 6, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Bio-glow on protrusion
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = BOSS_BIO_HOT;
  ctx.beginPath();
  ctx.arc(cx - bodyRx - 4, (bodyTop + bodyBottom) / 2 - 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOSS_BIO_ACCENT;
  ctx.beginPath();
  ctx.arc(cx - bodyRx - 1, (bodyTop + bodyBottom) / 2 - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Three eyes
  const eyeY = bodyTop + 8;
  const eyeSpacing = 7;
  ctx.fillStyle = BOSS_EYE;
  ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_EYE_HOT;
  ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_EYE;
  ctx.beginPath(); ctx.arc(cx, eyeY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_EYE_HOT;
  ctx.beginPath(); ctx.arc(cx, eyeY, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_EYE;
  ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_EYE_HOT;
  ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, 1, 0, Math.PI * 2); ctx.fill();

  // Bio-glow on body
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = BOSS_BIO_ACCENT;
  ctx.beginPath(); ctx.arc(cx + 6, eyeY + 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 3, eyeY + 18, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_BIO_HOT;
  ctx.beginPath(); ctx.arc(cx + 6, eyeY + 12, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Arms
  const armExtend = attacking ? 8 : 0;
  ctx.strokeStyle = BOSS_PLATE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 8, eyeY + 8);
  ctx.quadraticCurveTo(cx - 18 - armExtend, eyeY + 14, cx - 16 - armExtend, eyeY + 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 8, eyeY + 8);
  ctx.quadraticCurveTo(cx + 18 + armExtend, eyeY + 14, cx + 16 + armExtend, eyeY + 20);
  ctx.stroke();
  ctx.fillStyle = BOSS_MANDIBLE;
  ctx.beginPath(); ctx.arc(cx - 16 - armExtend, eyeY + 20, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_MANDIBLE_LIT;
  ctx.beginPath(); ctx.arc(cx - 16 - armExtend, eyeY + 20, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_MANDIBLE;
  ctx.beginPath(); ctx.arc(cx + 16 + armExtend, eyeY + 20, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_MANDIBLE_LIT;
  ctx.beginPath(); ctx.arc(cx + 16 + armExtend, eyeY + 20, 1, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1;

  // View adjustments
  switch (view) {
    case 'frontQuarter':
    case 'side':
      ctx.fillStyle = BOSS_CARAPACE;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(cx + 5, bodyTop, bodyRx, bodyBottom - bodyTop);
      ctx.globalAlpha = 1;
      break;
    case 'backQuarter':
      ctx.fillStyle = BOSS_CARAPACE;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(cx - eyeSpacing - 3, eyeY - 5, eyeSpacing * 2 + 6, 12);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = BOSS_PLATE;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, bodyTop + 3); ctx.lineTo(cx, bodyBottom); ctx.stroke();
      ctx.lineWidth = 1;
      break;
    case 'back':
      ctx.fillStyle = BOSS_CARAPACE;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(cx - eyeSpacing - 4, eyeY - 5, eyeSpacing * 2 + 8, 12);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = BOSS_PLATE;
      ctx.lineWidth = 1;
      for (let seg = 0; seg < 3; seg++) {
        const segY = bodyTop + 5 + seg * 12;
        ctx.beginPath(); ctx.moveTo(cx - bodyRx + 2, segY); ctx.lineTo(cx + bodyRx - 2, segY); ctx.stroke();
      }
      ctx.lineWidth = 1;
      break;
  }

  ctx.fillStyle = BOSS_PLATE_LIT;
  ctx.beginPath();
  ctx.ellipse(cx - 3, bodyTop + 1, bodyRx - 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

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

function generateBossCorpseTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = 'rgba(23, 62, 74, 0.6)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 5, 35, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200, 224, 64, 0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 6, 25, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = BOSS_CARAPACE;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 5);
  ctx.quadraticCurveTo(cx - 22, cy + 2, cx - 16, cy + 8);
  ctx.quadraticCurveTo(cx - 6, cy + 12, cx + 2, cy + 10);
  ctx.quadraticCurveTo(cx + 12, cy + 8, cx + 16, cy + 2);
  ctx.quadraticCurveTo(cx + 14, cy - 4, cx + 8, cy - 7);
  ctx.quadraticCurveTo(cx, cy - 10, cx - 10, cy - 8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = BOSS_PLATE; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = BOSS_CARAPACE;
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 2);
  ctx.lineTo(cx + 20, cy - 5);
  ctx.lineTo(cx + 24, cy);
  ctx.lineTo(cx + 20, cy + 5);
  ctx.lineTo(cx + 12, cy + 4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = BOSS_PLATE; ctx.lineWidth = 1; ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = BOSS_BIO_HOT;
  ctx.beginPath(); ctx.arc(cx - 10, cy, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BOSS_BIO_ACCENT;
  ctx.beginPath(); ctx.arc(cx + 4, cy + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(58, 167, 184, 0.3)';
  ctx.beginPath(); ctx.arc(cx - 8, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 8, cy - 2, 2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = BOSS_CARAPACE;
  ctx.fillRect(cx - 22, cy + 6, 2, 2);
  ctx.fillRect(cx - 18, cy + 10, 2, 1);
  ctx.fillRect(cx + 18, cy + 8, 2, 2);
  ctx.fillRect(cx + 24, cy + 4, 1, 2);
  ctx.fillRect(cx + 12, cy - 10, 2, 1);

  return texFromCanvas(canvas, ctx);
}

export const bossCorpseTexture = generateBossCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
