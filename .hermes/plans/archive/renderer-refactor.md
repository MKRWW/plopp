# Sprint Plan: Renderer Refactor — ✅ DONE (2026-05-28)

> **Status: COMPLETE.** All four tasks shipped on develop.
>
> Commits (in order):
> - `1d38546` refactor(engine): extract enemy AI from renderer into enemy-ai.ts
> - `6506223` refactor(engine): extract combat into combat.ts
> - `9dd486b` refactor(engine): extract effects into effects.ts
> - `3a16bf5` refactor(engine): extract level flow into level-flow.ts
>
> Final outcome: renderer.ts went from **3181 → 1988 LOC** (~37% smaller).
> Four new sibling modules: `enemy-ai.ts` (435), `combat.ts` (263),
> `effects.ts` (438), `level-flow.ts` (343). No behaviour changes;
> smoke-tested after each task.
>
> Workflow used: prompts in this doc were copy-pasted to a local
> qwen3.6 worker, results reviewed and corrected by Claude before
> commit. Task 4 needed two reviewer-applied fixes (sprite-array
> mutation, `if (LOADING)` wrapper) — documented in commit
> `3a16bf5`'s body.
>
> Kept for historical reference. Each Task = one commit. No behaviour
> changes were allowed at any step.

## Problem

[`doom-browser/src/engine/renderer.ts`](../../doom-browser/src/engine/renderer.ts)
is at **3181 LOC** (~107 KB) and mixes:

- Game loop orchestration
- Raycasting + floor/ceiling rendering
- Sprite rendering (with z-buffer, hit-flash, death-anim, angle views)
- Particle / projectile render passes (blood, bio, rocket)
- HUD drawing (health, ammo, score, hitmarker, wall-impact, crosshair)
- Overlay effects (damage flash, low-health vignette, headbob, screen shake)
- Player movement + interaction (door open, exit trigger, pickup)
- Enemy AI state machine + per-class chase behaviours (Husk, Spitter, Latcher)
- Combat (player firing, hit detection, rocket projectile lifecycle)
- Level loading + transition + reset

Finding any single concern is a chore, code reviews are unwieldy, and
test-targeting individual subsystems is impossible. Recent features
(Latcher, bio projectiles, blood) made it worse.

## Goals

1. **Zero behaviour change.** Same gameplay, same numbers, same visuals,
   same test pass/fail count before and after each task.
2. Break renderer.ts down to roughly **≤ 1500 LOC** of orchestration +
   pure rendering, with the other concerns living in their own modules.
3. Each extracted module is a **library of free functions** that take
   explicit dependencies. **No new classes** introduced just to hold
   state — the `Renderer` keeps owning state and calls into modules.
4. Stop after any task and the codebase is still healthy. The sprint
   is incremental; nothing later relies on something only "halfway"
   moved.

## Non-goals

- New abstractions, dependency-injection frameworks, ECS, etc.
- Renaming public APIs unless strictly required by the extraction.
- Touching tests except where imports need updating.
- Performance optimisations.
- Renaming `doom-browser/` directory (npm package is `plopp` but the
  folder name stays).

## Bestandsschutz (do not touch)

- Game balance: damage values, AI ranges, weapon cooldowns
- Level generation
- Sprite-textures (post Husk/Spitter/Latcher redesign)
- Sound effect parameters
- Player input handling
- Vite / TypeScript / Vitest config
- The `.gitattributes` LF normalisation

## Target architecture

```
src/engine/
├── renderer.ts          // orchestrator + raycaster + sprite renderer  (~1500 LOC)
├── enemy-ai.ts          // AI state machine + per-class chase          (~650 LOC, NEW)
├── combat.ts            // player shoot + hit detection + projectiles   (~500 LOC, NEW)
├── effects.ts           // particles + overlay drawing + heartbeat      (~500 LOC, NEW)
├── level-flow.ts        // level transition + install + sprite init     (~250 LOC, NEW)
│
├── sprite.ts            // unchanged
├── sprite-textures.ts   // unchanged
├── level-gen.ts         // unchanged
├── collision.ts         // unchanged
├── world.ts             // unchanged
├── bio-projectile.ts    // unchanged
├── rocket-projectile.ts // unchanged
├── blood-particle.ts    // unchanged
├── textures.ts          // unchanged
├── zbuffer.ts           // unchanged
```

