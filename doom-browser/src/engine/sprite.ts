/**
 * Sprite system for the raycasting renderer.
 *
 * Sprites are world objects independent from the tile grid: enemies, items,
 * pickups, and decorations. They are projected into camera space and rendered
 * with a z-buffer depth test.
 */

import { Texture } from './textures';

/**
 * Sprite types used by the game.
 */
export enum SpriteType {
  ENEMY = 'enemy',
  AMMO = 'ammo',
  HEALTH = 'health',
  KEYCARD = 'keycard',
  BARREL = 'barrel',
  TERMINAL = 'terminal',
  LAMP = 'lamp',
  DEBRIS = 'debris'
}

/**
 * A billboard sprite in the 3D world.
 */
export class Sprite {
  public x: number;
  public y: number;
  public type: SpriteType;
  public texture: Texture | null;

  // Animation
  public textures: Texture[] = [];
  public currentFrame: number = 0;
  public frameTimer: number = 0;
  public animationSpeed: number = 0.2;
  public floatingPhase: number = 0;

  // Enemy state
  public isAlive: boolean = true;
  public health: number = 3;
  public attackTimer: number = 0;

  // Hit feedback & death animation
  public isDying: boolean = false;
  public hitFlashTimer: number = 0;
  public deathTimer: number = 0;
  public deathDuration: number = 0.45; // seconds

  constructor(x: number, y: number, type: SpriteType, texture: Texture | null = null) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.texture = texture;
    if (texture) {
      this.textures = [texture];
    }
  }

  /**
   * Update frame animation and pickup bobbing.
   */
  public update(deltaTime: number): void {
    if (this.textures.length > 1) {
      this.frameTimer += deltaTime;
      if (this.frameTimer >= this.animationSpeed) {
        this.frameTimer -= this.animationSpeed;
        this.currentFrame = (this.currentFrame + 1) % this.textures.length;
        this.texture = this.textures[this.currentFrame];
      }
    }

    if (this.type === SpriteType.AMMO || this.type === SpriteType.HEALTH || this.type === SpriteType.KEYCARD) {
      this.floatingPhase += deltaTime * 2.0;
    }

    // Lamp glow pulse
    if (this.type === SpriteType.LAMP) {
      this.floatingPhase += deltaTime * 3.0;
    }
  }

  /**
   * Vertical bobbing offset for pickups.
   */
  public getFloatingOffset(): number {
    if (this.type === SpriteType.AMMO || this.type === SpriteType.HEALTH || this.type === SpriteType.KEYCARD) {
      return Math.sin(this.floatingPhase) * 0.05;
    }
    return 0;
  }
}

/**
 * Power-of-two sprite texture size.
 */
const SPRITE_TEXTURE_SIZE = 64;

type EnemyPose = 'idle' | 'walk' | 'attack';

/**
 * Generates all procedural sprite textures.
 */
export function generateSpriteTextures(): Map<SpriteType, Texture[]> {
  const textures = new Map<SpriteType, Texture[]>();

  textures.set(SpriteType.ENEMY, [
    generateEnemyIdleTexture(),
    generateEnemyWalkTexture(),
    generateEnemyAttackTexture()
  ]);

  textures.set(SpriteType.AMMO, [generateAmmoTexture()]);
  textures.set(SpriteType.HEALTH, [generateHealthTexture()]);
  textures.set(SpriteType.KEYCARD, [generateKeycardTexture()]);

  // Decor textures
  textures.set(SpriteType.BARREL, [generateBarrelTexture()]);
  textures.set(SpriteType.TERMINAL, [generateTerminalTexture()]);
  textures.set(SpriteType.LAMP, [generateLampTexture()]);
  textures.set(SpriteType.DEBRIS, [generateDebrisTexture()]);

  return textures;
}

function generateEnemyIdleTexture(): Texture {
  return generateEnemyTexture('idle');
}

function generateEnemyWalkTexture(): Texture {
  return generateEnemyTexture('walk');
}

function generateEnemyAttackTexture(): Texture {
  return generateEnemyTexture('attack');
}

/**
 * Original gritty 90s-FPS-inspired enemy, drawn as readable 64x64 pixel art.
 */
