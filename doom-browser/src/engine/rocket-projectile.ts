export class RocketProjectile {
  public x: number;
  public y: number;
  public z: number;
  public dirX: number;
  public dirY: number;
  public speed: number;
  public lifetime: number;
  public age: number = 0;
  public hit: boolean = false;
  public explosionRadius: number;
  public explosionDamage: number;

  constructor(x: number, y: number, z: number, dirX: number, dirY: number, speed: number, lifetime: number = 4, explosionRadius: number = 1.5, explosionDamage: number = 10) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = speed;
    this.lifetime = lifetime;
    this.explosionRadius = explosionRadius;
    this.explosionDamage = explosionDamage;
  }

  update(dt: number): void {
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.age += dt;
  }

  isExpired(): boolean {
    return this.age > this.lifetime;
  }

  checkHit(sprite: { x: number; y: number }): boolean {
    const dx = this.x - sprite.x;
    const dy = this.y - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 0.4;
  }

  explode(enemies: { x: number; y: number; isAlive: boolean; health: number; isDying: boolean; isDead: boolean; hitFlashTimer: number }[]): { killed: number } {
    let killed = 0;
    for (const e of enemies) {
      if (!e.isAlive || e.isDying || e.isDead) continue;
      const dx = this.x - e.x;
      const dy = this.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.explosionRadius) {
        e.health -= this.explosionDamage;
        e.hitFlashTimer = 0.15;
        if (e.health <= 0) {
          e.isAlive = false;
          e.isDying = true;
          e.health = 0;
          killed++;
        }
      }
    }
    return { killed };
  }
}