### Module pattern (consistent across all tasks)

Every extracted module exports free functions that take an explicit
**context** parameter — a plain object with the renderer state they
need. No imports of `Renderer` itself, no circular dependencies.

```ts
// enemy-ai.ts
export interface AIContext {
  player: Player;
  sprites: Sprite[];
  bioProjectiles: BioProjectile[];
  triggerDamageFlash: () => void;
}

export function updateEnemyAI(ctx: AIContext, deltaTime: number): void { … }
export function broadcastGunshot(ctx: AIContext): void { … }
```

Renderer side:

```ts
import { updateEnemyAI, broadcastGunshot, type AIContext } from './enemy-ai';

// inside Renderer:
private aiCtx(): AIContext {
  return {
    player: this.player,
    sprites: this.sprites,
    bioProjectiles: this.bioProjectiles,
    triggerDamageFlash: () => this.triggerDamageFlash(),
  };
}

// game loop:
updateEnemyAI(this.aiCtx(), deltaTime);
```

The `aiCtx()` builder is cheap (small object literal per frame). Don't
cache it on `this` — that would couple the renderer back to the module
shape.

## Task ordering

Tasks are roughly ordered by dependency direction and risk:

1. **Task 1 — enemy-ai.ts** — fully self-contained subsystem, biggest LOC win, no callers outside renderer's game loop. Lowest risk.
2. **Task 2 — combat.ts** — depends on `broadcastGunshot` from Task 1 (clean import).
3. **Task 3 — effects.ts** — independent of Tasks 1-2, but easier after combat because it shares the projectile-update mental model.
4. **Task 4 — level-flow.ts** — depends on `effects` (for `triggerDamageFlash`) and `combat` (`spawnBloodAt` if moved there). Cleanest at the end.

If you have time for only one task, do **Task 1**. It removes 20% of
the file and makes the AI testable in isolation.

## Per-task acceptance + verify checklist

Each task must pass **all** of these before commit:

- [ ] `cd doom-browser && npm run build` — green, zero new TypeScript errors
- [ ] `npm test` — same number of failures as before the task (currently 6-20 pre-existing in sprite/rocket-projectile/level-gen, depending on which subset vitest reports). Zero NEW failures.
- [ ] `npm run dev` smoke test: start, kill a Husk, kill a Spitter, get bitten by a Latcher, walk through the exit door (with both keycards), confirm Stage 2 loads.
- [ ] `git diff --stat` shows only the expected files touched (the new module + renderer.ts).
- [ ] No exported function or class lost (search for old method names — only renderer call-sites should still reference them).

---

## Task 1 — enemy-ai.ts

### Scope

Extract every method that participates in enemy AI behaviour:

| Method | Current line | LOC |
| --- | --- | --- |
| `updateEnemyAI` | renderer.ts:2442 | ~120 |
| `handleGruntChase` | renderer.ts:2563 | ~45 |
| `handleShooterChase` | renderer.ts:2608 | ~60 |
| `handleLatcherChase` | renderer.ts:2669 | ~100 |
| `broadcastGunshot` | renderer.ts:351 | ~35 |
| `applyEntityAvoidance` | renderer.ts:2772 | ~30 |

Plus the constants `attackRange / chaseSpeed / attackDamage / attackCooldown`
used inside `updateEnemyAI` (lines 2445-2448). Move them into
`enemy-ai.ts` as module-level constants.

### Interface

```ts
// enemy-ai.ts
import { Sprite, EnemyAIState, EnemyClass, ... } from './sprite';
import { Player } from '../player/player';
import { BioProjectile } from './bio-projectile';
import { hasLineOfSight, slideAlongX, slideAlongY, resolveAllEntityOverlaps, ENEMY_RADIUS, PLAYER_RADIUS, MIN_ENTITY_DIST } from './collision';

export interface AIContext {
  player: Player;
  sprites: Sprite[];
  bioProjectiles: BioProjectile[];
  triggerDamageFlash: () => void;
}

export function updateEnemyAI(ctx: AIContext, deltaTime: number): void;
export function broadcastGunshot(ctx: AIContext): void;
```

