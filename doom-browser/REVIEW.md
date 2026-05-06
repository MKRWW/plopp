# REVIEW — Weapon Switching Feature

## Findings to Fix

### 1. Minor: preventDefault() on wheel always fires
**Location:** `src/player/input.ts` setupWheel()
**Issue:** `e.preventDefault()` is called on every wheel event regardless of game state. Should only gate on PLAYING state.
**Fix:** Add a `isInPlayingState(): boolean` method or gate wheel events. Simplest fix: add a getter in InputHandler that checks game state, OR just check the inventory weapon count (if <= 1, skip). Best approach: the Renderer already only polls wheel flags during PLAYING — the real issue is only that preventDefault fires in menu. Since pointer lock is active during PLAYING, this is low risk but fix it: only call preventDefault + set flags when pointer is locked.

### 2. Minor: Wheel flags cannot accumulate multiple notches
**Location:** `src/player/input.ts` wheel flag design
**Issue:** Boolean flags can't handle rapid multi-notch scrolls.
**Fix:** Change `wheelDownFlag`/`wheelUpFlag` to small integer counters, capped at 1. Each wheel event increments, renderer decrements after consuming.

### 3. Suggestion: Add clarifying comment for TAB/wheel priority
**Location:** `src/engine/renderer.ts` game loop switch block
**Fix:** Add inline comment explaining priority order.

### 4. Suggestion: Wrap shadowBlur in save()/restore()
**Location:** `src/engine/renderer.ts` drawHUD() weapon flash section
**Fix:** Use `ctx.save()` before and `ctx.restore()` after drawing the flash.
