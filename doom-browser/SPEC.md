# SPEC: Redesigned Procedural Level Generation — Double Keycard, Multi-Entrance/Exit, Scaled Maps

## 0. Existing Code Baseline

| File | Relevant Content |
|---|---|
| `src/engine/level-gen.ts` (674 lines) | `generateLevel(seed, stage)` → returns `Level` interface. Places rooms (5-9) on 16-24×16-24 grid. Single spawn (room 0), single exit (farthest room), single blue keycard, single BLUE_KEY_DOOR chokepoint. BFS reachability validation. `mulberry32` PRNG. Helper functions: `roomCenter`, `roomsOverlap`, `carveRoom`, `carveCorridor`, `pickExitDoor`, `placeBlueDoor`, `bfsReachable`, `pickCornerTile`, `placeCoverDecor`, `placeSecretRoom`, `randomFloorInRoom`, `spawnFacing`, `weightedRandomByDistance`, `shuffle`. |
| `src/engine/world.ts` (195 lines) | `TILE` enum: FLOOR=0, WALL_STONE=1, WALL_METAL=2, EXIT_DOOR=3, BLUE_KEY_DOOR=4, SECRET_WALL=5. `WorldState` class with `Door` interfaces for BLUE_KEY_DOOR and SECRET_WALL. `scanDoors()` scans tiles 4 and 5. `interactAt(x, y, hasKeycard)` checks `hasKeycard` for BLUE_KEY_DOOR. `isDoorTile()` matches tiles 4/5. `getTile()` considers door animation state. |
| `src/engine/renderer.ts` (2390 lines) | `Renderer` class: `hasKeycard: boolean`, `keycardPickupMessage` timer. `initializeSprites()` reads `level.keycard` for `SpriteType.KEYCARD` sprite. `checkItemPickup()` handles KEYCARD pickup → sets `hasKeycard = true`. `checkDoorInteraction()` calls `worldState.interactAt(x, y, this.hasKeycard)`. `showDoorMessage()` renders "LOCKED: KEYCARD REQUIRED" for DOOR_LOCKED. `drawHUD()` renders keycard indicator, exit proximity check against `this.currentLevel.exit`, exit E-press requires `hasKeycard`. `installLevel()` resets `hasKeycard = false`. |
| `src/engine/sprite.ts` (115 lines) | `SpriteType` enum: ENEMY, AMMO, HEALTH, KEYCARD, BARREL, TERMINAL, LAMP, DEBRIS, WEAPON_SHOTGUN, WEAPON_ROCKETLAUNCHER. `isCollectableSprite()` returns true for AMMO, HEALTH, KEYCARD, weapons. |
| `src/engine/textures.ts` (699 lines) | `TextureManager` generates wall textures for types 1-5. `initialize()` sets types 1-5. `generateBlueKeyDoorTexture()` for type 4. No texture for type 6 yet. |
| `src/engine/sprite-textures.ts` (1649 lines) | `generateSpriteTextures()` produces flat Map of textures by SpriteType. `generateKeycardFront/Back()` for KEYCARD sprite. `buildRotatingItemFrames()` for rotating item sprites. |
| `src/engine/__tests__/level-gen.test.ts` (354 lines) | Tests determinism, tile validity (0-5), spawn/exit/keycard on FLOOR, scaling, blue door presence, room count (≥5), enemy scaling, shotgun/rocket staging. References `level.rooms?.length`. |
| `src/engine/collision.ts` (284 lines) | `isWall()`, `positionCollides()`, sliding functions. Uses `worldState.isSolidTile()`. Unchanged by this feature. |
| `src/game/state.ts` (233 lines) | `GameState` enum, `GameStateManager`. Unchanged by this feature. |
| `src/audio/sound.ts` (575 lines) | `SoundManager`. Unchanged by this feature. |
| `src/main.ts` (38 lines) | Entry point: generates level, loads into WorldState, spawns player, creates Renderer. Unchanged by this feature. |

## 1. Feature Summary

Replace the current small-scope level generator (5-9 rooms on 16-24×16-24 grid, single entrance/exit, single keycard) with a significantly more complex procedural level design. The new system generates large maps (32-50×32-50) with 12-30+ rooms, 2-3 interconnected entrance rooms, 2-3 exit rooms, and a double-keycard progression chain (Yellow Keycard → Yellow Key Door → Blue Keycard → Blue Key Door → Exits). Both doors are verified as true chokepoints via BFS reachability. Cross-corridors add shortcuts between non-adjacent rooms. All quantities (enemies, ammo, health, decor, weapons, secrets) scale proportionally with stage difficulty.

