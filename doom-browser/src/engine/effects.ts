import { Sprite, SpriteType } from './sprite';
import { Player } from '../player/player';
import { ZBuffer } from './zbuffer';
import { SoundManager, SoundType } from '../audio/sound';
import { BloodParticle } from './blood-particle';
import { BioProjectile } from './bio-projectile';
import { RocketProjectile } from './rocket-projectile';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

export const HIT_MARKER_DURATION = 0.15;
export const WALL_IMPACT_DURATION = 0.2;
export const LOW_HEALTH_THRESHOLD = 25;
export const HEARTBEAT_PULSE_DURATION = 0.45;

export interface EffectsContext {
  ctx: CanvasRenderingContext2D;
  player: Player;
  zBuffer: ZBuffer;
  soundManager: SoundManager;
  bloodParticles: BloodParticle[];
  bioProjectiles: BioProjectile[];
  rockets: RocketProjectile[];
}

export interface EffectsState {
  damageFlashTimer: number;
  damageFlashDuration: number;
  hitMarkerTimer: number;
  wallImpactX: number;
  wallImpactY: number;
  wallImpactTimer: number;
  heartbeatTimer: number;
  heartbeatPulseTimer: number;
  headbobPhase: number;
  headbobIntensity: number;
  screenShakeTimer: number;
  screenShakeIntensity: number;
  isSprinting: boolean;
}

export function createEffectsState(): EffectsState {
  return {
    damageFlashTimer: 0,
    damageFlashDuration: 0.3,
    hitMarkerTimer: 0,
    wallImpactX: 0,
    wallImpactY: 0,
    wallImpactTimer: 0,
    heartbeatTimer: 0,
    heartbeatPulseTimer: 0,
    headbobPhase: 0,
    headbobIntensity: 0,
    screenShakeTimer: 0,
    screenShakeIntensity: 0,
    isSprinting: false,
  };
}

/**
 * Spawn a burst of blood/gore droplets from a sprite that just transitioned
 * into the dying state. Color is class-specific: cyan-teal for the Husk
 * (chitin ichor), bio-green for the Spitter, dark red as fallback.
 */
export function spawnBlood(ctx: EffectsContext, sprite: Sprite): void {
  let color: string;
  if (sprite.type === SpriteType.ENEMY) {
    color = '173e4a';        // HUSK_PLATE
  } else if (sprite.type === SpriteType.SHOOTER) {
    color = 'c8e040';        // SPITTER_BIO
  } else {
    color = '7a0a0a';        // generic red
  }

  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 1.6;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    // Initial upward kick + variance — droplets arc above and fall back.
    const vz = 1.2 + Math.random() * 1.8;
    const z = 0.15 + Math.random() * 0.15;
    const life = 0.7 + Math.random() * 0.6;
    ctx.bloodParticles.push(new BloodParticle(sprite.x, sprite.y, z, vx, vy, vz, life, color));
  }
}

/**
 * Blood particles: advance ballistic motion, cull expired.
 */
export function updateBloodParticles(ctx: EffectsContext, deltaTime: number): void {
  for (let i = ctx.bloodParticles.length - 1; i >= 0; i--) {
    if (ctx.bloodParticles[i].update(deltaTime)) {
      ctx.bloodParticles.splice(i, 1);
    }
  }
}

/**
 * Low-health heartbeat tick: only active below threshold. Pulse rate scales
 * with how low health is — faster (and louder visually) the closer to dying.
 * pulseTimer decrement runs whenever isPlaying so the fade-out completes.
 */
export function updateHeartbeat(
  ctx: EffectsContext,
  state: EffectsState,
  deltaTime: number,
  isPlaying: boolean
): void {
  if (!isPlaying) return;

  if (ctx.player.health > 0 && ctx.player.health < LOW_HEALTH_THRESHOLD) {
    const severity = 1 - ctx.player.health / LOW_HEALTH_THRESHOLD; // 0..1
    const pulseInterval = 1.0 - severity * 0.5; // 1.0 s → 0.5 s
    state.heartbeatTimer += deltaTime;
    if (state.heartbeatTimer >= pulseInterval) {
      state.heartbeatTimer = 0;
      state.heartbeatPulseTimer = HEARTBEAT_PULSE_DURATION;
      ctx.soundManager.play(SoundType.HEARTBEAT);
    }
  } else {
    state.heartbeatTimer = 0;
  }
  if (state.heartbeatPulseTimer > 0) {
    state.heartbeatPulseTimer -= deltaTime;
  }
}

