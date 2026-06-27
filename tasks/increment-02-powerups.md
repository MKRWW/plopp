# Increment 02 — Powerups: Armor + Berserk

## Goal

Add two powerup types to close gameplay gap #4 ("Keine Powerup-Highs"). **Armor** gives the player a +50 damage-absorbing shield (consumed before HP, cap 100). **Berserk** doubles all weapon damage for 10 seconds with a red HUD glow + countdown. Berserk spawns exclusively inside secret walls; Armor spawns rarely in normal rooms. Both have procedural pickup sprites and distinct audio.

OUT of scope: additional powerup types (speed, invisibility, etc.), persistent upgrades between runs, visual mesh effects on the player sprite, new player attack types, multi-door work, minimap markers.

## Files

- Edit: `src/engine/sprite.ts` — add `ARMOR` and `BERSERK` to `SpriteType` enum; update `isCollectableSprite()`.
- Edit: `src/engine/level-gen.ts` — add `secretBerserk: Vec2 | null` and `armorPickups: Vec2[]` to `Level` interface; change secret room loot to 50% BERSERK / 50% HEALTH; add rare Armor spawns (1 per stage, 40% chance, not on stage 1 or BOSS_STAGE).
- Edit: `src/engine/level-flow.ts` — initialize ARMOR and BERSERK sprites in `initializeSprites()`.
- Edit: `src/engine/renderer.ts` — add `playerArmor: number` (0–100) and `berserkTimer: number` fields; extend `checkItemPickup()` for ARMOR/BERSERK; extend `drawHUD()` with Armor bar + Berserk countdown/glow; reset armor/berserk in game reset; decrement berserkTimer in update loop.
- Edit: `src/engine/combat.ts` — apply Berserk damage multiplier (×2) in `handlePlayerShoot()` for hitscan AND rocket spawn (pass doubled `explosionDamage`); add `applyPlayerDamage()` helper that absorbs through armor first; replace all direct `ctx.player.health -= damage` in this file with `applyPlayerDamage()`.
- Edit: `src/engine/enemy-ai.ts` — replace all direct `ctx.player.health -= damage` calls (5 sites) with `applyPlayerDamage()` from combat.ts.
- Edit: `src/audio/sound.ts` — add `POWERUP_ARMOR` and `POWERUP_BERSERK` to `SoundType` enum; add `playPowerupArmor()` and `playPowerupBerserk()` procedural synths; add dispatch cases.
- Edit: `src/engine/sprite-textures.ts` — add procedural textures for ARMOR (cyan shield) and BERSERK (red star/diamond) pickup sprites in the existing texture generation flow.

## Required API / behavior

### `src/engine/sprite.ts`

Add to `SpriteType` enum:
```ts
  ARMOR = 'armor',
  BERSERK = 'berserk'
```

Update `isCollectableSprite()`:
```ts
export function isCollectableSprite(type: SpriteType): boolean {
  return (
    type === SpriteType.AMMO ||
    type === SpriteType.HEALTH ||
    type === SpriteType.KEYCARD ||
    type === SpriteType.YELLOW_KEYCARD ||
    type === SpriteType.WEAPON_SHOTGUN ||
    type === SpriteType.WEAPON_ROCKETLAUNCHER ||
    type === SpriteType.ARMOR ||
    type === SpriteType.BERSERK
  );
}
```

### `src/engine/level-gen.ts`

Add to `Level` interface (keep all existing fields):
```ts
  secretBerserk: Vec2 | null;   // Berserk pickup in secret room (replaces secretHealth 50% of time)
  armorPickups: Vec2[];         // 0-1 armor pickups in normal rooms
```

In `generateLevel()`, change the secret room section (around line 832-840):
- Keep `secretHealth` for backwards compat but ALSO compute `secretBerserk`.
- When a secret room is placed: 50% chance → `secretBerserk = secretRoomPos` (Berserk), 50% → `secretHealth = secretRoomPos` (Health). Only one of the two is non-null.