`handleGruntChase`, `handleShooterChase`, `handleLatcherChase`, and
`applyEntityAvoidance` are **non-exported helpers** in `enemy-ai.ts`.
They take an `AIContext` plus the individual sprite and computed
geometry, just like the current private methods.

### Renderer changes

- Add `import { updateEnemyAI, broadcastGunshot, type AIContext } from './enemy-ai';`
- Add a private `aiCtx()` helper that returns the context object
- Replace all 3 internal calls (`this.updateEnemyAI(dt)` × 1, `this.broadcastGunshot()` × 2) with the imported functions
- Delete the 6 method definitions from `renderer.ts`

### Acceptance

- Renderer.ts loses ~390 LOC
- `enemy-ai.ts` is created, ~400 LOC including imports + interface
- Husk wanders / alerts / chases identically
- Spitter still fires bio projectiles
- Latcher still wind-ups and leaps
- Player shooting still alerts enemies in range
- Build + tests + smoke test green

### Verify

```bash
cd doom-browser && npm run build && npm test 2>&1 | tail -20
```

Then `npm run dev`:
- Spawn level (Stage 3 for variety)
- Stand still — wait for a Latcher to pounce → confirm AI runs
- Fire a shot — distant enemies should turn toward you (gunshot awareness)
- Kill all enemies → "WIN" state should appear

---

## Task 2 — combat.ts

### Scope

| Method | Current line | LOC |
| --- | --- | --- |
| `handleShoot` | renderer.ts:267 | ~80 |
| `triggerWallImpact` | renderer.ts:385 | ~60 |
| `checkShotHit` | renderer.ts:445 | ~40 |
| Rocket projectile update loop | renderer.ts: in game loop (~50 LOC) |
| Bio projectile update loop | renderer.ts: in game loop (~10 LOC) |

### Interface

```ts
// combat.ts
import { Sprite, ... } from './sprite';
import { Player } from '../player/player';
import { WeaponInventory } from '../game/weapons';
import { Weapon } from '../game/weapon';
import { RocketProjectile } from './rocket-projectile';
import { BioProjectile } from './bio-projectile';
import { SoundManager } from '../audio/sound';

export interface CombatContext {
  player: Player;
  inventory: WeaponInventory;
  weapon: Weapon;
  sprites: Sprite[];
  rockets: RocketProjectile[];
  bioProjectiles: BioProjectile[];
  soundManager: SoundManager;
  triggerDamageFlash: () => void;
  broadcastGunshot: () => void;
  spawnBlood: (s: Sprite) => void;
  triggerScreenShake: (intensity: number, duration: number) => void;
  setWallImpact: (x: number, y: number) => void;  // visual marker, owned by effects later
  setHitMarker: () => void;                       // ditto
}

export function handlePlayerShoot(ctx: CombatContext): void;
export function checkShotHit(ctx: CombatContext): Sprite | null;
export function updateRockets(ctx: CombatContext, deltaTime: number): void;
export function updateBioProjectiles(ctx: CombatContext, deltaTime: number): void;
```

`triggerWallImpact` is purely visual — its trigger fires from combat
but the actual rendering moves to effects in Task 3. For Task 2, keep
it as a helper inside combat.ts that updates renderer-owned state via
the `setWallImpact` callback.

### Renderer changes

- Import combat functions
- Replace the inline rocket/bio update loops in `start()` with single function calls
- Delete the moved methods
- Build the `CombatContext` similarly to `aiCtx()`

### Acceptance

- Renderer loses another ~250-300 LOC
- Player firing all 3 weapons works identically (pistol hitscan, shotgun, rocket)
- Rocket explosion still kills enemies in range + applies AoE
- Bio projectiles still fly from Spitters on cooldown
- Wall impacts still appear briefly
- Hitmarker still flashes on hit

### Verify

```bash
cd doom-browser && npm run build && npm test
```

`npm run dev`: fire each weapon at a wall and an enemy. Confirm rocket
explodes, bio glob arcs, pistol/shotgun apply hit-flash + score.

---

## Task 3 — effects.ts

### Scope