## 2. Scope

**In scope**:
- New `TILE.YELLOW_KEY_DOOR` (type 6) in `world.ts`
- Door system (`WorldState`) supports YELLOW_KEY_DOOR with matching keycard check
- New `SpriteType.YELLOW_KEYCARD` in `sprite.ts`
- Procedural yellow keycard sprite texture in `sprite-textures.ts`
- Yellow key door wall texture in `textures.ts`
- `TextureManager.initialize()` registers yellow key door texture
- Complete `level-gen.ts` generator rewrite: larger maps, multi-entrance/exit, dual keycards, cross-corridors, scaled quantities
- `Level` interface expanded: `yellowKeycard`, `exits`, `spawnRooms`, `exitRooms`, `rooms`
- `Renderer` class: `hasYellowKeycard` + `hasBlueKeycard` state, dual pickup handling, multi-exit proximity, HUD updates (keycard icons, dual pickup messages, dual lock messages), dual-keycard exit requirement
- `interactAt()` signature updated for dual keycards
- `InteractionResult` enum extended with `YELLOW_DOOR_LOCKED`
- Existing test file `level-gen.test.ts` updated for new interfaces and ranges

**Out of scope**:
- Changes to collision system, enemy AI, weapon system, audio, minimap, pointer lock, game state machine, raycasting core
- Changes to `player.ts`, `input.ts`, `state.ts`, `sound.ts`, `weapons.ts`, `minimap.ts`, `zbuffer.ts`, `main.ts`
- Adding new enemy types, new weapons, or new sprite categories beyond YELLOW_KEYCARD
- Changes to rendering pipeline (castRays, renderSprites, drawWeapon, etc.)
- New sound effects (existing PICKUP/DOOR sounds reused)
- Level editor or seed display in-game

## 3. Technical Context

- **Language & runtime**: TypeScript 5.4 strict, ES2020 target, browser DOM
- **Framework**: Vite 5.4, Vitest 4.1.5 (jsdom)
- **Build command**: `npm run build`
- **Test command**: `npm test` (vitest run)
- **Affected files**: `src/engine/level-gen.ts`, `src/engine/world.ts`, `src/engine/sprite.ts`, `src/engine/textures.ts`, `src/engine/sprite-textures.ts`, `src/engine/renderer.ts`
- **Affected test file**: `src/engine/__tests__/level-gen.test.ts`
- **Architectural constraints**: No external dependencies. All assets procedurally generated via Canvas. Tile-based grid. ESM live bindings for WORLD_MAP.
- **Dependencies**: None added.

## 4. Interfaces & Contracts

### 4.1 Tile enum (world.ts)

```typescript
export const TILE = {
  FLOOR: 0,
  WALL_STONE: 1,
  WALL_METAL: 2,
  EXIT_DOOR: 3,
  BLUE_KEY_DOOR: 4,
  SECRET_WALL: 5,
  YELLOW_KEY_DOOR: 6,
} as const;
```

### 4.2 Door interface extension (world.ts)

The `Door.type` union expands to include YELLOW_KEY_DOOR:

```typescript
export interface Door {
  type: typeof TILE.BLUE_KEY_DOOR | typeof TILE.SECRET_WALL | typeof TILE.YELLOW_KEY_DOOR;
  state: DoorState;
  progress: number;
  openSpeed: number;
}
```

### 4.3 InteractionResult (world.ts)

New enum value for yellow door lock:

```typescript
export enum InteractionResult {
  NONE = 0,
  DOOR_OPENING = 1,
  DOOR_LOCKED = 2,         // Blue key door locked
  SECRET_FOUND = 3,
  YELLOW_DOOR_LOCKED = 4,  // Yellow key door locked
}
```

### 4.4 WorldState.interactAt (world.ts)

Signature and behavior change:

```typescript
interactAt(x: number, y: number, hasYellowKeycard: boolean, hasBlueKeycard: boolean): InteractionResult;
```

Behavior:
- TILE.SECRET_WALL → opens without any keycard (unchanged)
- TILE.BLUE_KEY_DOOR + hasBlueKeycard === false → return DOOR_LOCKED
- TILE.BLUE_KEY_DOOR + hasBlueKeycard === true → open door
- TILE.YELLOW_KEY_DOOR + hasYellowKeycard === false → return YELLOW_DOOR_LOCKED
- TILE.YELLOW_KEY_DOOR + hasYellowKeycard === true → open door

