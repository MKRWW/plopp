# Sprint Plan: Boss + Enemy Voices

> Status: drafted, not started. Pick this up in a fresh session.
> Each Task = one commit. Behaviour parity is **not** the contract here
> — these are new features. But: no regressions in existing gameplay.

## Problem

Two of the five gaps from the gameplay-gap review (memory:
`project_gameplay_gaps.md`) hurt the most:

- **Enemies are silent.** No idle/alert/death-rattle sounds. Combat is
  always blind-corner damage-flashes because you can't hear anything
  approaching.
- **No endgame.** Stages 1 → ∞ with the same three enemy classes. No
  goal beyond "next stage", no Win-Condition the player can chase.

Both are gameplay-feel issues, not engine issues. Fixing them moves
the game from "tech demo with combat" toward "game with a reason to
play".

## Goals

1. **Per-class procedural enemy voices** — Web Audio-synthesized
   idle, alert, and (where missing) death sounds for Husk, Spitter,
   Latcher. Distance-attenuated, with per-enemy cooldowns so they
   don't spam.
2. **One endgame Boss** at a fixed `BOSS_STAGE` (default 10). New
   `EnemyClass.BOSS` with three HP-driven phases. Boss-death triggers
   `GameState.WIN` instead of a stage transition.
3. **Stay in-style** — all SFX procedural (Web Audio), boss sprite
   procedural (in line with the Husk/Spitter/Latcher aesthetic, chitin
   + bio-glow family).

## Non-goals

- Voice variety across individual enemies of the same class. One
  idle per class is enough.
- Boss arena hand-crafting. Boss spawns in a regular procedural level
  with normal-enemy count set to 0 + extra ammo/health.
- Reworking the existing AI state machine. The boss uses the same
  IDLE/ALERT/CHASE skeleton, with phase-switching inside CHASE.
- Multi-boss content. One boss, one design, one endgame.
- Adjustable difficulty, options menu, persistent unlocks.

## Bestandsschutz (do not touch)

- The refactor module boundaries (`enemy-ai.ts`, `combat.ts`,
  `effects.ts`, `level-flow.ts`) — extend, don't blur.
- Existing AI numbers (Husk speed, Spitter cooldown, Latcher leap
  arc) — boss gets its own constants.
- Pickup balance.
- Level-gen retry logic from `fix(level-gen)`.

## Target additions

```
src/audio/sound.ts             // + new SoundTypes, new procedural synths
src/engine/enemy-ai.ts         // + idle/alert sound triggers, BOSS chase logic
src/engine/sprite.ts           // + EnemyClass.BOSS, SpriteType.BOSS, boss state
src/engine/sprite-textures.ts  // + boss textures (8-direction or 4-direction)
src/engine/level-gen.ts        // + BOSS_STAGE constant, boss-stage population
src/engine/level-flow.ts       // + boss-stage sprite-init branch
src/engine/combat.ts           // boss-death → WIN integration
```

No new modules. All additions slot into existing ones.

## Task ordering

1. **Task 1 — Procedural enemy voices** (idle + alert, all 3 classes).
   Cleanest first because it's self-contained in `sound.ts` +
   `enemy-ai.ts`; no new sprites, no new state. Big perceived impact
   per LOC.
2. **Task 2 — Boss enemy class + sprite** (no phases yet, just a
   tanky Husk-shaped placeholder that spawns and fights). Lets us
   verify spawning, hit-flash, corpse, death-anim work for the new
   class before adding behaviour complexity.
3. **Task 3 — Boss phase state machine** (melee → spit → rage charge,
   driven by current HP %). Builds on Task 2 with isolated phase
   logic in `enemy-ai.ts`.
4. **Task 4 — BOSS_STAGE + Win-Condition** (level-gen branch, boss
   spawn, kill → WIN transition). Cleanest at the end because both
   prior tasks must work in isolation.

If only one task lands: **Task 1**. It alone makes every existing
session noticeably more atmospheric.

---

## Task 1 — Procedural enemy voices