| Method | Current line | LOC |
| --- | --- | --- |
| `spawnBloodAt` | renderer.ts:1010 | ~30 |
| `renderBloodParticles` | renderer.ts:1040 | ~40 |
| `renderRockets` | renderer.ts:1078 | ~70 |
| `renderBioProjectiles` | renderer.ts:1147 | ~65 |
| `drawDamageFlash` | renderer.ts:2327 | ~20 |
| `drawLowHealthVignette` | renderer.ts:2306 | ~20 |
| `drawHitMarker` | renderer.ts:2349 | ~25 |
| `drawWallImpact` | renderer.ts:2373 | ~25 |
| Heartbeat update block (inside game loop, ~25 LOC) |
| Headbob update + transform (inside game loop, ~30 LOC) |
| Screen-shake update + transform (inside game loop, ~10 LOC) |

### Interface

```ts
// effects.ts
import { Sprite, ... } from './sprite';
import { BloodParticle } from './blood-particle';
import { BioProjectile } from './bio-projectile';
import { RocketProjectile } from './rocket-projectile';
import { Player } from '../player/player';
import { ZBuffer } from './zbuffer';
import { SoundManager } from '../audio/sound';
import { InputHandler } from '../player/input';

export interface EffectsContext {
  ctx: CanvasRenderingContext2D;
  player: Player;
  zBuffer: ZBuffer;
  soundManager: SoundManager;
  input: InputHandler;
  bloodParticles: BloodParticle[];
  bioProjectiles: BioProjectile[];
  rockets: RocketProjectile[];
}

export interface EffectsState {
  damageFlashTimer: number;
  damageFlashDuration: number;
  hitmarkerTimer: number;
  wallImpactX: number;
  wallImpactY: number;
  wallImpactTimer: number;
  heartbeatTimer: number;
  heartbeatPulseTimer: number;
  headbobPhase: number;
  headbobIntensity: number;
  screenShakeTimer: number;
  screenShakeIntensity: number;
  isSprinting: boolean;
}

export function spawnBlood(ctx: EffectsContext, sprite: Sprite): void;
export function updateBloodParticles(ctx: EffectsContext, deltaTime: number): void;
export function updateHeartbeat(ctx: EffectsContext, state: EffectsState, deltaTime: number, isPlaying: boolean): void;
export function updateHeadbobAndShake(state: EffectsState, deltaTime: number, isMoving: boolean): { translateX: number; translateY: number };
export function renderBloodParticles(ctx: EffectsContext): void;
export function renderBioProjectiles(ctx: EffectsContext): void;
export function renderRockets(ctx: EffectsContext): void;
export function drawDamageFlash(ctx: EffectsContext, state: EffectsState): void;
export function drawLowHealthVignette(ctx: EffectsContext, state: EffectsState, lowHealthThreshold: number): void;
export function drawHitMarker(ctx: EffectsContext, state: EffectsState): void;
export function drawWallImpact(ctx: EffectsContext, state: EffectsState): void;
```

`EffectsState` is a plain object owned by Renderer (the same fields it
already has) and passed by reference so the effects module can both
read and decrement timers.

### Renderer changes

- The `EffectsState` is the existing fields on `Renderer` grouped into
  a single object held by the renderer (`this.effectsState`).
- All effect-method calls swap to imported function calls.
- The transform stacking inside `start()` (save/translate/restore for
  shake + headbob) gets refactored to use the `updateHeadbobAndShake`
  helper, but the `save`/`restore` calls stay in renderer.

### Acceptance

- Renderer loses ~300-400 LOC
- All visuals identical: blood splatters, rocket trails, bio globs,
  damage flash, low-health vignette, hit-marker, wall-impact decal,
  headbob, screen shake

### Verify

- Fire all weapons → trails / flashes present
- Take damage from a Latcher → damage flash + screen shake + (if below 25 HP) vignette + heartbeat sound
- Kill an enemy → blood splatter coloured correctly per class
- Walk in different directions → headbob present, stops when idle
- Sprint → headbob intensifies

---

## Task 4 — level-flow.ts

### Scope

| Method | Current line | LOC |
| --- | --- | --- |
| `initializeSprites` | renderer.ts:537 | ~170 |
| `beginLevelTransition` | renderer.ts:706 | ~35 |
| `installLevel` | renderer.ts:739 | ~25 |
| `resetGame` | renderer.ts:2397 | ~40 |

### Interface

