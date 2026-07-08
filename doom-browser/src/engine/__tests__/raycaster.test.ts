/**
 * Unit tests for raycaster.ts
 * Tests that castRays(), drawFloorAndCeiling(), and drawTexturedColumn()
 * execute without crashing with valid contexts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { castRays, drawFloorAndCeiling, drawTexturedColumn, type RaycasterContext } from '../raycaster';
import { Player } from '../../player/player';
import { TextureManager } from '../textures';
import { ZBuffer } from '../zbuffer';
import { createMockTexture } from '../../__tests__/utils/mocks';

const SCREEN_WIDTH = 640;

describe('raycaster', () => {
  let ctx: RaycasterContext;
  let canvas: HTMLCanvasElement;
  let c2d: CanvasRenderingContext2D;
  let zBuffer: ZBuffer;
  let textureManager: TextureManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = SCREEN_WIDTH;
    canvas.height = 480;
    c2d = canvas.getContext('2d')!;

    zBuffer = new ZBuffer(SCREEN_WIDTH);
    textureManager = new TextureManager();
    textureManager.initialize();

    const player = new Player(5, 5);

    ctx = {
      ctx: c2d,
      player,
      textureManager,
      zBuffer,
    };
  });

  it('castRays runs without crashing (base case)', () => {
    expect(() => castRays(ctx)).not.toThrow();
  });

  it('castRays populates z-buffer with positive distances', () => {
    castRays(ctx);
    // Check a few z-buffer values are positive (walls should be in front)
    let hasPositive = false;
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      if (ctx.zBuffer.get(x) > 0) {
        hasPositive = true;
        break;
      }
    }
    expect(hasPositive).toBe(true);
  });

  it('castRays with player at different position', () => {
    ctx.player.x = 10;
    ctx.player.y = 10;
    expect(() => castRays(ctx)).not.toThrow();
  });

  it('castRays after player rotation', () => {
    ctx.player.rotate(Math.PI / 4);
    expect(() => castRays(ctx)).not.toThrow();
  });

  it('drawFloorAndCeiling runs without crashing', () => {
    expect(() => drawFloorAndCeiling(ctx)).not.toThrow();
  });

  it('drawTexturedColumn runs without crashing', () => {
    const tex = createMockTexture(128, 128, 128, 255, 64, 64);
    expect(() => drawTexturedColumn(ctx, 100, 100, 300, 200, tex, 0.5, 1.0)).not.toThrow();
  });

  it('drawTexturedColumn with door animation progress', () => {
    const tex = createMockTexture(128, 128, 128, 255, 64, 64);
    expect(() => drawTexturedColumn(ctx, 100, 100, 300, 200, tex, 0.5, 1.0, 0.5)).not.toThrow();
  });

  it('drawTexturedColumn with zero visible height returns early', () => {
    const tex = createMockTexture(128, 128, 128, 255, 64, 64);
    // drawStart == drawEnd means zero height
    expect(() => drawTexturedColumn(ctx, 100, 300, 300, 200, tex, 0.5, 1.0)).not.toThrow();
  });
});
