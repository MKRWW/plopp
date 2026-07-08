import { Texture } from '../textures';
import { SPRITE_TEXTURE_SIZE, EnemyPose } from './shared';

// Latcher (Plopp-Headcrab): small parasitic blob with mandibles and spider legs.
const LATCHER_SHADOW       = '#0a0507';
const LATCHER_FLESH        = '#5a2030';
const LATCHER_FLESH_LIT    = '#9a4660';
const LATCHER_FLESH_RIM    = '#d68090';
const LATCHER_VEIN         = '#3a0a18';
const LATCHER_LEG          = '#2a0d18';
const LATCHER_MANDIBLE     = '#1a0608';
const LATCHER_MANDIBLE_LIT = '#4a1828';
const LATCHER_MAW          = '#ff3a55';

/* ------------------------------------------------------------------ */
/* Latcher: parasitic blob with mandibles + spider legs                 */
/* ------------------------------------------------------------------ */

export function buildLatcherAngleViews(pose: EnemyPose): Texture[] {
  // The Latcher reads the same from every angle (blob with legs around it),
  // so all 8 slots share one texture per pose.
  const tex = generateLatcherTexture(pose);
  return [tex, tex, tex, tex, tex, tex, tex, tex];
}

export function generateLatcherTexture(pose: EnemyPose): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const isLeap = pose === 'attack';
  const isWindup = pose === 'walk';

  // Body posture per pose:
  //   idle     → squat round blob, legs splayed mid-low
  //   windup   → crouched, body 1 px lower, legs tucked tighter (tell)
  //   leap     → body lifted slightly, legs splayed out wide, maw open
  const bodyCy = isWindup ? 46 : (isLeap ? 38 : 44);
  const bodyRx = isLeap ? 13 : 12;
  const bodyRy = isWindup ? 7 : (isLeap ? 9 : 8);

  // Shadow (smaller during leap to suggest airborne)
  ctx.save();
  ctx.globalAlpha = isLeap ? 0.4 : 0.6;
  ctx.fillStyle = LATCHER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, 58, isLeap ? 7 : 11, isLeap ? 1.5 : 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Spider legs — 4 per side, splayed out from the body sides.
  // Each leg: bent in middle, points down-outward. Angles vary per pose.
  const legAngles = isLeap
    ? [-1.5, -1.1, -0.75, -0.35]   // splayed wide in flight
    : isWindup
      ? [-1.3, -1.0, -0.7, -0.35]  // tucked tighter for windup
      : [-1.45, -1.0, -0.6, -0.2]; // idle: relaxed splay

  ctx.strokeStyle = LATCHER_LEG;
  ctx.lineWidth = 2;
  for (let side = 0; side < 2; side++) {
    for (const baseAngle of legAngles) {
      const a = side === 0 ? Math.PI + baseAngle : -baseAngle;
      const hipX = cx + Math.cos(a) * (bodyRx - 1);
      const hipY = bodyCy + Math.sin(a) * (bodyRy - 1);
      const kneeX = cx + Math.cos(a) * (bodyRx + 4);
      const kneeY = bodyCy + Math.sin(a) * (bodyRy + 2) + 2;
      const footX = cx + Math.cos(a) * (bodyRx + 7);
      const footY = isLeap
        ? bodyCy + Math.sin(a) * (bodyRy + 4) + 4  // legs trail in air
        : 57;                                       // grounded
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 1;

  // Body — fleshy blob with gradient + rim highlight.
  ctx.fillStyle = LATCHER_FLESH;
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(cx, bodyCy - bodyRy, cx, bodyCy + bodyRy);
  grad.addColorStop(0, LATCHER_FLESH_LIT);
  grad.addColorStop(1, LATCHER_FLESH);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, bodyCy - 0.5, bodyRx - 1, bodyRy - 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top-rim highlight crescent.
  ctx.fillStyle = LATCHER_FLESH_RIM;
  ctx.beginPath();
  ctx.ellipse(cx - 2, bodyCy - bodyRy + 1, bodyRx - 4, 1.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing veins — 3 wavy lines across the back.
  ctx.strokeStyle = LATCHER_VEIN;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const offsetX = -bodyRx + 3 + i * 4;
    ctx.beginPath();
    ctx.moveTo(cx + offsetX, bodyCy - bodyRy + 2);
    ctx.quadraticCurveTo(cx + offsetX + 2, bodyCy, cx + offsetX, bodyCy + bodyRy - 2);
    ctx.stroke();
  }

  // Cluster eyes — 5-6 small black dots on the upper front of the body.
  ctx.fillStyle = LATCHER_MANDIBLE;
  const eyes: Array<[number, number]> = [
    [cx - 5, bodyCy - 3],
    [cx - 2, bodyCy - 4],
    [cx + 1, bodyCy - 4],
    [cx + 4, bodyCy - 3],
    [cx - 3, bodyCy - 1],
    [cx + 2, bodyCy - 1]
  ];
  for (const [ex, ey] of eyes) {
    ctx.beginPath();
    ctx.arc(ex, ey, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mandibles — 4 pincers projecting forward / downward from the front of
  // the body. In leap pose they splay wide and the maw opens.
  const mandibleSplay = isLeap ? 7 : (isWindup ? 3 : 4);
  const mandibleLen = isLeap ? 8 : 6;
  const mandibleY = bodyCy + bodyRy - 2;

  if (isLeap) {
    // Open maw — bright pink interior between the mandibles.
    ctx.fillStyle = LATCHER_MAW;
    ctx.beginPath();
    ctx.ellipse(cx, mandibleY + mandibleLen / 2, mandibleSplay - 1, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = LATCHER_MANDIBLE;
  ctx.lineWidth = 2;
  // 4 mandibles: outer-left, inner-left, inner-right, outer-right
  const mandiblePositions = [
    { dx: -mandibleSplay,     bend: -1 },
    { dx: -mandibleSplay / 3, bend: -0.4 },
    { dx:  mandibleSplay / 3, bend:  0.4 },
    { dx:  mandibleSplay,     bend:  1 }
  ];
  for (const m of mandiblePositions) {
    const startX = cx + m.dx * 0.4;
    const tipX = cx + m.dx + m.bend * (isLeap ? 2 : 1);
    const tipY = mandibleY + mandibleLen;
    ctx.beginPath();
    ctx.moveTo(startX, mandibleY);
    ctx.quadraticCurveTo(cx + m.dx, mandibleY + mandibleLen * 0.5, tipX, tipY);
    ctx.stroke();
  }
  // Mandible highlight (inner edge of the outer two)
  ctx.strokeStyle = LATCHER_MANDIBLE_LIT;
  ctx.lineWidth = 1;
  for (const m of [mandiblePositions[0], mandiblePositions[3]]) {
    const startX = cx + m.dx * 0.4;
    const tipX = cx + m.dx + m.bend * (isLeap ? 2 : 1);
    const tipY = mandibleY + mandibleLen;
    ctx.beginPath();
    ctx.moveTo(startX + (m.dx < 0 ? 1 : -1), mandibleY + 1);
    ctx.quadraticCurveTo(cx + m.dx + (m.dx < 0 ? 1 : -1), mandibleY + mandibleLen * 0.5, tipX + (m.dx < 0 ? 1 : -1), tipY - 1);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