```ts
// level-flow.ts
import { Level, generateLevel } from './level-gen';
import { Sprite, ... } from './sprite';
import { SpriteTextureSet } from './sprite-textures';
import { Player } from '../player/player';
import { GameStateManager, GameState } from '../game/state';
import { Weapon } from '../game/weapon';
import { WeaponInventory } from '../game/weapons';

export interface LevelFlowContext {
  player: Player;
  weapon: Weapon;
  inventory: WeaponInventory;
  gameStateManager: GameStateManager;
  spriteSet: SpriteTextureSet;
  sprites: Sprite[];
}

export interface LevelFlowState {
  baseSeed: number;
  stage: number;
  currentLevel: Level;
  isLoading: boolean;
  pendingLevel: Level | null;
  loadingProgress: number;
  loadingTargetStage: number;
  loadingAnimStart: number;
}

export function initializeSprites(ctx: LevelFlowContext, level: Level): void;
export function beginLevelTransition(ctx: LevelFlowContext, state: LevelFlowState): void;
export function installLevel(ctx: LevelFlowContext, state: LevelFlowState, level: Level): void;
export function resetGame(ctx: LevelFlowContext, state: LevelFlowState): void;
```

### Renderer changes

- Group level-flow fields into a single `levelFlowState` object
- Replace method calls with imported function calls
- Move the entire LOADING-update block in the game loop into a single
  `tickLoading(ctx, state, deltaTime)` call exported from level-flow

### Acceptance

- Renderer loses another ~250 LOC
- Player respawn on death works
- Stage transition (E at exit door) works
- Loading screen progresses correctly
- Generation-failure retry (the recent `fix(level-gen)` commit) still recovers

### Verify

- Die → return to menu → restart cycle
- Complete a stage (find both keycards, exit) → Stage 2 loads
- Try to generate a stage with a problematic seed (or just play multiple stages)

---

## Final state after all 4 tasks

| File | Approx. LOC |
| --- | --- |
| renderer.ts | ~1500 (game loop, raycaster, sprite render, HUD, pickup, player update) |
| enemy-ai.ts | ~400 (NEW) |
| combat.ts | ~350 (NEW) |
| effects.ts | ~450 (NEW) |
| level-flow.ts | ~280 (NEW) |

renderer.ts goes from **3181 → ~1500**, distributed responsibilities
into 4 focused modules under 500 LOC each.

## Pitfalls and how to handle them

1. **Forgotten field on the context object** → TypeScript error at the
   call site. Just add the field and the constructor that builds the
   context.

2. **Circular import risk** between enemy-ai.ts and combat.ts**:
   combat needs `broadcastGunshot` from enemy-ai. That's a clean
   one-way import (combat → enemy-ai). Do not import combat from
   enemy-ai.

3. **State mutation timing** — most extracted functions mutate the
   sprite array, player, projectile arrays directly. Keep that as-is.
   Don't add immutable patterns; this is a 60 FPS game loop.

4. **Tests referencing private methods** — they don't, because they're
   private. But verify with a grep before each task.

5. **Don't bundle "while I'm here" tweaks.** If you notice a bug while
   moving code, write it down for a follow-up commit. Behaviour parity
   is the contract.

6. **Commit-message hygiene** — one commit per task with a clear
   "refactor(…): extract … from renderer" subject, plus a body listing
   methods moved.

## Copy-paste-ready prompts

Each block below is the full briefing for one task. Run them in order.

### Prompt for Task 1

