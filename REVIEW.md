# REVIEW - Fix Black Screen Crash

## Problem
Nach dem letzten Commit (41089fb "added new level and more complexity") crasht das Spiel komplett → schwarzer Bildschrim im Browser. Build (vite) geht durch, aber Runtime crasht.

## Root Cause: Zwei Runtime-Fehler

### Bug 1: level-gen.ts Zeile 880 - Undefined Variable ReferenceError
**Datei:** `doom-browser/src/engine/level-gen.ts`
**Zeile:** 880
**Problem:** `exitRooms` wird im Return-Object referenziert, aber die Variable heißt `exitRoomIndices`.

```typescript
// Zeile 878-880:
return {
  spawnRooms: spawnRoomIndices,
  exits,
  exitRooms,  // ← CRASH: Variable 'exitRooms' ist nicht definiert! Soll 'exitRoomIndices' sein.
```

**Fix:** `exitRooms` → `exitRoomIndices`

Dieser Bug verhindert komplettes Level-Generieren → main.ts crasht sofort bei `generateLevel()` → schwarzer Screen.

### Bug 2: renderer.ts Zeile 1008 - Wrong Argument Count
**Datei:** `doom-browser/src/engine/renderer.ts`
**Zeile:** 1008
**Problem:** `interactAt()` wird mit 3 Argumenten aufgerufen, aber die Signatur in world.ts Zeile 139 erwartet 4.

```typescript
// world.ts Zeile 139 - Signatur:
interactAt(x: number, y: number, hasYellowKeycard: boolean, hasBlueKeycard: boolean): InteractionResult

// renderer.ts Zeile 1008 - Fehlerhafter Aufruf:
const result = worldState.interactAt(mapX, mapY, this.hasKeycard);  // ← Nur 3 Args!
```

**Fix:** Passe den Aufruf an die neue Signatur an. Prüfe, ob `this.hasKeycard` noch existiert oder ob es jetzt zwei separate Methoden/Properties gibt (`hasYellowKeycard`, `hasBlueKeycard`). Renderer muss beide Keycard-States an `interactAt()` übergeben.

## Context
- Commit 41089fb eingeführt
- level-gen.ts komplett rewritten (dual keycard progression: yellow + blue)
- world.ts `interactAt()` Signatur erweitert (hat jetzt yellowKeycard + blueKeycard Parameter)
- Renderer wurde nicht angepasst → veraltet

## Tasks für Qwen
1. Fix `exitRooms` → `exitRoomIndices` in level-gen.ts Zeile 880
2. Fix `interactAt()` Aufruf in renderer.ts Zeile 1008: passe an neue 4-Arg Signatur an (hasYellowKeycard, hasBlueKeycard)
3. Prüfe, ob `this.hasKeycard` im Renderer noch existiert oder ob es jetzt separate `hasYellowKeycard`/`hasBlueKeycard` Properties sein müssen
4. Teste build + dev-server nach Fix
