import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Sprite,
  SpriteType,
  EnemyAIState,
  EnemyClass,
  LatcherState,
  BossPhase,
  AI_AWARENESS_RADIUS,
  AI_GUNSHOT_RADIUS,
  AI_ALERT_TO_CHASE_DELAY,
  AI_CHASE_TO_ALERT_DELAY,
  AI_BOSS_HP,
  AI_BOSS_ATTACK_RANGE,
  AI_BOSS_ATTACK_COOLDOWN,
  AI_BOSS_ATTACK_DAMAGE,
  AI_LATCHER_LEAP_RANGE,
  AI_LATCHER_LEAP_MIN_DIST,
  AI_LATCHER_WINDUP_DURATION,
  AI_LATCHER_LEAP_DURATION,
  AI_LATCHER_LEAP_COOLDOWN,
  AI_LATCHER_DAMAGE,
  AI_LATCHER_CONTACT_RADIUS,
  BOSS_VOLLEY_COOLDOWN,
  AI_SHOOTER_RANGE,
  AI_SHOOTER_MIN_DIST,
  AI_SHOOTER_COOLDOWN,
  AI_SHOOTER_DAMAGE,
} from '../sprite';
import { hasLineOfSight } from '../collision';
import { worldState } from '../world';
import { updateEnemyAI, broadcastGunshot, type AIContext } from '../enemy-ai';
import { Player } from '../../player/player';
import { BioProjectile } from '../bio-projectile';
import { createTestPlayer } from '../../__tests__/utils/fixtures';

let originalIsSolidTile: typeof worldState.isSolidTile;