### 4.5 SpriteType (sprite.ts)

New enum member:

```typescript
export enum SpriteType {
  ENEMY = 'enemy',
  AMMO = 'ammo',
  HEALTH = 'health',
  KEYCARD = 'keycard',               // Blue keycard (unchanged)
  YELLOW_KEYCARD = 'yellow_keycard', // NEW
  BARREL = 'barrel',
  TERMINAL = 'terminal',
  LAMP = 'lamp',
  DEBRIS = 'debris',
  WEAPON_SHOTGUN = 'weapon_shotgun',
  WEAPON_ROCKETLAUNCHER = 'weapon_rocketlauncher'
}
```

`isCollectableSprite()` must return true for `SpriteType.YELLOW_KEYCARD`.

### 4.6 Level interface (level-gen.ts)

Complete new interface definition:

```typescript
export interface Level {
  stage: number;
  seed: number;
  width: number;
  height: number;
  map: number[][];
  spawn: { x: number; y: number; dirX: number; dirY: number };
  entrance: Vec2;
  /** Room indices forming the entrance cluster (2-3 rooms near each other). */
  spawnRooms: number[];
  /** Exit door positions — one per exit room. */
  exits: Vec2[];
  /** Room indices of the exit rooms (2-3 rooms in farthest corners). */
  exitRooms: number[];
  /** Kept for backwards compatibility: points to exits[0]. */
  exit: Vec2;
  /** New: Yellow keycard position (reachable from spawn without any keycard). */
  yellowKeycard: Vec2;
  /** Blue keycard position (reachable only after opening yellow key door). */
  blueKeycard: Vec2;
  /** Kept for backwards compatibility: points to blueKeycard. */
  keycard: Vec2;
  enemies: Vec2[];
  ammo: Vec2[];
  health: Vec2[];
  secretHealth: Vec2 | null;
  decor: DecorPlacement[];
  shotguns: Vec2[];
  rocketLaunchers: Vec2[];
  /** Exposed Room data for validation/debugging. Array of {x, y, w, h}. */
  rooms: Array<{ x: number; y: number; w: number; h: number }>;
}
```

### 4.7 Room interface (level-gen.ts, internal)

```typescript
interface Room { x: number; y: number; w: number; h: number; }
```
No change from existing, but `Room[]` is now exposed in the Level output.

### 4.8 Renderer state (renderer.ts)

```typescript
// Replace single hasKeycard with two booleans
private hasYellowKeycard: boolean = false;
private hasBlueKeycard: boolean = false;

// Two pickup message timers
private yellowKeycardPickupMessage: number = 0;
private blueKeycardPickupMessage: number = 0;
private readonly keycardMessageDuration: number = 2.0;
```

### 4.9 Renderer.checkDoorInteraction (renderer.ts)

Must call `worldState.interactAt(mapX, mapY, this.hasYellowKeycard, this.hasBlueKeycard)`.

### 4.10 Renderer.showDoorMessage (renderer.ts)

Extended to handle `YELLOW_DOOR_LOCKED`:

```typescript
// For DOOR_LOCKED → "LOCKED: KEYCARD REQUIRED" (unchanged)
// For YELLOW_DOOR_LOCKED → "LOCKED: YELLOW KEYCARD REQUIRED" (new)
```

## 5. Tasks

---
**Task 1 – Add YELLOW_KEY_DOOR tile, door system support, InteractionResult extension**

**Goal**: Extend `world.ts` with YELLOW_KEY_DOOR tile type, update door scanning/interaction for the new tile, and add YELLOW_DOOR_LOCKED to InteractionResult.

**Input files**: `src/engine/world.ts`

**Output files**: `src/engine/world.ts` (modified)

