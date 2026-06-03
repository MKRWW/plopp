# Increment 01 — Fist melee weapon (emergency fallback)

## Goal

Add a fist/melee weapon so the player is never stuck in a death-loop when out of
ammo (gameplay gap #3). The fist is **always owned** (from game start and after
reset), has **infinite ammo**, a **long cooldown**, and **short range**. It is
selected via a **dedicated key (V)** — there is **NO auto-switch** when ammo runs
out, and the fist is **excluded from the TAB/wheel weapon cycle** (reachable only
by its key). Hitscan damage logic is reused; only range is gated.

OUT of scope: auto-switch-on-empty, a chainsaw/berserk variant, new ammo/powerup
types, minimap work, multi-door work. Do not refactor unrelated code.

## Files

- Edit: `src/game/weapons.ts` — new `WeaponType.FIST`; optional `WeaponDef` fields
  (`isMelee`, `meleeRange`, `infiniteAmmo`); FIST weapon def; seed FIST in
  `WeaponInventory` constructor + `reset()`; infinite-ammo handling in `fire()` /
  `getCurrentAmmo()` / `addAmmo()`; melee-skipping `switchNext()` / `switchPrev()`.
- Edit: `src/engine/combat.ts` — range-gate `checkShotHit`; melee branch in
  `handlePlayerShoot` (melee sound, range-limited hit).
- Edit: `src/audio/sound.ts` — `SoundType.MELEE`, `playMelee()` synth, dispatch case.
- Edit: `src/engine/renderer.ts` — `drawFist()` + dispatch in `drawWeapon`; skip
  muzzle flash for melee; HUD shows `∞` for infinite ammo; dedicated **KeyV**
  (edge-detected) switches to FIST.
- Edit: `src/game/__tests__/weapons.test.ts` — update `getWeaponCount` baseline;
  add FIST tests (see Tests).
- Create: `src/engine/__tests__/combat.test.ts` — `checkShotHit` range-gating tests.

## Required API / behavior

### `src/game/weapons.ts`

Add to the enum:
```ts
export enum WeaponType {
  PISTOL = 'pistol',
  SHOTGUN = 'shotgun',
  ROCKET_LAUNCHER = 'rocket_launcher',
  FIST = 'fist'
}
```

Add three OPTIONAL fields to `WeaponDef` (keep all existing fields, keep them in
the same place; new ones optional so the other three defs stay valid):
```ts
  isMelee?: boolean;       // melee weapon: range-limited, no projectile, no muzzle flash
  meleeRange?: number;     // max hit distance in tiles (only when isMelee)
  infiniteAmmo?: boolean;  // never consumes ammo; getCurrentAmmo() reports Infinity
```

Append the FIST def to the `WEAPONS` array as `WEAPONS[3]` (do NOT reorder the
existing three):
```ts
  {
    type: WeaponType.FIST,
    name: 'FIST',
    damage: 2,
    fireCooldown: 0.5,        // long — emergency weapon
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
```

`WeaponInventory` changes (keep the rest of the class identical):

- **Constructor**: seed pistol THEN fist; current stays 0 (pistol):
```ts
  constructor() {
    this.weapons.push({ def: WEAPONS[0], ammo: WEAPONS[0].startAmmo, fireCooldown: 0 });
    this.weapons.push({ def: WEAPONS[3], ammo: WEAPONS[3].startAmmo, fireCooldown: 0 }); // FIST
    this.current = 0;
  }
```

- **`reset()`**: restore the same two weapons, current 0, kills 0:
```ts
  reset(): void {
    this.weapons = [
      { def: WEAPONS[0], ammo: WEAPONS[0].startAmmo, fireCooldown: 0 },
      { def: WEAPONS[3], ammo: WEAPONS[3].startAmmo, fireCooldown: 0 } // FIST
    ];
    this.current = 0;
    this.kills = 0;
  }
```

- **`fire()`**: respect cooldown always; skip ammo logic for infinite-ammo weapons:
```ts
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
```

- **`getCurrentAmmo()`**: report `Infinity` for infinite-ammo weapons:
```ts
  getCurrentAmmo(): number {
    const w = this.weapons[this.current];
    return w.def.infiniteAmmo ? Infinity : w.ammo;
  }
```

- **`addAmmo()`**: no-op for infinite-ammo current weapon (guard at the top):
```ts
  addAmmo(amount: number): void {
    const w = this.weapons[this.current];
    if (w.def.infiniteAmmo) return;
    w.ammo = Math.min(w.def.maxAmmo, w.ammo + amount);
  }
```

- **`switchNext()` / `switchPrev()`**: cycle only NON-melee weapons (fist is
  reachable via its dedicated key, not the cycle). Replace both with a shared
  helper:
```ts
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
```
`switchTo(type)` is UNCHANGED — it must still select FIST when asked (that is how
the dedicated key works). `getWeaponCount()` is UNCHANGED — it returns the true
total (now 2 at start).