/**
 * Decrement render-only timers (damage-flash, screen-shake, hit-marker,
 * wall-impact) once per frame. Runs even while PAUSED so visual overlays
 * still fade out cleanly.
 */
export function updateEffectTimers(state: EffectsState, deltaTime: number): void {
  if (state.damageFlashTimer > 0) state.damageFlashTimer -= deltaTime;
  if (state.screenShakeTimer > 0) state.screenShakeTimer -= deltaTime;
  if (state.hitMarkerTimer > 0) state.hitMarkerTimer -= deltaTime;
  if (state.wallImpactTimer > 0) state.wallImpactTimer -= deltaTime;
}

/**
 * Tick headbob phase/intensity envelope and compute screen-shake offset.
 * Returns the canvas translation to apply this frame.
 */
export function updateHeadbobAndShake(
  state: EffectsState,
  deltaTime: number,
  isMoving: boolean
): { translateX: number; translateY: number } {
  const sprintFactor = state.isSprinting ? 1.4 : 1.0;
  state.headbobPhase += deltaTime * 8 * sprintFactor;
  if (isMoving) {
    state.headbobIntensity = Math.min(1, state.headbobIntensity + deltaTime * 4);
  } else {
    state.headbobIntensity = Math.max(0, state.headbobIntensity - deltaTime * 6);
  }
  const bobY = Math.sin(state.headbobPhase) * 2.5 * state.headbobIntensity * sprintFactor;
  const bobX = Math.sin(state.headbobPhase * 0.5) * 1.2 * state.headbobIntensity * sprintFactor;

  let shakeX = 0;
  let shakeY = 0;
  if (state.screenShakeTimer > 0) {
    const shakeIntensity = state.screenShakeIntensity * (state.screenShakeTimer / 0.12);
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
  }
  return { translateX: shakeX + bobX, translateY: shakeY + bobY };
}

/**
 * Render blood/gore droplets after the main sprite pass. Each particle is
 * projected with the same camera math as sprites, depth-tested against the
 * z-buffer at its screen column, and drawn as a small colored square that
 * fades with its remaining life.
 */
export function renderBloodParticles(ctx: EffectsContext): void {
  if (ctx.bloodParticles.length === 0) return;

  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;
  const planeX = ctx.player.planeX;
  const planeY = ctx.player.planeY;
  const px = ctx.player.x;
  const py = ctx.player.y;
  const invDet = 1.0 / (planeX * dirY - dirX * planeY);

  for (const p of ctx.bloodParticles) {
    const spriteX = p.x - px;
    const spriteY = p.y - py;
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.1) continue;

    const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
    if (screenX < 0 || screenX >= SCREEN_WIDTH) continue;
    if (ctx.zBuffer.get(screenX) < transformY) continue;

    // Z (world up/down) maps to vertical screen offset around mid-height,
    // scaled by inverse depth so further droplets visually drop slower.
    const screenY = Math.floor(SCREEN_HEIGHT / 2 - (p.z * SCREEN_HEIGHT) / transformY);
    const size = Math.max(1, Math.floor(4 / transformY));
    ctx.ctx.fillStyle = `rgba(${parseInt(p.color.slice(0, 2), 16)},${parseInt(p.color.slice(2, 4), 16)},${parseInt(p.color.slice(4, 6), 16)},${p.alpha})`;
    ctx.ctx.fillRect(screenX - Math.floor(size / 2), screenY - Math.floor(size / 2), size, size);
  }
}

/**
 * Render flying rockets as a small fire-glow head with a 5-sample backward
 * trail so the launcher's projectile is actually visible mid-flight.
 * Trail positions are computed from the rocket's direction so no per-rocket
 * trail state has to be kept.
 */