**Instructions**:
1. Add `YELLOW_KEY_DOOR: 6` to the `TILE` object (after `SECRET_WALL: 5`).
2. Add `YELLOW_DOOR_LOCKED = 4` to the `InteractionResult` enum (after `SECRET_FOUND = 3`).
3. Expand the `Door.type` union to include `typeof TILE.YELLOW_KEY_DOOR`.
4. In `scanDoors()`, add a third condition: `base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL || base === TILE.YELLOW_KEY_DOOR`.
5. In `getTile()`, update the early return: if `base` is not one of BLUE_KEY_DOOR, SECRET_WALL, or YELLOW_KEY_DOOR, return `base`.
6. In `isDoorTile()`, add `|| base === TILE.YELLOW_KEY_DOOR`.
7. Replace the single-parameter `interactAt(x: number, y: number, hasKeycard: boolean)` with:
   ```typescript
   interactAt(x: number, y: number, hasYellowKeycard: boolean, hasBlueKeycard: boolean): InteractionResult {
     const base = WORLD_MAP[y]?.[x];
     if (base !== TILE.BLUE_KEY_DOOR && base !== TILE.SECRET_WALL && base !== TILE.YELLOW_KEY_DOOR) return InteractionResult.NONE;
     const door = this.doors.get(`${x},${y}`);
     if (!door) return InteractionResult.NONE;
     if (door.state !== 'closed') return InteractionResult.NONE;
     if (door.type === TILE.BLUE_KEY_DOOR && !hasBlueKeycard) return InteractionResult.DOOR_LOCKED;
     if (door.type === TILE.YELLOW_KEY_DOOR && !hasYellowKeycard) return InteractionResult.YELLOW_DOOR_LOCKED;
     door.state = 'opening';
     door.progress = 0;
     if (door.type === TILE.SECRET_WALL) return InteractionResult.SECRET_FOUND;
     return InteractionResult.DOOR_OPENING;
   }
   ```
8. Update the JSDoc comment on the `TILE` object to document type 6 as "Yellow Key Door (requires Yellow Keycard, animated)".

**Done when**: `npm run build` succeeds; TILE includes YELLOW_KEY_DOOR=6; InteractionResult includes YELLOW_DOOR_LOCKED=4; interactAt takes two boolean params and returns the correct result for each door type.

---
**Task 2 – Add YELLOW_KEYCARD sprite type and textures**

**Goal**: Add the yellow keycard sprite type, its rotating textures, and the yellow key door wall texture.

**Input files**: `src/engine/sprite.ts`, `src/engine/sprite-textures.ts`, `src/engine/textures.ts`

**Output files**: `src/engine/sprite.ts` (modified), `src/engine/sprite-textures.ts` (modified), `src/engine/textures.ts` (modified)

**Instructions**:

**In `sprite.ts`**:
1. Add `YELLOW_KEYCARD = 'yellow_keycard'` to the `SpriteType` enum (between `KEYCARD` and `BARREL`).
2. In `isCollectableSprite()`, add `|| type === SpriteType.YELLOW_KEYCARD` to the return expression.

**In `sprite-textures.ts`**:
1. In `generateSpriteTextures()`, add a new entry for `SpriteType.YELLOW_KEYCARD`:
   ```typescript
   flat.set(SpriteType.YELLOW_KEYCARD, buildRotatingItemFrames(generateYellowKeycardFront, generateYellowKeycardBack));
   ```
2. Implement `generateYellowKeycardFront()` — mirror the structure of `generateKeycardFront()` but use yellow/orange colors:
   - Card gradient: `#9c7a1a` → `#cc9a20` → `#9c7a1a` (gold/yellow tones)
   - Stroke: `#ffd700` (gold)
   - Chip: `#d4a017` / `#f0c040` (keep same gold chip)
   - Barcode lines: `#ffd700` (gold)
   - Glow: `rgba(255, 215, 0, 0.35)` with `shadowColor = '#ffd700'`
3. Implement `generateYellowKeycardBack()` — mirror `generateKeycardBack()` with darker gold:
   - Card gradient: `#665510` → `#806a15` → `#665510`
   - Stroke: `#d8b83a`
   - Magnetic stripe: `#2a1a0a` (dark brown-black)
   - Glow: `rgba(255, 215, 0, 0.10)`

**In `textures.ts`**:
1. In `initialize()`, add `this.textures.set(6, this.generateYellowKeyDoorTexture());`.
2. Implement `generateYellowKeyDoorTexture()` — mirror `generateBlueKeyDoorTexture()` but use yellow/gold:
   - Background: `#3a3a2a` (warm dark gray)
   - Frame: `#5a5a4a`
   - Inner frame: `#3a3a2a`
   - Glow radius: radial gradient with `rgba(255, 200, 50, 0.5)` → `rgba(255, 200, 50, 0.2)` → `rgba(255, 200, 50, 0)`
   - Keycard slot: `#111` background, `#ff0` (yellow) inner slot
   - "KEY" text: `#ffd700` (gold) with `shadowColor = '#ff0'`
   - Same noise pass at the end
