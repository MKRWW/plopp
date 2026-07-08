import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handlePlayerShoot,
  updateRockets,
  updateBioProjectiles,
  applyPlayerDamage,
  checkShotHit,
  type CombatContext,
} from '../combat';
import { createTestPlayer } from '../../__tests__/utils/fixtures';
import { createMockEnemySprite, createMockTexture } from '../../__tests__/utils/mocks';
import { Player } from '../../player/player';
import { WeaponInventory, WeaponType, WEAPONS } from '../../game/weapons';
import { Weapon } from '../../game/weapon';
import { Sprite, SpriteType } from '../sprite';
import { RocketProjectile } from '../rocket-projectile';
import { BioProjectile } from '../bio-projectile';
import { SoundType } from '../../audio/sound';
import { worldState } from '../world';

let originalIsSolidTile: typeof worldState.isSolidTile;

beforeEach(() => {
  originalIsSolidTile = worldState.isSolidTile.bind(worldState);
  vi.spyOn(worldState, 'isSolidTile').mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Minimal context for checkShotHit-only tests ---
function ctxWith(player: any, sprites: any[]): CombatContext {
  return { player, sprites } as unknown as CombatContext;
}

// --- Full context for handlePlayerShoot / updateRockets / updateBioProjectiles ---
function createCombatContext(opts: {
  player?: Player;
  sprites?: Sprite[];
  rockets?: RocketProjectile[];
  bioProjectiles?: BioProjectile[];
  berserkTimer?: number;
} = {}): any {
  const player = opts.player ?? createTestPlayer(1.5, 1.5);
  const inventory = new WeaponInventory();
  inventory.addWeapon(WEAPONS[1]); // SHOTGUN
  inventory.addWeapon(WEAPONS[2]); // ROCKET_LAUNCHER
  inventory.switchTo(WeaponType.PISTOL);

  const weapon = new Weapon();
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
    inventory,
    weapon,
    sprites: opts.sprites ?? [],
    rockets: opts.rockets ?? [],
    bioProjectiles: opts.bioProjectiles ?? [],
    soundManager,
    triggerDamageFlash: vi.fn(),
    broadcastGunshot: vi.fn(),
    triggerScreenShake: vi.fn(),
    setWallImpact: vi.fn(),
    setHitMarker: vi.fn(),
    flashCameraNoSound: vi.fn(),
    berserkTimer: opts.berserkTimer ?? 0,
  };
}

// ===================== EXISTING TESTS =====================

describe('checkShotHit - range gating (melee vs hitscan)', () => {
  it('hits a distant enemy with the default (infinite) range', () => {
    const player = createTestPlayer(1.5, 1.5);
    const far = createMockEnemySprite(5.0, 1.5);
    const hit = checkShotHit(ctxWith(player, [far]));
    expect(hit).toBe(far);
  });

  it('misses a distant enemy when range is limited to melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const far = createMockEnemySprite(5.0, 1.5);
    const hit = checkShotHit(ctxWith(player, [far]), 1.3);
    expect(hit).toBeNull();
  });

  it('hits an adjacent enemy within melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const near = createMockEnemySprite(2.5, 1.5);
    const hit = checkShotHit(ctxWith(player, [near]), 1.3);
    expect(hit).toBe(near);
  });
});

// ===================== NEW: checkShotHit edge cases =====================

