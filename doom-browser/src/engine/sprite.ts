/**
 * Sprite system for the raycasting renderer.
 *
 * Sprites are world objects independent from the tile grid: enemies, items,
 * pickups, and decorations. They are projected into camera space and rendered
 * with a z-buffer depth test.
 */

import { Texture } from './textures';

export enum SpriteType {
  ENEMY = 'enemy',
  AMMO = 'ammo',
  HEALTH = 'health',
  KEYCARD = 'keycard',
  YELLOW_KEYCARD = 'yellow_keycard',
  BARREL = 'barrel',
  TERMINAL = 'terminal',
  LAMP = 'lamp',
  DEBRIS = 'debris',
  WEAPON_SHOTGUN = 'weapon_shotgun',
  WEAPON_ROCKETLAUNCHER = 'weapon_rocketlauncher'
}

/**
 * Returns true for sprites that the player can pick up (collectables).
 * Deco sprites (BARREL, TERMINAL, LAMP, DEBRIS) and ENEMY return false.
 */
export function isCollectableSprite(type: SpriteType): boolean {
  return (
    type === SpriteType.AMMO ||
    type === SpriteType.HEALTH ||
    type === SpriteType.KEYCARD ||
    type === SpriteType.YELLOW_KEYCARD ||
    type === SpriteType.WEAPON_SHOTGUN ||
    type === SpriteType.WEAPON_ROCKETLAUNCHER
  );
}

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

  // 8-direction sprite support: angleViews[poseIdx][angleIdx 0..7]
  // angleIdx 0 = front, 4 = back, advancing CCW around the sprite.
  public angleViews: Texture[][] = [];
  public facingAngle: number = 0;

  // Enemy state
  public isAlive: boolean = true;
  public health: number = 3;
  public attackTimer: number = 0;

  // Hit feedback & death animation
  public isDying: boolean = false;
  public hitFlashTimer: number = 0;
  public deathTimer: number = 0;
  public deathDuration: number = 0.45;

  // Corpse persistence (dead state after death animation)
  public isDead: boolean = false;
  public corpseTexture: Texture | null = null;

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
   * Returns true if this sprite is a collectable item (AMMO, HEALTH, KEYCARD).
   * Deco sprites (BARREL, TERMINAL, LAMP, DEBRIS) and ENEMY return false.
   */
  public get isCollectable(): boolean {
    return isCollectableSprite(this.type);
  }

  public update(deltaTime: number): void {
    if (this.textures.length > 1) {
      this.frameTimer += deltaTime;
      if (this.frameTimer >= this.animationSpeed) {
        this.frameTimer -= this.animationSpeed;
        this.currentFrame = (this.currentFrame + 1) % this.textures.length;
        this.texture = this.textures[this.currentFrame];
      }
    }

    if (this.type === SpriteType.ENEMY) {
      this.floatingPhase += deltaTime * 2.0;
    }
  }

  public getFloatingOffset(): number {
    if (this.type === SpriteType.ENEMY) {
      return Math.sin(this.floatingPhase) * 0.05;
    }
    return 0;
  }
}

// Re-export für Rückwärtskompatibilität — Aufrufer importieren
// generateSpriteTextures weiterhin aus './sprite'.
export { generateSpriteTextures } from './sprite-textures';
export type { SpriteTextureSet } from './sprite-textures';
