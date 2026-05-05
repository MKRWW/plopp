Now I'll write the detailed implementation specification based on my analysis of the codebase.

---

## Automated Test Infrastructure Implementation Spec

## Problem

The codebase lacks automated test coverage, making it difficult to verify critical game systems and detect regressions. Recent features—lazy level generation with loading screens and dead NPC corpse persistence—require test validation to ensure determinism, proper state transitions, and collision behavior. Without automated tests, manual verification is the only quality gate.

## Files to touch

### Configuration & Framework
- `package.json` — add Vitest dependencies and npm scripts
- `vite.config.ts` — add Vitest config

### Test Directories (new)
- `src/engine/__tests__/level-gen.test.ts` — level generation tests
- `src/engine/__tests__/sprite.test.ts` — sprite lifecycle and corpse persistence
- `src/game/__tests__/state.test.ts` — state machine transitions
- `src/__tests__/utils/mocks.ts` — mock objects (player, renderer, sound manager)
- `src/__tests__/utils/fixtures.ts` — test helpers and fixtures
- `src/__tests__/utils/test-levels.ts` — factory for creating test levels

### Configuration Files
- `vitest.config.ts` — Vitest setup and configuration
- `.nycrc.json` — coverage reporting config (optional, for c8)

## Approach

### 1. Framework Setup
- Install Vitest (`npm install -D vitest @vitest/ui`) compatible with existing Vite config
- Update `package.json` with `test`, `test:watch`, and `test:coverage` scripts
- Create `vitest.config.ts` extending the existing Vite config
- Configure coverage reporting with c8 to target 80% for new/critical modules

### 2. Test Utilities
Create reusable test infrastructure in `src/__tests__/utils/`:
- **mocks.ts**: Implement mock classes for GameStateManager, Renderer, Weapon, and SoundManager with minimal stub behavior
- **fixtures.ts**: Helper functions for creating test players, setting up game state, and clearing module state between tests
- **test-levels.ts**: Factory function `createTestLevel(seed, stage, overrides)` to generate levels with controlled parameters; enables fixture-level level manipulation for specific test scenarios

### 3. Level Generation Tests (`src/engine/__tests__/level-gen.test.ts`)
**Determinism Test**
- Same `seed` + `stage` must always produce identical level layout, spawn position, exit position, and enemy placements (byte-for-byte tile map comparison)
- Verify spawn, entrance, exit, keycard, enemy, ammo, and health positions are identical across 3+ runs

**Level Validation Test**
- All tiles in `level.map` must be valid TILE constants (0–5)
- Spawn position must be on a FLOOR tile within room 0
- Exit door must exist and be on perimeter of exit room
- Keycard must be reachable without blue door
- All enemy, ammo, health positions must be on FLOOR tiles
- Width/height must be in range [16, 24] per stage constraints

**Multi-Stage Differentiation Test**
- Stage 1, 2, 3 with same seed must produce different room counts, enemy counts, and map layouts
- Higher stages must have more rooms and enemies than stage 1

### 4. Sprite System Tests (`src/engine/__tests__/sprite.test.ts`)
**Lifecycle Test: Alive → Dying → Dead**
- New sprite: `isAlive=true`, `isDying=false`, `isDead=false`
- After receiving damage to `health=0`: `isAlive=false`, `isDying=true`, `isDead=false`, `deathTimer=0`
- After `deathTimer >= deathDuration` (0.45s): `isDead=true`, `isAlive=false`, `isDying=false`
- Verify `update(deltaTime)` advances `deathTimer` correctly

**Corpse Persistence Test**
- Dead sprites remain in the `sprites` array after death animation completes
- Dead sprites are **not** removed or spliced
- `isDead=true` distinguishes corpses from alive/dying sprites
- Multiple corpses can coexist in the array

**Collision Exclusion Test**
- Dead sprites (`isDead=true`) are excluded from AI chase/attack calculations
- Dead sprites do not participate in collision checks with the player or other entities
- Verify that enemy AI pathfinding/target selection skips dead enemies

### 5. State Machine Tests (`src/game/__tests__/state.test.ts`)
**LOADING State Test**
- `gameState === GameState.LOADING` blocks input (no Enter/Space transition)
- `renderLoading()` is called, displaying progress bar and stage number
- Input events (Enter, Space, Escape) are ignored while loading

**LOADING → PLAYING Transition Test**
- After `isLoading=false` and loading progress completes, transition to PLAYING
- Input (Enter/Space) triggers transition from MENU → PLAYING
- Verify `render()` doesn't show loading screen after transition

**DEAD/WIN → MENU Transition Test**
- DEAD + Enter/Space → MENU (no loading screen shown)
- WIN + Enter/Space → MENU (no loading screen shown)
- Verify `render()` skips loading screen render in these transitions

