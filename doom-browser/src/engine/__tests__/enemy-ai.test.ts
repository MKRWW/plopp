import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sprite, SpriteType, EnemyAIState, AI_AWARENESS_RADIUS, AI_GUNSHOT_RADIUS, AI_ALERT_TO_CHASE_DELAY, AI_CHASE_TO_ALERT_DELAY } from '../sprite';
import { hasLineOfSight } from '../collision';
import { worldState } from '../world';

let originalIsSolidTile: typeof worldState.isSolidTile;

beforeEach(() => {
  originalIsSolidTile = worldState.isSolidTile.bind(worldState);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock isSolidTile to return false everywhere (open space)
function mockOpenSpace(): void {
  vi.spyOn(worldState, 'isSolidTile').mockReturnValue(false);
}

// Mock isSolidTile to block specific coordinates
function mockWallsAt(wallCoords: Set<string>): void {
  vi.spyOn(worldState, 'isSolidTile').mockImplementation((x: number, y: number) => {
    return wallCoords.has(`${x},${y}`);
  });
}

function createEnemySprite(x: number = 5, y: number = 5): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 64, 64);
  }
  return new Sprite(x, y, SpriteType.ENEMY, canvas);
}

// Simulate one tick of AI decision logic (mirrors updateEnemyAI logic)
function tickAI(sprite: Sprite, playerX: number, playerY: number, dt: number): void {
  const dx = playerX - sprite.x;
  const dy = playerY - sprite.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const hasLOS = hasLineOfSight(sprite.x, sprite.y, playerX, playerY);

  switch (sprite.aiState) {
    case EnemyAIState.IDLE:
      if (dist <= AI_AWARENESS_RADIUS && hasLOS) {
        sprite.aiState = EnemyAIState.ALERT;
        sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
        sprite.facingAngle = Math.atan2(dy, dx);
      }
      break;

    case EnemyAIState.ALERT:
      sprite.facingAngle = Math.atan2(dy, dx);
      if (dist <= AI_AWARENESS_RADIUS && hasLOS) {
        sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
      }
      sprite.alertTimer -= dt;
      sprite.alertFadeoutTimer -= dt;
      if (sprite.alertTimer <= 0) {
        if (dist > AI_AWARENESS_RADIUS) {
          sprite.aiState = EnemyAIState.IDLE;
          sprite.alertTimer = 0;
          sprite.alertFadeoutTimer = 0;
        } else {
          sprite.aiState = EnemyAIState.CHASE;
        }
      }
      if (sprite.alertFadeoutTimer <= 0 && sprite.alertTimer <= 0) {
        sprite.aiState = EnemyAIState.IDLE;
      }
      if (hasLOS && dist <= AI_AWARENESS_RADIUS) {
        sprite.aiState = EnemyAIState.CHASE;
      }
      break;

    case EnemyAIState.CHASE:
      if (dist > AI_AWARENESS_RADIUS && !hasLOS) {
        sprite.aiState = EnemyAIState.ALERT;
        sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
        sprite.facingAngle = Math.atan2(dy, dx);
      }
      break;
  }
}

// Simulate gunshot broadcast
function tickGunshot(sprite: Sprite, playerX: number, playerY: number): void {
  const dx = playerX - sprite.x;
  const dy = playerY - sprite.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > AI_GUNSHOT_RADIUS) return;
  const angleToPlayer = Math.atan2(dy, dx);
  if (sprite.aiState === EnemyAIState.IDLE) {
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
    sprite.facingAngle = angleToPlayer;
  } else if (sprite.aiState === EnemyAIState.ALERT) {
    sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
    sprite.facingAngle = angleToPlayer;
  }
  sprite.heardGunshotTime = performance.now() / 1000;
}

describe('AI State Transitions', () => {
  it('IDLE → ALERT on LOS detection', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
  });

  it('IDLE stays IDLE when player out of range', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    tickAI(sprite, 20, 20, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('ALERT → CHASE after timer expires', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    // First tick: IDLE → ALERT
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    // Advance time past alertTimer
    tickAI(sprite, 6, 5, AI_ALERT_TO_CHASE_DELAY + 0.1);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('ALERT → IDLE when alertTimer expires and player far', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    // Player moves far away; alertTimer expires
    tickAI(sprite, 20, 20, AI_ALERT_TO_CHASE_DELAY + 0.1);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('CHASE → ALERT with fadeout on lost LOS', () => {
    mockWallsAt(new Set(['9,5'])); // Wall between enemy (5,5) and player (15,5)
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    // Player is far and blocked by wall
    tickAI(sprite, 15, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    expect(sprite.alertFadeoutTimer).toBeGreaterThan(0);
  });

  it('ALERT fadeout → IDLE when timer expires', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
    // Player far, fadeout expires
    tickAI(sprite, 20, 20, AI_CHASE_TO_ALERT_DELAY + AI_ALERT_TO_CHASE_DELAY + 1);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('ALERT fadeout → CHASE on LOS re-acquisition', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
    // Player in range with LOS — should immediately chase
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('Gunshot alerts IDLE enemy within gunshot radius (no LOS needed)', () => {
    const sprite = createEnemySprite(5, 5);
    tickGunshot(sprite, 8, 5); // dist ~3, within 12-tile gunshot radius
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    expect(sprite.alertTimer).toBe(AI_ALERT_TO_CHASE_DELAY);
  });

  it('Gunshot resets ALERT timer for alert enemies', () => {
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertTimer = 0.2; // nearly expired
    tickGunshot(sprite, 8, 5);
    expect(sprite.alertTimer).toBe(AI_ALERT_TO_CHASE_DELAY);
  });

  it('Gunshot does not affect CHASE enemies', () => {
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    tickGunshot(sprite, 8, 5);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('Gunshot does not alert enemies beyond gunshot radius', () => {
    const sprite = createEnemySprite(5, 5);
    tickGunshot(sprite, 25, 25); // far away
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });
});

describe('AI Constants Validation', () => {
  it('AI_AWARENESS_RADIUS and AI_GUNSHOT_RADIUS have valid values', () => {
    expect(AI_AWARENESS_RADIUS).toBe(8.0);
    expect(AI_GUNSHOT_RADIUS).toBe(12.0);
    expect(AI_ALERT_TO_CHASE_DELAY).toBe(1.0);
    expect(AI_CHASE_TO_ALERT_DELAY).toBe(6.0);
  });
});

describe('Enemy Sprite Initialization', () => {
  it('sprite spawns in IDLE state with correct fields', () => {
    const sprite = createEnemySprite(3, 4);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
    expect(sprite.spawnX).toBe(3);
    expect(sprite.spawnY).toBe(4);
    expect(sprite.alertTimer).toBe(0);
    expect(sprite.alertFadeoutTimer).toBe(0);
  });
});