### Scope

- New `SoundType` entries: `HUSK_IDLE`, `HUSK_ALERT`, `SPITTER_IDLE`,
  `SPITTER_ALERT`, `LATCHER_IDLE`, `LATCHER_ALERT`. (Existing
  `ENEMY_DEATH` stays generic for now.)
- Per-class procedural synth in `sound.ts`:
  - **Husk idle** — low growl: sawtooth osc 80–120 Hz, slow LFO,
    short burst (~250 ms).
  - **Husk alert** — sharper rising tone, ~400 ms.
  - **Spitter idle** — wet clicking: short noise bursts, band-pass
    filtered.
  - **Spitter alert** — single high chirp + click tail.
  - **Latcher idle** — skittering: rapid noise bursts.
  - **Latcher alert** — high-pitch screech, ~200 ms.
- **Distance attenuation**: `sound.play()` gains a `volume` parameter
  (or new `playAt(type, distance)` helper). Falloff: `1 / (1 + d * k)`,
  clamped, cuts to 0 past `AI_AWARENESS_RADIUS * 1.5`.
- **Trigger logic in `enemy-ai.ts`**:
  - Per-sprite `idleSoundCooldown` field (start: random 3–6 s).
    Decrements each frame in IDLE state; on hit 0 → play idle, reset to
    random 4–8 s.
  - On state transition `IDLE → ALERT` or `IDLE → CHASE` (also on
    gunshot-awareness wake) → play alert once.
  - All triggers go through the distance-attenuated path so quiet
    enemies far away don't blast the player.

### Interface

```ts
// sound.ts additions
export enum SoundType {
  // ...existing...
  HUSK_IDLE, HUSK_ALERT,
  SPITTER_IDLE, SPITTER_ALERT,
  LATCHER_IDLE, LATCHER_ALERT,
}

// On SoundManager:
play(type: SoundType, volume?: number): void;  // default volume = 1
// helper used by enemy-ai:
playAt(type: SoundType, distance: number): void;
```

```ts
// sprite.ts addition (on Sprite class):
idleSoundCooldown: number;  // seconds until next idle sound, in IDLE state only
```

```ts
// enemy-ai.ts: inside the per-enemy tick, route IDLE/ALERT transitions
// + idle cooldown through the new SoundManager helpers. SoundManager
// is added to AIContext.
```

### Acceptance

- Stand still in a level → distant enemies emit occasional class-
  specific idle sounds, volume scales with distance.
- Sprint into a room → enemies emit alert SFX as they wake up.
- No idle/alert sounds when paused, dead, or in menu.
- No perf regression — synth functions reuse oscillator/buffer
  patterns from existing SFX.

### Verify

- `cd doom-browser && npm run build` — green
- `npm test` — same baseline (Task 1 adds no test churn)
- Smoke: spawn level, listen → growls from offscreen; rush a Husk →
  alert before chase begins.

---

## Task 2 — Boss enemy class + sprite (placeholder behaviour)

### Scope

- `SpriteType.BOSS` added.
- `EnemyClass.BOSS` added.
- Constants in `sprite.ts`:
  ```ts
  export const AI_BOSS_SPEED = 1.2;          // tiles/s, slower than Husk
  export const AI_BOSS_HP = 30;              // tanky
  export const AI_BOSS_ATTACK_RANGE = 0.8;
  export const AI_BOSS_ATTACK_DAMAGE = 25;
  export const AI_BOSS_ATTACK_COOLDOWN = 1.5;
  ```
- Procedural boss sprite in `sprite-textures.ts`:
  - 8-direction views (consistent with other enemies)
  - Larger than Husk (~1.4× scale)
  - Aesthetic: chitin family (HUSK_PLATE palette + glow accents from
    SPITTER_BIO_HOT). Three-eyed silhouette or asymmetric mass — make
    it visually distinct at a glance.
  - Corpse texture (large, dark)
- Boss chase = scaled-up Husk chase (Task 3 replaces this with phases).
- Boss-death animation: same scaffolding as other classes, longer
  duration (1.5 s vs 0.5 s).