3. Update the JSDoc comment on `initialize()` to mention type 6 = Yellow Key Door.

**Done when**: `npm run build` succeeds; SpriteType.YELLOW_KEYCARD exists and is collectable; `generateSpriteTextures()` includes YELLOW_KEYCARD textures; `TextureManager` registers tile type 6; yellow keycard textures are gold/yellow (distinct from blue keycard).

---
**Task 3 – Redesign level-gen.ts generator**

**Goal**: Rewrite `generateLevel()` to produce large maps with multi-entrance, multi-exit, dual keycard progression, cross-corridors, and scaled quantities.

**Input files**: `src/engine/level-gen.ts`, `src/engine/world.ts` (for TILE.YELLOW_KEY_DOOR), `src/engine/sprite.ts` (for SpriteType.YELLOW_KEYCARD)

**Output files**: `src/engine/level-gen.ts` (modified)

**Instructions**:

**Step 3a — Replace the `Level` interface** (lines 34-56):
Replace the entire interface with the new definition from §4.6. Keep `Vec2`, `DecorPlacement`, and `DecorType` as-is.

**Step 3b — Update map sizing** (lines 494-498):
Replace the old formula with:
```typescript
const W = clamp(32 + Math.floor(stage / 2) * 2, 32, 50);
const H = W;
const targetRooms = clamp(12 + Math.floor(stage * 1.5), 12, 30);
```

**Step 3c — Multi-entrance room selection**:
After rooms are generated and carved (before corridor carving), designate spawn rooms:
- Pick the room closest to top-left corner (1,1) as first spawn room
- Swap it to index 0, greedily pick next `numSpawnRooms-1` rooms by smallest center-to-room[0] Manhattan distance
- `numSpawnRooms = stage >= 5 ? 3 : 2`
- `spawnRoomIndices = Array.from({length: numSpawnRooms}, (_, i) => i)`

**Step 3d — Multi-exit room selection**:
After sequential corridors, pick 2-3 rooms farthest from the spawn cluster as exit rooms:
```typescript
const numExitRooms = stage >= 5 ? 3 : 2;
```
Move chosen exit rooms to the END of the rooms array via swaps. Define `exitRoomIndices` as the last `numExitRooms` indices.

**Step 3e — Cross-corridors**:
After sequential L-corridors, add 1-3 cross-corridors between non-adjacent, non-spawn-and-exit-adjacent rooms. Only connect rooms with Manhattan distance > 3 between centers. Carve one L-corridor per cross pair.
```typescript
const numCrossCorridors = clamp(1 + Math.floor(stage / 3), 1, 3);
```
Only in the middle zone (between spawn rooms and exit rooms).

**Step 3f — Exit doors**:
For each exit room, call `pickExitDoor(map, exitRoom, rng)` and set the wall tile to `TILE.EXIT_DOOR`. Collect all exit wall positions into `exits: Vec2[]`. The `exit` field (backwards compat) = `exits[0]`.

**Step 3g — Yellow Key Door placement**:
Create a new function `placeYellowDoor(map, spawnPos, blueKeyCandidateRoom, rooms, rng): Vec2 | null`. Analogous to `placeBlueDoor` but:
- The chokepoint is between the spawn area and the `blueKeyCandidateRoom` (a room selected from the middle zone)
- Use `TILE.YELLOW_KEY_DOOR` instead of BLUE_KEY_DOOR
- BFS without YELLOW_KEY_DOOR → should NOT reach blueKeyCandidateRoom
- BFS with YELLOW_KEY_DOOR passable → should reach blueKeyCandidateRoom

**Step 3h — Blue Key Door placement**:
Update `placeBlueDoor`: the chokepoint is now between the blue keycard room (post-yellow-door zone) and the exit rooms. BFS from spawn WITH both yellow and blue key doors passable should reach exits; with ONLY yellow door passable should NOT reach exits. Accept array of exit access points.

**Step 3i — Keycard placement**:
- Yellow keycard: pick a non-spawn, non-exit room reachable from spawn WITHOUT any key door. Use `bfsReachable(map, spawn, new Set())`. Distance-weighted random selection (near spawn). Place on a corner tile.
- Blue keycard: pick a non-spawn, non-exit room reachable from spawn with ONLY YELLOW_KEY_DOOR passable (not BLUE_KEY_DOOR). Verify with BFS.

