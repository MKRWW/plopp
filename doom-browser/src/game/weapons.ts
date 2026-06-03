import { SoundType } from '../audio/sound';

export enum WeaponType {
  PISTOL = 'pistol',
  SHOTGUN = 'shotgun',
  ROCKET_LAUNCHER = 'rocket_launcher',
  FIST = 'fist'
}

export interface WeaponDef {
  type: WeaponType;
  name: string;
  damage: number;
  fireCooldown: number;
  flashDuration: number;
  startAmmo: number;
  maxAmmo: number;
  recoilY: number;
  recoilXSpread: number;
  screenShake: number;
  fireSound: SoundType;
  isProjectile: boolean;
  projectileSpeed?: number;
  explosionRadius?: number;
  explosionDamage?: number;
  isMelee?: boolean;
  meleeRange?: number;
  infiniteAmmo?: boolean;
}

export class WeaponInventory {
  private weapons: { def: WeaponDef; ammo: number; fireCooldown: number }[] = [];
  private current: number = 0;
  public kills: number = 0;

  constructor() {
    this.weapons.push({ def: WEAPONS[0], ammo: WEAPONS[0].startAmmo, fireCooldown: 0 });
    this.weapons.push({ def: WEAPONS[3], ammo: WEAPONS[3].startAmmo, fireCooldown: 0 }); // FIST
    this.current = 0;
  }

  addWeapon(def: WeaponDef): void {
    const existingIdx = this.weapons.findIndex(w => w.def.type === def.type);
    if (existingIdx >= 0) {
      this.weapons[existingIdx].ammo = Math.min(def.maxAmmo, this.weapons[existingIdx].ammo + def.startAmmo);
    } else {
      this.weapons.push({ def, ammo: def.startAmmo, fireCooldown: 0 });
      this.current = this.weapons.length - 1;
    }
  }

  switchTo(type: WeaponType): boolean {
    const idx = this.weapons.findIndex(w => w.def.type === type);
    if (idx >= 0) {
      this.current = idx;
      return true;
    }
    return false;
  }

  switchNext(): boolean { return this.cycle(1); }
  switchPrev(): boolean { return this.cycle(-1); }

  private cycle(dir: number): boolean {
    const n = this.weapons.length;
    for (let step = 1; step < n; step++) {
      const idx = (((this.current + dir * step) % n) + n) % n;
      if (!this.weapons[idx].def.isMelee) {
        this.current = idx;
        return true;
      }
    }
    return false;
  }

  getWeaponCount(): number {
    return this.weapons.length;
  }

  getCurrent(): WeaponDef {
    return this.weapons[this.current].def;
  }

  getCurrentAmmo(): number {
    const w = this.weapons[this.current];
    return w.def.infiniteAmmo ? Infinity : w.ammo;
  }

  getMaxAmmo(): number {
    return this.weapons[this.current].def.maxAmmo;
  }

  fire(): boolean {
    const w = this.weapons[this.current];
    if (w.fireCooldown > 0) return false;
    if (!w.def.infiniteAmmo) {
      if (w.ammo <= 0) return false;
      w.ammo--;
    }
    w.fireCooldown = w.def.fireCooldown;
    return true;
  }

  update(dt: number): void {
    for (const w of this.weapons) {
      if (w.fireCooldown > 0) w.fireCooldown = Math.max(0, w.fireCooldown - dt);
    }
  }

  addAmmo(amount: number): void {
    const w = this.weapons[this.current];
    if (w.def.infiniteAmmo) return;
    w.ammo = Math.min(w.def.maxAmmo, w.ammo + amount);
  }

  hasWeapon(type: WeaponType): boolean {
    return this.weapons.some(w => w.def.type === type);
  }

  reset(): void {
    this.weapons = [
      { def: WEAPONS[0], ammo: WEAPONS[0].startAmmo, fireCooldown: 0 },
      { def: WEAPONS[3], ammo: WEAPONS[3].startAmmo, fireCooldown: 0 } // FIST
    ];
    this.current = 0;
    this.kills = 0;
  }
}

export const WEAPONS: WeaponDef[] = [
  {
    type: WeaponType.PISTOL,
    name: 'PISTOL',
    damage: 1,
    fireCooldown: 0.2,
    flashDuration: 0.12,
    startAmmo: 50,
    maxAmmo: 200,
    recoilY: -25,
    recoilXSpread: 5,
    screenShake: 3,
    fireSound: SoundType.SHOOT,
    isProjectile: false
  },
  {
    type: WeaponType.SHOTGUN,
    name: 'SHOTGUN',
    damage: 1,
    fireCooldown: 0.1,
    flashDuration: 0.08,
    startAmmo: 200,
    maxAmmo: 400,
    recoilY: -15,
    recoilXSpread: 3,
    screenShake: 2,
    fireSound: SoundType.SHOOT,
    isProjectile: false
  },
  {
    type: WeaponType.ROCKET_LAUNCHER,
    name: 'ROCKET',
    damage: 10,
    fireCooldown: 0.8,
    flashDuration: 0.25,
    startAmmo: 20,
    maxAmmo: 40,
    recoilY: -40,
    recoilXSpread: 8,
    screenShake: 6,
    fireSound: SoundType.ROCKET_SHOOT,
    isProjectile: true,
    projectileSpeed: 12,
    explosionRadius: 1.5,
    explosionDamage: 10
  },
  {
    type: WeaponType.FIST,
    name: 'FIST',
    damage: 2,
    fireCooldown: 0.5,
    flashDuration: 0.12,
    startAmmo: 0,
    maxAmmo: 0,
    recoilY: -18,
    recoilXSpread: 4,
    screenShake: 2,
    fireSound: SoundType.MELEE,
    isProjectile: false,
    isMelee: true,
    meleeRange: 1.3,
    infiniteAmmo: true
  }
];