- Hit-flash: new color (e.g. orange) so it reads as "big enemy".

### Interface

```ts
// In sprite.ts:
export enum EnemyClass { GRUNT, SHOOTER, LATCHER, BOSS }
export enum SpriteType { ..., BOSS }
```

### Acceptance

- Force-spawn a boss (via `level.bosses[]` populated by hand in a
  debug branch of level-gen, or temporarily push one in
  `initializeSprites`) → it appears, has the boss texture, chases
  like a slow Husk, dies after taking damage, leaves a boss corpse.
- No regressions on the three existing enemies.

### Verify

- `npm run build`, `npm test` green
- Smoke: temp-spawn boss, shoot it dead with rockets; verify hit-flash,
  death-anim, corpse render correctly.

---

## Task 3 — Boss phase state machine

### Scope

- Add `BossPhase` enum to `sprite.ts`:
  ```ts
  export enum BossPhase { MELEE, VOLLEY, RAGE }
  ```
- Add to `Sprite` (BOSS-only fields):
  ```ts
  bossPhase: BossPhase;
  bossVolleyTimer: number;
  bossRageActivated: boolean;
  ```
- In `enemy-ai.ts`, new non-exported `handleBossChase(ctx, sprite, ...)`:
  - **Phase 1 — MELEE** (HP > 50%): scaled-up Husk chase. Same as
    Task 2 baseline.
  - **Phase 2 — VOLLEY** (HP 20-50%): every `BOSS_VOLLEY_COOLDOWN`
    seconds, fire 3 bio-projectiles in a 30° fan toward the player.
    Reuse `BioProjectile` from combat (already exists for Spitter).
    Stays mostly stationary while volleying.
  - **Phase 3 — RAGE** (HP < 20%): speed doubles, attack range
    halved (charges into player), attack damage +25%. Triggered once
    via `bossRageActivated` so it's a clear "the boss is enraged" beat.