**Step 3j — Scaled quantities**:
- Enemies: `clamp(12 + Math.floor(stage * 2), 12, 25)`
- Ammo: `clamp(6 + Math.floor(stage * 1.0), 6, 12)`
- Health: `clamp(4 + Math.floor(stage * 0.8), 4, 8)`
- Decor: `clamp(10 + Math.floor(stage * 2), 10, 20)`
- Secrets: increase probability to 0.8 for stage 2+, attempt 2-4 secret rooms
- Shotguns: `stage >= 2 ? 2 + Math.floor((stage - 2) / 2) : 0`
- Rocket launchers: `stage >= 4 ? 1 + Math.floor((stage - 4) / 2) : 0`
- When placing enemies: exclude BOTH spawn rooms AND exit rooms (not just room 0)

**Step 3k — Return value**:
Include all new fields: `spawnRooms`, `exitRooms`, `exits`, `exit` (= exits[0]), `yellowKeycard`, `blueKeycard`, `keycard` (= blueKeycard), `rooms`.

**Step 3l — Validation in retry loop**:
1. Both doors are true chokepoints
2. Yellow keycard is reachable from spawn without any key door
3. Blue keycard is reachable only after yellow door
4. All exit rooms have valid exit doors
5. At least `minRooms` (set to 8) rooms placed

**Step 3m — Update helper functions as needed**:
- `placeBlueDoor` now targets exit access cells (array) and accounts for yellow door
- Add new `placeYellowDoor` function following the same pattern
- Update `bfsReachable` usage throughout

**Done when**: `npm run build` succeeds; `generateLevel(42, 1)` returns a valid Level with: `spawnRooms.length >= 2`, `exitRooms.length >= 2`, `exits.length >= 2`, width >= 32, at least 12 rooms, both door types present in map, yellow keycard on FLOOR, blue keycard on FLOOR, yellow keycard reachable without keys, blue keycard reachable after yellow door, exits reachable after both doors, enemies 12+, all positions on FLOOR tiles.

---
**Task 4 – Update renderer for dual keycards, multi-exit, HUD**

**Goal**: Replace single-keycard renderer logic with dual-keycard system, multi-exit proximity, and updated HUD.

**Input files**: `src/engine/renderer.ts`, `src/engine/world.ts`, `src/engine/sprite.ts`, `src/engine/level-gen.ts` (new Level interface)

**Output files**: `src/engine/renderer.ts` (modified)

**Instructions**:

**Step 4a — Keycard state fields** (around line 52-53):
Replace `private hasKeycard: boolean = false;` with `hasYellowKeycard` + `hasBlueKeycard`.
Replace `private keycardPickupMessage: number = 0;` with two timers: `yellowKeycardPickupMessage` and `blueKeycardPickupMessage`.

**Step 4b — initializeSprites()** (around line 467-550):
Add a YELLOW_KEYCARD sprite block after the existing KEYCARD sprite creation. Also rename the existing KEYCARD to reference `level.blueKeycard` instead of `level.keycard` for clarity (both work due to backwards compat).

**Step 4c — checkItemPickup()** (around line 421-452):
Replace the KEYCARD case with both KEYCARD → `hasBlueKeycard` and YELLOW_KEYCARD → `hasYellowKeycard`.

**Step 4d — checkDoorInteraction()** (around line 1008):
Replace `worldState.interactAt(mapX, mapY, this.hasKeycard)` with `worldState.interactAt(mapX, mapY, this.hasYellowKeycard, this.hasBlueKeycard)`.

**Step 4e — showDoorMessage()** (around line 1021-1040):
Add a case for `YELLOW_DOOR_LOCKED`: `"LOCKED: YELLOW KEYCARD REQUIRED"`.

**Step 4f — installLevel()** (around line 573-592):
Reset both `hasYellowKeycard = false`, `hasBlueKeycard = false`, and both pickup message timers to 0.

**Step 4g — drawHUD() keycard indicator** (around line 1817-1823):
Replace single keycard indicator with two: Y-CARD (yellow, top-left) and B-CARD (blue, below yellow).

**Step 4h — Keycard pickup messages**:
Replace single keycard pickup message with two: "YELLOW KEYCARD GEFUNDEN!" (gold) and "KEYCARD GEFUNDEN!" (blue, existing).

**Step 4i — Exit proximity check** (around line 1841-1859):
Check against ALL exit positions in `this.currentLevel.exits`. Requires BOTH keycards to show green "EXIT" message. Show missing keycard message in red if either is missing.

