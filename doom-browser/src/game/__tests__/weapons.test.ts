import { describe, it, expect } from 'vitest';
import { WeaponType, WeaponInventory, WEAPONS } from '../weapons';
import { SoundType } from '../../audio/sound';

describe('WeaponInventory - Initial State', () => {
  it('starts with pistol as current weapon on construction', () => {
    const inv = new WeaponInventory();
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
  });

  it('startAmmo matches WEAPONS[0]', () => {
    const inv = new WeaponInventory();
    expect(inv.getCurrentAmmo()).toBe(WEAPONS[0].startAmmo);
  });

  it('maxAmmo matches WEAPONS[0]', () => {
    const inv = new WeaponInventory();
    expect(inv.getMaxAmmo()).toBe(WEAPONS[0].maxAmmo);
  });

  it('kills start at 0', () => {
    const inv = new WeaponInventory();
    expect(inv.kills).toBe(0);
  });

  it('hasWeapon returns true for initial pistol', () => {
    const inv = new WeaponInventory();
    expect(inv.hasWeapon(WeaponType.PISTOL)).toBe(true);
  });

  it('hasWeapon returns false for non-starter weapons', () => {
    const inv = new WeaponInventory();
    expect(inv.hasWeapon(WeaponType.SHOTGUN)).toBe(false);
    expect(inv.hasWeapon(WeaponType.ROCKET_LAUNCHER)).toBe(false);
  });

  it('hasWeapon returns true for fist on fresh inventory', () => {
    const inv = new WeaponInventory();
    expect(inv.hasWeapon(WeaponType.FIST)).toBe(true);
  });

  it('getWeaponCount() is 2 on fresh inventory (pistol + fist)', () => {
    const inv = new WeaponInventory();
    expect(inv.getWeaponCount()).toBe(2);
  });
});

describe('WeaponInventory - Fire', () => {
  it('fire() returns true with ammo available', () => {
    const inv = new WeaponInventory();
    expect(inv.getCurrentAmmo()).toBe(50);
    const result = inv.fire();
    expect(result).toBe(true);
    expect(inv.getCurrentAmmo()).toBe(49);
  });

  it('fire() returns false with zero ammo', () => {
    const inv = new WeaponInventory();
    // Drain all ammo; clear the cooldown each iteration so fire() actually
    // consumes a round (a bare while(ammo>0) loop would spin forever because
    // fire() refuses while the cooldown is still ticking).
    for (let i = 0; i < WEAPONS[0].startAmmo; i++) {
      inv.update(1);
      inv.fire();
    }
    expect(inv.getCurrentAmmo()).toBe(0);
    inv.update(1); // clear cooldown so the final fire() fails on ammo, not cooldown
    const result = inv.fire();
    expect(result).toBe(false);
  });

  it('fire() returns false during cooldown', () => {
    const inv = new WeaponInventory();
    inv.fire();
    expect(inv.fire()).toBe(false);
  });

  it('fire() returns true after cooldown expires', () => {
    const inv = new WeaponInventory();
    inv.fire();
    inv.update(0.5);
    expect(inv.fire()).toBe(true);
  });
});

describe('WeaponInventory - Update', () => {
  it('update() decrements fire cooldown', () => {
    const inv = new WeaponInventory();
    inv.fire();
    inv.update(0.15);
    inv.update(0.1);
    expect(inv.fire()).toBe(true);
  });

  it('update() clamps cooldown to 0', () => {
    const inv = new WeaponInventory();
    inv.fire();
    inv.update(999);
    expect(inv.fire()).toBe(true);
  });
});

describe('WeaponInventory - addWeapon', () => {
  it('adds a new weapon type and switches to it', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
    expect(inv.hasWeapon(WeaponType.PISTOL)).toBe(true);
    expect(inv.hasWeapon(WeaponType.SHOTGUN)).toBe(true);
  });

  it('adding existing weapon top ups ammo, does not switch', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    const currentType = inv.getCurrent().type;
    inv.addWeapon(WEAPONS[1]);
    expect(inv.getCurrent().type).toBe(currentType);
  });
});

describe('WeaponInventory - switchTo', () => {
  it('switches to existing weapon when available', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    const result = inv.switchTo(WeaponType.SHOTGUN);
    expect(result).toBe(true);
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
  });

  it('returns false when weapon not owned', () => {
    const inv = new WeaponInventory();
    const result = inv.switchTo(WeaponType.ROCKET_LAUNCHER);
    expect(result).toBe(false);
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
  });
});

describe('WeaponInventory - addAmmo', () => {
  it('adds ammo to current weapon', () => {
    const inv = new WeaponInventory();
    const before = inv.getCurrentAmmo();
    inv.addAmmo(10);
    expect(inv.getCurrentAmmo()).toBe(before + 10);
  });

  it('caps ammo at maxAmmo', () => {
    const inv = new WeaponInventory();
    inv.addAmmo(9999);
    expect(inv.getCurrentAmmo()).toBe(WEAPONS[0].maxAmmo);
  });
});

describe('WeaponInventory - reset', () => {
  it('resets to pistol + fist with startAmmo', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    inv.addWeapon(WEAPONS[2]);
    inv.kills = 5;
    inv.reset();
    expect(inv.getWeaponCount()).toBe(2);
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
    expect(inv.getCurrentAmmo()).toBe(WEAPONS[0].startAmmo);
    expect(inv.kills).toBe(0);
    expect(inv.hasWeapon(WeaponType.FIST)).toBe(true);
    expect(inv.hasWeapon(WeaponType.SHOTGUN)).toBe(false);
    expect(inv.hasWeapon(WeaponType.ROCKET_LAUNCHER)).toBe(false);
  });
});

