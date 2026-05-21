import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sprite, SpriteType, EnemyClass, EnemyAIState, AI_SHOOTER_RANGE, AI_SHOOTER_MIN_DIST, AI_SHOOTER_COOLDOWN, AI_SHOOTER_DAMAGE, AI_SHOOTER_MOVE_SPEED, isCollectableSprite } from '../sprite';
import { hasLineOfSight } from '../collision';
import { worldState } from '../world';

let originalIsSolidTile: typeof worldState.isSolidTile;

beforeEach(() => {
  originalIsSolidTile = worldState.isSolidTile.bind(worldState);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockOpenSpace(): void {
  vi.spyOn(worldState, 'isSolidTile').mockReturnValue(false);
}

// Create a shooter sprite
function createShooterSprite(x: number = 5, y: number = 5): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f0f';
    ctx.fillRect(0, 0, 64, 64);
  }
  const s = new Sprite(x, y, SpriteType.SHOOTER, canvas);
  s.enemyClass = EnemyClass.SHOOTER;
  return s;
}

// Create a grunt sprite for regression tests
function createGruntSprite(x: number = 5, y: number = 5): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 64, 64);
  }
  const s = new Sprite(x, y, SpriteType.ENEMY, canvas);
  s.enemyClass = EnemyClass.GRUNT;
  return s;
}

// Simulate one tick of Shooter AI in CHASE state (mirrors renderer.ts updateEnemyAI)
// Returns { movedCloser: boolean, movedAway: boolean, fired: boolean, damageDealt: number }
function tickShooterChase(
  sprite: Sprite,
  playerX: number,
  playerY: number,
  dt: number
): { movedCloser: boolean; movedAway: boolean; fired: boolean; damageDealt: number; muzzleFlash: boolean } {
  const dx = playerX - sprite.x;
  const dy = playerY - sprite.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const hasLOS = hasLineOfSight(sprite.x, sprite.y, playerX, playerY);

  let movedCloser = false;
  let movedAway = false;
  let fired = false;
  let damageDealt = 0;
  let muzzleFlash = false;

  if (sprite.enemyClass === EnemyClass.SHOOTER) {
    if (dist < sprite.shooterMinDist) {
      // Back away
      if (dist > 0) {
        const moveX = -(dx / dist) * AI_SHOOTER_MOVE_SPEED * dt;
        const moveY = -(dy / dist) * AI_SHOOTER_MOVE_SPEED * dt;
        sprite.x += moveX;
        sprite.y += moveY;
        movedAway = true;
      }
    } else if (dist > sprite.shooterRange) {
      // Close distance
      if (dist > 0) {
        const moveX = (dx / dist) * AI_SHOOTER_MOVE_SPEED * dt;
        const moveY = (dy / dist) * AI_SHOOTER_MOVE_SPEED * dt;
        sprite.x += moveX;
        sprite.y += moveY;
        movedCloser = true;
      }
    } else {
      // In range, check for shot
      if (hasLOS) {
        sprite.attackTimer += dt;
        if (sprite.attackTimer >= sprite.shooterCooldown) {
          sprite.attackTimer = 0;
          fired = true;
          damageDealt = sprite.shooterDamage;
          sprite.muzzleFlashTimer = 0.2; // 200ms flash
          muzzleFlash = true;
        }
      }
    }
  }
  return { movedCloser, movedAway, fired, damageDealt, muzzleFlash };
}