After the existing item placement (around line 860-872), add Armor spawn:
```ts
    // Armor: rare pickup, 1 per stage with 40% chance, not on stage 1 or boss stage
    let armorPickups: Vec2[] = [];
    if (stage > 1 && stage !== BOSS_STAGE && rng() < 0.4) {
      armorPickups = placeItemsInRooms(map, rooms, excludeSpawnExit, 1, rng, used);
    }
```

Return both new fields in the Level object.

### `src/engine/level-flow.ts`

In `initializeSprites()`, after the `secretHealth` block (line 216-222), add:
```ts
  // Secret Berserk (replaces secret health 50% of the time)
  if (level.secretBerserk) {
    const berserkTextures = flat.get(SpriteType.BERSERK);
    const s = new Sprite(level.secretBerserk.x, level.secretBerserk.y, SpriteType.BERSERK, berserkTextures?.[0] ?? null);
    if (berserkTextures) s.textures = berserkTextures;
    s.animationSpeed = 0.12;
    ctx.sprites.push(s);
  }

  // Armor pickups
  const armorTextures = flat.get(SpriteType.ARMOR);
  for (const pos of level.armorPickups) {
    const s = new Sprite(pos.x, pos.y, SpriteType.ARMOR, armorTextures?.[0] ?? null);
    if (armorTextures) s.textures = armorTextures;
    s.animationSpeed = 0.12;
    ctx.sprites.push(s);
  }
```

### `src/audio/sound.ts`

Add to `SoundType` enum:
```ts
  POWERUP_ARMOR = 'powerupArmor',
  POWERUP_BERSERK = 'powerupBerserk'
```

Add dispatch cases in `play()`:
```ts
      case SoundType.POWERUP_ARMOR:
        this.playPowerupArmor();
        break;
      case SoundType.POWERUP_BERSERK:
        this.playPowerupBerserk();
        break;
```

Add two procedural synth methods:

`playPowerupArmor()` — bright, short "ping" with undertone (~300ms):
- Sine oscillator at 880Hz → exponential ramp down to 440Hz over 200ms
- Gain: quick attack (10ms to 0.3), exponential decay to 0.001 over 280ms
- Add a second sine at 1320Hz (fifth above) at lower gain (0.1) for shimmer

`playPowerupBerserk()` — deep drone + staccato rise (~400ms):
- Sine oscillator starting at 110Hz, ramp to 220Hz over 300ms (rising drone)
- Gain: sustain at 0.25 for 200ms, then decay over 200ms
- Add a square wave at 55Hz (sub-bass rumble) at gain 0.08 for the full 400ms
- Add 3 short noise bursts (each ~30ms) at t=50ms, t=150ms, t=250ms for staccato "pulses"

### `src/engine/combat.ts`

Add exported helper function for armor-absorbing damage:
```ts
/**
 * Applies damage to the player, absorbing through armor first.
 * Returns the actual HP damage dealt (after armor absorption).
 */
export function applyPlayerDamage(
  player: Player,
  playerArmor: { value: number },
  rawDamage: number
): void {
  if (playerArmor.value > 0) {
    const absorbed = Math.min(playerArmor.value, rawDamage);
    playerArmor.value -= absorbed;
    rawDamage -= absorbed;
  }
  if (rawDamage > 0) {
    player.health -= rawDamage;
  }
}
```

The `playerArmor` parameter is a `{ value: number }` wrapper object so the function can mutate it. The Renderer owns the actual `playerArmorValue: number` field and passes `{ value: this.playerArmorValue }` — BUT since we need the mutation to propagate back, use a simpler approach: **add `playerArmor` as a field on the Player object itself** (see renderer.ts section below). This avoids wrapper objects.

**Revised approach**: Add `armor: number` directly to the `Player` class in `src/player/player.ts`. Then `applyPlayerDamage` takes just `player: Player`:

```ts
export function applyPlayerDamage(player: Player, rawDamage: number): void {
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rawDamage);
    player.armor -= absorbed;
    rawDamage -= absorbed;
  }
  if (rawDamage > 0) {
    player.health -= rawDamage;
  }
}
```

