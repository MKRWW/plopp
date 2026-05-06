import { describe, it, expect } from 'vitest';
import { RocketProjectile } from '../rocket-projectile';

function createRocket(x: number = 0, y: number = 0, speed: number = 12, lifetime: number = 4) {
  return new RocketProjectile(x, y, 0.3, 1, 0, speed, lifetime, 1.5, 10);
}

describe('RocketProjectile - Construction', () => {
  it('sets initial position and direction', () => {
    const r = createRocket(5, 5);
    expect(r.x).toBe(5);
    expect(r.y).toBe(5);
    expect(r.z).toBe(0.3);
    expect(r.dirX).toBe(1);
    expect(r.dirY).toBe(0);
  });

  it('default lifetime is 4 seconds', () => {
    const r = createRocket();
    expect(r.lifetime).toBe(4);
  });

  it('sets explosionRadius and explosionDamage from constructor', () => {
    const r = createRocket();
    expect(r.explosionRadius).toBe(1.5);
    expect(r.explosionDamage).toBe(10);
  });

  it('initially not expired', () => {
    const r = createRocket();
    expect(r.age).toBe(0);
    expect(r.isExpired()).toBe(false);
  });
});

describe('RocketProjectile - update', () => {
  it('moves in direction axis per update', () => {
    const r = createRocket(0, 0, 10);
    r.update(0.1);
    expect(r.x).toBeCloseTo(1, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });

  it('ages over time', () => {
    const r = createRocket();
    r.update(0.5);
    expect(r.age).toBeCloseTo(0.5, 5);
    r.update(1.0);
    expect(r.age).toBeCloseTo(1.5, 5);
  });

  it('moves diagonally with normalized direction', () => {
    const r = new RocketProjectile(0, 0, 0.3, 0.7071, 0.7071, 10);
    r.update(1.0);
    expect(r.x).toBeCloseTo(7, 0);
    expect(r.y).toBeCloseTo(7, 0);
  });
});

describe('RocketProjectile - expiration', () => {
  it('returns true when age > lifetime', () => {
    const r = createRocket(0, 0, 10, 2);
    r.update(2.1);
    expect(r.isExpired()).toBe(true);
  });

  it('returns false before lifetime ends', () => {
    const r = createRocket(0, 0, 10, 2);
    r.update(1.5);
    expect(r.isExpired()).toBe(false);
  });

  it('returns false at exact lifetime boundary', () => {
    const r = createRocket(0, 0, 10, 2);
    r.update(2.0);
    expect(r.isExpired()).toBe(false);
  });
});

describe('RocketProjectile - checkHit', () => {
  it('returns true when within 0.4 units', () => {
    const r = createRocket(5, 5);
    const target = { x: 5.1, y: 5.2 };
    expect(r.checkHit(target)).toBe(true);
  });

  it('returns false when outside 0.4 units', () => {
    const r = createRocket(0, 0);
    const target = { x: 1, y: 1 };
    expect(r.checkHit(target)).toBe(false);
  });

  it('returns true for exact same position', () => {
    const r = createRocket(3, 3);
    const target = { x: 3, y: 3 };
    expect(r.checkHit(target)).toBe(true);
  });

  it('returns false when barely outside 0.4 units', () => {
    const r = createRocket(0, 0);
    const target = { x: 0.41, y: 0 };
    expect(r.checkHit(target)).toBe(false);
  });
});

describe('RocketProjectile - explode', () => {
  it('damages enemies within explosionRadius', () => {
    const r = createRocket(0, 0);
    const enemies = [
      { x: 0.5, y: 0.5, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 3, y: 3, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(enemies[0].health).toBe(-5);
    expect(enemies[0].hitFlashTimer).toBe(0.15);
    expect(enemies[1].health).toBe(5);
    expect(enemies[1].hitFlashTimer).toBe(0);
  });

  it('marks enemies as dying when health reaches 0 or below', () => {
    const r = createRocket(0, 0);
    const enemies = [
      { x: 0.5, y: 0.5, isAlive: true, health: 3, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 1, y: 1, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(enemies[0].isAlive).toBe(false);
    expect(enemies[0].isDying).toBe(true);
    expect(enemies[1].isAlive).toBe(true);
    expect(enemies[1].isDying).toBe(false);
  });

  it('returns killed count', () => {
    const r = createRocket(0, 0);
    const enemies = [
      { x: 0.5, y: 0.5, isAlive: true, health: 3, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 1, y: 1, isAlive: true, health: 20, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 3, y: 3, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(result.killed).toBe(1);
  });

  it('skips dead and dying enemies', () => {
    const r = createRocket(0, 0);
    const enemies = [
      { x: 0.5, y: 0.5, isAlive: false, health: 3, isDying: true, isDead: false, hitFlashTimer: 0 },
      { x: 1, y: 1, isAlive: true, health: 3, isDying: false, isDead: true, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(result.killed).toBe(0);
    expect(enemies[0].health).toBe(3);
    expect(enemies[1].health).toBe(3);
  });

  it('respects explosionRadius', () => {
    const r = new RocketProjectile(0, 0, 0.3, 1, 0, 10, 4, 0.5, 10);
    const enemies = [
      { x: 0.4, y: 0.4, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 0.6, y: 0.6, isAlive: true, health: 5, isDying: false, isDead: false, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(enemies[0].health).toBe(-5);
    expect(enemies[1].health).toBe(5);
  });

  it('kills multiple enemies in one explode call', () => {
    const r = createRocket(0, 0);
    const enemies = [
      { x: 0.1, y: 0.1, isAlive: true, health: 3, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 0.3, y: 0.3, isAlive: true, health: 2, isDying: false, isDead: false, hitFlashTimer: 0 },
      { x: 0.5, y: 0.5, isAlive: true, health: 3, isDying: false, isDead: false, hitFlashTimer: 0 },
    ];
    const result = r.explode(enemies);
    expect(result.killed).toBe(3);
    expect(enemies[0].isAlive).toBe(false);
    expect(enemies[1].isAlive).toBe(false);
    expect(enemies[2].isAlive).toBe(false);
  });
});