export function renderRockets(ctx: EffectsContext): void {
  if (ctx.rockets.length === 0) return;

  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;
  const planeX = ctx.player.planeX;
  const planeY = ctx.player.planeY;
  const px = ctx.player.x;
  const py = ctx.player.y;
  const invDet = 1.0 / (planeX * dirY - dirX * planeY);

  for (const rocket of ctx.rockets) {
    const TRAIL_SAMPLES = 5;
    const TRAIL_STEP = 0.18;  // tiles between samples

    // Render trail back-to-front (oldest first, so head ends up on top).
    for (let i = TRAIL_SAMPLES; i >= 0; i--) {
      const wx = rocket.x - rocket.dirX * TRAIL_STEP * i;
      const wy = rocket.y - rocket.dirY * TRAIL_STEP * i;
      const spriteX = wx - px;
      const spriteY = wy - py;
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
      if (transformY <= 0.1) continue;

      const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
      if (screenX < 0 || screenX >= SCREEN_WIDTH) continue;
      if (ctx.zBuffer.get(screenX) < transformY) continue;

      const screenY = Math.floor(SCREEN_HEIGHT / 2 - 8 / transformY);
      const baseRadius = Math.max(2, Math.min(22, 12 / transformY));
      const t = 1 - i / TRAIL_SAMPLES; // 1 at head, 0 at tail

      if (i === 0) {
        // Head: bright fire glow.
        ctx.ctx.fillStyle = 'rgba(120, 30, 10, 0.45)';
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenX, screenY, baseRadius * 1.7, 0, Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.fillStyle = 'rgba(255, 120, 30, 0.9)';
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenX, screenY, baseRadius, 0, Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.fillStyle = 'rgba(255, 230, 140, 1)';
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenX, screenY, baseRadius * 0.45, 0, Math.PI * 2);
        ctx.ctx.fill();
      } else {
        // Smoke / fading flame trail samples.
        const alpha = t * 0.55;
        const radius = baseRadius * (0.7 + t * 0.6);
        ctx.ctx.fillStyle = `rgba(80, 60, 50, ${alpha * 0.7})`;
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenX, screenY, radius * 1.2, 0, Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.fillStyle = `rgba(200, 90, 30, ${alpha})`;
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenX, screenY, radius * 0.6, 0, Math.PI * 2);
        ctx.ctx.fill();
      }
    }
  }
}

/**
 * Render visual-only Spitter bio projectiles after the main sprite pass.
 * Each projectile is drawn as a stack of three radial fills (halo + body
 * + hot core) and depth-tested against the z-buffer at its screen column.
 */
export function renderBioProjectiles(ctx: EffectsContext): void {
  if (ctx.bioProjectiles.length === 0) return;

  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;
  const planeX = ctx.player.planeX;
  const planeY = ctx.player.planeY;
  const px = ctx.player.x;
  const py = ctx.player.y;
  const invDet = 1.0 / (planeX * dirY - dirX * planeY);

  for (const proj of ctx.bioProjectiles) {
    const spriteX = proj.x - px;
    const spriteY = proj.y - py;
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.1) continue;

    const screenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
    if (screenX < 0 || screenX >= SCREEN_WIDTH) continue;

    // Z-buffer test at the projectile's screen column — hides it behind walls.
    if (ctx.zBuffer.get(screenX) < transformY) continue;

    // Sprites use mid-screen as the horizontal axis; projectile sits slightly
    // above mid-height to suggest emitter level.
    const screenY = Math.floor(SCREEN_HEIGHT / 2 - 8 / transformY);
    const baseRadius = Math.max(2, Math.min(28, 14 / transformY));

    if (proj.isSplatting) {
      const fade = proj.splatTimer / proj.splatDuration;
      // Splat: bigger spread, fades alpha
      ctx.ctx.fillStyle = `rgba(90, 102, 24, ${0.35 * fade})`;
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 2.4, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = `rgba(200, 224, 64, ${0.7 * fade})`;
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 1.2, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = `rgba(244, 255, 138, ${0.9 * fade})`;
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 0.5, 0, Math.PI * 2);
      ctx.ctx.fill();
    } else {
      // In-flight glob: outer halo, bright body, hot core.
      ctx.ctx.fillStyle = 'rgba(90, 102, 24, 0.35)';
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 1.7, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = 'rgba(200, 224, 64, 0.85)';
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 0.9, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = 'rgba(244, 255, 138, 1)';
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenX, screenY, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.ctx.fill();
    }
  }
}

