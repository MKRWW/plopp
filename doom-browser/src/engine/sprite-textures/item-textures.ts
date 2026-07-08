import { Texture } from '../textures';
import { SPRITE_TEXTURE_SIZE, texFromCanvas } from './shared';

export function generateAmmoFront(): Texture {
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

export function generateAmmoBack(): Texture {
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

export function generateHealthFront(): Texture {
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

export function generateHealthBack(): Texture {
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

export function generateKeycardFront(): Texture {
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

export function generateKeycardBack(): Texture {
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

export function generateYellowKeycardFront(): Texture {
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

export function generateYellowKeycardBack(): Texture {
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


/* ------------------------------------------------------------------ */
/* Decor (no shadows baked in)                                         */
/* ------------------------------------------------------------------ */

export function generateBarrelTexture(): Texture {
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

export function generateTerminalTexture(): Texture {
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

export function generateLampTexture(): Texture {
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

export function generateDebrisTexture(): Texture {
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

export function generateShotgunFront(): Texture {
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

export function generateShotgunBack(): Texture {
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

export function generateRocketLauncherFront(): Texture {
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

export function generateRocketLauncherBack(): Texture {
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
/* Powerup pickup textures: Armor (cyan shield) + Berserk (red star)  */
/* ------------------------------------------------------------------ */

export function generateArmorFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32, cy = 32;

  // Shield shape: inverted pentagon (flat top, pointed bottom)
  ctx.fillStyle = '#0cc';
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 14);
  ctx.lineTo(cx + 18, cy - 14);
  ctx.lineTo(cx + 18, cy + 2);
  ctx.lineTo(cx, cy + 18);
  ctx.lineTo(cx - 18, cy + 2);
  ctx.closePath();
  ctx.fill();

  // Darker border
  ctx.strokeStyle = '#066';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Upper-left highlight
  ctx.fillStyle = '#0ff';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 10);
  ctx.lineTo(cx - 2, cy - 10);
  ctx.lineTo(cx - 2, cy);
  ctx.lineTo(cx - 14, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Center cross (shield emblem)
  ctx.strokeStyle = '#066';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 10);
  ctx.moveTo(cx - 8, cy - 2);
  ctx.lineTo(cx + 8, cy - 2);
  ctx.stroke();

  return texFromCanvas(canvas, ctx);
}

export function generateArmorBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32, cy = 32;

  // Shield back: darker
  ctx.fillStyle = '#066';
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 14);
  ctx.lineTo(cx + 18, cy - 14);
  ctx.lineTo(cx + 18, cy + 2);
  ctx.lineTo(cx, cy + 18);
  ctx.lineTo(cx - 18, cy + 2);
  ctx.closePath();
  ctx.fill();

  // Rivet details
  ctx.fillStyle = '#099';
  ctx.beginPath(); ctx.arc(cx - 12, cy - 8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 12, cy - 8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 8, cy + 8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 8, cy + 8, 1.5, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

export function generateBerserkFront(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32, cy = 32;

  // 4-pointed star
  ctx.fillStyle = '#f22';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.lineTo(cx + 22, cy);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx, cy + 22);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.lineTo(cx - 22, cy);
  ctx.lineTo(cx - 6, cy - 6);
  ctx.closePath();
  ctx.fill();

  // Darker border
  ctx.strokeStyle = '#a00';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bright center
  ctx.fillStyle = '#f88';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Radiating lines for "power" feel
  ctx.strokeStyle = '#f88';
  ctx.lineWidth = 1.5;
  const angles = [-0.6, 0, 0.6];
  for (const a of angles) {
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * 8, cy + dir * 8 * Math.cos(a));
      ctx.lineTo(cx + Math.sin(a) * 16, cy + dir * 16 * Math.cos(a));
      ctx.stroke();
    }
  }

  return texFromCanvas(canvas, ctx);
}

export function generateBerserkBack(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_TEXTURE_SIZE;
  canvas.height = SPRITE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  const cx = 32, cy = 32;

  // Back: darker star
  ctx.fillStyle = '#a00';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.lineTo(cx + 22, cy);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx, cy + 22);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.lineTo(cx - 22, cy);
  ctx.lineTo(cx - 6, cy - 6);
  ctx.closePath();
  ctx.fill();

  // Center dimmer
  ctx.fillStyle = '#c44';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
  ctx.restore();

  return texFromCanvas(canvas, ctx);
}

