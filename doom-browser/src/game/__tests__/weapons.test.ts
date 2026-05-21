import { describe, it, expect } from 'vitest';
import { WeaponType, WeaponInventory, WEAPONS } from '../weapons';
import { SoundType } from '../../audio/sound';

describe('WeaponInventory - Initial State', () => {
  it('starts with one weapon (pistol) on construction', () => {
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
    while (inv.getCurrentAmmo() > 0) {
      inv.fire();
    }
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
  it('resets to a single pistol with startAmmo', () => {
    const inv = new WeaponInventory();
    inv.addWeapon(WEAPONS[1]);
    inv.addWeapon(WEAPONS[2]);
    inv.kills = 5;
    inv.reset();
    expect(inv.getCurrent().type).toBe(WeaponType.PISTOL);
    expect(inv.getCurrentAmmo()).toBe(WEAPONS[0].startAmmo);
    expect(inv.kills).toBe(0);
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
  });

  it('rocket has projectileSpeed, explosionRadius, explosionDamage', () => {
    expect(WEAPONS[2].projectileSpeed).toBe(12);
    expect(WEAPONS[2].explosionRadius).toBe(1.5);
    expect(WEAPONS[2].explosionDamage).toBe(10);
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
    expect(inv.getWeaponCount()).toBe(1);
    inv.addWeapon(WEAPONS[1]);
    expect(inv.getWeaponCount()).toBe(2);
    inv.addWeapon(WEAPONS[2]);
    expect(inv.getWeaponCount()).toBe(3);
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
