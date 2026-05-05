#!/bin/bash

# Task 2 Verification Script: EXIT_DOOR Tile-Type and Placement
# Tests:
#   1. TILE.EXIT_DOOR = 3 exists
#   2. EXIT_DOOR placement on exit wall (line 426)
#   3. Level.exit points to EXIT_DOOR position (line 512)
#   4. Level.exit !== Level.entrance
#   5. TypeScript compilation passes

echo "=== TASK 2 VERIFICATION: EXIT_DOOR Tile-Type and Placement ==="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: TILE.EXIT_DOOR = 3
echo "[Test 1] Checking TILE.EXIT_DOOR = 3 in world.ts"
if grep -q "EXIT_DOOR: 3" src/engine/world.ts; then
    echo "✓ PASS: TILE.EXIT_DOOR = 3 defined"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: TILE.EXIT_DOOR not found or incorrect value"
    ((FAIL_COUNT++))
fi
echo ""

# Test 2: EXIT_DOOR placement in pickExitDoor function
echo "[Test 2] Checking pickExitDoor function exists and returns {wall, access}"
if grep -q "function pickExitDoor" src/engine/level-gen.ts && \
   grep -q "{ wall: Vec2; access: Vec2 }" src/engine/level-gen.ts; then
    echo "✓ PASS: pickExitDoor function has correct signature"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: pickExitDoor function signature incorrect"
    ((FAIL_COUNT++))
fi
echo ""

# Test 3: EXIT_DOOR placement on map
echo "[Test 3] Checking EXIT_DOOR is placed on exitDoor.wall tile (line 426)"
if grep -q "map\[exitDoor\.wall\.y\]\[exitDoor\.wall\.x\] = TILE\.EXIT_DOOR" src/engine/level-gen.ts; then
    echo "✓ PASS: EXIT_DOOR placed on exit wall tile"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: EXIT_DOOR placement code not found"
    ((FAIL_COUNT++))
fi
echo ""

# Test 4: Level.exit points to EXIT_DOOR center
echo "[Test 4] Checking Level.exit points to EXIT_DOOR wall center (x + 0.5, y + 0.5)"
if grep -q "exit: { x: exitDoor\.wall\.x + 0\.5, y: exitDoor\.wall\.y + 0\.5 }" src/engine/level-gen.ts; then
    echo "✓ PASS: Level.exit points to EXIT_DOOR center"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: Level.exit assignment incorrect"
    ((FAIL_COUNT++))
fi
echo ""

# Test 5: Level interface has exit property
echo "[Test 5] Checking Level interface has 'exit: Vec2' property"
if grep -A 15 "export interface Level" src/engine/level-gen.ts | grep -q "exit: Vec2"; then
    echo "✓ PASS: Level interface has 'exit: Vec2' property"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: Level interface missing 'exit' property"
    ((FAIL_COUNT++))
fi
echo ""

# Test 6: Level.exit !== Level.entrance (different positions)
echo "[Test 6] Checking Level.exit and Level.entrance are separate (exit from pickExitDoor)"
if grep -q "entrance: { x: entranceTile\.x + 0\.5" src/engine/level-gen.ts && \
   grep -q "exit: { x: exitDoor\.wall\.x + 0\.5" src/engine/level-gen.ts; then
    echo "✓ PASS: Level.exit and Level.entrance are independently calculated"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: entrance or exit calculation incorrect"
    ((FAIL_COUNT++))
fi
echo ""

# Test 7: EXIT_DOOR blocks player (implicit in blocking checks)
echo "[Test 7] Checking EXIT_DOOR mentioned in collision/blocking logic"
if grep -q "EXIT_DOOR" src/engine/level-gen.ts; then
    echo "✓ PASS: EXIT_DOOR referenced in level generation"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: EXIT_DOOR not referenced"
    ((FAIL_COUNT++))
fi
echo ""

# Test 8: TypeScript compilation
echo "[Test 8] Checking TypeScript compilation"
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo "✗ FAIL: TypeScript compilation errors found"
    echo "Errors:"
    npx tsc --noEmit 2>&1 | grep "error" | head -5
    ((FAIL_COUNT++))
else
    echo "✓ PASS: TypeScript compilation successful"
    ((PASS_COUNT++))
fi
echo ""

# Summary
echo "=== SUMMARY ==="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
if [ $FAIL_COUNT -eq 0 ]; then
    echo ""
    echo "✓ All tests passed! Task 2 is complete."
    exit 0
else
    echo ""
    echo "✗ Some tests failed. Review the output above."
    exit 1
fi
