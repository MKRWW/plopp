## Dead-Body Corpse Persistence Spec

```markdown
## Problem

When an NPC's health reaches 0, the engine runs a 0.45-second shrink-and-sink death
animation and then removes the sprite entirely (`this.sprites.splice(idx, 1)` at
`renderer.ts:1833`). The level becomes cleaner than the combat it depicts; there is no
visual record of kills. Classic Doom retained corpses on the floor for the entire session.
The goal is to leave a flat "dead body" billboard in place of every killed NPC, persisting
until the player exits the level.

---

## Files to touch

| File | Reason |
|---|---|
| `src/engine/sprite.ts` | Add `isDead` state flag and `corpseTexture` field to the `Sprite` class |
| `src/engine/sprite-textures.ts` | Add `generateCorpseTexture()` — a procedural top-down bloodied-body tile |
| `src/engine/renderer.ts` | Death transition, corpse rendering branch, AI/collision exclusion |

No other files require changes. Level data, collision constants, z-buffer, and sound
systems are unaffected.

---

## Approach

### 1. Sprite class (`sprite.ts`)

Add two fields to the `Sprite` class (after the existing `isDying`/`deathTimer` block,
around line 58):

```ts
isDead: boolean = false;      // settled corpse — animation complete
corpseTexture: Texture | null = null;
```

`isDead` is the third lifecycle state after `isAlive` and `isDying`. The lifecycle
becomes: **alive → dying (0.45 s animation) → dead (permanent)**.

### 2. Corpse texture (`sprite-textures.ts`)

Add `generateCorpseTexture(w: number, h: number): Texture`. The texture should read as a
body lying face-down:

- Background: transparent / floor-coloured (alpha 0 for transparent pixels so the floor
  shows through).
- Silhouette drawn as a roughly humanoid elongated blob centred on the tile, using the
  same dark-reddish palette already used for the death tint (`r≈80, g≈20, b≈15`).
- A dark blood-pool ellipse behind/around the silhouette.
- Use the same 64×64 canvas size as all other generated textures so the rendering
  pipeline needs no special-casing on dimensions.

Attach the result to each enemy `Sprite` at creation time:

```ts
enemy.corpseTexture = generateCorpseTexture(TEX_W, TEX_H);  // renderer.ts initializeSprites()
```

### 3. Death transition (`renderer.ts` — update loop ~line 1830)

Replace the current splice-on-expire block:

```ts
// BEFORE
if (sprite.deathTimer <= 0) {
  const idx = this.sprites.indexOf(sprite);
  if (idx >= 0) this.sprites.splice(idx, 1);
}
```

```ts
// AFTER
if (sprite.deathTimer <= 0) {
  sprite.isDying = false;
  sprite.isDead = true;
  // x/y remain unchanged — corpse stays where the enemy died
}
```

The sprite stays in `this.sprites` forever (until level reload clears the array).

### 4. AI and collision exclusion (`renderer.ts` — enemy update loop ~line 1701)

The AI guard is currently `!s.isDying`. Extend it:

```ts
// line ~1701
if (!s.isAlive || s.isDying || s.isDead) continue;
```

In `wouldOverlapEntity` / `resolveEntityCollision` helpers (and the
`resolveAllEntityOverlaps` pass at ~line 1766), skip any sprite where `s.isDead` is
true. Players and living enemies should walk through corpses without deflection.

### 5. Corpse rendering branch (`renderer.ts` — `renderSprites()` ~line 594)

After the existing angle-view selection block, add a dedicated branch for dead sprites.
Dead sprites skip the 8-direction pose logic, shadow, hit-flash, and death-tint:

```
if (sprite.isDead && sprite.corpseTexture) {
  texture = sprite.corpseTexture

  // Render flat: small fixed height (~18 % of full sprite height),
  // anchored to the floor line.
  //   spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY)) * CORPSE_SCALE
  //   CORPSE_SCALE = 0.18
  //   drawStartY = horizon + Math.floor(spriteHeight / 2)  // sits ON the floor
  //   drawEndY   = drawStartY + spriteHeight

  // Width uses same scale as height (square billboard projected flat).
  // Z-buffer depth test is identical to living sprites — walls occlude corpses.
  // No shadow ellipse (body IS the shadow).
  // Apply distance-based brightness darkening same as walls/floor.
}
```

The "flat on floor" illusion comes entirely from the small scale factor and the low
vertical anchor point — no change to the projection math is needed.

Existing living/dying render paths are unchanged; the `isDead` branch is a short-circuit
at the top of the per-sprite loop.

---

## Acceptance criteria

1. After an NPC's death animation completes its full 0.45 s, a corpse sprite is visible
   on the floor at the NPC's last position.
2. The corpse persists for the entire session on that level (survives any number of
   additional kills, player movement, weapon reloads).
3. The corpse is correctly occluded by walls using the existing z-buffer; a wall between
   the player and the corpse hides the corpse fully or partially.
4. Corpses are sorted with all other sprites by distance each frame; multiple overlapping
   corpses render in correct painter's-algorithm order.
5. The player and all living enemies can walk through corpse positions without any
   collision deflection.
6. The living enemy AI (chase/attack) is unaffected by the presence of corpses.
7. Corpse sprites do not animate (frozen single frame).
8. On level transition (new procedural level), all corpses are gone (the `sprites` array
   is rebuilt from scratch in `initializeSprites()`).
9. Performance: 20 simultaneous corpses on screen produce no measurable frame-rate drop
   on a mid-range laptop (corpses are cheaper than living enemies: no AI, no animation
   update, no shadow).
10. No corpse texture bleeds into item or decor sprite slots.

---

## Test plan

**Manual — single kill**
- Start a level, shoot one enemy until dead.
- Observe the death animation plays to completion.
- After animation ends, a flat dark body sprite is on the floor where the enemy was.
- Walk toward the corpse position; player passes through without being pushed.
- Walk away and look back; corpse is still visible and correctly depth-sorted with walls.

**Manual — multiple kills**
- Kill 5+ enemies in the same room.
- All corpses remain simultaneously.
- Walk between them; no collision or jitter.
- Shoot a living enemy that is near a corpse; blood/tint on the new kill does not affect
  the existing corpse's appearance.

**Manual — wall occlusion**
- Stand so a wall is between the camera and a corpse.
- Corpse must not bleed through the wall (z-buffer test).
- Step sideways until corpse comes into view; it appears cleanly at the correct moment.

**Manual — level transition**
- Kill some enemies, then reach the exit door and start a new level.
- No corpses are present in the new level.

**Manual — performance baseline**
- Kill all enemies reachable in the first generated level (typically 5–8).
- Open browser dev-tools performance panel and confirm consistent frame rendering.

**Code review checks**
- `isDead` sprites are excluded from every collision resolution call site.
- `isDead` sprites are excluded from the AI update loop.
- `generateCorpseTexture` is called once per enemy at spawn, not every frame.
- The `corpseTexture` field on non-enemy sprites (items, decor) is `null` and the corpse
  render branch is guarded by `sprite.type === SpriteType.ENEMY` (or equivalent).
```