describe('WEAPONS - fireSound types', () => {
  it('fireSound is SoundType enum value', () => {
    for (const w of WEAPONS) {
      expect(typeof w.fireSound).toBe('string');
      expect(Object.values(SoundType)).toContain(w.fireSound);
    }
  });

  it('rocket launcher uses ROCKET_SHOOT sound', () => {
    expect(WEAPONS[2].fireSound).toBe(SoundType.ROCKET_SHOOT);
  });

  it('pistol and shotgun use SHOOT sound', () => {
    expect(WEAPONS[0].fireSound).toBe(SoundType.SHOOT);
    expect(WEAPONS[1].fireSound).toBe(SoundType.SHOOT);
  });
});

describe('WEAPONS - definitions', () => {
  it('all weapons have isProjectile flag', () => {
    expect(WEAPONS[0].isProjectile).toBe(false);
    expect(WEAPONS[1].isProjectile).toBe(false);
    expect(WEAPONS[2].isProjectile).toBe(true);
    expect(WEAPONS[3].isProjectile).toBe(false);
  });

  it('rocket has projectileSpeed, explosionRadius, explosionDamage', () => {
    expect(WEAPONS[2].projectileSpeed).toBe(12);
    expect(WEAPONS[2].explosionRadius).toBe(1.5);
    expect(WEAPONS[2].explosionDamage).toBe(10);
  });

  it('WEAPONS[3] is FIST with correct melee properties', () => {
    expect(WEAPONS[3].type).toBe(WeaponType.FIST);
    expect(WEAPONS[3].isMelee).toBe(true);
    expect(WEAPONS[3].infiniteAmmo).toBe(true);
    expect(WEAPONS[3].meleeRange).toBe(1.3);
    expect(WEAPONS[3].fireSound).toBe(SoundType.MELEE);
  });
});

describe('WeaponInventory - Fist / melee', () => {
  it('switchTo(FIST) returns true and makes getCurrent().type === FIST', () => {
    const inv = new WeaponInventory();
    const result = inv.switchTo(WeaponType.FIST);
    expect(result).toBe(true);
    expect(inv.getCurrent().type).toBe(WeaponType.FIST);
  });

  it('after switchTo(FIST): getCurrentAmmo() is Infinity; fire() works; cooldown blocks; ammo never decrements', () => {
    const inv = new WeaponInventory();
    inv.switchTo(WeaponType.FIST);
    expect(inv.getCurrentAmmo()).toBe(Infinity);
    expect(inv.fire()).toBe(true);
    expect(inv.fire()).toBe(false); // cooldown
    inv.update(0.6);
    expect(inv.fire()).toBe(true);
    expect(inv.getCurrentAmmo()).toBe(Infinity); // never decremented
  });

  it('on fresh inventory [pistol, fist], switchNext() and switchPrev() both return false', () => {
    const inv = new WeaponInventory();
    const nextResult = inv.switchNext();
    const prevResult = inv.switchPrev();
    expect(nextResult).toBe(false);
    expect(prevResult).toBe(false);
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
  });

  it('with shotgun added, cycling never lands on FIST', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]); // [PISTOL, FIST, SHOTGUN]
    inv.switchTo(WeaponType.PISTOL);
    inv.switchNext();
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
    inv.switchNext();
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
    expect(inv.getCurrent().type).not.toBe(WeaponType.FIST);
  });

  it('addAmmo() is no-op for infiniteAmmo current weapon', () => {
    const inv = new WeaponInventory();
    inv.switchTo(WeaponType.FIST);
    const before = inv.getCurrentAmmo();
    inv.addAmmo(10);
    expect(inv.getCurrentAmmo()).toBe(before); // still Infinity
  });
});

describe('WeaponInventory - switchNext / switchPrev', () => {
  it('switchNext() cycles forward', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]); // [PISTOL, SHOTGUN]
    inv.addWeapon(WEAPONS[2]); // [PISTOL, SHOTGUN, ROCKET]
    expect(inv.getCurrent().type).toBe(WeaponType.ROCKET_LAUNCHER);
    inv.switchNext();
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
    inv.switchNext();
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
    inv.switchNext();
    expect(inv.getCurrent().type).toBe(WeaponType.ROCKET_LAUNCHER);
  });

  it('switchPrev() cycles backward', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]); // [PISTOL, SHOTGUN]
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
    inv.switchPrev();
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
    inv.switchPrev();
    expect(inv.getCurrent().type).toBe(WeaponType.SHOTGUN);
  });

  it('Single weapon: switchNext() returns false', () => {
    const inv = new WeaponInventory();
    const result = inv.switchNext();
    expect(result).toBe(false);
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
  });

  it('Single weapon: switchPrev() returns false', () => {
    const inv = new WeaponInventory();
    const result = inv.switchPrev();
    expect(result).toBe(false);
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
  });

  it('getWeaponCount() returns correct length', () => {
    const inv = new WeaponInventory();
    expect(inv.getWeaponCount()).toBe(2);
    inv.addWeapon(WEAPONS[1]);
    expect(inv.getWeaponCount()).toBe(3);
    inv.addWeapon(WEAPONS[2]);
    expect(inv.getWeaponCount()).toBe(4);
  });

  it('switchNext() returns true with multiple weapons', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    expect(inv.switchNext()).toBe(true);
  });

  it('switchPrev() returns true with multiple weapons', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    expect(inv.switchPrev()).toBe(true);
  });
});
