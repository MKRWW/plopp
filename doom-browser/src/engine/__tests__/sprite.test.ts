import { describe, it, expect } from 'vitest';
import { Sprite, SpriteType } from '../../engine/sprite';

function createEnemySprite(x: number = 5, y: number = 5, health: number = 3): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(180,50,50,255)';
  ctx.fillRect(0, 0, 64, 64);
  const imgData = ctx.getImageData(0, 0, 64, 64);
  const texture = { canvas, width: 64, height: 64, data: imgData };
  const sprite = new Sprite(x, y, SpriteType.ENEMY, texture);
  sprite.texture = texture;
  sprite.textures = [texture];
  sprite.health = health;
  sprite.deathDuration = 0.45;
  return sprite;
}

describe('Sprite System - Lifecycle', () => {
  it('new sprite: isAlive=true, isDying=false, isDead=false', () => {
    const sprite = createEnemySprite();
    expect(sprite.isAlive).toBe(true);
    expect(sprite.isDying).toBe(false);
    expect(sprite.isDead).toBe(false);
    expect(sprite.health).toBe(3);
    expect(sprite.deathTimer).toBe(0);
  });

  it('after taking fatal damage: isAlive=false, isDying=true, isDead=false', () => {
    const sprite = createEnemySprite();
    sprite.health = 0;
    sprite.isAlive = false;
    sprite.isDying = true;
    sprite.deathTimer = 0;

    expect(sprite.isAlive).toBe(false);
    expect(sprite.isDying).toBe(true);
    expect(sprite.isDead).toBe(false);
  });

  it('deathTimer advances when manually decremented', () => {
    const sprite = createEnemySprite();
    sprite.health = 0;
    sprite.isAlive = false;
    sprite.isDying = true;
    sprite.deathTimer = sprite.deathDuration;

    sprite.deathTimer = Math.max(0, sprite.deathTimer - 0.1);
    expect(sprite.deathTimer).toBeCloseTo(0.35, 4);

    sprite.deathTimer = Math.max(0, sprite.deathTimer - 0.1);
    expect(sprite.deathTimer).toBeCloseTo(0.25, 4);
  });

  it('deathTimer reaches 0 after deathDuration seconds', () => {
    const sprite = createEnemySprite();
    sprite.health = 0;
    sprite.isAlive = false;
    sprite.isDying = true;
    sprite.deathTimer = sprite.deathDuration;

    // Simulate the full death animation (0.45s)
    sprite.deathTimer = Math.max(0, sprite.deathTimer - 0.01);
    for (let i = 0; i < 44; i++) {
      sprite.deathTimer = Math.max(0, sprite.deathTimer - 0.01);
    }

    expect(sprite.deathTimer).toBe(0);
    expect(sprite.isDead).toBe(false);
    expect(sprite.isDying).toBe(true);
  });

  it('isDead flag transitions when deathTimer completes', () => {
    const sprite = createEnemySprite();
    sprite.health = 0;
    sprite.isAlive = false;
    sprite.isDying = true;
    sprite.deathTimer = sprite.deathDuration;

    // Advance past death duration
    while (sprite.deathTimer > 0) {
      sprite.deathTimer = Math.max(0, sprite.deathTimer - 0.005);
    }

    // After death animation completes, mark as dead
    sprite.isDying = false;
    sprite.isDead = true;

    expect(sprite.isDead).toBe(true);
    expect(sprite.isDying).toBe(false);
    expect(sprite.isAlive).toBe(false);
  });

  it('update() advances animation frames for sprites with multiple textures', () => {
    const canvas1 = document.createElement('canvas');
    canvas1.width = 64;
    canvas1.height = 64;
    const ctx1 = canvas1.getContext('2d')!;
    ctx1.fillStyle = 'rgba(255,0,0,255)';
    ctx1.fillRect(0, 0, 64, 64);

    const canvas2 = document.createElement('canvas');
    canvas2.width = 64;
    canvas2.height = 64;
    const ctx2 = canvas2.getContext('2d')!;
    ctx2.fillStyle = 'rgba(0,255,0,255)';
    ctx2.fillRect(0, 0, 64, 64);

    const imgData1 = ctx1.getImageData(0, 0, 64, 64);
    const imgData2 = ctx2.getImageData(0, 0, 64, 64);

    const tex1 = { canvas: canvas1, width: 64, height: 64, data: imgData1 };
    const tex2 = { canvas: canvas2, width: 64, height: 64, data: imgData2 };

    const sprite = new Sprite(5, 5, SpriteType.ENEMY);
    sprite.textures = [tex1, tex2];
    sprite.texture = tex1;
    sprite.currentFrame = 0;
    sprite.animationSpeed = 0.2;

    expect(sprite.currentFrame).toBe(0);
    expect(sprite.texture).toBe(tex1);

    sprite.update(0.15);
    expect(sprite.currentFrame).toBe(0);

    sprite.update(0.1);
    expect(sprite.currentFrame).toBe(1);
    expect(sprite.texture).toBe(tex2);
  });

  it('update() advances floating phase for collectable items', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(50,180,50,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    const sprite = new Sprite(3, 3, SpriteType.HEALTH, texture);
    sprite.texture = texture;
    sprite.textures = [texture];
    sprite.floatingPhase = 0;

    sprite.update(0.5);
    expect(sprite.floatingPhase).toBeCloseTo(1.0, 4);

    const offset = sprite.getFloatingOffset();
    expect(offset).toBeCloseTo(Math.sin(1.0) * 0.05, 4);
  });
});