beforeEach(() => {
  originalIsSolidTile = worldState.isSolidTile.bind(worldState);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Load a real open map so MAP_WIDTH/HEIGHT are set for collision functions
function mockOpenSpace(): void {
  const size = 20;
  const map: number[][] = [];
  for (let y = 0; y < size; y++) map.push(new Array(size).fill(0));
  worldState.loadLevel({ map, width: size, height: size } as any);
}

// Load a map with specific wall tiles
function mockWallsAt(wallCoords: Set<string>): void {
  const size = 20;
  const map: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row = new Array(size).fill(0);
    for (let x = 0; x < size; x++) {
      if (wallCoords.has(`${x},${y}`)) row[x] = 1;
    }
    map.push(row);
  }
  worldState.loadLevel({ map, width: size, height: size } as any);
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

function createLatcher(x: number = 5, y: number = 5): Sprite {
  const sprite = createEnemySprite(x, y);
  sprite.type = SpriteType.LATCHER;
  sprite.enemyClass = EnemyClass.LATCHER;
  return sprite;
}

function createShooter(x: number = 5, y: number = 5): Sprite {
  const sprite = createEnemySprite(x, y);
  sprite.type = SpriteType.SHOOTER;
  sprite.enemyClass = EnemyClass.SHOOTER;
  return sprite;
}

function createBoss(x: number = 5, y: number = 5): Sprite {
  const sprite = createEnemySprite(x, y);
  sprite.type = SpriteType.BOSS;
  sprite.enemyClass = EnemyClass.BOSS;
  sprite.health = AI_BOSS_HP;
  return sprite;
}

function createAIContext(opts: {
  player?: Player;
  sprites?: Sprite[];
  bioProjectiles?: BioProjectile[];
} = {}): AIContext {
  const player = opts.player ?? createTestPlayer(6, 5);
  const soundManager = {
    play: vi.fn(),
    playAt: vi.fn(),
    init: vi.fn(),
    stop: vi.fn(),
    toggle: vi.fn(),
    isEnabled: () => true,
    setMusicVolume: vi.fn(),
    startMusic: vi.fn(),
    stopMusic: vi.fn(),
  };
  return {
    player,
    sprites: opts.sprites ?? [],
    bioProjectiles: opts.bioProjectiles ?? [],
    soundManager: soundManager as any,
    triggerDamageFlash: vi.fn(),
  } as AIContext;
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

// ===================== EXISTING: AI State Transitions (simulated) =====================

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
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    tickAI(sprite, 6, 5, AI_ALERT_TO_CHASE_DELAY + 0.1);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('ALERT → IDLE when alertTimer expires and player far', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    tickAI(sprite, 20, 20, AI_ALERT_TO_CHASE_DELAY + 0.1);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('CHASE → ALERT with fadeout on lost LOS', () => {
    mockWallsAt(new Set(['9,5'])); // Wall between enemy (5,5) and player (15,5)
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    tickAI(sprite, 15, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    expect(sprite.alertFadeoutTimer).toBeGreaterThan(0);
  });

  it('ALERT fadeout → IDLE when timer expires', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
    tickAI(sprite, 20, 20, AI_CHASE_TO_ALERT_DELAY + AI_ALERT_TO_CHASE_DELAY + 1);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('ALERT fadeout → CHASE on LOS re-acquisition', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
    tickAI(sprite, 6, 5, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('Gunshot alerts IDLE enemy within gunshot radius (no LOS needed)', () => {
    const sprite = createEnemySprite(5, 5);
    tickGunshot(sprite, 8, 5);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    expect(sprite.alertTimer).toBe(AI_ALERT_TO_CHASE_DELAY);
  });

  it('Gunshot resets ALERT timer for alert enemies', () => {
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertTimer = 0.2;
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
    tickGunshot(sprite, 25, 25);
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

// ===================== NEW: updateEnemyAI (real function) =====================

describe('updateEnemyAI - real function tests', () => {
  it('IDLE → ALERT when player is within awareness radius with LOS', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    const player = createTestPlayer(7, 5); // dist = 2 < 8
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
  });

  it('IDLE stays IDLE when player is out of range', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    const player = createTestPlayer(20, 20); // dist >> 8
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('CHASE grunt attacks player when in range', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5.3, 5);
    sprite.aiState = EnemyAIState.CHASE;
    const player = createTestPlayer(5, 5);
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 1.1); // > attackCooldown (1.0)
    expect(player.health).toBe(85); // 100 - 15
    expect(ctx.triggerDamageFlash).toHaveBeenCalled();
  });

  it('CHASE grunt moves toward player when out of attack range', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(8, 5);
    sprite.aiState = EnemyAIState.CHASE;
    const player = createTestPlayer(5, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.x).toBeLessThan(8);
    expect(sprite.x).toBeGreaterThan(7.9);
  });

  it('skips dying and dead enemies', () => {
    mockOpenSpace();
    const dying = createEnemySprite(5.5, 5);
    dying.isAlive = false;
    dying.isDying = true;
    dying.aiState = EnemyAIState.CHASE;
    const dead = createEnemySprite(6, 5);
    dead.isAlive = false;
    dead.isDead = true;
    dead.aiState = EnemyAIState.CHASE;
    const player = createTestPlayer(5, 5);
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [dying, dead] });
    updateEnemyAI(ctx, 1.0);
    expect(player.health).toBe(100);
  });
});

// ===================== NEW: broadcastGunshot (real function) =====================

describe('broadcastGunshot - real function tests', () => {
  it('alerts IDLE enemies within gunshot radius', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.IDLE;
    const player = createTestPlayer(8, 5); // dist = 3 < 12
    const ctx = createAIContext({ player, sprites: [sprite] });
    broadcastGunshot(ctx);
    expect(sprite.aiState).toBe(EnemyAIState.ALERT);
    expect(sprite.alertTimer).toBe(AI_ALERT_TO_CHASE_DELAY);
  });

  it('resets ALERT timer for alert enemies', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.ALERT;
    sprite.alertTimer = 0.2;
    const player = createTestPlayer(8, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    broadcastGunshot(ctx);
    expect(sprite.alertTimer).toBe(AI_ALERT_TO_CHASE_DELAY);
  });

  it('does not change CHASE enemies state', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    const player = createTestPlayer(8, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    broadcastGunshot(ctx);
    expect(sprite.aiState).toBe(EnemyAIState.CHASE);
  });

  it('does not alert enemies beyond gunshot radius', () => {
    mockOpenSpace();
    const sprite = createEnemySprite(5, 5);
    sprite.aiState = EnemyAIState.IDLE;
    const player = createTestPlayer(25, 25); // dist >> 12
    const ctx = createAIContext({ player, sprites: [sprite] });
    broadcastGunshot(ctx);
    expect(sprite.aiState).toBe(EnemyAIState.IDLE);
  });

  it('skips dead and dying enemies', () => {
    mockOpenSpace();
    const dead = createEnemySprite(6, 5);
    dead.isAlive = false;
    dead.isDead = true;
    const dying = createEnemySprite(7, 5);
    dying.isAlive = false;
    dying.isDying = true;
    const player = createTestPlayer(5, 5);
    const ctx = createAIContext({ player, sprites: [dead, dying] });
    broadcastGunshot(ctx);
    expect(dead.aiState).not.toBe(EnemyAIState.ALERT);
    expect(dying.aiState).not.toBe(EnemyAIState.ALERT);
  });
});

// ===================== NEW: Latcher AI =====================

describe('Latcher AI - leap mechanics', () => {
  it('APPROACH → WINDUP when in leap range with LOS', () => {
    mockOpenSpace();
    const sprite = createLatcher(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.latcherState = LatcherState.APPROACH;
    const player = createTestPlayer(7, 5); // dist = 2, within [0.6, 3.0]
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.latcherState).toBe(LatcherState.WINDUP);
    expect(sprite.latcherStateTimer).toBe(0);
  });

  it('WINDUP → LEAP after windup duration', () => {
    mockOpenSpace();
    const sprite = createLatcher(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.latcherState = LatcherState.WINDUP;
    sprite.latcherStateTimer = 0;
    const player = createTestPlayer(7, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, AI_LATCHER_WINDUP_DURATION + 0.01);
    expect(sprite.latcherState).toBe(LatcherState.LEAP);
    expect(sprite.leapStartX).toBe(5);
    expect(sprite.leapStartY).toBe(5);
    expect(sprite.leapTargetX).toBe(7);
    expect(sprite.leapTargetY).toBe(5);
  });

  it('LEAP → RECOVER on contact with player (damage applied)', () => {
    mockOpenSpace();
    const sprite = createLatcher(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.latcherState = LatcherState.LEAP;
    sprite.latcherStateTimer = 0;
    sprite.leapStartX = 5;
    sprite.leapStartY = 5;
    sprite.leapTargetX = 5.5;
    sprite.leapTargetY = 5;
    sprite.leapProgress = 0;
    const player = createTestPlayer(5.3, 5);
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.1);
    expect(sprite.latcherState).toBe(LatcherState.RECOVER);
    expect(player.health).toBe(100 - AI_LATCHER_DAMAGE);
    expect(ctx.triggerDamageFlash).toHaveBeenCalled();
  });

  it('LEAP → RECOVER on leap completion without contact', () => {
    mockOpenSpace();
    const sprite = createLatcher(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.latcherState = LatcherState.LEAP;
    sprite.latcherStateTimer = 0;
    sprite.leapStartX = 5;
    sprite.leapStartY = 5;
    sprite.leapTargetX = 6;
    sprite.leapTargetY = 6;
    sprite.leapProgress = 0;
    const player = createTestPlayer(10, 10); // far away
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, AI_LATCHER_LEAP_DURATION + 0.01);
    expect(sprite.latcherState).toBe(LatcherState.RECOVER);
    expect(player.health).toBe(100); // no damage
  });

  it('RECOVER → APPROACH after cooldown', () => {
    mockOpenSpace();
    const sprite = createLatcher(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.latcherState = LatcherState.RECOVER;
    sprite.latcherStateTimer = 0;
    const player = createTestPlayer(10, 10); // far, won't trigger leap
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, AI_LATCHER_LEAP_COOLDOWN + 0.01);
    expect(sprite.latcherState).toBe(LatcherState.APPROACH);
  });
});

// ===================== NEW: Shooter (Spitter) AI =====================

describe('Shooter AI - projectile attack', () => {
  it('shoots player when in optimal range with LOS', () => {
    mockOpenSpace();
    const sprite = createShooter(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.attackTimer = AI_SHOOTER_COOLDOWN - 0.1; // almost ready
    const player = createTestPlayer(8, 5); // dist = 3, within [3.0, 5.0]
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.2); // pushes attackTimer past cooldown
    expect(player.health).toBe(100 - AI_SHOOTER_DAMAGE);
    expect(ctx.triggerDamageFlash).toHaveBeenCalled();
    expect(ctx.bioProjectiles.length).toBe(1); // visual projectile spawned
  });

  it('backs away when player is too close', () => {
    mockOpenSpace();
    const sprite = createShooter(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    const player = createTestPlayer(5.5, 5); // dist = 0.5 < shooterMinDist (3.0)
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.1);
    expect(sprite.x).toBeLessThan(5); // moved away from player
  });
});

// ===================== NEW: Boss AI =====================

describe('Boss AI - phase behavior', () => {
  it('MELEE phase: attacks player in range', () => {
    mockOpenSpace();
    const sprite = createBoss(5.3, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.bossPhase = BossPhase.MELEE;
    sprite.attackTimer = 0;
    const player = createTestPlayer(5, 5);
    player.health = 100;
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, AI_BOSS_ATTACK_COOLDOWN + 0.1);
    expect(player.health).toBe(100 - AI_BOSS_ATTACK_DAMAGE);
    expect(ctx.triggerDamageFlash).toHaveBeenCalled();
  });

  it('transitions to VOLLEY phase at 50% HP', () => {
    mockOpenSpace();
    const sprite = createBoss(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.bossPhase = BossPhase.MELEE;
    sprite.health = AI_BOSS_HP * 0.5; // 50%
    const player = createTestPlayer(7, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.bossPhase).toBe(BossPhase.VOLLEY);
    expect(sprite.bossVolleyTimer).toBeCloseTo(BOSS_VOLLEY_COOLDOWN, 1);
  });

  it('VOLLEY phase: fires 3-projectile fan on cooldown', () => {
    mockOpenSpace();
    const sprite = createBoss(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.bossPhase = BossPhase.VOLLEY;
    sprite.bossVolleyTimer = 0; // ready to fire
    sprite.health = AI_BOSS_HP * 0.5;
    const player = createTestPlayer(7, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.1);
    expect(ctx.bioProjectiles.length).toBe(3);
    expect(sprite.bossVolleyTimer).toBe(BOSS_VOLLEY_COOLDOWN);
    expect(sprite.muzzleFlashTimer).toBeGreaterThan(0);
  });

  it('transitions to RAGE phase at 20% HP', () => {
    mockOpenSpace();
    const sprite = createBoss(5, 5);
    sprite.aiState = EnemyAIState.CHASE;
    sprite.bossPhase = BossPhase.MELEE;
    sprite.health = AI_BOSS_HP * 0.2; // 20%
    const player = createTestPlayer(7, 5);
    const ctx = createAIContext({ player, sprites: [sprite] });
    updateEnemyAI(ctx, 0.016);
    expect(sprite.bossPhase).toBe(BossPhase.RAGE);
    expect(sprite.bossRageActivated).toBe(true);
  });
});
