# Task 1: Extend Level Interface and Generator with entrance property

## Implementation Status: ✓ COMPLETE

### 1. Level Interface Extension
**File**: `src/engine/level-gen.ts` (lines 34-52)

✓ `Level` interface now includes:
```typescript
export interface Level {
  stage: number;
  seed: number;
  width: number;
  height: number;
  map: number[][];
  spawn: { x: number; y: number; dirX: number; dirY: number };
  /** Entrance position: 1 tile INSIDE room 0 from a randomly chosen wall edge. */
  entrance: Vec2;
  /** Center of the EXIT_DOOR wall tile — player checks distance to this. */
  exit: Vec2;
  keycard: Vec2;
  enemies: Vec2[];
  ammo: Vec2[];
  health: Vec2[];
  secretHealth: Vec2 | null;
  decor: DecorPlacement[];
}
```

### 2. Entrance Placement Logic
**File**: `src/engine/level-gen.ts` (lines 162-192)

✓ `pickEntrancePosition()` function implemented with:
- **Randomized wall selection**: Chooses one of 4 walls (top, bottom, left, right)
  - Case 0: Top wall → y = room.y + 1 (1 tile inside from top)
  - Case 1: Bottom wall → y = room.y + room.h - 2 (1 tile inside from bottom)
  - Case 2: Left wall → x = room.x + 1 (1 tile inside from left)
  - Case 3: Right wall → x = room.x + room.w - 2 (1 tile inside from right)

- **Random positioning along wall**: 
  - Top/Bottom: Random x within room width
  - Left/Right: Random y within room height

- **Returns Vec2**: Proper type matching Level.entrance requirement

### 3. Integration into Level Generation
**File**: `src/engine/level-gen.ts` (lines 410-412 and 511)

✓ In `generateLevel()` function:
- Line 410: Comment confirms entrance selection from room 0
- Line 411: Calls `pickEntrancePosition(spawnRoom, rng)` on spawn room (room 0)
- Line 412: Creates Vec2 from entrance tile
- Line 511: Includes `entrance: { x: entrance.x + 0.5, y: entrance.y + 0.5 }` in returned Level object

### 4. Verification Criteria

**✓ Criterion 1: Build Success**
- TypeScript compilation: PASS (npx tsc --noEmit)
- No type errors found

**✓ Criterion 2: entrance Property Definition**
- Type: `Vec2` (object with `x: number` and `y: number`)
- Present in Level interface
- Properly initialized in generateLevel() return statement

**✓ Criterion 3: Entrance at Room Edge**
- Entrance is positioned on a randomly chosen wall of room 0
- Position is always 1 tile INSIDE the room from wall edge
- Different from spawn location (spawn is room center, entrance is at edge)

**✓ Criterion 4: entrance !== exit**
- Entrance: Positioned at edge of room 0 (spawn room)
- Exit: Positioned on perimeter wall of exit room (farthest from spawn)
- Structurally guaranteed to be different positions

**✓ Criterion 5: Valid Room Coordinates**
- Entrance x-coordinate: In range [room.x, room.x + room.w)
- Entrance y-coordinate: In range [room.y, room.y + room.h)
- Exit coordinates: Valid floor tiles in exit room's vicinity

## Implementation Details

### Edge Case Handling
- Room edges must be ≥3 tiles wide/tall for valid entrance placement
- Function has default fallback (returns room.x, room.y) for invalid cases
- All 4 wall cases covered with proper boundary calculations

### Randomization
- Uses existing mulberry32 PRNG via `rng()` function
- Random wall choice: 4-way distribution
- Random position along wall: distributed across wall length/height

### Coordinate System
- Tile coordinates: Integer x, y
- Final coordinates: Tile + 0.5 offset for center positioning
- Consistent with other entity placement (spawn, keycard, enemies, etc.)

## Files Modified
- `src/engine/level-gen.ts` - Main implementation file

## No Additional Files Required
- No new interfaces created
- No new utility functions needed
- Uses existing helper functions and PRNG
