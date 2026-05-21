import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasLineOfSight } from '../collision';
import { worldState, TILE } from '../world';

let originalIsSolidTile: typeof worldState.isSolidTile;

beforeEach(() => {
  originalIsSolidTile = worldState.isSolidTile.bind(worldState);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Build a grid of floor tiles, optionally placing walls at given coords
function mockSolidTile(
  wallCoords: Set<string>,
  mapW: number,
  mapH: number
): void {
  vi.spyOn(worldState, 'isSolidTile').mockImplementation((x: number, y: number) => {
    if (x < 0 || y < 0 || x >= mapW || y >= mapH) return true;
    return wallCoords.has(`${x},${y}`);
  });
}

describe('hasLineOfSight', () => {
  it('same position returns true (distance zero)', () => {
    mockSolidTile(new Set(), 10, 10);
    expect(hasLineOfSight(5, 5, 5, 5)).toBe(true);
  });

  it('adjacent tiles with no wall returns true', () => {
    mockSolidTile(new Set(), 10, 10);
    expect(hasLineOfSight(5, 5, 6, 5)).toBe(true);
  });

  it('wall between source and target returns false', () => {
    // Wall at tile (5,5) — blocks ray from (4,5) to (6,5)
    mockSolidTile(new Set(['5,5']), 10, 10);
    expect(hasLineOfSight(4, 5, 6, 5)).toBe(false);
  });

  it('L-shaped path with wall blocking direct line', () => {
    // Wall at (6,4) blocks direct line from (4,4) to (7,4)
    mockSolidTile(new Set(['6,4']), 10, 10);
    expect(hasLineOfSight(4, 4, 7, 4)).toBe(false);
  });

  it('long distance with no obstacles returns true', () => {
    mockSolidTile(new Set(), 20, 20);
    expect(hasLineOfSight(2, 2, 17, 17)).toBe(true);
  });

  it('out of bounds target returns false', () => {
    mockSolidTile(new Set(), 10, 10);
    expect(hasLineOfSight(5, 5, 15, 15)).toBe(false);
  });

  it('axis-aligned ray with wall blocks LOS', () => {
    mockSolidTile(new Set(['4,5']), 10, 10);
    expect(hasLineOfSight(2, 5, 6, 5)).toBe(false);
  });

  it('axis-aligned ray without wall has LOS', () => {
    mockSolidTile(new Set(), 10, 10);
    expect(hasLineOfSight(2, 5, 7, 5)).toBe(true);
  });

  it('diagonal ray with wall on path blocks LOS', () => {
    // Ray from (2,2) to (8,8); wall at (5,5) should block
    mockSolidTile(new Set(['5,5']), 10, 10);
    expect(hasLineOfSight(2, 2, 8, 8)).toBe(false);
  });

  it('diagonal ray around wall returns true', () => {
    // Wall far from the ray path — should not block
    mockSolidTile(new Set(['8,2']), 10, 10);
    expect(hasLineOfSight(2, 2, 8, 8)).toBe(true);
  });
});
