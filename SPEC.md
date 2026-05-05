Now I have everything I need. Here is the spec:

---

## Problem

`Renderer.advanceStage()` (`renderer.ts:493–518`) calls `generateLevel()` synchronously and immediately commits the result in the same animation frame. There is no visual transition, no input blocking, and no feedback. At higher stages the generator can retry internally up to 50 times, which can cause a visible stutter. The exit trigger at `renderer.ts:1933–1940` fires during the normal game-loop update path, so the level swap happens mid-frame with no ceremony. Stage 1 is correctly generated synchronously at startup in `main.ts` before the game loop runs; only stage transitions (stage 2, 3, …) need the loading screen.

---

## Files to touch

| File | What changes |
|---|---|
| `src/game/state.ts` | Add `LOADING = 'loading'` to `GameState`; add `renderLoading(ctx, w, h, progress, stage)` method |
| `src/engine/renderer.ts` | Replace `advanceStage()` with async `beginLevelTransition()`; add loading-state fields; guard game-loop update path |
| `src/main.ts` | No change — stage 1 generation before the loop is unaffected |
| `src/engine/level-gen.ts` | No change — already deterministic via `mulberry32(seed ^ stage * 0x9E3779B9)` |

---

## Approach

### 1. Add `LOADING` state — `src/game/state.ts`

Add `LOADING = 'loading'` to the `GameState` enum between `PAUSED` and `DEAD`.

Add a new public method `renderLoading(ctx, w, h, progress: number, stage: number)`:
- Full black background: `ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)`
- Centered "STAGE N" text at `h/2 - 70`, bold 40px monospace, white
- Rotating arc spinner at `h/2` center: radius 32px, white stroke lineWidth 4, arc from `t` to `t + 1.8π` where `t = (Date.now() / 300) % (2π)` — draw each frame from caller
- "Loading… XX%" text at `h/2 + 60`, 18px monospace, `#aaa`, where XX is `Math.floor(progress * 100)`
- Progress bar: 220px wide, 10px tall, centered at `h/2 + 90`; grey background `#333`, red fill `#cc0000` to `progress * 220` width, 2px white border

The `GameStateManager.render()` switch must fall through to `renderLoading` when state is `LOADING`; the caller (Renderer) passes `progress` and `stage` as extra arguments, which `render()` should accept as optional params and forward.

### 2. Loading-state fields — `src/engine/renderer.ts`

Add to the `Renderer` class:

```ts
private isLoading: boolean = false;
private loadingProgress: number = 0;         // 0.0 → 1.0
private pendingLevel: Level | null = null;
private loadingTargetStage: number = 0;
private loadingAnimStart: number = 0;
private readonly LOAD_ANIM_MS = 700;         // progress bar animation duration
```

### 3. Replace `advanceStage()` with `beginLevelTransition()` — `src/engine/renderer.ts`

Delete the existing `advanceStage()` body. Replace with:

```
private beginLevelTransition(): void {
  if (this.isLoading) return;                        // guard double-trigger
  this.isLoading = true;
  this.loadingTargetStage = this.stage + 1;
  this.loadingProgress = 0;
  this.gameStateManager.transitionTo(GameState.LOADING);

  // Defer generation by one setTimeout so the LOADING frame paints first.
  setTimeout(() => {
    this.pendingLevel = generateLevel(this.baseSeed, this.loadingTargetStage);
    this.loadingAnimStart = performance.now();
  }, 0);
}
```

The `setTimeout(..., 0)` ensures at least one `requestAnimationFrame` fires (and paints the black loading screen) before the synchronous `generateLevel` call blocks the thread. `generateLevel` takes <30ms even at max stage, so the single-frame gap is sufficient.

### 4. Main game-loop integration — `src/engine/renderer.ts`

In the main render/update method (the `requestAnimationFrame` callback):

**When `gameState === GameState.LOADING`:**
- Skip all gameplay: no `updatePlayer()`, no enemy AI, no `worldState.updateWorld()`, no shooting
- Render loading screen: black fill + call `gameStateManager.render(ctx, w, h, this.loadingProgress, this.loadingTargetStage)`
- If `this.pendingLevel !== null` (generation done):
  - Compute `elapsed = performance.now() - this.loadingAnimStart`
  - `this.loadingProgress = Math.min(elapsed / this.LOAD_ANIM_MS, 1.0)`
  - When `this.loadingProgress >= 1.0`:
    - Apply the level (see §5 below)
    - `this.isLoading = false; this.pendingLevel = null`
    - `this.gameStateManager.transitionTo(GameState.PLAYING)`
- Return early (do not execute raycasting or sprite rendering)

**When `gameState === GameState.PLAYING` and `this.isLoading`:**
- This gap cannot occur (LOADING state is held until `isLoading` is cleared), but add the guard defensively.

**Exit door trigger (existing code at `renderer.ts:1933`):**
- Replace `this.advanceStage()` with `this.beginLevelTransition()`
- Keep all surrounding conditions unchanged (hasKeycard, distance check, edge trigger)