In `handlePlayerShoot()`, apply Berserk multiplier:
```ts
  const berserkMult = /* from ctx */ ctx.berserkTimer > 0 ? 2 : 1;
```

For hitscan: change `hit.health -= def.damage;` to `hit.health -= def.damage * berserkMult;`

For rockets: change the rocket spawn to pass `def.explosionDamage ?? 10` multiplied: `(def.explosionDamage ?? 10) * berserkMult`

Add `berserkTimer: number` to `CombatContext` interface.

Replace the bio-projectile damage line (line 273):
```ts
        // OLD: ctx.player.health -= proj.damage;
        applyPlayerDamage(ctx.player, proj.damage);
```

### `src/engine/enemy-ai.ts`

Import `applyPlayerDamage` from `./combat`. Replace ALL 5 direct `ctx.player.health -= ...` lines with `applyPlayerDamage(ctx.player, damage)`:
- Line 217: `ctx.player.health -= attackDamage;` → `applyPlayerDamage(ctx.player, attackDamage);`
- Line 317: `ctx.player.health -= damage;` → `applyPlayerDamage(ctx.player, damage);`
- Line 421: `ctx.player.health -= sprite.shooterDamage;` → `applyPlayerDamage(ctx.player, sprite.shooterDamage);`
- Line 486: `ctx.player.health -= AI_LATCHER_DAMAGE;` → `applyPlayerDamage(ctx.player, AI_LATCHER_DAMAGE);`
- Line 526: `ctx.player.health -= AI_LATCHER_DAMAGE;` → `applyPlayerDamage(ctx.player, AI_LATCHER_DAMAGE);`

### `src/player/player.ts`

Add `armor: number = 0;` field to the Player class. Reset it in any `reset()` or initialization method if one exists.

### `src/engine/renderer.ts`

Add fields to Renderer class:
```ts
  private berserkTimer: number = 0;
  private readonly BERSERK_DURATION: number = 10; // seconds
```

(`player.armor` lives on the Player object now.)

**CombatContext** — add `berserkTimer`:
```ts
  private combatCtx(): CombatContext {
    return {
      // ... existing fields ...
      berserkTimer: this.berserkTimer,
    };
  }
```

**Update loop** — decrement `berserkTimer` in the PLAYING update block (before or after the existing timer updates):
```ts
    if (this.berserkTimer > 0) {
      this.berserkTimer = Math.max(0, this.berserkTimer - deltaTime);
    }
```

**`checkItemPickup()`** — extend the pickup switch with two new branches:
```ts
        } else if (sprite.type === SpriteType.ARMOR) {
          if (this.player.armor < 100) {
            this.player.armor = Math.min(100, this.player.armor + 50);
            this.soundManager.play(SoundType.POWERUP_ARMOR);
            this.sprites.splice(i, 1);
          }
          // If armor is full (100), do NOT pick up — skip this item
          continue; // don't play the default PICKUP sound
        } else if (sprite.type === SpriteType.BERSERK) {
          this.berserkTimer = this.BERSERK_DURATION;
          this.player.score += 200;
          this.soundManager.play(SoundType.POWERUP_BERSERK);
          this.sprites.splice(i, 1);
          continue; // don't play the default PICKUP sound
```

Note: the existing code plays `SoundType.PICKUP` for all items after the if/else chain. For ARMOR and BERSERK we play their own sounds and `continue` to skip the generic PICKUP sound.

**`drawHUD()`** — add Armor bar below health bar, and Berserk overlay:

Armor bar (below the health bar, same width/position pattern):
```ts
    // --- Armor Bar (below health bar) ---
    if (this.player.armor > 0) {
      const armorBarX = 20;
      const armorBarY = h - 28;
      const armorBarW = 200;
      const armorBarH = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(armorBarX - 2, armorBarY - 2, armorBarW + 4, armorBarH + 4);
      ctx.fillStyle = '#033';
      ctx.fillRect(armorBarX, armorBarY, armorBarW, armorBarH);
      const armorPct = this.player.armor / 100;
      ctx.fillStyle = '#0cc';
      ctx.fillRect(armorBarX, armorBarY, armorBarW * armorPct, armorBarH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ARMOR ${this.player.armor}`, armorBarX + 5, armorBarY + 10);
    }
