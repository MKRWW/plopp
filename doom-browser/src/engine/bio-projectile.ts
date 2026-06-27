import { positionCollides } from './collision';

/**
 * Visual-only bio projectile fired by the Spitter. Travels along a fixed ray
 * from the spitter's emitter toward the player's position at the moment of
 * firing. Does not deal damage — gameplay-side the spitter's hitscan already
 * applied damage when this was spawned. The projectile exists purely for the
 * "fehlt doch was die projektil optik" feedback loop.
 *
 * Lifecycle:
 *   flying  → splat (on hit / lifetime expiry) → removed
 */
export class BioProjectile {
  public x: number;
  public y: number;
  public dirX: number;
  public dirY: number;
  public speed: number;
  public lifetime: number;
  public age: number = 0;

  /** Damage to apply on player collision. Default 0 (visual-only). */
  public damage: number = 0;

  /** Prevents applying damage more than once (e.g. projectile lingers on player). */
  public hasDamaged: boolean = false;

  /** Splat phase counts down once the glob has hit or expired. */
  public splatTimer: number = 0;
  public readonly splatDuration: number = 0.18;

  constructor(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number = 18,
    lifetime: number = 0.4,
    damage: number = 0
  ) {
    this.x = x;
    this.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = speed;
    this.lifetime = lifetime;
    this.damage = damage;
  }

  /**
   * Advance the projectile. Returns true once the splat phase is done and
   * the projectile should be removed from the renderer's list.
   */
  update(dt: number): boolean {
    if (this.splatTimer > 0) {
      this.splatTimer -= dt;
      return this.splatTimer <= 0;
    }

    this.age += dt;
    if (this.age >= this.lifetime) {
      this.triggerSplat();
      return false;
    }

    const newX = this.x + this.dirX * this.speed * dt;
    const newY = this.y + this.dirY * this.speed * dt;

    if (positionCollides(newX, newY, 0.05)) {
      this.triggerSplat();
      return false;
    }

    this.x = newX;
    this.y = newY;
    return false;
  }

  triggerSplat(): void {
    if (this.splatTimer <= 0) {
      this.splatTimer = this.splatDuration;
    }
  }

  get isSplatting(): boolean {
    return this.splatTimer > 0;
  }
}