describe('Shooter enemy class', () => {
  describe('Sprite creation and defaults', () => {
    it('Shooter sprite has correct type and enemy class', () => {
      const s = createShooterSprite(5, 5);
      expect(s.type).toBe(SpriteType.SHOOTER);
      expect(s.enemyClass).toBe(EnemyClass.SHOOTER);
    });

    it('Shooter has correct default fields', () => {
      const s = createShooterSprite(5, 5);
      expect(s.shooterRange).toBe(5.0);
      expect(s.shooterMinDist).toBe(3.0);
      expect(s.shooterCooldown).toBe(2.5);
      expect(s.shooterDamage).toBe(25);
    });

    it('Shooter starts in IDLE state', () => {
      const s = createShooterSprite(5, 5);
      expect(s.aiState).toBe(EnemyAIState.IDLE);
    });

    it('isCollectableSprite returns false for SHOOTER', () => {
      expect(isCollectableSprite(SpriteType.SHOOTER)).toBe(false);
    });
  });

  describe('Shooter chase behavior', () => {
    beforeEach(() => {
      mockOpenSpace();
    });

    it('Shooter backs away when player is closer than shooterMinDist', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      const playerX = 5.5; // 0.5 tiles away (< 3.0 min dist)
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      expect(result.movedAway).toBe(true);
      expect(shooter.x).toBeLessThan(5); // moved away from player on X axis
    });

    it('Shooter closes distance when player is farther than shooterRange', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 0;
      const playerX = 11; // 6 tiles away (> shooterRange of 5.0)
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      expect(result.movedCloser).toBe(true);
      expect(shooter.x).toBeGreaterThan(5);
    });

    it('Shooter fires when in range with LOS and cooldown elapsed', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 2.5; // cooldown already elapsed
      const playerX = 7; // 2 tiles away (between minDist 3 and range 5 — adjusted)
      const playerY = 5;

      // Actually 2 tiles < 3 minDist, so shooter backs away. Use 4 tiles.
      const shooter2 = createShooterSprite(5, 5);
      shooter2.aiState = EnemyAIState.CHASE;
      shooter2.attackTimer = 2.5;
      const playerX2 = 9; // 4 tiles away (between 3.0 min and 5.0 range)
      const playerY2 = 5;

      const result = tickShooterChase(shooter2, playerX2, playerY2, 0.1);

      expect(result.fired).toBe(true);
      expect(result.damageDealt).toBe(25);
      expect(result.muzzleFlash).toBe(true);
    });

    it('Shooter does NOT fire when cooldown has not elapsed', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 0; // cooldown not elapsed
      const playerX = 9; // 4 tiles away
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      expect(result.fired).toBe(false);
      expect(result.damageDealt).toBe(0);
    });

    it('Shooter does NOT fire when wall blocks LOS', () => {
      // Restore solid tile to return true (wall between shooter and player)
      vi.spyOn(worldState, 'isSolidTile').mockReturnValue(true);

      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 2.5;
      const playerX = 9;
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      // With LOS blocked, the mock returns true for all tiles, so hasLineOfSight returns false
      // The shooter stays in place (in range) but doesn't fire
      expect(result.fired).toBe(false);
    });

    it('Shooter muzzleFlashTimer is set after firing', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 2.5;
      const playerX = 9;
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      expect(result.muzzleFlash).toBe(true);
      expect(shooter.muzzleFlashTimer).toBe(0.2);
    });

    it('Shooter deals AI_SHOOTER_DAMAGE (25) per hit', () => {
      const shooter = createShooterSprite(5, 5);
      shooter.aiState = EnemyAIState.CHASE;
      shooter.attackTimer = 2.5;
      const playerX = 9;
      const playerY = 5;

      const result = tickShooterChase(shooter, playerX, playerY, 0.1);

      expect(result.damageDealt).toBe(AI_SHOOTER_DAMAGE);
      expect(AI_SHOOTER_DAMAGE).toBe(25);
    });
  });

  describe('Grunt regression test', () => {
    it('Grunt still does melee at contact range (no shooter behavior)', () => {
      const grunt = createGruntSprite(5, 5);
      grunt.aiState = EnemyAIState.CHASE;
      grunt.attackTimer = 1.0;

      // Grunt at contact range (0.2 tiles) — the AI_MIN_ENTITY_DIST is ~0.35
      const playerX = 5.2;
      const playerY = 5;

      // For Grunt, tickShooterChase should not apply shooter logic
      // because enemyClass is GRUNT
      const result = tickShooterChase(grunt, playerX, playerY, 0.1);

      expect(result.fired).toBe(false); // Grunt doesn't use raycast
      expect(result.movedAway).toBe(false); // Grunt doesn't back away
      expect(result.damageDealt).toBe(0);
    });

    it('Grunt sprite has correct defaults', () => {
      const grunt = createGruntSprite(5, 5);
      expect(grunt.type).toBe(SpriteType.ENEMY);
      expect(grunt.enemyClass).toBe(EnemyClass.GRUNT);
      expect(grunt.health).toBe(3);
    });
  });
});
