# SPEC: Fix Black Screen — Add missing shotguns/rocketLaunchers to Level interface

## 0. Existing Code Baseline

| File | Relevant State |
|---|---|
| `src/engine/level-gen.ts` | `Level` interface (lines 34-52) has NO `shotguns` or `rocketLaunchers` properties. `generateLevel()` return (lines 629-644) does NOT include them. |
| `src/engine/renderer.ts` | `initializeSprites()` at lines 534-550 iterates `level.shotguns` and `level.rocketLaunchers` — **these are undefined, causing runtime crash → black screen** |
| `src/engine/sprite.ts` | `SpriteType` enum already has `WEAPON_SHOTGUN` and `WEAPON_ROCKETLAUNCHER`. `isCollectableSprite()` already returns true for both. |
| `src/engine/sprite-textures.ts` | `generateSpriteTextures()` already generates textures for both weapon types. |
| `src/engine/level-gen.test.ts` | Root-level test file, checks determinism, validation, structural integrity. |
| `src/engine/__tests__/level-gen.test.ts` | `__tests__/` version of the same tests. |

## 1. Summary

Fix a runtime crash (black screen) caused by `renderer.ts` iterating over `level.shotguns` and `level.rocketLaunchers` which are not defined in the `Level` interface or produced by `generateLevel()`.

## 2. Scope

**In scope**:
- Add `shotguns: Vec2[]` and `rocketLaunchers: Vec2[]` to the `Level` interface
- Generate weapon pickup positions in `generateLevel()` with stage-based scaling
- Return these arrays in the generated Level object
- Update both test files with assertions for the new properties

**Out of scope**:
- Changes to `sprite.ts`, `sprite-textures.ts`, `renderer.ts`, `world.ts`
- Changes to weapon rendering, firing, or inventory logic

## 3. Technical Context

- **Language**: TypeScript 5.4
- **Framework**: Vite 5.4
- **Build**: `npm run build`
- **Test**: `npm test` (vitest, jsdom)
- **Pattern**: Use existing `randomFloorInRoom(room, rng, used)` helper, same as ammo/health/decor

## 4. Interfaces & Contracts

### 4.1 Level Interface additions (after `decor` line)

```typescript
/** Shotgun weapon pickups (appear from stage 2 onwards). */
shotguns: Vec2[];
/** Rocket Launcher weapon pickups (appear from stage 4 onwards). */
rocketLaunchers: Vec2[];
```

### 4.2 Stage scaling formulas

| Property | Count formula | Effect |
|---|---|---|
| `shotguns` | `stage >= 2 ? 1 + Math.floor((stage - 2) / 2) : 0` | s1→0, s2-3→1, s4-5→2, s6+→3 |
| `rocketLaunchers` | `stage >= 4 ? Math.floor((stage - 4) / 3) + 1 : 0` | s1-3→0, s4-6→1, s7+→2 |

## 5. Tasks

---
**Task 1 – Add shotguns and rocketLaunchers to Level interface**

**Goal**: Extend the `Level` interface with two new required properties.

**Input files**: `src/engine/level-gen.ts`

**Output files**: `src/engine/level-gen.ts`

**Instructions**:
1. Read the `Level` interface (lines 34-52).
2. After the `decor: DecorPlacement[];` line, append:
   ```typescript
   /** Shotgun weapon pickups (appear from stage 2 onwards). */
   shotguns: Vec2[];
   /** Rocket Launcher weapon pickups (appear from stage 4 onwards). */
   rocketLaunchers: Vec2[];
   ```
3. That is the only change in this task.

**Done when**: `npm run build` succeeds (or `npx tsc --noEmit` reports no errors).

---
**Task 2 – Generate weapon pickups in generateLevel()**

**Goal**: Populate `shotguns` and `rocketLaunchers` arrays in `generateLevel()` and include them in the return object.

**Input files**: `src/engine/level-gen.ts`

**Output files**: `src/engine/level-gen.ts`