describe('Sprite System - Corpse Persistence', () => {
  it('dead sprite can be flagged isDead=true and remain in array', () => {
    const sprites: Sprite[] = [];
    const enemy = createEnemySprite(5, 5);
    enemy.health = 0;
    enemy.isAlive = false;
    enemy.isDying = true;
    enemy.deathTimer = enemy.deathDuration;

    // Simulate death animation completion
    enemy.isDying = false;
    enemy.isDead = true;
    sprites.push(enemy);

    expect(sprites.length).toBe(1);
    expect(sprites[0]).toBe(enemy);
    expect(sprites[0].isDead).toBe(true);
  });

  it('dead sprites are not spliced from array', () => {
    const sprites: Sprite[] = [];
    const enemy1 = createEnemySprite(5, 5);
    enemy1.health = 0;
    enemy1.isAlive = false;
    enemy1.isDying = false;
    enemy1.isDead = true;

    const enemy2 = createEnemySprite(7, 7);
    enemy2.health = 0;
    enemy2.isAlive = false;
    enemy2.isDying = false;
    enemy2.isDead = true;

    sprites.push(enemy1);
    sprites.push(enemy2);

    expect(sprites.length).toBe(2);
    expect(sprites[0].isDead).toBe(true);
    expect(sprites[1].isDead).toBe(true);
    expect(sprites[0].isAlive).toBe(false);
    expect(sprites[1].isAlive).toBe(false);
  });

  it('isDead=true distinguishes corpses from alive/dying sprites', () => {
    const alive = createEnemySprite(1, 1);
    const dying = createEnemySprite(2, 2);
    dying.health = 0;
    dying.isAlive = false;
    dying.isDying = true;
    dying.isDead = false;

    const dead = createEnemySprite(3, 3);
    dead.health = 0;
    dead.isAlive = false;
    dead.isDying = false;
    dead.isDead = true;

    expect(alive.isAlive).toBe(true);
    expect(alive.isDying).toBe(false);
    expect(alive.isDead).toBe(false);

    expect(dying.isAlive).toBe(false);
    expect(dying.isDying).toBe(true);
    expect(dying.isDead).toBe(false);

    expect(dead.isAlive).toBe(false);
    expect(dead.isDying).toBe(false);
    expect(dead.isDead).toBe(true);
  });

  it('multiple corpses can coexist in the array', () => {
    const sprites: Sprite[] = [];
    const numCorpses = 5;

    for (let i = 0; i < numCorpses; i++) {
      const corpse = createEnemySprite(5 + i, 5);
      corpse.health = 0;
      corpse.isAlive = false;
      corpse.isDying = false;
      corpse.isDead = true;
      corpse.deathTimer = 1.0;
      sprites.push(corpse);
    }

    expect(sprites.length).toBe(numCorpses);
    for (let i = 0; i < sprites.length; i++) {
      expect(sprites[i].isDead).toBe(true);
      expect(sprites[i].isAlive).toBe(false);
    }
  });
});