/**
 * Red radial vignette that pulses on heartbeat when player.health is below
 * LOW_HEALTH_THRESHOLD. Drawn before drawDamageFlash so the damage flash
 * still overrides on direct hits.
 */
export function drawLowHealthVignette(ctx: EffectsContext, state: EffectsState): void {
  if (ctx.player.health <= 0 || ctx.player.health >= LOW_HEALTH_THRESHOLD) return;

  const severity = 1 - ctx.player.health / LOW_HEALTH_THRESHOLD; // 0..1
  const baseAlpha = 0.15 + severity * 0.25;
  const pulseAlpha = (state.heartbeatPulseTimer / HEARTBEAT_PULSE_DURATION) * 0.35;
  const alpha = Math.min(0.9, baseAlpha + pulseAlpha);

  const cx = SCREEN_WIDTH / 2;
  const cy = SCREEN_HEIGHT / 2;
  const innerR = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.25;
  const outerR = Math.sqrt(cx * cx + cy * cy);

  const grad = ctx.ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, 'rgba(120, 0, 0, 0)');
  grad.addColorStop(0.6, `rgba(150, 0, 0, ${alpha * 0.4})`);
  grad.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);
  ctx.ctx.fillStyle = grad;
  ctx.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

export function drawDamageFlash(ctx: EffectsContext, state: EffectsState): void {
  if (state.damageFlashTimer <= 0) return;

  const intensity = state.damageFlashTimer / state.damageFlashDuration;
  const alpha = intensity * 0.5;
  const border = 40;

  ctx.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;

  // Oben
  ctx.ctx.fillRect(0, 0, SCREEN_WIDTH, border);
  // Unten
  ctx.ctx.fillRect(0, SCREEN_HEIGHT - border, SCREEN_WIDTH, border);
  // Links
  ctx.ctx.fillRect(0, 0, border, SCREEN_HEIGHT);
  // Rechts
  ctx.ctx.fillRect(SCREEN_WIDTH - border, 0, border, SCREEN_HEIGHT);
}

/**
 * Zeichnet den Hitmarker (kurzes Kreuz in Bildschirmmitte).
 */
export function drawHitMarker(ctx: EffectsContext, state: EffectsState): void {
  if (state.hitMarkerTimer <= 0) return;

  const intensity = state.hitMarkerTimer / HIT_MARKER_DURATION;
  const alpha = intensity;
  const cx = SCREEN_WIDTH / 2;
  const cy = SCREEN_HEIGHT / 2;
  const size = 8;

  ctx.ctx.strokeStyle = `rgba(255, 255, 200, ${alpha})`;
  ctx.ctx.lineWidth = 2;

  // Kleines X-Kreuz
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(cx - size, cy - size);
  ctx.ctx.lineTo(cx + size, cy + size);
  ctx.ctx.moveTo(cx + size, cy - size);
  ctx.ctx.lineTo(cx - size, cy + size);
  ctx.ctx.stroke();
}

/**
 * Zeichnet einen kurzen Impact-Funken am Wand-Trefferpunkt.
 */
export function drawWallImpact(ctx: EffectsContext, state: EffectsState): void {
  if (state.wallImpactTimer <= 0) return;

  const intensity = state.wallImpactTimer / WALL_IMPACT_DURATION;
  const alpha = intensity;
  const sparkSize = 6 * intensity;

  // Gelb/orange Funken
  ctx.ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
  ctx.ctx.beginPath();
  ctx.ctx.arc(state.wallImpactX, state.wallImpactY, sparkSize, 0, Math.PI * 2);
  ctx.ctx.fill();

  // Helle Mitte
  ctx.ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
  ctx.ctx.beginPath();
  ctx.ctx.arc(state.wallImpactX, state.wallImpactY, sparkSize * 0.4, 0, Math.PI * 2);
  ctx.ctx.fill();
}
