/**
 * Sprite system for the raycasting renderer.
 *
 * Sprites are world objects independent from the tile grid: enemies, items,
 * pickups, and decorations. They are projected into camera space and rendered
 * with a z-buffer depth test.
 */

import { Texture } from './textures';

// Enemy AI awareness constants
export const AI_AWARENESS_RADIUS = 8.0;
export const AI_GUNSHOT_RADIUS = 12.0;
export const AI_ALERT_TO_CHASE_DELAY = 1.0;
export const AI_CHASE_TO_ALERT_DELAY = 6.0;
export const AI_IDLE_PATROL_RADIUS = 1.0;

export enum EnemyAIState {
  IDLE = 'idle',
  ALERT = 'alert',
  CHASE = 'chase'
}

export enum SpriteType {
  ENEMY = 'enemy',
  SHOOTER = 'shooter',
  LATCHER = 'latcher',
  BOSS = 'boss',
  AMMO = 'ammo',
  HEALTH = 'health',
  KEYCARD = 'keycard',
  YELLOW_KEYCARD = 'yellow_keycard',
  BARREL = 'barrel',
  TERMINAL = 'terminal',
  LAMP = 'lamp',
  DEBRIS = 'debris',
  WEAPON_SHOTGUN = 'weapon_shotgun',
  WEAPON_ROCKETLAUNCHER = 'weapon_rocketlauncher',
  ARMOR = 'armor',
  BERSERK = 'berserk'
}

/**
 * Returns true for sprites that the player can pick up (collectables).
 * Deco sprites (BARREL, TERMINAL, LAMP, DEBRIS), ENEMY and SHOOTER return false.
 */
export function isCollectableSprite(type: SpriteType): boolean {
  return (
    type === SpriteType.AMMO ||
    type === SpriteType.HEALTH ||
    type === SpriteType.KEYCARD ||
    type === SpriteType.YELLOW_KEYCARD ||
    type === SpriteType.WEAPON_SHOTGUN ||
    type === SpriteType.WEAPON_ROCKETLAUNCHER ||
    type === SpriteType.ARMOR ||
    type === SpriteType.BERSERK
  );
}

/**
 * Enemy class distinguishes Grunt (melee), Shooter (ranged), and Latcher
 * (pounce-and-bite, fragile but fast).
 */
export enum EnemyClass {
  GRUNT = 'grunt',
  SHOOTER = 'shooter',
  LATCHER = 'latcher',
  BOSS = 'boss'
}

/** Shooter behavior constants (spec) */
export const AI_SHOOTER_RANGE = 5.0;
export const AI_SHOOTER_MIN_DIST = 3.0;
export const AI_SHOOTER_COOLDOWN = 2.5;
export const AI_SHOOTER_DAMAGE = 25;
export const AI_SHOOTER_MOVE_SPEED = 1.5;

/**
 * Latcher behavior constants. Latchers are small, fragile, and lethal at
 * close range. Their gimmick is the wind-up-then-leap arc: they freeze
 * briefly when in leap range, then launch in a parabolic arc that ignores
 * collisions for its duration. Touch damage on impact.
 */
export const AI_LATCHER_MOVE_SPEED = 2.5;        // walking-approach speed
export const AI_LATCHER_LEAP_RANGE = 3.0;        // start wind-up at this dist
export const AI_LATCHER_LEAP_MIN_DIST = 0.6;     // too close, latch instead
export const AI_LATCHER_WINDUP_DURATION = 0.4;   // crouch / tell before jump
export const AI_LATCHER_LEAP_DURATION = 0.55;    // time spent airborne
export const AI_LATCHER_LEAP_SPEED = 8.0;        // horizontal travel speed in arc
export const AI_LATCHER_LEAP_COOLDOWN = 1.8;     // post-landing recovery
export const AI_LATCHER_DAMAGE = 30;             // bite damage on contact
export const AI_LATCHER_CONTACT_RADIUS = 0.55;   // touch radius for bite

/** Boss behavior constants. Placeholder — Task 3 adds phases. */
export const AI_BOSS_SPEED = 1.2;                // tiles/s, slow but deliberate
export const AI_BOSS_HP = 30;                    // takes many hits
export const AI_BOSS_ATTACK_RANGE = 0.8;         // tiles, close-range melee
export const AI_BOSS_ATTACK_DAMAGE = 25;         // per hit
export const AI_BOSS_ATTACK_COOLDOWN = 1.5;      // seconds between attacks

/** Boss phase-specific constants (Task 3). */
export const BOSS_VOLLEY_COOLDOWN = 2.0;         // seconds between volleys
export const BOSS_VOLLEY_FAN_DEG = 30;           // total fan width in degrees
export const BOSS_VOLLEY_DAMAGE = 12;            // per projectile that lands on player
export const BOSS_VOLLEY_PROJECTILE_SPEED = 14;
export const BOSS_VOLLEY_PROJECTILE_LIFE = 1.2;
export const BOSS_RAGE_SPEED_MULTIPLIER = 2.0;
export const BOSS_RAGE_DAMAGE_MULTIPLIER = 1.25;