```

Berserk overlay (red glow + countdown, drawn after all other HUD):
```ts
    // --- Berserk active overlay ---
    if (this.berserkTimer > 0) {
      // Red border glow
      const alpha = Math.min(0.4, this.berserkTimer / this.BERSERK_DURATION * 0.4);
      ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.lineWidth = 1;

      // Countdown text (top center)
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = `rgba(255, 60, 60, ${0.7 + 0.3 * Math.sin(performance.now() / 150)})`;
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 12;
      ctx.fillText(`BERSERK ${this.berserkTimer.toFixed(1)}`, w / 2, 25);
      ctx.shadowBlur = 0;
    }
```

**Pickup proximity hint** — extend the item pickup hint section (around line 1657-1677) to show hints for ARMOR/BERSERK:
```ts
        } else if (sprite.type === SpriteType.ARMOR) {
          ctx.fillStyle = '#0cc';
          ctx.fillText('[E] ARMOR einsammeln', w / 2, 60);
        } else if (sprite.type === SpriteType.BERSERK) {
          ctx.fillStyle = '#f44';
          ctx.fillText('[E] BERSERK einsammeln', w / 2, 60);
```

**Game reset** — wherever the game resets (look for `resetGameFlow` calls or the RESET transition), also reset:
```ts
    this.berserkTimer = 0;
    this.player.armor = 0;
```

### `src/engine/sprite-textures.ts`

Add procedural textures for ARMOR and BERSERK in the existing texture generation pattern. Look at how HEALTH/AMMO textures are generated and follow the same approach.

**ARMOR texture** (64×64): Cyan/blue shield shape — draw a simple shield outline (inverted triangle or rounded pentagon) filled with `#0cc` and a lighter `#0ff` highlight on the upper-left quadrant. Keep it simple and recognizable at small screen sizes.

**BERSERK texture** (64×64): Red star/diamond — draw a 4-pointed star or diamond filled with `#f22` and a brighter `#f88` center. Add 2-3 radiating lines for a "power" feel. Keep it bold and high-contrast.

## Tests (no hardware / no external deps)

Do NOT add new test files for this increment. The existing test suite should continue to pass with no new failures. The acceptance criteria are verified via build + manual smoke test.

If existing tests reference `SpriteType` enum values or `Level` interface shape and break, fix them minimally to match the new shape.

## Acceptance

- `npm run build` (Windows host) → clean exit 0.
- `npm test` (WSL) → no NEW failures beyond the pre-existing flaky level-gen / rocket-projectile baselines.
- Manual smoke test:
  1. Start a stage → find a secret wall (crack texture) → open it → 50% chance of Berserk inside. Pick it up → red border glow + "BERSERK 10.0" countdown appears → shoot an enemy → dies in half the hits.
  2. Find an Armor pickup (cyan shield on floor) → pick it up → "ARMOR 50" bar appears below health bar. Get hit by enemy → armor decreases first, HP stays intact until armor hits 0.
  3. Armor at 100 → walking over another Armor does NOT pick it up (no waste).
  4. Berserk expires → red glow fades, damage returns to normal.
  5. Rocket launcher during Berserk → AoE explosion damage is doubled.

## Do NOT

- Do not modify `src/player/input.ts`, `src/game/minimap.ts`, `src/game/state.ts`, or any test files (except minimal fixes for broken enum/shape references).
- Do not add npm dependencies or external assets.
- Do not add additional powerup types, persistent upgrades, or visual mesh effects.
- Do not change existing weapon cooldowns, enemy HP, level size, or room generation.
- Do not refactor the damage application beyond adding `applyPlayerDamage()` and replacing the 6 direct `player.health -=` sites.
- Do not reformat or "clean up" unrelated code, comments, or imports.
- Do not change the existing `secretHealth` field semantics — it still works for the 50% case where it's chosen over Berserk.