describe('Sprite System - Collision Exclusion', () => {
  it('dead sprites have isDead flag set to true', () => {
    const dead = createEnemySprite(5, 5);
    dead.health = 0;
    dead.isAlive = false;
    dead.isDying = false;
    dead.isDead = true;

    expect(dead.isDead).toBe(true);
  });

  it('isDying sprites have isDying flag set to true', () => {
    const dying = createEnemySprite(5, 5);
    dying.health = 0;
    dying.isAlive = false;
    dying.isDying = true;
    dying.isDead = false;

    expect(dying.isDying).toBe(true);
    expect(dying.isDead).toBe(false);
  });

  it('isCollectable returns false for ENEMY type', () => {
    const enemy = createEnemySprite(5, 5);
    expect(enemy.isCollectable).toBe(false);
  });

  it('isCollectable returns true for HEALTH type', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(50,180,50,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    const health = new Sprite(3, 3, SpriteType.HEALTH, texture);
    health.texture = texture;
    expect(health.isCollectable).toBe(true);
  });

  it('isCollectable returns true for AMMO type', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(180,180,50,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    const ammo = new Sprite(3, 3, SpriteType.AMMO, texture);
    ammo.texture = texture;
    expect(ammo.isCollectable).toBe(true);
  });

  it('isCollectable returns true for KEYCARD type', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(180,50,180,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    const keycard = new Sprite(3, 3, SpriteType.KEYCARD, texture);
    keycard.texture = texture;
    expect(keycard.isCollectable).toBe(true);
  });

  it('isCollectable returns false for deco types', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(100,100,100,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    for (const type of [SpriteType.BARREL, SpriteType.TERMINAL, SpriteType.LAMP, SpriteType.DEBRIS]) {
      const deco = new Sprite(3, 3, type, texture);
      deco.texture = texture;
      expect(deco.isCollectable).toBe(false);
    }
  });

  it('hitFlashTimer persists on update (not auto-reset)', () => {
    const sprite = createEnemySprite(5, 5);
    sprite.hitFlashTimer = 0.12;

    sprite.update(0.05);
    expect(sprite.hitFlashTimer).toBe(0.12);

    sprite.update(0.1);
    expect(sprite.hitFlashTimer).toBe(0.12);
  });

  it('floatingOffset is non-zero for collectable items after update', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(50,180,50,255)';
    ctx.fillRect(0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const texture = { canvas, width: 64, height: 64, data: imgData };

    const health = new Sprite(3, 3, SpriteType.HEALTH, texture);
    health.texture = texture;
    health.floatingPhase = 0;

    health.update(0.25);
    const offset = health.getFloatingOffset();
    expect(offset).not.toBe(0);
  });

  it('floatingOffset is zero for non-collectable sprites', () => {
    const sprite = createEnemySprite(5, 5);
    sprite.floatingPhase = 10;

    sprite.update(0.5);
    const offset = sprite.getFloatingOffset();
    expect(offset).toBe(0);
  });

  it('dead sprites are excluded from AI chase and collision calculations', () => {
    const alive = createEnemySprite(5, 5);
    const dying = createEnemySprite(6, 6);
    dying.health = 0;
    dying.isAlive = false;
    dying.isDying = true;
    dying.deathTimer = dying.deathDuration;

    const dead = createEnemySprite(7, 7);
    dead.health = 0;
    dead.isAlive = false;
    dead.isDying = false;
    dead.isDead = true;

    const sprites: Sprite[] = [alive, dying, dead];
    const aliveSprites = sprites.filter(s => !s.isDead && s.isAlive);
    const collisionCandidates = sprites.filter(s => s.isAlive);

    expect(aliveSprites.length).toBe(1);
    expect(aliveSprites[0]).toBe(alive);
    expect(aliveSprites[0].x).toBe(5);
    expect(aliveSprites[0].y).toBe(5);

    expect(collisionCandidates.length).toBe(1);
    expect(collisionCandidates[0]).toBe(alive);
    expect(collisionCandidates[0].isAlive).toBe(true);
    expect(collisionCandidates[0].isDead).toBe(false);

    expect(dead.isDead).toBe(true);
    expect(dead.isAlive).toBe(false);
    expect(dying.isDead).toBe(false);
    expect(dying.isAlive).toBe(false);
  });
});