**Step 4j — Exit E-press check** (around line 2254-2263):
Replace single keycard check with `hasYellowKeycard && hasBlueKeycard`. Check against all exits in `this.currentLevel.exits`.

**Step 4k — Item pickup HUD hint** (around line 1784-1803):
Add YELLOW_KEYCARD proximity hint: `"[E] YELLOW KEYCARD einsammeln"`.

**Step 4l — Timer decrements** (~line 2310-2329):
Replace single `keycardPickupMessage` decrement with two separate decrements.

**Step 4m — resetGame()** (around line 1968-2002):
Reset both keycard states and both pickup message timers.

**Done when**: `npm run build` succeeds; renderer compiles; no references to `hasKeycard` remain; dual keycard pickup works; HUD shows both keycard indicators; exit requires BOTH keycards; door interaction passes both keycard booleans; YELLOW_DOOR_LOCKED shows correct message.

---
**Task 5 – Update tests**

**Goal**: Update `src/engine/__tests__/level-gen.test.ts` for new interfaces, tile range, map sizes, and dual keycard system.

**Input files**: `src/engine/__tests__/level-gen.test.ts`, `src/engine/level-gen.ts` (modified by Task 3), `src/engine/world.ts` (modified by Task 1)

**Output files**: `src/engine/__tests__/level-gen.test.ts` (modified)

**Instructions**:

1. **Tile range test**: Change `expect(tile).toBeLessThanOrEqual(5)` to `expect(tile).toBeLessThanOrEqual(6)`.
2. **Keycard tests**: Split into two tests — `blueKeycard` and `yellowKeycard` both on FLOOR tiles.
3. **Exit door test**: Update to check `level.exits.length >= 2` and each exit on EXIT_DOOR tile.
4. **Map size test**: `width >= 32`, `width <= 50`, same for height.
5. **Room count test**: Minimum 12.
6. **Determinism test**: Add assertions for spawnRooms, exitRooms, exits, yellowKeycard, blueKeycard, rooms.
7. **Yellow key door test** (new): Check YELLOW_KEY_DOOR exists in map.
8. **Exit door count test** (new): `level.exits.length >= 2`.
9. **Spawn/exit room tests** (new): `spawnRooms.length >= 2` and `exitRooms.length >= 2`.
10. **Enemy count test**: Update range (stage 1 >= 12, stage 3 >= 16).
11. **Floor tile count test**: Update minimum.
12. **Keycard reachability test**: Yellow reachable without keys, blue reachable only with yellow door, exits reachable only with both.
13. **Stage differentiation tests**: Update for new scale.
14. Remove/update tests referencing old single-room/single-exit/single-keycard model.

**Done when**: `npm test` passes with zero failures; all determinism, validation, and scale tests pass against the new Level interface.

## 6. Integration Points

| Component | Integration detail |
|---|---|
| **TextureManager (textures.ts)** | `initialize()` must register texture for tile type 6 (YELLOW_KEY_DOOR). Called once at Renderer construction. |
| **generateSpriteTextures (sprite-textures.ts)** | Flat map must include `SpriteType.YELLOW_KEYCARD` → arrays of 8-frame rotating textures. Called by `initializeSprites()` in renderer. |
| **Renderer constructor (renderer.ts)** | `initializeSprites()` reads `level.yellowKeycard` and `level.blueKeycard` from the new Level interface. |
| **Renderer game loop (renderer.ts)** | `checkItemPickup()` handles both KEYCARD → `hasBlueKeycard` and YELLOW_KEYCARD → `hasYellowKeycard`. `checkDoorInteraction()` passes dual keycard booleans to `interactAt()`. |
| **Renderer HUD (renderer.ts)** | Keycard indicators, pickup messages, exit proximity, and exit E-press all updated for dual keycard. |
| **Renderer installLevel() (renderer.ts)** | Resets both keycard states on stage transition. |
| **Renderer resetGame() (renderer.ts)** | Resets both keycard states on game restart. |
| **WorldState (world.ts)** | `scanDoors()` scans tile type 6; `interactAt()` checks correct keycard for each door type; `getTile()`, `isDoorTile()` include type 6. |
| **Test suite** | `level-gen.test.ts` must be updated for new Level fields and new tile range (0-6). |

## 7. Acceptance Criteria