function generateEnemyTexture(pose: EnemyPose): Texture {
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

  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, 61, 19, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  drawLegs(ctx, cx, legKick);
  drawTorso(ctx, cx, torsoY);
  drawShoulders(ctx, cx);
  drawArms(ctx, cx, attacking, armSwing);
  drawHead(ctx, cx, headY, attacking);
  applySpriteRimLight(ctx);

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

function drawLegs(ctx: CanvasRenderingContext2D, cx: number, legKick: number): void {
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

function drawTorso(ctx: CanvasRenderingContext2D, cx: number, torsoY: number): void {
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

function drawShoulders(ctx: CanvasRenderingContext2D, cx: number): void {
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

function drawArms(
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

function drawHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  attacking: boolean
): void {
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

  ctx.fillStyle = '#160606';
  ctx.fillRect(cx - 9, headY, 7, 4);
  ctx.fillRect(cx + 2, headY, 7, 4);

  ctx.shadowColor = '#ff2a00';
  ctx.shadowBlur = attacking ? 10 : 7;
  ctx.fillStyle = attacking ? '#ff2100' : '#ff4a12';
  ctx.fillRect(cx - 8, headY + 1, attacking ? 6 : 5, 2);
  ctx.fillRect(cx + 3, headY + 1, attacking ? 6 : 5, 2);
  ctx.fillStyle = '#ffd15a';
  ctx.fillRect(cx - 7, headY + 1, 2, 1);
  ctx.fillRect(cx + 4, headY + 1, 2, 1);
  ctx.shadowBlur = 0;

  ctx.fillStyle = attacking ? '#ff2a00' : '#1a0706';
  ctx.fillRect(cx - 6, headY + 7, 12, attacking ? 4 : 3);
  ctx.fillStyle = '#d6c09a';
  ctx.fillRect(cx - 5, headY + 7, 2, 2);
  ctx.fillRect(cx - 1, headY + 7, 2, 2);
  ctx.fillRect(cx + 3, headY + 7, 2, 2);
}

function applySpriteRimLight(ctx: CanvasRenderingContext2D): void {
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

/**
 * Generates an ammo box pickup.
 */
function generateAmmoTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const centerX = SPRITE_TEXTURE_SIZE / 2;
  const centerY = SPRITE_TEXTURE_SIZE / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(centerX - 12, centerY + 14, 24, 4);

  ctx.fillStyle = '#c65';
  ctx.fillRect(centerX - 12, centerY - 10, 24, 24);

  ctx.fillStyle = '#a54';
  ctx.fillRect(centerX - 12, centerY - 10, 24, 4);

  ctx.fillStyle = '#ffe082';
  ctx.fillRect(centerX - 2, centerY - 4, 4, 12);
  ctx.fillRect(centerX - 6, centerY, 12, 4);

  ctx.fillStyle = '#fb8';
  ctx.fillRect(centerX - 12, centerY - 2, 3, 8);
  ctx.fillRect(centerX + 9, centerY - 2, 3, 8);

  ctx.strokeStyle = 'rgba(255,255,200,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 12, centerY + 14);
  ctx.lineTo(centerX - 12, centerY - 10);
  ctx.lineTo(centerX + 12, centerY - 10);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(centerX + 12, centerY - 10);
  ctx.lineTo(centerX + 12, centerY + 14);
  ctx.lineTo(centerX - 12, centerY + 14);
  ctx.stroke();

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/**
 * Generates a health pack pickup.
 */
function generateHealthTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const centerX = SPRITE_TEXTURE_SIZE / 2;
  const centerY = SPRITE_TEXTURE_SIZE / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(centerX - 10, centerY + 12, 20, 4);

  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(centerX - 10, centerY - 8, 20, 20);

  ctx.fillStyle = '#4c4';
  ctx.fillRect(centerX - 3, centerY - 6, 6, 12);
  ctx.fillRect(centerX - 6, centerY - 3, 12, 6);

  ctx.fillStyle = '#bbb';
  ctx.fillRect(centerX - 10, centerY - 8, 20, 2);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#4c4';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(68,204,68,0.3)';
  ctx.fillRect(centerX - 6, centerY - 6, 12, 12);
  ctx.restore();

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/**
 * Glowing sci-fi keycard — blue card with chip and circuit details.
 */
function generateKeycardTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;
  const cy = 32;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - 18, cy + 18, 36, 4);

  // Card body — rounded rectangle, glowing blue
  const cardW = 36;
  const cardH = 26;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  // Card background gradient
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#1a5a9c');
  cardGrad.addColorStop(0.5, '#2070cc');
  cardGrad.addColorStop(1, '#1a5a9c');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();

  // Card border (bright edge)
  ctx.strokeStyle = '#5ab8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.stroke();

  // Gold chip (top-left)
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(cardX + 4, cardY + 4, 8, 6);
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(cardX + 5, cardY + 5, 6, 4);

  // Circuit lines on card
  ctx.strokeStyle = '#5ab8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 5);
  ctx.lineTo(cardX + 28, cardY + 5);
  ctx.lineTo(cardX + 30, cardY + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 10);
  ctx.lineTo(cardX + 26, cardY + 10);
  ctx.stroke();

  // Barcode lines (bottom)
  ctx.fillStyle = '#5ab8ff';
  ctx.fillRect(cardX + 4, cardY + 16, 2, 8);
  ctx.fillRect(cardX + 8, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 11, cardY + 16, 3, 8);
  ctx.fillRect(cardX + 16, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 19, cardY + 16, 2, 8);
  ctx.fillRect(cardX + 23, cardY + 16, 1, 8);
  ctx.fillRect(cardX + 26, cardY + 16, 3, 8);

  // Glow effect
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#5ab8ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(90, 184, 255, 0.35)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 3);
  ctx.fill();
  ctx.restore();

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/* ------------------------------------------------------------------ */
/* Decor texture generators                                            */
/* ------------------------------------------------------------------ */

/**
 * Rusted explosive barrel — orange-brown with hazard stripes.
 */
function generateBarrelTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 59, 14, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Barrel body
  ctx.fillStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.ellipse(cx, 40, 13, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gradient for cylindrical look
  const bodyGrad = ctx.createLinearGradient(cx - 13, 0, cx + 13, 0);
  bodyGrad.addColorStop(0, '#3a2210');
  bodyGrad.addColorStop(0.3, '#7a4a20');
  bodyGrad.addColorStop(0.6, '#8a5528');
  bodyGrad.addColorStop(1, '#2a1508');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 40, 12, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hazard stripes (black bands)
  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(cx - 12, 28, 24, 3);
  ctx.fillRect(cx - 12, 38, 24, 3);
  ctx.fillRect(cx - 12, 48, 24, 3);

  // Yellow hazard band
  ctx.fillStyle = '#b8960a';
  ctx.fillRect(cx - 11, 33, 22, 4);

  // Top rim
  ctx.fillStyle = '#6a4020';
  ctx.beginPath();
  ctx.ellipse(cx, 21, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2a12';
  ctx.beginPath();
  ctx.ellipse(cx, 21, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rust spots
  ctx.fillStyle = '#8a3010';
  ctx.fillRect(cx - 8, 30, 3, 2);
  ctx.fillRect(cx + 4, 44, 4, 2);
  ctx.fillRect(cx - 5, 50, 2, 3);

  // Skull-like hazard symbol on yellow band
  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(cx - 2, 34, 4, 3);

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/**
 * Old CRT terminal / console with green screen glow.
 */
function generateTerminalTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 60, 18, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Desk / base
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - 18, 48, 36, 6);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx - 18, 53, 36, 3);

  // Monitor body
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 16, 18, 32, 32);

  // Bezel
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 15, 19, 30, 28);

  // Screen (dark green)
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(cx - 12, 22, 24, 22);

  // Green text lines on screen
  ctx.fillStyle = '#33cc33';
  ctx.fillRect(cx - 10, 25, 14, 2);
  ctx.fillRect(cx - 10, 29, 10, 2);
  ctx.fillRect(cx - 10, 33, 16, 2);
  ctx.fillRect(cx - 10, 37, 8, 2);

  // Cursor blink (bright green)
  ctx.fillStyle = '#66ff66';
  ctx.fillRect(cx - 2, 37, 2, 2);

  // Screen glow
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = '#33cc33';
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(51, 204, 51, 0.15)';
  ctx.fillRect(cx - 12, 22, 24, 22);
  ctx.restore();

  // Power LED
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(cx + 10, 46, 2, 2);

  // Keyboard hint
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 14, 44, 28, 4);
  ctx.fillStyle = '#666';
  for (let k = 0; k < 8; k++) {
    ctx.fillRect(cx - 12 + k * 3, 45, 2, 2);
  }

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/**
 * Warning lamp / floor light with pulsing glow.
 */
function generateLampTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, 60, 10, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pole
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 2, 30, 4, 30);

  // Base plate
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cx - 7, 57, 14, 4);

  // Lamp housing
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(cx - 8, 18, 16, 14);

  // Lens (amber/orange)
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(cx - 6, 20, 12, 10);

  // Glow effect
  ctx.save();
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255, 136, 0, 0.8)';
  ctx.fillRect(cx - 5, 21, 10, 8);
  ctx.restore();

  // Bright center
  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(cx - 3, 23, 6, 4);

  // Top cap
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 5, 16, 10, 3);

  // Warning stripes on housing
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 8, 18, 2, 14);
  ctx.fillRect(cx + 6, 18, 2, 14);

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}

