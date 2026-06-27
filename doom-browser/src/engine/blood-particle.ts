/**
 * Tiny blood / gore droplet spawned when an enemy starts dying. Pure visual,
 * follows a ballistic arc with gravity, fades alpha over its lifetime, and
 * is removed when the splat-floor timer expires.
 *
 * Color is class-specific so a Husk leaves teal-tinted ichor and a Spitter
 * leaves green bio. The Latcher will fall back to red.
 */
export class BloodParticle {
  public x: number;
  public y: number;
  /** Vertical offset in tile units. 0 = sprite mid-height. */
  public z: number;
  public vx: number;
  public vy: number;
  public vz: number;
  public life: number;
  public maxLife: number;
  public color: string;

  constructor(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    color: string
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.color = color;
  }

  /** Advance ballistic motion. Returns true once the particle should be culled. */
  update(dt: number): boolean {
    this.life -= dt;
    if (this.life <= 0) return true;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // Simple gravity in z (downward in world).
    this.vz -= 4.5 * dt;

    // Once a droplet falls below the floor, just freeze it as a splat smear.
    if (this.z < -0.3) {
      this.z = -0.3;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
    }
    return false;
  }

  /** 0..1 alpha based on remaining life. */
  get alpha(): number {
    return Math.max(0, Math.min(1, this.life / this.maxLife));
  }
}