1. `TILE.YELLOW_KEY_DOOR === 6` exists in world.ts
2. `InteractionResult.YELLOW_DOOR_LOCKED === 4` exists in world.ts
3. `SpriteType.YELLOW_KEYCARD` exists and `isCollectableSprite` returns true for it
4. `generateLevel(seed, 1)` returns a Level with: `width >= 32`, `spawnRooms.length >= 2`, `exitRooms.length >= 2`, `exits.length >= 2`, at least 12 rooms, both YELLOW_KEY_DOOR and BLUE_KEY_DOOR tiles present in the map
5. Yellow keycard is reachable from spawn without any key door open (verified by BFS)
6. Blue keycard is NOT reachable from spawn without the yellow key door open, but IS reachable when yellow door is passable
7. Exit rooms are NOT reachable without the blue key door open, but ARE reachable when both doors are passable
8. Renderer `hasYellowKeycard` and `hasBlueKeycard` fields exist; no references to `hasKeycard` remain
9. Picking up a YELLOW_KEYCARD sprite sets `hasYellowKeycard = true` and displays "YELLOW KEYCARD GEFUNDEN!"
10. Picking up a KEYCARD sprite sets `hasBlueKeycard = true` and displays "KEYCARD GEFUNDEN!"
11. Interacting with a YELLOW_KEY_DOOR without the yellow keycard shows "LOCKED: YELLOW KEYCARD REQUIRED"
12. Interacting with a BLUE_KEY_DOOR without the blue keycard shows "LOCKED: KEYCARD REQUIRED"
13. Exit proximity check requires BOTH keycards; shows appropriate missing keycard message if either is missing
14. Exit E-press requires BOTH keycards to trigger stage transition
15. `exit` backwards-compat field equals `exits[0]`; `keycard` backwards-compat field equals `blueKeycard`
16. `npm run build` passes with zero type errors
17. `npm test` passes with all tests green

## 8. Test Requirements

**Test file**: `src/engine/__tests__/level-gen.test.ts`

| Test category | Tests |
|---|---|
| Determinism | Same seed+stage → identical spawnRooms, exitRooms, exits, yellowKeycard, blueKeycard, rooms |
| Tile validity | All tiles 0-6 (was 0-5) |
| Spawn validity | Spawn on FLOOR in first spawn room area |
| Keycard validity | yellowKeycard on FLOOR; blueKeycard on FLOOR |
| Exit validity | exits.length >= 2; each exit position on EXIT_DOOR tile |
| Enemy/all positions | All enemies, ammo, health, decor on FLOOR tiles |
| Door presence | Both YELLOW_KEY_DOOR and BLUE_KEY_DOOR exist in map |
| Scale | width >= 32; room count >= 12; enemy count >= 12 at stage 1 |
| Multi-stage differentiation | Higher stages produce larger maps, more rooms, more enemies |
| Keycard reachability | Yellow reachable without keys; blue reachable only with yellow; exits reachable only with both |

**No new test files** needed — all changes fit in the existing `level-gen.test.ts`.

## 9. Assumptions & Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | YELLOW_KEY_DOOR = 6 follows SECRET_WALL = 5 | Keeps tile IDs sequential; avoids gaps. |
| 2 | `keycard` field alias → `blueKeycard` (not yellow) | Existing flow was "find keycard → open blue door". Blue keycard fills the same role. |
| 3 | `exit` field alias → `exits[0]` | Renderer iterates all exits, but `exit` is kept for backwards compat. |
| 4 | Spawn rooms selected from top-left corner area | Predictable player orientation, coherent entrance cluster. |
| 5 | Exit rooms selected from rooms farthest from spawn cluster | Player must traverse the full dungeon. |
| 6 | Cross-corridors only in middle zone | Prevents trivial shortcuts that bypass both key doors. |
| 7 | `interactAt` takes two separate boolean params | Minimizes diff size; caller passes directly. |
| 8 | YELLOW_DOOR_LOCKED as separate InteractionResult value | Allows showDoorMessage to distinguish "need yellow" vs "need blue". |
| 9 | Exit requires BOTH keycards | Matches feature description. |
| 10 | Room sizes remain 3-6 tiles (unchanged) | Per feature description. |
| 11 | Map is always square (W == H) | Simplifies generator; consistent with existing design. |
| 12 | KEYCARD = blue, YELLOW_KEYCARD = yellow | Both collectable, renderer distinguishes by SpriteType. |
| 13 | Door animation for YELLOW_KEY_DOOR uses same openSpeed (1.2) | Keeps all animated doors visually consistent. |