- Phase transitions on HP threshold crossings — one-shot, latched.
- Optional: distinct boss SFX per phase (Task 1's procedural style)
  — `BOSS_ROAR`, `BOSS_VOLLEY`, `BOSS_RAGE`. Can be its own follow-up
  if time-pressed.

### Acceptance

- Boss starts in MELEE phase, switches to VOLLEY at 50% HP (visible
  via fan of bio-projectiles), switches to RAGE at 20% (visible via
  faster movement).
- Volley uses existing bio-projectile rendering (no new draw code).

### Verify

- `npm run build`, `npm test` green
- Smoke: pin the boss with rocket-launcher, watch all three phases
  trigger; survive RAGE phase to confirm damage scaling.

---

## Task 4 — BOSS_STAGE + Win-Condition

### Scope

- Constant in `level-gen.ts`:
  ```ts
  export const BOSS_STAGE = 10;
  ```
- Level-gen branch: if `stage === BOSS_STAGE`, produce a level with:
  - Zero normal enemies (`enemies = []`, `shooters = []`,
    `latchers = []`).
  - One boss in `level.bosses = [{ x, y }]` (positioned far from
    spawn, ideally in the largest room).
  - Extra ammo + health pickups in the spawn room.
  - Keep keycards + exit door logic intact (the boss room is still a
    valid level structure).
- Add `bosses: Position[]` to the `Level` type.
- `level-flow.ts` `initializeSprites` gains a `BOSS` branch (mirrors
  the Husk/Spitter/Latcher blocks).
- **Win trigger**: when the last alive boss dies, transition to
  `GameState.WIN`. Implement in `combat.ts` or `enemy-ai.ts` death-
  detection block: after a kill, check if any boss remains alive; if
  none and we were on `BOSS_STAGE`, call
  `gameStateManager.transitionTo(GameState.WIN)`.
- Win-screen text: existing `GameState.WIN` render path already shows
  a victory message — leave the copy as-is or adjust to "BOSS DEFEATED".

### Acceptance

- Force-jump to stage 10 (debug shortcut or just play through) → boss
  level loads with no normal enemies, one boss, extra loot.
- Kill the boss → instant WIN state, game-over screen with victory
  message.
- Stages 1-9 unaffected.

### Verify

- `npm run build`, `npm test` green
- Smoke: speedrun stages 1-9 (rocket-spam, just to get there), confirm
  stage 10 spawns boss, kill it, reach WIN.

---

## Final state after all 4 tasks

| What | Where |
| --- | --- |
| Per-class idle/alert SFX | `sound.ts`, `enemy-ai.ts` |
| Boss enemy (class + sprite + corpse + 8-dir views) | `sprite.ts`, `sprite-textures.ts` |
| Boss 3-phase AI | `enemy-ai.ts` |
| Boss stage + win condition | `level-gen.ts`, `level-flow.ts`, `combat.ts` |

Net result: the game has a soundscape that telegraphs threats, and
an endgame the player can chase.

## Pitfalls

1. **Web Audio cooldowns** — synthesizing identical oscillators
   every few frames will eat CPU. Cache the buffer per SoundType
   (existing pattern in `sound.ts`).
2. **Distance attenuation gain noise** — Web Audio `GainNode` works
   for one-shots, but creating + connecting nodes per call adds GC
   pressure. Use a shared gain or compute volume up-front and apply
   it to a freshly created `AudioBufferSourceNode`.
3. **Boss-Phase one-shot latching** — without a `bossRageActivated`
   flag, an HP-threshold check that flickers around 20% could fire
   the rage transition multiple times. Latch it.
4. **Bio-projectile ownership in VOLLEY** — the boss isn't a
   Spitter; make sure `enemy-ai.ts` sets the projectile spawn-source
   correctly so existing collision/damage code still works.
5. **Win-trigger ordering** — boss death must transition to WIN
   *after* corpse/death-anim starts but *before* the next-frame
   sprite update, so the player sees the corpse on the WIN screen.
6. **Force-spawn debug for Tasks 2/3** — don't ship debug spawn
   code. Either guard with `if (DEBUG)` or remove before commit.
   The proper boss spawn comes in Task 4.

## Copy-paste-ready prompts

Each block below is the full briefing for one task. Run them in
order. Update line numbers via grep before pasting if the renderer
has shifted.

### Prompt for Task 1

```
KONTEXT: Lies /mnt/d/Development/Sources/Fun/aiDoom/.hermes/plans/boss-and-enemy-voices.md komplett.
Halte dich an "Module pattern" (Context-Pattern aus dem renderer-refactor) und "Task 1 — Procedural enemy voices".

WORKING DIRECTORY: /mnt/d/Development/Sources/Fun/aiDoom/doom-browser

AUFGABE: Erweitere doom-browser/src/audio/sound.ts um sechs neue prozedurale Enemy-Voice-SFX
und ziehe Distance-attenuated Idle/Alert-Trigger in doom-browser/src/engine/enemy-ai.ts ein.
KEIN MP3-Sample-Import — alles via Web Audio API synthetisieren.

KONKRETE SCHRITTE:

1. In sound.ts:
   - SoundType erweitern: HUSK_IDLE, HUSK_ALERT, SPITTER_IDLE, SPITTER_ALERT, LATCHER_IDLE, LATCHER_ALERT.
   - Pro Type eine prozedurale synth-Funktion analog zu den existierenden SFX.
     Vorgaben (im Plan):
       Husk idle: low growl, sawtooth 80-120 Hz, ~250 ms
       Husk alert: sharper rising tone, ~400 ms
       Spitter idle: wet clicking (kurze noise bursts, band-pass)
       Spitter alert: high chirp + click tail
       Latcher idle: skittering (rapid noise bursts)
       Latcher alert: high-pitch screech, ~200 ms
   - play(type, volume?) ergänzen (volume default 1; gain auf das Web-Audio-Node anwenden).
   - playAt(type, distance): Distance-attenuated Wrapper.
     Falloff: 1 / (1 + d * k) mit k so gewählt dass bei AI_AWARENESS_RADIUS Lautstärke ~0.4 ist.
     Bei distance > AI_AWARENESS_RADIUS * 1.5: volume = 0 (skip play).

2. In sprite.ts:
   - Sprite-Klasse: neues Feld idleSoundCooldown: number = (Math.random() * 3) + 3.

3. In enemy-ai.ts:
   - AIContext um soundManager: SoundManager erweitern.
   - In jedem per-enemy Tick:
     a) Wenn aiState === IDLE: idleSoundCooldown -= deltaTime.
        Wenn ≤ 0: per-class idle Sound via playAt(distance) abspielen,
        cooldown reset auf (Math.random() * 4) + 4.
     b) Bei Transition IDLE→ALERT oder IDLE→CHASE: per-class alert Sound via playAt(distance).
        (Existierende Transition-Points im handleGruntChase/handleShooterChase/handleLatcherChase finden.)
   - distance = Distanz Sprite ↔ player.

4. In renderer.ts aiCtx(): soundManager: this.soundManager ergänzen.

VERBOTEN:
- MP3-Samples / externe Assets / fetch.
- Existierende SFX-Parameter ändern.
- Sprite-Texturen oder AI-Konstanten anfassen.
- Tests anfassen.
- combat.ts / effects.ts / level-flow.ts / sprite-textures.ts berühren.

VERIFY (selbst ausführen und Ergebnis berichten):
- cd /mnt/d/Development/Sources/Fun/aiDoom/doom-browser && npm run build  → grün
- npm test 2>&1 | tail -20  → keine NEUEN Failures
- Berichte: welche SoundTypes hinzugefügt, welche Trigger-Stellen in enemy-ai.ts geändert,
  ob playAt() / play() interface stabil bleibt.
```

### Prompt for Task 2

```
KONTEXT: Lies boss-and-enemy-voices.md komplett. Task 1 ist committet.
Folge "Task 2 — Boss enemy class + sprite (placeholder behaviour)".

AUFGABE: Führe SpriteType.BOSS und EnemyClass.BOSS ein, generiere eine prozedurale
8-Richtungs-Boss-Sprite + Corpse, und implementiere placeholder Boss-Chase
(skalierte Husk-Logik). Boss spawnt NOCH NICHT in normalen Levels — nur via
temporärem Debug-Spawn in initializeSprites (für deinen Smoke-Test).

KONKRETE SCHRITTE:

1. sprite.ts:
   - SpriteType erweitern um BOSS.
   - EnemyClass erweitern um BOSS.
   - Konstanten (Modul-Level): AI_BOSS_SPEED=1.2, AI_BOSS_HP=30, AI_BOSS_ATTACK_RANGE=0.8,
     AI_BOSS_ATTACK_DAMAGE=25, AI_BOSS_ATTACK_COOLDOWN=1.5.
   - Sprite-Klasse: isBoss getter (sprite.enemyClass === EnemyClass.BOSS).

2. sprite-textures.ts:
   - bossAngleViews: Texture[][8][] (8 Richtungen × N Posen) — Aesthetic siehe Plan
     (HUSK_PLATE-Palette mit SPITTER_BIO_HOT-Akzenten, ~1.4× Husk-Größe, drei-eye Silhouette
     oder asymmetrische Masse, klar als Boss erkennbar).
   - bossCorpseTexture: große dunkle Corpse.
   - SpriteTextureSet um bossAngleViews ergänzen.

3. enemy-ai.ts:
   - handleBossChase(ctx, sprite, deltaTime) als non-exported Helfer:
     skalierte Husk-Chase mit AI_BOSS_SPEED/AI_BOSS_ATTACK_RANGE/AI_BOSS_ATTACK_DAMAGE/
     AI_BOSS_ATTACK_COOLDOWN.
   - updateEnemyAI: per-class switch auch für BOSS.
   - Hit-Flash-Color für BOSS in der Sprite-Render-Pipeline (renderer.ts): orange Tint
     (z. B. +200 R, +120 G, +30 B) — analog zu den existierenden per-class flashes.

4. level-flow.ts initializeSprites:
   - Neuer BOSS-Block analog zu HUSK/SPITTER/LATCHER, der über level.bosses iteriert.
   - Sprite-Setup: angleViews = spriteSet.bossAngleViews, corpseTexture = bossCorpseTexture,
     health = AI_BOSS_HP, enemyClass = EnemyClass.BOSS.

5. level-gen.ts:
   - Level-Type erweitern: bosses: Position[].
   - generateLevel: leere bosses Array für alle Stages (echte Population kommt in Task 4).

6. TEMPORÄR für deinen Smoke-Test:
   - In level-flow.ts initializeSprites, NACH den existierenden Blocks, EINE Zeile:
       if (level.stage === 1) { /* DEBUG: temp boss spawn */ … }
   - Vor dem Commit DIESEN Block wieder entfernen. Im Commit-Body erwähnen, dass
     das nur lokal getestet wurde und in Task 4 dauerhaft kommt.

VERBOTEN:
- Phasen / Volley / Rage einbauen (kommt in Task 3).
- Bio-Projektile / Spitter-Sound-Reuse.
- combat.ts / effects.ts anfassen außer Sprite-Render-Pipeline für Hit-Flash-Color.
- Tests / Balance bestehender Gegner.

VERIFY:
- npm run build, npm test grün
- Smoke-Test: Stage 1 spawnt einen Boss, Boss verfolgt mich, Boss stirbt nach mehreren
  Treffern, Corpse bleibt liegen, Hit-Flash ist orange erkennbar.
- Berichte: bossAngleViews-Posen-Anzahl, ob hit-flash visuell distinkt ist, welche
  Renderer-Stelle für den Boss-Hit-Flash geändert wurde.
```

### Prompt for Task 3

```
KONTEXT: Lies boss-and-enemy-voices.md komplett. Tasks 1+2 committet.
Folge "Task 3 — Boss phase state machine".

AUFGABE: Ersetze handleBossChase durch ein Drei-Phasen-Statemachine. HP-Schwellen
schalten Phasen one-shot um. Wiederverwende BioProjectile aus combat.ts für die
VOLLEY-Phase.

KONKRETE SCHRITTE:

1. sprite.ts:
   - export enum BossPhase { MELEE, VOLLEY, RAGE }
   - Sprite: bossPhase: BossPhase = BossPhase.MELEE; bossVolleyTimer = 0;
     bossRageActivated = false;
   - Konstanten: BOSS_VOLLEY_COOLDOWN = 2.0, BOSS_VOLLEY_FAN_DEG = 30,
     BOSS_RAGE_SPEED_MULTIPLIER = 2.0, BOSS_RAGE_DAMAGE_MULTIPLIER = 1.25.

2. enemy-ai.ts handleBossChase:
   - Phase 1 — MELEE (HP > 50%): existierende skalierte Husk-Chase aus Task 2.
   - Phase 2 — VOLLEY (HP 20-50%): bossVolleyTimer -= deltaTime; wenn ≤ 0:
     drei BioProjectile spawnen in 30° fan toward player; cooldown reset auf
     BOSS_VOLLEY_COOLDOWN. Boss bleibt während VOLLEY stationär (kein move).
     BioProjectile-Spawn-Source darf NICHT mit Spitter kollidieren (existierende
     Damage-Pipeline soll Boss-Projektile genauso behandeln wie Spitter-Projektile).
   - Phase 3 — RAGE (HP < 20%): wenn !bossRageActivated, latchen:
     bossRageActivated = true; speed *= BOSS_RAGE_SPEED_MULTIPLIER (effektiv);
     damage *= BOSS_RAGE_DAMAGE_MULTIPLIER. Verhalten wie MELEE aber schneller.
   - Transition-Checks: nur auf HP-Threshold crossings, nicht jeden Frame neu setzen.

3. AIContext erweitern um bioProjectiles: BioProjectile[] (war schon drin).

VERBOTEN:
- Neue Projektil-Typen / Sprite-Anpassungen.
- Texturen ändern.
- combat.ts Damage-Pipeline ändern.
- BioProjectile-Klasse ändern.
- Tests anfassen.

VERIFY:
- npm run build, npm test grün
- Smoke-Test (mit Debug-Spawn aus Task 2): Boss tanken, beobachten dass:
  > 50% HP: melee
  50-20% HP: Boss steht und feuert 3 bio-globs im Fan
  < 20% HP: Boss rennt sichtbar schneller und macht mehr Damage
- Berichte: HP-Threshold-Stellen, ob bossRageActivated wirklich nur einmal latcht,
  ob Volley-Projektile vom existierenden Render-Pass aufgesammelt werden.
```

### Prompt for Task 4

```
KONTEXT: Lies boss-and-enemy-voices.md komplett. Tasks 1-3 committet.
Folge "Task 4 — BOSS_STAGE + Win-Condition". Entferne den Debug-Spawn aus Task 2.

AUFGABE: BOSS_STAGE in level-gen.ts populieren, Boss in level-flow Sprite-Init
korrekt einbinden, Boss-Death triggert GameState.WIN.

KONKRETE SCHRITTE:

1. level-gen.ts:
   - export const BOSS_STAGE = 10;
   - In generateLevel: wenn stage === BOSS_STAGE:
     - enemies = [], shooters = [], latchers = []
     - bosses = [{ x, y }] — Position im größten Raum, möglichst weit vom spawn entfernt
     - ammo + health Pickups im Spawn-Raum (mind. 3 ammo + 2 health zusätzlich)
     - Keycards + Exit-Door bleiben wie sie sind (Boss-Level ist gültiges Level-Layout)

2. level-flow.ts initializeSprites:
   - Den TEMPORÄREN Debug-Spawn aus Task 2 ENTFERNEN.
   - Sicherstellen dass der BOSS-Block aus Task 2 weiterhin korrekt über
     level.bosses iteriert (also auch funktioniert wenn bosses leer ist).

3. enemy-ai.ts oder combat.ts (wo Death-Detection passiert):
   - Nach jeder Death-Transition (sprite alive → dying): prüfen ob aktive
     Bosses noch leben.
   - Wenn current stage === BOSS_STAGE UND keine alive Bosses mehr:
     gameStateManager.transitionTo(GameState.WIN).
   - Timing: WIN trigger NACH sprite.isDying = true, sodass Boss-Corpse beim
     Win-Screen sichtbar ist.

4. Optional polish: Win-Screen-Text aktualisieren auf "BOSS DEFEATED" in
   state.ts wenn straightforward. Wenn aufwendig → skip.

VERBOTEN:
- Boss-Sprite oder -AI ändern.
- Level-gen-Retry-Logik anfassen.
- Stages 1-9 Spawn-Verhalten ändern.
- Tests anfassen.

VERIFY:
- npm run build, npm test grün
- Smoke-Test:
  > Stages 1-9 spielen sich unverändert (zumindest Stage 1 + Stage 5 testen)
  > Stage 10: Boss-Level lädt, keine normalen Gegner, ein Boss
  > Boss killen → WIN-State, Game-Over-Screen
- Berichte: BOSS_STAGE-Wert, ob Win-Trigger-Stelle in enemy-ai oder combat,
  ob Boss-Corpse beim Win-Screen sichtbar bleibt.
```

## Wenn fertig

Plopp hat dann:
- Atmosphäre die Threats akustisch kommuniziert (kein blindes Eck-Damage)
- Ein klares Spielziel (Stage 10 schlagen)
- Boss-Encounter mit Phasen-Dramaturgie

Folge-Plans (separat, nicht hier): melee-fallback (Faust/Knuppel),
powerup-pickups (berserk/armor), minimap-marker. Siehe memory:
`project_gameplay_gaps.md`.