**Instructions**:
1. Immediately BEFORE the `const facing = spawnFacing(...)` line (around line 627), add:
   ```typescript
   // --- Shotgun pickups (stage 2+) ---
   const numShotguns = stage >= 2 ? 1 + Math.floor((stage - 2) / 2) : 0;
   const shotguns: Vec2[] = [];
   for (let i = 0; i < numShotguns; i++) {
     const room = rooms[Math.floor(rng() * rooms.length)];
     const tile = randomFloorInRoom(room, rng, used);
     if (!tile) continue;
     shotguns.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
   }

   // --- Rocket Launcher pickups (stage 4+) ---
   const numRocketLaunchers = stage >= 4 ? Math.floor((stage - 4) / 3) + 1 : 0;
   const rocketLaunchers: Vec2[] = [];
   for (let i = 0; i < numRocketLaunchers; i++) {
     const room = rooms[Math.floor(rng() * rooms.length)];
     const tile = randomFloorInRoom(room, rng, used);
     if (!tile) continue;
     rocketLaunchers.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
   }
   ```
2. In the return object, after the `decor,` line, append:
   ```typescript
   shotguns,
   rocketLaunchers,
   ```

**Done when**: `npm run build` succeeds with no errors.

---
**Task 3 – Update root-level test file**

**Goal**: Extend `src/engine/level-gen.test.ts` with assertions for the new properties.

**Input files**: `src/engine/level-gen.test.ts`

**Output files**: `src/engine/level-gen.test.ts`

**Instructions**:
1. In the "same seed + stage produces identical" test, add after the `decor` assertion:
   ```typescript
   expect(levels[i].shotguns).toEqual(levels[0].shotguns);
   expect(levels[i].rocketLaunchers).toEqual(levels[0].rocketLaunchers);
   ```
2. In the "Level Generation - Structural Integrity" suite, add:
   ```typescript
   it('stage 1 has no shotgun or rocket launcher pickups', () => {
     const level = generateLevel(5000, 1);
     expect(level.shotguns.length).toBe(0);
     expect(level.rocketLaunchers.length).toBe(0);
   });

   it('stage 2+ has shotgun pickups, stage 4+ has rocket launcher pickups', () => {
     const l2 = generateLevel(5001, 2);
     const l4 = generateLevel(5002, 4);
     const l5 = generateLevel(5003, 5);
     expect(l2.shotguns.length).toBeGreaterThanOrEqual(1);
     expect(l2.rocketLaunchers.length).toBe(0);
     expect(l4.shotguns.length).toBeGreaterThanOrEqual(1);
     expect(l4.rocketLaunchers.length).toBeGreaterThanOrEqual(1);
     expect(l5.shotguns.length).toBeGreaterThanOrEqual(l4.shotguns.length);
     expect(l5.rocketLaunchers.length).toBeGreaterThanOrEqual(l4.rocketLaunchers.length);
   });
   ```

**Done when**: `npm test` passes all test cases.

---
**Task 4 – Update __tests__/level-gen.test.ts**

**Goal**: Apply the same test updates to `src/engine/__tests__/level-gen.test.ts`.

**Input files**: `src/engine/__tests__/level-gen.test.ts`

**Output files**: `src/engine/__tests__/level-gen.test.ts`

**Instructions**: Same as Task 3 but with seeds offset by 2 (5004, 5005, 5006, 5007 instead of 5000-5003).

**Done when**: `npm test` passes all test cases in both test files.

## 6. Integration Points

- `level-gen.ts` → `renderer.ts`: `initializeSprites()` already reads `level.shotguns` and `level.rocketLaunchers` — no renderer changes needed.
- `level-gen.ts` → `world.ts`: `loadLevel(level)` accepts the expanded interface.
- `level-gen.ts` → both test files: must verify new properties.

## 7. Acceptance Criteria

1. `npm run build` succeeds with no errors
2. `npm test` passes all existing and new test cases
3. `generateLevel(42, 1).shotguns` returns `[]`
4. `generateLevel(42, 1).rocketLaunchers` returns `[]`
5. `generateLevel(42, 2).shotguns.length` >= 1
6. `generateLevel(42, 4).rocketLaunchers.length` >= 1
7. Five calls with identical (seed, stage) produce identical `shotguns` and `rocketLaunchers` arrays
8. Game no longer crashes on startup with black screen

## 8. Test Requirements

- **Task 3**: Determinism check in existing "same seed" test + 2 new test cases in Structural Integrity suite
- **Task 4**: Same as Task 3 but in `__tests__/` file with offset seeds
- No mocking needed — pure functions with deterministic PRNG

## 9. Assumptions & Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Weapon pickups can spawn in ANY room (including spawn) | Matches existing pattern for ammo/health/decor |
| 2 | Properties are required (`Vec2[]` not `Vec2[] \| undefined`) | Renderer assumes they exist; empty array is safe |
| 3 | New pickups added to `used` Set | Prevents overlapping placements — consistent with all other logic |