### `src/engine/combat.ts`

Range-gate `checkShotHit` with an optional max range (default `Infinity` keeps all
existing callers identical):
```ts
export function checkShotHit(ctx: CombatContext, maxRange: number = Infinity): Sprite | null {
```
Inside the loop, after computing `dist`, also require `dist <= maxRange` for a hit
(combine with the existing `offset < 0.4 && dist < closestDist` condition):
```ts
    if (offset < 0.4 && dist <= maxRange && dist < closestDist) {
```

In `handlePlayerShoot`, the fire-sound block currently plays ROCKET_SHOOT for
rockets else SHOOT. Add a melee case so the fist plays its own sound:
```ts
  if (def.type === WeaponType.ROCKET_LAUNCHER) {
    ctx.soundManager.play(SoundType.ROCKET_SHOOT);
  } else if (def.isMelee) {
    ctx.soundManager.play(SoundType.MELEE);
  } else {
    ctx.soundManager.play(SoundType.SHOOT);
  }
```
And gate the hitscan raycast by melee range. The hitscan path currently does
`const hit = checkShotHit(ctx);`. Change to:
```ts
  const hit = checkShotHit(ctx, def.isMelee ? (def.meleeRange ?? 1.3) : Infinity);
```
Everything else in the hit/kill block stays the same. (Melee is `isProjectile:false`
so it flows through the existing hitscan branch — do not add a projectile path.)

### `src/audio/sound.ts`

Add `MELEE = 'melee'` to the `SoundType` enum. Add a dispatch case in the `play()`
switch: `case SoundType.MELEE: this.playMelee(); break;`. Add a short, punchy
"swing + thud" synth (mirror the style of `playShoot`/`playHeartbeat`, ~120 ms,
guard on `this.audioContext`/`this.masterGain`):
```ts
  /**
   * Melee swing: short filtered noise whoosh + low thud. No tonal gunshot.
   */
  private playMelee(): void {
    if (!this.audioContext || !this.masterGain) return;
    const t = this.audioContext.currentTime;

    // Whoosh: short noise burst through a lowpass that sweeps down.
    const bufferSize = Math.floor(this.audioContext.sampleRate * 0.12);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    const lp = this.audioContext.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.1);
    const ng = this.audioContext.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    noise.connect(lp); lp.connect(ng); ng.connect(this.masterGain);
    noise.start(t); noise.stop(t + 0.12);

    // Low thud on impact.
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    const og = this.audioContext.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(og); og.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.12);
  }
```

### `src/engine/renderer.ts`

1. **Draw the fist.** In `drawWeapon`, add a branch alongside the existing ones:
```ts
    } else if (def.type === WeaponType.ROCKET_LAUNCHER) {
      this.drawRocketLauncher(cx, baseY);
    } else if (def.type === WeaponType.FIST) {
      this.drawFist(cx, baseY);
    }
```
   Add a new private `drawFist(cx: number, baseY: number): void` that draws a
   simple first-person fist/glove from the bottom of the screen, in the same
   minimal procedural style as `drawPistol` (solid fills + a little shading, no
   external assets, no new fields). Keep it small — a clenched fist rising into
   view is enough. Use the existing recoil-driven `baseY`/`cx` so the punch
   animation works for free.

2. **No muzzle flash for melee.** The muzzle-flash block runs when
   `this.weapon.state === WeaponState.FIRING && this.muzzleFlashTexture`. Add
   `&& !def.isMelee` so the fist has no gun flash:
```ts
    if (this.weapon.state === WeaponState.FIRING && this.muzzleFlashTexture && !def.isMelee) {
      this.drawMuzzleFlash(cx, baseY, def);
    }
```

3. **HUD infinite ammo.** Replace the ammo HUD line so infinite ammo shows `∞`:
```ts
    const def = this.inventory.getCurrent();
    const ammo = this.inventory.getCurrentAmmo();
    const ammoStr = isFinite(ammo) ? String(ammo) : '∞';
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`${def.name} — ${ammoStr}`, w - 20, h - 30);
```

4. **Dedicated melee key (V).** In the PLAYING update block where TAB/wheel
   switching is handled (right after `this.input.resetWheelFlags();`), add an
   edge-detected KeyV → switch to FIST. Add a private field
   `private meleeKeyWasDown = false;` near the other input-edge fields, then:
```ts
    const meleeKeyDown = this.input.isKey('KeyV');
    if (meleeKeyDown && !this.meleeKeyWasDown) {
      if (this.inventory.switchTo(WeaponType.FIST)) {
        this.weaponFlashTimer = this.WEAPON_FLASH_DURATION;
        this.weaponFlashName = this.inventory.getCurrent().name;
      }
    }
    this.meleeKeyWasDown = meleeKeyDown;
```
   Do NOT modify `input.ts`. Reuse the existing `this.input.isKey(...)` API.