export enum LatcherState {
  APPROACH = 'approach',
  WINDUP = 'windup',
  LEAP = 'leap',
  RECOVER = 'recover'
}

/** Boss phase state machine (driven by HP thresholds — see enemy-ai.ts). */
export enum BossPhase {
  MELEE = 'melee',
  VOLLEY = 'volley',
  RAGE = 'rage'
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

  // AI Awareness state (only meaningful for SpriteType.ENEMY)
  public aiState: EnemyAIState = EnemyAIState.IDLE;

  // IDLE patrol: original spawn position and wander parameters
  public spawnX: number = 0;
  public spawnY: number = 0;
  public idleWanderTargetX: number = 0;
  public idleWanderTargetY: number = 0;
  public idleWanderTimer: number = 0;

  // ALERT timer: countdown (in seconds) before transitioning to CHASE
  public alertTimer: number = 0;

  // Alert fadeout timer: countdown (in seconds) before transitioning back to IDLE
  public alertFadeoutTimer: number = 0;

  // Gunshot awareness: time (in seconds, absolute) when this enemy was last alerted by a gunshot
  public heardGunshotTime: number = 0;

  // Enemy state
  public isAlive: boolean = true;
  public health: number = 3;
  public attackTimer: number = 0;

  // Enemy class (Grunt vs Shooter)
  public enemyClass: EnemyClass = EnemyClass.GRUNT;

  // Shooter-specific fields
  public shooterRange: number = AI_SHOOTER_RANGE;
  public shooterMinDist: number = AI_SHOOTER_MIN_DIST;
  public shooterCooldown: number = AI_SHOOTER_COOLDOWN;
  public shooterDamage: number = AI_SHOOTER_DAMAGE;

  // Muzzle flash visual feedback for shooter
  public muzzleFlashTimer: number = 0;

  // Latcher-specific state machine + timers.
  public latcherState: LatcherState = LatcherState.APPROACH;
  public latcherStateTimer: number = 0;
  public leapStartX: number = 0;
  public leapStartY: number = 0;
  public leapTargetX: number = 0;
  public leapTargetY: number = 0;
  /** 0..1 progress through the current leap arc. Drives vertical offset. */
  public leapProgress: number = 0;

  // Hit feedback & death animation
  public isDying: boolean = false;
  public hitFlashTimer: number = 0;
  public deathTimer: number = 0;
  public deathDuration: number = 0.45;

  // Corpse persistence (dead state after death animation)
  public isDead: boolean = false;
  public corpseTexture: Texture | null = null;

  // Death event marker — set once blood particles have been spawned for the
  // alive → dying transition. Renderer-only, no AI involvement.
  public bloodSpawned: boolean = false;

  // Idle voice cooldown: seconds until next class-specific idle sound.
  // Counts down while in IDLE state. Starts randomized 3–6 s.
  public idleSoundCooldown: number = (Math.random() * 3) + 3;

  // Boss-specific fields (only meaningful for EnemyClass.BOSS)
  public bossPhase: BossPhase = BossPhase.MELEE;
  public bossVolleyTimer: number = 0;
  public bossRageActivated: boolean = false;

  constructor(x: number, y: number, type: SpriteType, texture: Texture | null = null) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.texture = texture;
    if (texture) {
      this.textures = [texture];
    }
    if (type === SpriteType.ENEMY || type === SpriteType.SHOOTER || type === SpriteType.LATCHER || type === SpriteType.BOSS) {
      this.spawnX = x;
      this.spawnY = y;
      this.aiState = EnemyAIState.IDLE;
    }
  }

  /**
   * Returns true if this sprite is an enemy (ENEMY, SHOOTER, LATCHER, or BOSS).
   */
  public get isEnemy(): boolean {
    return this.type === SpriteType.ENEMY || this.type === SpriteType.SHOOTER || this.type === SpriteType.LATCHER || this.type === SpriteType.BOSS;
  }

  /**
   * Returns true if this sprite is a boss enemy.
   */
  public get isBoss(): boolean {
    return this.enemyClass === EnemyClass.BOSS;
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

    // Animation phase ticks for collectables (item bob) and enemies (idle micro-anim).
    if (
      isCollectableSprite(this.type) ||
      this.type === SpriteType.ENEMY ||
      this.type === SpriteType.SHOOTER ||
      this.type === SpriteType.LATCHER ||
      this.type === SpriteType.BOSS
    ) {
      this.floatingPhase += deltaTime * 2.0;
    }
  }

  public getFloatingOffset(): number {
    if (isCollectableSprite(this.type)) {
      return Math.sin(this.floatingPhase) * 0.05;
    }
    return 0;
  }
}

// Re-export für Rückwärtskompatibilität — Aufrufer importieren
// generateSpriteTextures weiterhin aus './sprite'.
export { generateSpriteTextures } from './sprite-textures';
export type { SpriteTextureSet } from './sprite-textures';