**resetGame() Clears Loading State Test**
- Call `resetGame()` after a level completes
- Verify `isLoading=false`, `pendingLevel=null`, `loadingProgress=0`
- Subsequent level load triggers LOADING state with fresh progress counter

### 6. Test Utilities Module Design
**mocks.ts** exports:
```typescript
class MockRenderer { /* stubs: render(), start(), dispose() */ }
class MockGameStateManager { /* stubs: getState(), transitionTo(), render() */ }
class MockSoundManager { /* stubs: playSound(), stop() */ }
class MockWeapon { /* stubs: fire(), reload(), update() */ }
```

**fixtures.ts** exports:
```typescript
function createTestPlayer(x?: number, y?: number): Player
function createTestGameState(): GameStateManager
function resetGameState(): void
function advanceFrame(renderer: Renderer, deltaTime: number): void
```

**test-levels.ts** exports:
```typescript
function createTestLevel(seed: number, stage: number, overrides?: Partial<Level>): Level
```

### 7. CI/CD Integration
- Add `npm test` script: `vitest run` (single run, exit with status)
- Add `npm test:watch` script: `vitest` (watch mode for local development)
- Add `npm test:coverage` script: `vitest run --coverage` (c8-based HTML report)
- Configure `.nycrc.json` to target 80% coverage for `src/engine/sprite.ts`, `src/engine/level-gen.ts`, and `src/game/state.ts`
- Suppress coverage for generated/procedural code: `src/engine/textures.ts`, `src/engine/sprite-textures.ts`

## Acceptance criteria

1. ✓ Vitest is installed and `npm test` runs all tests without error
2. ✓ Level generation determinism test passes (same seed always produces identical layout)
3. ✓ Level validation test passes (all levels have valid tiles, spawn in room 0, exit exists, keycard reachable)
4. ✓ Multi-stage differentiation test passes (stages 1–3 produce different layouts)
5. ✓ Sprite lifecycle test passes (alive → dying → dead state transitions verified)
6. ✓ Corpse persistence test passes (dead sprites remain in array, not spliced)
7. ✓ Collision exclusion test passes (dead sprites excluded from AI and collision)
8. ✓ LOADING state test passes (input blocked, progress bar rendered)
9. ✓ State transition tests pass (LOADING→PLAYING, DEAD→MENU, WIN→MENU verified)
10. ✓ resetGame() clears loading state (isLoading, pendingLevel, loadingProgress reset to defaults)
11. ✓ Mock objects (renderer, sound manager, weapon) are reusable across tests
12. ✓ Test fixtures enable common scenarios without code duplication
13. ✓ Coverage report shows ≥80% for sprite.ts, level-gen.ts, state.ts
14. ✓ `npm test:watch` runs tests in watch mode for local development
15. ✓ `npm test:coverage` generates HTML coverage report in `coverage/` directory

## Test plan

### Phase 1: Framework & Utilities (1–2 hours)
1. Install Vitest and configure `vitest.config.ts`
2. Update `package.json` with test scripts
3. Implement mock objects in `src/__tests__/utils/mocks.ts`
4. Implement test fixtures in `src/__tests__/utils/fixtures.ts`
5. Implement test level factory in `src/__tests__/utils/test-levels.ts`

### Phase 2: Level Generation Tests (2–3 hours)
1. Write determinism test: generate level 5× with same seed, compare tile maps and entity positions
2. Write validation test: check all tiles, spawn/exit/keycard placement, reachability
3. Write multi-stage test: generate stages 1–3 with same seed, verify increasing complexity

### Phase 3: Sprite System Tests (1.5–2 hours)
1. Write lifecycle test: create sprite, apply damage, advance time, verify state flags
2. Write corpse persistence test: kill sprite, verify remains in array, not spliced
3. Write collision exclusion test: add dead sprite to scene, verify skipped by AI and collision checks

### Phase 4: State Machine Tests (1.5–2 hours)
1. Write LOADING state test: transition to LOADING, verify input blocked and progress bar rendered
2. Write transition tests: LOADING→PLAYING, DEAD→MENU, WIN→MENU with input verification
3. Write resetGame() test: verify loading state cleared to defaults

### Phase 5: Coverage & Polish (1 hour)
1. Run `npm test:coverage` and verify ≥80% on critical modules
2. Add any missing edge-case tests (boundary conditions, state edge cases)
3. Document test-running instructions in README

### Execution Timeline
- **Total effort**: 7–10 hours
- **Recommended order**: Utilities → Level Gen → Sprite → State Machine → Coverage → Polish
- **Parallel work**: Can begin Phase 3 while Phase 2 is in progress if developers are available

---