### 5. Applying the pending level

Extract the install logic from `advanceStage()` into a private `installLevel(level: Level)`:

```
worldState.loadLevel(level);
this.currentLevel = level;
this.stage = this.loadingTargetStage;
this.player.setPosition(level.spawn.x, level.spawn.y);
this.player.dirX = level.spawn.dirX;
this.player.dirY = level.spawn.dirY;
this.player.planeX = -level.spawn.dirY * 0.66;
this.player.planeY = level.spawn.dirX * 0.66;
this.hasKeycard = false;
this.keycardPickupMessage = 0;
this.doorMessage = '';
this.doorMessageTimer = 0;
this.sprites = [];
this.initializeSprites();
this.stageBannerTimer = this.stageBannerDuration;
this.soundManager.play(SoundType.DOOR);
```

This is the same logic as the current `advanceStage()` — just deferred to when `loadingProgress >= 1.0`.

### 6. Input blocking

`updatePlayer()` and `handleShoot()` must not execute while `isLoading`. The existing check `if (gameState !== GameState.PLAYING) return` already gates `updatePlayer` — because state is `LOADING`, not `PLAYING`, during the transition. The mousedown listener for shooting also checks `gameState === GameState.PLAYING` (`renderer.ts:141`), so it is blocked automatically. No additional changes needed in `input.ts`.

`GameStateManager`'s keydown listener must ignore LOADING: add `|| this.state === GameState.LOADING` to the guard conditions for Enter, Space, and Escape so they cannot interrupt a transition.

### 7. Determinism — no changes required

`generateLevel(baseSeed, stage)` seeds its PRNG with `mulberry32(baseSeed ^ (stage * 0x9E3779B9))`. `baseSeed` is fixed for the session at `main.ts:19`. Every level is fully determined by `(baseSeed, stage)`. No new state is introduced.

---

## Acceptance criteria

1. Pressing E at the exit door (keycard held, distance < 1.5 tiles) immediately renders a black loading screen — no frame shows the new level before the loading screen.
2. Loading screen displays: correct "STAGE N" number, a continuously rotating spinner arc, "Loading… XX%" text, and a red progress bar that fills left-to-right from 0% to 100%.
3. The progress bar reaches 100% and the new game world is not visible until the bar completes.
4. No player movement, camera rotation, shooting, or enemy AI executes while the loading screen is active.
5. After transition, the player is positioned at `level.spawn` with the correct facing direction.
6. All NPCs, items, ammo, health, secret health, and decor sprites defined in the new `Level` object are present and interactable.
7. `hasKeycard` is `false` at the start of each new stage; the exit door cannot be opened without collecting the new level's keycard.
8. The "STAGE N" banner appears after the loading screen clears (using the existing `stageBannerTimer` path).
9. ESC keypresses during the loading screen are ignored; no state corruption occurs.
10. Giving the same `baseSeed` produces identical level layouts for every stage across two runs.
11. The total time from E-press to playable game (loading screen + generation + animation) is ≤ 2 seconds on a mid-range machine.
12. DEAD → MENU and WIN → MENU flows do not show a loading screen.

---

## Test plan

1. **Basic transition** — Start, collect keycard, press E at exit door. Verify: (a) screen cuts to black immediately, (b) loading screen with correct stage number appears, (c) spinner rotates, (d) progress bar fills to 100%, (e) game world appears after bar completes.
2. **Progress animation** — Time the progress bar from appearance to 100% with a stopwatch. Must take approximately 700ms and not jump instantly.
3. **Input blocking** — During loading screen, rapidly press WASD and move mouse. After transition confirm player is at spawn (not at pre-load position), and no shots were fired.
4. **Keycard reset** — After stage transition, approach exit door without keycard. Confirm "Locked" message appears; the E key does not advance to the next stage.
5. **Multi-stage chain** — Play stages 1 → 2 → 3 in sequence. Each transition must show the correct stage number on the loading screen.
6. **ESC during loading** — Press ESC while loading screen is visible. Confirm no crash, no pause overlay, and the loading screen completes normally.
7. **Determinism** — Temporarily `console.log(baseSeed)` in `main.ts`. Run with that seed twice (hardcode it). Compare level layouts (minimap, keycard position, exit door position) for stages 1, 2, and 3 — they must be identical.
8. **Dead/win no loading** — Die during gameplay → DEAD screen appears (no loading screen). WIN condition (should not occur mid-transition) — confirm no loading screen.
9. **Double-trigger guard** — Rapidly double-tap E at the exit door. Confirm only one level transition occurs (the `isLoading` guard prevents re-entry).
10. **Performance at high stage** — Fast-forward to stage 10+ by temporarily hardcoding `loadingTargetStage`. Measure wall-clock time from E-press to playable. Must be < 2000ms.
11. **Spinner continuity** — During loading screen, confirm the spinner arc rotates smoothly with no pause during the `generateLevel` call (verify it resumes immediately after the setTimeout fires).