## Tests (no hardware / no external deps)

### `src/game/__tests__/weapons.test.ts` (edit)

- Update the existing `getWeaponCount() returns correct length` test to the new
  baseline: starts at **2** (pistol + fist), **3** after adding shotgun, **4**
  after adding rocket. Do not change the other switchNext/switchPrev tests — they
  must still pass as-is (the melee-skip cycle preserves their behavior).
- Add a `describe('WeaponInventory - Fist / melee')` block asserting:
  - `hasWeapon(WeaponType.FIST)` is `true` on a fresh inventory.
  - `getWeaponCount()` is `2` on a fresh inventory.
  - `switchTo(WeaponType.FIST)` returns `true` and makes `getCurrent().type === FIST`.
  - After `switchTo(FIST)`: `getCurrentAmmo()` is `Infinity`; `fire()` is `true`;
    an immediate second `fire()` is `false` (cooldown); after `update(0.6)`,
    `fire()` is `true` again; `getCurrentAmmo()` is still `Infinity` (never decremented).
  - On a fresh inventory (`[pistol, fist]`), `switchNext()` and `switchPrev()`
    both return `false` and leave `getCurrent().type === PISTOL` (fist is skipped
    in the cycle).
  - With shotgun added (`switchTo(PISTOL)` first to be deterministic), cycling
    never lands on FIST: from PISTOL, `switchNext()` reaches SHOTGUN, and another
    `switchNext()` returns to PISTOL (never FIST).
  - `reset()` restores exactly `[pistol, fist]`: `getWeaponCount() === 2`,
    `getCurrent().type === PISTOL`, `hasWeapon(FIST) === true`.
- Add to the `WEAPONS - definitions` style coverage: `WEAPONS[3].type === FIST`,
  `WEAPONS[3].isMelee === true`, `WEAPONS[3].infiniteAmmo === true`,
  `WEAPONS[3].meleeRange === 1.3`, `WEAPONS[3].isProjectile === false`,
  `WEAPONS[3].fireSound === SoundType.MELEE`.
  (The existing `fireSound is SoundType enum value` test iterates ALL of WEAPONS,
  so MELEE must be a valid enum member — it will after the sound.ts change.)

### `src/engine/__tests__/combat.test.ts` (create)

Use the existing helpers. `checkShotHit` only reads `ctx.player` and `ctx.sprites`,
so build a partial context and cast it:
```ts
import { describe, it, expect } from 'vitest';
import { checkShotHit, type CombatContext } from '../combat';
import { createTestPlayer } from '../../__tests__/utils/fixtures';
import { createMockEnemySprite } from '../../__tests__/utils/mocks';

function ctxWith(player: any, sprites: any[]): CombatContext {
  return { player, sprites } as unknown as CombatContext;
}

describe('checkShotHit - range gating (melee vs hitscan)', () => {
  it('hits a distant enemy with the default (infinite) range', () => {
    const player = createTestPlayer(1.5, 1.5);   // facing +x
    const far = createMockEnemySprite(5.0, 1.5);  // ~3.5 tiles ahead
    const hit = checkShotHit(ctxWith(player, [far]));
    expect(hit).toBe(far);
  });

  it('misses a distant enemy when range is limited to melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const far = createMockEnemySprite(5.0, 1.5);  // ~3.5 tiles -> out of melee
    const hit = checkShotHit(ctxWith(player, [far]), 1.3);
    expect(hit).toBeNull();
  });

  it('hits an adjacent enemy within melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const near = createMockEnemySprite(2.5, 1.5); // ~1.0 tile -> within melee
    const hit = checkShotHit(ctxWith(player, [near]), 1.3);
    expect(hit).toBe(near);
  });
});
```

## Acceptance

- `npm run build` (Windows host) → clean exit 0.
- `npm test` (run in WSL) → the new combat tests pass, all weapons.test.ts tests
  pass (existing + new), and **no test that passed before now fails**. The only
  acceptable failures are the pre-existing flaky `level-gen` procedural-generation
  tests (retry-limit hits) — do not touch those.
- Manual feel check (reviewer): pressing **V** switches to FIST, HUD shows
  `FIST — ∞`, attacking only damages enemies within ~1.3 tiles, long cooldown,
  no muzzle flash, distinct swing sound; TAB/wheel never selects the fist.

## Do NOT

- Do not modify `src/player/input.ts`, `level-gen.ts`, `world.ts`, minimap, or any
  enemy/AI/projectile files.
- Do not add npm dependencies or external assets.
- Do not add auto-switch-to-fist-on-empty behavior, a berserk/damage mode, or any
  second melee weapon — fist only, dedicated key only.
- Do not reorder the existing `WEAPONS` entries (pistol/shotgun/rocket must keep
  indices 0/1/2; fist is index 3).
- Do not change `switchTo()` or `getWeaponCount()` semantics.
- Do not reformat or "clean up" unrelated code, comments, or imports.