describe('checkShotHit - edge cases', () => {
  it('returns null when no enemies exist', () => {
    const player = createTestPlayer(1.5, 1.5);
    expect(checkShotHit(ctxWith(player, []))).toBeNull();
  });

  it('ignores enemies behind the player', () => {
    const player = createTestPlayer(5, 5); // facing +x
    const behind = createMockEnemySprite(3, 5);
    expect(checkShotHit(ctxWith(player, [behind]))).toBeNull();
  });

  it('ignores dying enemies', () => {
    const player = createTestPlayer(1.5, 1.5);
    const dying = createMockEnemySprite(3, 1.5);
    dying.isAlive = false;
    dying.isDying = true;
    expect(checkShotHit(ctxWith(player, [dying]))).toBeNull();
  });

  it('ignores dead enemies', () => {
    const player = createTestPlayer(1.5, 1.5);
    const dead = createMockEnemySprite(3, 1.5);
    dead.isAlive = false;
    dead.isDead = true;
    expect(checkShotHit(ctxWith(player, [dead]))).toBeNull();
  });

  it('ignores non-enemy sprites', () => {
    const player = createTestPlayer(1.5, 1.5);
    const ammo = new Sprite(3, 1.5, SpriteType.AMMO, createMockTexture(50, 180, 50));
    expect(checkShotHit(ctxWith(player, [ammo]))).toBeNull();
  });

  it('hits the closest enemy when multiple are in line', () => {
    const player = createTestPlayer(1.5, 1.5);
    const near = createMockEnemySprite(2.5, 1.5);
    const far = createMockEnemySprite(4.5, 1.5);
    const hit = checkShotHit(ctxWith(player, [far, near]));
    expect(hit).toBe(near);
  });

  it('misses an enemy far off to the side', () => {
    const player = createTestPlayer(1.5, 1.5); // facing +x
    const side = createMockEnemySprite(3.5, 4.5);
    expect(checkShotHit(ctxWith(player, [side]))).toBeNull();
  });
});

// ===================== NEW: applyPlayerDamage =====================

describe('applyPlayerDamage', () => {
  it('reduces health by full damage when no armor', () => {
    const player = createTestPlayer(1, 1);
    player.armor = 0;
    player.health = 100;
    applyPlayerDamage(player, 30);
    expect(player.health).toBe(70);
    expect(player.armor).toBe(0);
  });

  it('absorbs damage through armor first', () => {
    const player = createTestPlayer(1, 1);
    player.armor = 50;
    player.health = 100;
    applyPlayerDamage(player, 30);
    expect(player.armor).toBe(20);
    expect(player.health).toBe(100);
  });

  it('depletes armor and damages health when damage exceeds armor', () => {
    const player = createTestPlayer(1, 1);
    player.armor = 20;
    player.health = 100;
    applyPlayerDamage(player, 50);
    expect(player.armor).toBe(0);
    expect(player.health).toBe(70);
  });

  it('handles zero damage gracefully', () => {
    const player = createTestPlayer(1, 1);
    player.armor = 50;
    player.health = 100;
    applyPlayerDamage(player, 0);
    expect(player.health).toBe(100);
    expect(player.armor).toBe(50);
  });
});

// ===================== NEW: handlePlayerShoot — weapon behavior =====================

describe('handlePlayerShoot - weapon behavior', () => {
  it('pistol: fires, decrements ammo, plays shoot sound', () => {
    const ctx = createCombatContext();
    const ammoBefore = ctx.inventory.getCurrentAmmo();
    handlePlayerShoot(ctx);
    expect(ctx.inventory.getCurrentAmmo()).toBe(ammoBefore - 1);
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.SHOOT);
    expect(ctx.broadcastGunshot).toHaveBeenCalled();
  });

  it('fist: fires with infinite ammo and plays melee sound', () => {
    const ctx = createCombatContext();
    ctx.inventory.switchTo(WeaponType.FIST);
    const ammoBefore = ctx.inventory.getCurrentAmmo();
    handlePlayerShoot(ctx);
    expect(ctx.inventory.getCurrentAmmo()).toBe(ammoBefore); // Infinity
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.MELEE);
  });

  it('shotgun: deals higher damage than pistol', () => {
    const ctxPistol = createCombatContext({
      sprites: [createMockEnemySprite(2.5, 1.5)],
    });
    ctxPistol.inventory.switchTo(WeaponType.PISTOL);
    handlePlayerShoot(ctxPistol);
    const pistolDamage = 3 - ctxPistol.sprites[0].health;

    const ctxShotgun = createCombatContext({
      sprites: [createMockEnemySprite(2.5, 1.5)],
    });
    ctxShotgun.inventory.switchTo(WeaponType.SHOTGUN);
    handlePlayerShoot(ctxShotgun);
    const shotgunDamage = 3 - ctxShotgun.sprites[0].health;

    expect(shotgunDamage).toBeGreaterThan(pistolDamage);
    expect(shotgunDamage).toBe(5);
    expect(pistolDamage).toBe(1);
  });

  it('rocket launcher: spawns a rocket projectile instead of hitscan', () => {
    const enemy = createMockEnemySprite(2.5, 1.5);
    const ctx = createCombatContext({ sprites: [enemy] });
    ctx.inventory.switchTo(WeaponType.ROCKET_LAUNCHER);
    const healthBefore = enemy.health;
    handlePlayerShoot(ctx);
    expect(ctx.rockets.length).toBe(1);
    expect(enemy.health).toBe(healthBefore); // no hitscan damage
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.ROCKET_SHOOT);
  });

  it('does not fire during weapon cooldown', () => {
    const ctx = createCombatContext();
    handlePlayerShoot(ctx);
    expect(ctx.soundManager.play).toHaveBeenCalledTimes(1);
    handlePlayerShoot(ctx); // blocked by cooldown
    expect(ctx.soundManager.play).toHaveBeenCalledTimes(1);
  });

  it('fires again after cooldown expires', () => {
    const ctx = createCombatContext();
    handlePlayerShoot(ctx);
    ctx.inventory.update(1); // clear cooldown
    handlePlayerShoot(ctx);
    expect(ctx.soundManager.play).toHaveBeenCalledTimes(2);
  });

  it('does not fire when pistol ammo is depleted', () => {
    const ctx = createCombatContext();
    for (let i = 0; i < 50; i++) {
      handlePlayerShoot(ctx);
      ctx.inventory.update(1);
    }
    expect(ctx.inventory.getCurrentAmmo()).toBe(0);
    ctx.soundManager.play.mockClear();
    handlePlayerShoot(ctx);
    expect(ctx.soundManager.play).not.toHaveBeenCalled();
  });

  it('applies berserk multiplier (2x damage)', () => {
    const enemy = createMockEnemySprite(2.5, 1.5);
    enemy.health = 100;
    const ctx = createCombatContext({ sprites: [enemy], berserkTimer: 5 });
    handlePlayerShoot(ctx); // pistol damage = 1 * 2 = 2
    expect(enemy.health).toBe(98);
  });
});

