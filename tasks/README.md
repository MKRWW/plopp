# Delegated increments

Tracker for the delegate flow (PO = Markus, architect+reviewer = Claude,
coder = local hermes/qwen3.6 in WSL). One row per increment.

| # | Increment | Branch | Status | Notes |
|---|-----------|--------|--------|-------|
| 01 | Fist melee fallback weapon | `wip/melee-fist` | ✅ reviewed, awaiting human merge | Dedicated key **V**, ∞ ammo, 1.3-tile range, long cooldown, excluded from TAB/wheel cycle. Coder: qwen3.6. Reviewer also fixed a pre-existing infinite-loop in `weapons.test.ts` that was hanging the whole suite. Gate: `npm run build` clean; `weapons.test.ts` + `combat.test.ts` green (42 + 3). Pre-existing failures unchanged (15 flaky level-gen, 1 stale dup level-gen file, 3 rocket-projectile). |