```
KONTEXT: Lies /mnt/d/Development/Sources/Fun/aiDoom/.hermes/plans/renderer-refactor.md komplett. Halte dich an "Module pattern" und "Task 1 — enemy-ai.ts".

AUFGABE: Erstelle doom-browser/src/engine/enemy-ai.ts und ziehe die 6 AI-Methoden + ihre Hilfskonstanten aus renderer.ts dorthin um. Keine Verhaltensänderung.

KONKRETE SCHRITTE:

1. Neue Datei doom-browser/src/engine/enemy-ai.ts anlegen. Imports aus sprite.ts, collision.ts, player/player, bio-projectile. Definiere AIContext-Interface laut Plan.

2. updateEnemyAI als exportierte Funktion ziehen, takes AIContext + deltaTime. Interne Helfer (handleGruntChase, handleShooterChase, handleLatcherChase, applyEntityAvoidance) als non-exported Funktionen in derselben Datei. Anpassen: this.X → ctx.X. Keine Logik-Änderung.

3. broadcastGunshot als exportierte Funktion ziehen, takes AIContext.

4. Die Konstanten attackRange / chaseSpeed / attackDamage / attackCooldown (renderer.ts:2445-2448) als module-level const in enemy-ai.ts.

5. In renderer.ts:
   - Imports am Anfang ergänzen: `import { updateEnemyAI, broadcastGunshot, type AIContext } from './enemy-ai';`
   - Private aiCtx()-Builder ergänzen die das Context-Objekt zurückgibt.
   - 6 Methoden-Definitionen (updateEnemyAI, broadcastGunshot, handleGruntChase, handleShooterChase, handleLatcherChase, applyEntityAvoidance) löschen.
   - Alle 3 internen Aufrufe (this.updateEnemyAI / this.broadcastGunshot) durch die importierten Funktionen mit aiCtx() ersetzen.

VERBOTEN:
- Andere renderer-Methoden anfassen
- AI-Konstanten oder -Werte ändern
- Neue Klassen, Singletons, DI-Container einführen
- Tests anfassen
- Andere Dateien außer renderer.ts und enemy-ai.ts berühren

VERIFY (selbst ausführen und Ergebnis berichten):
- `cd /mnt/d/Development/Sources/Fun/aiDoom/doom-browser && npm run build` — grün
- `npm test 2>&1 | tail -20` — keine NEUEN Failures gegenüber Baseline (akzeptiert: dieselben pre-existing in sprite/rocket/level-gen)
- Berichte: LOC von renderer.ts vorher/nachher, LOC von enemy-ai.ts, welche Methoden bewegt
```

### Prompt for Task 2

```
KONTEXT: Lies /mnt/d/Development/Sources/Fun/aiDoom/.hermes/plans/renderer-refactor.md komplett. Task 1 (enemy-ai.ts) ist committet. Folge "Task 2 — combat.ts".

AUFGABE: Erstelle doom-browser/src/engine/combat.ts und ziehe die Kampf-Logik aus renderer.ts um. Keine Verhaltensänderung.

KONKRETE SCHRITTE:

1. Datei combat.ts anlegen. CombatContext-Interface aus Plan definieren. Import von broadcastGunshot aus './enemy-ai'.

2. Folgende Funktionen exportieren (alles takes CombatContext, manche zusätzlich deltaTime):
   - handlePlayerShoot — aus renderer.ts:267 (handleShoot)
   - checkShotHit — aus renderer.ts:445
   - updateRockets — neuer Wrapper um den Rocket-Update-Block in start() (siehe game loop, sucht "this.rockets.length")
   - updateBioProjectiles — neuer Wrapper um den BioProjectile-Update-Block

   triggerWallImpact (renderer.ts:385) als non-exported Helfer in combat.ts behalten.

3. In renderer.ts:
   - Imports ergänzen
   - combatCtx()-Builder analog zu aiCtx()
   - Methoden löschen
   - In start() die inline-Update-Loops durch updateRockets(combatCtx(), dt) bzw. updateBioProjectiles(combatCtx(), dt) ersetzen
   - handleShoot-Aufrufsite (suche "this.handleShoot()") durch handlePlayerShoot(combatCtx()) ersetzen

VERBOTEN:
- enemy-ai.ts modifizieren (read-only nutzen)
- Tests, sprite.ts, level-gen oder andere Files anfassen
- Schaden, Cooldowns, Sprite-Radien oder andere Balance-Werte ändern
- Neue Sprite-Types oder EnemyClasses einführen

VERIFY:
- `npm run build` grün
- `npm test` keine neuen Failures
- Berichte: renderer.ts LOC vorher/nachher, combat.ts LOC, alle bewegten Methoden
```

### Prompt for Task 3

