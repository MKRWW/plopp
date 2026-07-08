/**
 * Unit tests for hud-renderer.ts
 * Tests that drawHUD() executes without crashing with valid and edge-case contexts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { drawHUD, type HUDContext } from '../hud-renderer';
import { createEffectsState } from '../effects';
import { Player } from '../../player/player';
import { WeaponInventory } from '../../game/weapons';
import { WEAPONS } from '../../game/weapons';
import { createMockCollectableSprite } from '../../__tests__/utils/mocks';
import { LevelFlowState } from '../level-flow';
import { generateLevel } from '../level-gen';

describe('hud-renderer', () => {
  let ctx: HUDContext;
  let canvas: HTMLCanvasElement;
  let c2d: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    c2d = canvas.getContext('2d')!;

    const player = new Player(5, 5);
    const inventory = new WeaponInventory();
    inventory.addWeapon(WEAPONS[0]);

    const level = generateLevel(1, 42);
    const sprites: Sprite[] = [];

    ctx = {
      ctx: c2d,
      player,
      inventory,
      sprites,
      effectsState: createEffectsState(),
      hasYellowKeycard: false,
      hasBlueKeycard: false,
      keycardPickupMessage: 0,
      doorMessage: '',
      doorMessageTimer: 0,
      weaponFlashTimer: 0,
      weaponFlashName: '',
      weaponFlashDuration: 1.5,
      levelFlowState: {
        baseSeed: 42,
        stage: 1,
        currentLevel: level,
        isLoading: false,
        pendingLevel: null,
        loadingProgress: 0,
        loadingTargetStage: 0,
        loadingAnimStart: 0,
        stageBannerTimer: 0,
      },
      berserkTimer: 0,
      berserkDuration: 10,
    };
  });

  it('drawHUD runs without crashing (base case)', () => {
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with health at 50%', () => {
    ctx.player.health = 50;
    ctx.player.maxHealth = 100;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with armor > 0', () => {
    ctx.player.armor = 50;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with low health (red bar)', () => {
    ctx.player.health = 10;
    ctx.player.maxHealth = 100;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with yellow keycard', () => {
    ctx.hasYellowKeycard = true;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with door message', () => {
    ctx.doorMessage = 'DOOR OPENING';
    ctx.doorMessageTimer = 1.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with locked door message', () => {
    ctx.doorMessage = 'LOCKED: BLUE KEYCARD REQUIRED';
    ctx.doorMessageTimer = 1.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with berserk active', () => {
    ctx.berserkTimer = 5.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with weapon flash', () => {
    ctx.weaponFlashTimer = 1.0;
    ctx.weaponFlashName = 'SHOTGUN';
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with stage banner', () => {
    ctx.levelFlowState.stageBannerTimer = 1.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with keycard pickup message', () => {
    ctx.keycardPickupMessage = 1.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with collectable sprite nearby', () => {
    const sprite = createMockCollectableSprite(5.1, 5.1, 'ammo');
    ctx.sprites = [sprite];
    ctx.player.x = 5.0;
    ctx.player.y = 5.0;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with sprinting', () => {
    ctx.effectsState.isSprinting = true;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with high score', () => {
    ctx.player.score = 99999;
    expect(() => drawHUD(ctx)).not.toThrow();
  });

  it('drawHUD with kills', () => {
    ctx.inventory.kills = 42;
    expect(() => drawHUD(ctx)).not.toThrow();
  });
});
