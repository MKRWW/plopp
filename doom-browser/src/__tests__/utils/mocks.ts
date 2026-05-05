import { GameState } from '../../game/state';
import { WeaponState } from '../../game/weapon';
import { Sprite } from '../../engine/sprite';
import { Texture } from '../../engine/textures';

export class MockRenderer {
  public lastCanvasWidth = 0;
  public lastCanvasHeight = 0;
  public renderCalls: Array<{ ctx: CanvasRenderingContext2D; width: number; height: number }> = [];
  public startCalls = 0;
  public disposeCalls = 0;

  start(): void { this.startCalls++; }
  dispose(): void { this.disposeCalls++; }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.renderCalls.push({ ctx, width, height });
    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
  }
}

export class MockGameStateManager {
  public state: GameState;
  public transitions: Array<{ from: GameState; to: GameState }> = [];
  public renderCalls: number = 0;

  constructor(initialState: GameState = GameState.MENU) {
    this.state = initialState;
  }

  getState(): GameState {
    return this.state;
  }

  transitionTo(newState: GameState): void {
    this.transitions.push({ from: this.state, to: newState });
    this.state = newState;
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number, health?: number, progress?: number, stage?: number): void {
    this.renderCalls++;
  }
}

export class MockSoundManager {
  public playCalls: Array<{ type: string }> = [];
  public stopCalls = 0;
  public enabled = true;

  init(): void {}
  play(type: string): void { this.playCalls.push({ type }); }
  stop(): void { this.stopCalls++; }
  toggle(): void { this.enabled = !this.enabled; }
  isEnabled(): boolean { return this.enabled; }
  setMusicVolume(_vol: number): void {}
  startMusic(): void {}
  stopMusic(): void {}
}

export class MockWeapon {
  public ammo: number = 50;
  public health: number = 100;
  public state: WeaponState = WeaponState.IDLE;
  public fireCalls = 0;
  public killCount = 0;
  public hitCount = 0;
  public maxAmmo = 200;
  public maxHealth = 100;

  fire(): boolean {
    this.fireCalls++;
    if (this.ammo <= 0) return false;
    this.ammo--;
    return true;
  }

  addAmmo(amount: number): void {
    this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
  }

  addHealth(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.hitCount++;
  }

  update(_dt: number, _moving: boolean): void {}
  getBobOffset(): number { return 0; }
  getBobXOffset(): number { return 0; }
  getRecoilY(): number { return 0; }
  getRecoilX(): number { return 0; }
  isDead(): boolean { return this.health <= 0; }
  reset(): void {
    this.health = this.maxHealth;
    this.ammo = 50;
    this.killCount = 0;
    this.hitCount = 0;
    this.state = WeaponState.IDLE;
  }
}

export function createMockTexture(
  r: number = 128, g: number = 128, b: number = 128, a: number = 255,
  width: number = 64, height: number = 64
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);

  return { canvas, width, height, data: imgData };
}

export function createMockEnemySprite(x: number = 5, y: number = 5): Sprite {
  const tex = createMockTexture(180, 50, 50);
  const sprite = new Sprite(x, y, 'enemy' as any, tex);
  sprite.texture = tex;
  sprite.textures = [tex];
  sprite.angleViews = [[tex, tex, tex, tex, tex, tex, tex, tex]];
  sprite.health = 3;
  sprite.isAlive = true;
  sprite.isDying = false;
  sprite.isDead = false;
  sprite.deathDuration = 0.45;
  return sprite;
}

export function createMockCollectableSprite(x: number = 3, y: number = 3, type: 'ammo' | 'health' | 'keycard' = 'ammo'): Sprite {
  const tex = createMockTexture(50, 180, 50);
  const sprite = new Sprite(x, y, type as any, tex);
  sprite.texture = tex;
  sprite.textures = [tex];
  sprite.animationSpeed = 0.12;
  return sprite;
}