// ===================== NEW: handlePlayerShoot — hit detection & kills =====================

describe('handlePlayerShoot - hit detection and kills', () => {
  it('deals damage to enemy in front of player', () => {
    const enemy = createMockEnemySprite(2.5, 1.5);
    const ctx = createCombatContext({ sprites: [enemy] });
    handlePlayerShoot(ctx);
    expect(enemy.health).toBe(2); // 3 - 1 pistol damage
    expect(enemy.hitFlashTimer).toBeCloseTo(0.12);
    expect(ctx.setHitMarker).toHaveBeenCalled();
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.HIT);
  });

  it('triggers wall impact when no enemy is hit', () => {
    const ctx = createCombatContext({ sprites: [] });
    handlePlayerShoot(ctx);
    expect(ctx.setWallImpact).toHaveBeenCalled();
  });

  it('kills enemy when health reaches zero', () => {
    const enemy = createMockEnemySprite(2.5, 1.5);
    enemy.health = 1;
    const ctx = createCombatContext({ sprites: [enemy] });
    handlePlayerShoot(ctx);
    expect(enemy.isAlive).toBe(false);
    expect(enemy.isDying).toBe(true);
    expect(enemy.deathTimer).toBe(enemy.deathDuration);
    expect(ctx.inventory.kills).toBe(1);
    expect(ctx.player.score).toBe(100);
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.ENEMY_DEATH);
  });

  it('does not kill enemy when health remains above zero', () => {
    const enemy = createMockEnemySprite(2.5, 1.5);
    enemy.health = 3;
    const ctx = createCombatContext({ sprites: [enemy] });
    handlePlayerShoot(ctx);
    expect(enemy.isAlive).toBe(true);
    expect(enemy.isDying).toBe(false);
    expect(ctx.inventory.kills).toBe(0);
  });
});

// ===================== NEW: updateRockets =====================

