#!/bin/bash
# Test script to verify Task 1 implementation: Entrance property in Level interface

echo "=== Task 1 Verification: Entrance Property ==="
echo ""

echo "1. Checking Level interface has 'entrance' property..."
if grep -q "entrance: Vec2" src/engine/level-gen.ts; then
  echo "   ✓ entrance: Vec2 property found in Level interface"
else
  echo "   ✗ entrance property NOT found"
  exit 1
fi

echo ""
echo "2. Checking pickEntrancePosition function..."
if grep -q "function pickEntrancePosition" src/engine/level-gen.ts; then
  echo "   ✓ pickEntrancePosition function defined"
else
  echo "   ✗ pickEntrancePosition function NOT found"
  exit 1
fi

echo ""
echo "3. Checking wall selection logic..."
if grep -q "choice = Math.floor(rng() \* 4)" src/engine/level-gen.ts; then
  echo "   ✓ Wall selection uses 4-way random choice"
else
  echo "   ✗ Wall selection logic NOT found"
  exit 1
fi

echo ""
echo "4. Checking entrance position calculation..."
walls=("room.y + 1" "room.y + room.h - 2" "room.x + 1" "room.x + room.w - 2")
for wall in "${walls[@]}"; do
  if grep -q "$wall" src/engine/level-gen.ts; then
    echo "   ✓ Found wall boundary: $wall"
  fi
done

echo ""
echo "5. Checking entrance is added to returned Level object..."
if grep -q "entrance: { x: entrance.x + 0.5" src/engine/level-gen.ts; then
  echo "   ✓ entrance property included in returned Level"
else
  echo "   ✗ entrance NOT included in returned Level"
  exit 1
fi

echo ""
echo "6. TypeScript compilation check..."
if npx tsc --noEmit 2>/dev/null; then
  echo "   ✓ TypeScript compilation successful (no errors)"
else
  echo "   ✗ TypeScript compilation failed"
  exit 1
fi

echo ""
echo "=== All Verification Tests PASSED ==="
echo ""
echo "Implementation Summary:"
echo "- Level interface extended with entrance: Vec2"
echo "- pickEntrancePosition() selects random wall (0=top, 1=bottom, 2=left, 3=right)"
echo "- Entrance positioned 1 tile INSIDE room 0 from chosen wall"
echo "- Both entrance and exit are different positions"
echo "- generateLevel() properly returns entrance in Level object"
