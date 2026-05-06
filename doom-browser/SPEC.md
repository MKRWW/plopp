# SPEC: Random Background Music Track Rotation

## 0. Existing Code Baseline

| File | Relevant Content |
|---|---|
| `src/audio/sound.ts` | `SoundManager` class; `initMusic()` sets `musicAudio.loop = true` (line 78); `ended` listener calls `playNextTrack()` (lines 83-85); `playNextTrack()` picks random non-repeating track and plays if `musicPlaying` is true (lines 104-116); `startMusic()` sets `musicPlaying = true` and calls `.play()` (lines 121-127) |
| `src/__tests__/utils/mocks.ts` | `MockSoundManager` with stub impl for `init`, `play`, `startMusic`, `stopMusic`, etc. |
| `src/engine/renderer.ts` | Creates `SoundManager` (line 155), calls `soundManager.startMusic()` at game start (line 2116) |
| `package.json` | TypeScript + Vite; `npm run build`, `npm test` (vitest) |

## 1. Feature Summary

The game currently plays a single random background music track on infinite loop for the entire session. The existing `ended` event handler and `playNextTrack()` method are already wired but never trigger because `loop = true`. Removing the infinite loop enables the 12 music tracks to rotate randomly during gameplay, improving audio variety without repeating the same track back-to-back.

## 2. Scope

**In scope**:
- Remove `musicAudio.loop = true` in `initMusic()` so tracks play once
- Verify existing `ended` → `playNextTrack()` chain works correctly without modification

**Out of scope**:
- Adding new music tracks or audio files
- Cross-fading between tracks
- Music pausing/resuming on game pause
- Changes to procedural sound effects (SFX are unaffected)
- UI volume controls or music menu

## 3. Technical Context

- **Language & runtime**: TypeScript 5.4, browser environment (Chrome/Firefox/Safari)
- **Framework**: Vite 5.4, Vitest 4.1.5 (jsdom)
- **Build command**: `npm run build`
- **Test command**: `npm test`
- **Existing modules**: `src/audio/sound.ts` (SoundManager), `src/engine/renderer.ts` (consumer)
- **Architectural constraints**: No external dependencies; all audio via Web Audio API or `HTMLAudioElement`
- **Dependencies**: None added

## 4. Interfaces & Contracts

No new interfaces. Two existing private methods whose behavior is affected (no signature changes):

```typescript
// src/audio/sound.ts — existing, no signature change
class SoundManager {
  private initMusic(): void;
  private playNextTrack(): void;
}
```

## 5. Tasks

---
**Task 1 – Disable infinite loop on music playback**

**Goal**: Remove the `loop = true` assignment so that each track plays once and the `ended` event fires.

**Input files**: `src/audio/sound.ts`

**Output files**: `src/audio/sound.ts` (modified)

**Instructions**:
1. In `src/audio/sound.ts`, in the `initMusic()` method, remove the line `this.musicAudio.loop = true;` (currently line 78).
2. Delete the now-stale comment above it: `// Wenn Track zu Ende (sollte nicht passieren wegen loop, aber als Fallback)` (line 82).
3. Replace it with this updated comment: `// When track ends, queue the next random track`.
4. Do not modify `playNextTrack()`, `startMusic()`, `loadTrack()`, or any other method.

**Done when**: `npm run build` succeeds with no type errors; the `musicAudio.loop` property is no longer assigned in `initMusic()`.

---

## 6. Integration Points

No integration changes required. The `ended` → `playNextTrack()` listener was already registered in `initMusic()`. The only behavioral change is that the `ended` event now fires naturally when each track completes, triggering existing rotation logic.

## 7. Acceptance Criteria

1. `musicAudio.loop` is NOT set to `true` anywhere in `src/audio/sound.ts`.
2. The `ended` event listener on `musicAudio` remains registered in `initMusic()`.
3. `playNextTrack()` still selects a random index ≠ `currentTrackIndex` when `MUSIC_FILES.length > 1`.
4. `playNextTrack()` still calls `this.musicAudio.play()` when `musicPlaying` is `true`.
5. `npm run build` passes with zero errors.

## 8. Test Requirements

No new test file required. The existing `MockSoundManager` in `src/__tests__/utils/mocks.ts` does not use `HTMLAudioElement` and is unaffected.

## 9. Assumptions & Decisions

| # | Assumption | Rationale |
|---|---|---|
| 1 | The `ended` → `playNextTrack()` chain is functionally correct as-is | Code review confirms the existing code is correct. |
| 2 | No cross-fade is needed between tracks | The feature description does not mention it. |
| 3 | `musicAudio` is a singleton per `SoundManager` instance | Confirmed by code. |
| 4 | Browser autoplay policy is handled by existing `.catch(() => {})` | The current `startMusic()` already silently swallows autoplay rejection. |