describe('updateRockets', () => {
  it('removes expired rockets and triggers explosion effects', () => {
    const rocket = new RocketProjectile(5, 5, 0.3, 1, 0, 12, 0.01, 1.5, 10);
    const ctx = createCombatContext({ rockets: [rocket] });
    updateRockets(ctx, 0.02);
    expect(ctx.rockets.length).toBe(0);
    expect(ctx.triggerScreenShake).toHaveBeenCalled();
    expect(ctx.flashCameraNoSound).toHaveBeenCalled();
    expect(ctx.soundManager.play).toHaveBeenCalledWith(SoundType.ROCKET_EXPLOSION);
  });

  it('damages enemies within explosion radius', () => {
    const enemy = createMockEnemySprite(5.3, 5);
    enemy.health = 100;
    const rocket = new RocketProjectile(5, 5, 0.3, 1, 0, 12, 0.01, 1.5, 10);
    const ctx = createCombatContext({ rockets: [rocket], sprites: [enemy] });
    updateRockets(ctx, 0.02);
    expect(enemy.health).toBe(90); // 100 - 10
    expect(enemy.hitFlashTimer).toBeCloseTo(0.15);
  });

  it('counts kills from explosion', () => {
    const enemy = createMockEnemySprite(5.3, 5);
    enemy.health = 5;
    const rocket = new RocketProjectile(5, 5, 0.3, 1, 0, 12, 0.01, 1.5, 10);
    const ctx = createCombatContext({ rockets: [rocket], sprites: [enemy] });
    updateRockets(ctx, 0.02);
    expect(enemy.isAlive).toBe(false);
    expect(enemy.isDying).toBe(true);
    expect(ctx.inventory.kills).toBe(1);
    expect(ctx.player.score).toBe(100);
  });

  it('explodes on direct enemy hit', () => {
    const enemy = createMockEnemySprite(5, 5);
    enemy.health = 100;
    const rocket = new RocketProjectile(5, 5, 0.3, 1, 0, 12, 4, 1.5, 10);
    const ctx = createCombatContext({ rockets: [rocket], sprites: [enemy] });
    updateRockets(ctx, 0.016);
    expect(ctx.rockets.length).toBe(0);
    expect(enemy.health).toBe(90);
  });

  it('does not damage dead or dying enemies', () => {
    const dead = createMockEnemySprite(5.3, 5);
    dead.isAlive = false;
    dead.isDead = true;
    dead.health = 0;
    const dying = createMockEnemySprite(5.4, 5);
    dying.isAlive = false;
    dying.isDying = true;
    dying.health = 0;
    const rocket = new RocketProjectile(5, 5, 0.3, 1, 0, 12, 0.01, 1.5, 10);
    const ctx = createCombatContext({ rockets: [rocket], sprites: [dead, dying] });
    updateRockets(ctx, 0.02);
    expect(ctx.inventory.kills).toBe(0);
  });
});

// ===================== NEW: updateBioProjectiles =====================

describe('updateBioProjectiles', () => {
  it('damages player when boss-volley projectile hits', () => {
    const player = createTestPlayer(5.3, 5);
    player.health = 100;
    const proj = new BioProjectile(5, 5, 1, 0, 14, 1.2, 12);
    const ctx = createCombatContext({ player, bioProjectiles: [proj] });
    updateBioProjectiles(ctx, 0.016);
    expect(player.health).toBe(88); // 100 - 12
    expect(ctx.triggerDamageFlash).toHaveBeenCalled();
    expect(proj.hasDamaged).toBe(true);
  });

  it('does not apply damage more than once', () => {
    const player = createTestPlayer(5.0, 5);
    player.health = 100;
    const proj = new BioProjectile(5, 5, 1, 0, 14, 1.2, 12);
    const ctx = createCombatContext({ player, bioProjectiles: [proj] });
    updateBioProjectiles(ctx, 0.016);
    expect(player.health).toBe(88);
    updateBioProjectiles(ctx, 0.016);
    expect(player.health).toBe(88);
  });

  it('does not damage player when projectile has zero damage', () => {
    const player = createTestPlayer(5.0, 5);
    player.health = 100;
    const proj = new BioProjectile(5, 5, 1, 0, 18, 0.4, 0);
    const ctx = createCombatContext({ player, bioProjectiles: [proj] });
    updateBioProjectiles(ctx, 0.016);
    expect(player.health).toBe(100);
  });

  it('removes projectile after splat completes', () => {
    const proj = new BioProjectile(10, 10, 1, 0, 18, 0.01, 0);
    const ctx = createCombatContext({ bioProjectiles: [proj] });
    updateBioProjectiles(ctx, 0.02); // lifetime expires → splat
    expect(ctx.bioProjectiles.length).toBe(1); // still in splat phase
    updateBioProjectiles(ctx, 0.2); // splat completes
    expect(ctx.bioProjectiles.length).toBe(0);
  });
});
