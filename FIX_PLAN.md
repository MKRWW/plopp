## Fix Plan

**1. src/__tests__/utils/fixtures.ts:11-12 — Import path depth**
- Fix: Change `'../player/player'` → `'../../player/player'` and `'../engine/sprite'` → `'../../engine/sprite'`
- Verify: `npm test` runs without import resolution errors

**2. src/__tests__/utils/fixtures.ts:16 — Circular require**
- Fix: Remove `require('./fixtures')` inside `createTestSprites()` function
- Verify: No circular dependency errors; `createTestSprites()` can be called in tests

**3. src/__tests__/utils/mocks.ts:140 — Parameter syntax error**
- Fix: Change `y: 3` to `y: number = 3`
- Verify: File passes TypeScript compilation without errors

**4. src/__tests__/utils/setup.ts:16,19 — Duplicate createGain() method**
- Fix: Keep only one `createGain()` definition; remove the duplicate on line 19
- Verify: AudioContext mock has single `createGain()` method; tests pass