```
KONTEXT: Lies /mnt/d/Development/Sources/Fun/aiDoom/.hermes/plans/renderer-refactor.md komplett. Tasks 1 + 2 committet. Folge "Task 3 — effects.ts".

AUFGABE: Erstelle doom-browser/src/engine/effects.ts und ziehe alle Partikel/Render-Pässe + HUD-Overlays + Headbob/Shake-Update um. Keine Verhaltensänderung.

KONKRETE SCHRITTE:

1. effects.ts mit EffectsContext + EffectsState-Interfaces wie im Plan.

2. Funktionen exportieren:
   - spawnBlood — aus renderer.ts:1010
   - updateBloodParticles — der existierende Update-Loop in start()
   - renderBloodParticles — aus renderer.ts:1040
   - renderBioProjectiles — aus renderer.ts:1147
   - renderRockets — aus renderer.ts:1078
   - drawDamageFlash — aus renderer.ts:2327
   - drawLowHealthVignette — aus renderer.ts:2306
   - drawHitMarker — aus renderer.ts:2349
   - drawWallImpact — aus renderer.ts:2373
   - updateHeartbeat — der existierende Heartbeat-Block aus dem game loop
   - updateHeadbobAndShake — der existierende Headbob/Shake-Update-Block; gibt {translateX, translateY} zurück

3. In renderer.ts:
   - Felder die zu EffectsState gehören (damageFlashTimer, heartbeatTimer, headbobPhase usw.) in ein einzelnes this.effectsState-Objekt gruppieren. Existierende Konstanten (LOW_HEALTH_THRESHOLD etc.) als Module-Konstanten in effects.ts ziehen, in den Renderer importieren falls noch dort benötigt.
   - effectsCtx()-Builder
   - Alle entsprechenden this.X-Aufrufe ersetzen
   - In start(): den Save/Translate/Restore-Block beibehalten, aber die Berechnung der Translation an updateHeadbobAndShake delegieren.

VERBOTEN:
- enemy-ai.ts oder combat.ts anfassen
- Render-Reihenfolge ändern (alle Pässe in derselben Z-Order behalten)
- Tests, sprite.ts, level-gen anfassen
- Particle-Counts, Glow-Werte, Vignette-Parameter ändern

VERIFY:
- Build + Tests
- Smoke-Test: Latcher killen → Blut der richtigen Farbe; HP < 25 → Vignette + Heartbeat; Sprint → Headbob; Wand schießen → Wall-Impact-Decal
```

### Prompt for Task 4

```
KONTEXT: Lies /mnt/d/Development/Sources/Fun/aiDoom/.hermes/plans/renderer-refactor.md komplett. Tasks 1-3 committet. Folge "Task 4 — level-flow.ts".

AUFGABE: Erstelle doom-browser/src/engine/level-flow.ts mit Level-Transition, -Install und Sprite-Initialisierung. Keine Verhaltensänderung.

KONKRETE SCHRITTE:

1. level-flow.ts mit LevelFlowContext + LevelFlowState-Interfaces.

2. Funktionen exportieren:
   - initializeSprites — aus renderer.ts:537
   - beginLevelTransition — aus renderer.ts:706
   - installLevel — aus renderer.ts:739
   - resetGame — aus renderer.ts:2397
   - tickLoading — neuer Wrapper um den LOADING-State-Block aus start() (siehe `if (gameState === GameState.LOADING)` in der Update-Phase)

3. In renderer.ts:
   - LevelFlowState-Felder (baseSeed, stage, currentLevel, isLoading, pendingLevel, loadingProgress, loadingTargetStage, loadingAnimStart) in this.levelFlowState gruppieren — oder direkt einzelne Properties belassen und beim Bauen des Context-Objekts referenzieren
   - levelFlowCtx() + this.levelFlowState wo nötig
   - Methoden löschen, Aufrufe ersetzen

VERBOTEN:
- Generation-Retry-Logik aus fix(level-gen) ändern — die bleibt 1:1
- Level-gen.ts anfassen
- Andere Module touchen

VERIFY:
- Sterben → Menu → restart
- Stage 1 → 2 → 3 Übergang
- Build + Tests
```

## Wenn fertig

renderer.ts ist auf ~1500 LOC. Jede zukünftige Erweiterung
(neue Gegner, neue Waffen, neue Effekte, neue Levels) hat ein klares
Zuhause und kollidiert nicht mit unrelated Logic. Test-Coverage kann
gezielt einzelne Module ansteuern statt durch den Renderer-Hauptklotz.

Falls nach Task 1 oder 2 schon die Schmerzen weg sind: Sprint stoppen
ist absolut okay. Es gibt keinen Endpunkt der "fertig" definiert
außer dass du dich beim Arbeiten wohl fühlst.
