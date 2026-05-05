import { Player } from '../../player/player';
import { Sprite, SpriteType } from '../../engine/sprite';

export function createTestPlayer(x: number = 1.5, y: number = 1.5): Player {
  const player = new Player(x, y);
  player.dirX = 1;
  player.dirY = 0;
  player.planeX = 0;
  player.planeY = 0.66;
  return player;
}

export function createTestSprites(): Sprite[] {
  const { createMockEnemySprite } = require('./mocks');

  const aliveEnemy = createMockEnemySprite(5, 5);
  const deadEnemy = createDeadEnemySprite(8, 8);

  const ammoCanvas = document.createElement('canvas');
  ammoCanvas.width = 64;
  ammoCanvas.height = 64;
  const ammoCtx = ammoCanvas.getContext('2d')!;
  ammoCtx.fillStyle = 'rgba(180,180,50,255)';
  ammoCtx.fillRect(0, 0, 64, 64);
  const ammoImgData = ammoCtx.getImageData(0, 0, 64, 64);
  const ammoTexture = { canvas: ammoCanvas, width: 64, height: 64, data: ammoImgData };
  const ammoSprite = new Sprite(3, 3, SpriteType.AMMO, ammoTexture);
  ammoSprite.texture = ammoTexture;

  return [aliveEnemy, deadEnemy, ammoSprite];
}

export function createDeadEnemySprite(x: number = 5, y: number = 5): Sprite {
  const { createMockEnemySprite } = require('./mocks');
  const sprite = createMockEnemySprite(x, y);
  sprite.isAlive = false;
  sprite.isDying = false;
  sprite.isDead = true;
  sprite.health = 0;
  sprite.deathTimer = 1.0;
  return sprite;
}

export function createDyingEnemySprite(x: number = 5, y: number = 5): Sprite {
  const { createMockEnemySprite } = require('./mocks');
  const sprite = createMockEnemySprite(x, y);
  sprite.isAlive = false;
  sprite.isDying = true;
  sprite.isDead = false;
  sprite.health = 0;
  sprite.deathTimer = 0.3;
  return sprite;
}

export function resetAllGlobals(): void {
  // No-op for now - will be extended if needed
}

export function advanceTime(deltaTime: number): number {
  return deltaTime;
}