/**
 * Scrap metal / tech debris on the floor.
 */
function generateDebrisTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

  const cx = 32;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, 52, 20, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main twisted metal piece
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

  // Rust on metal
  ctx.fillStyle = '#6a3020';
  ctx.fillRect(cx - 10, 40, 6, 3);
  ctx.fillRect(cx + 6, 43, 5, 2);

  // Broken circuit board piece
  ctx.fillStyle = '#1a4a1a';
  ctx.fillRect(cx + 8, 36, 10, 8);
  ctx.fillStyle = '#2a6a2a';
  ctx.fillRect(cx + 10, 38, 6, 4);

  // Gold contacts
  ctx.fillStyle = '#b8960a';
  ctx.fillRect(cx + 10, 37, 2, 1);
  ctx.fillRect(cx + 14, 37, 2, 1);

  // Wire hanging off
  ctx.strokeStyle = '#5a2020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 16, 44);
  ctx.quadraticCurveTo(cx - 22, 48, cx - 20, 52);
  ctx.stroke();

  // Small sparks / bright bits
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 4, 36, 2, 2);
  ctx.fillRect(cx + 14, 38, 1, 2);

  return {
    canvas,
    width: SPRITE_TEXTURE_SIZE,
    height: SPRITE_TEXTURE_SIZE,
    data: ctx.getImageData(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE)
  };
}
