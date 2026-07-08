import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Player } from '../player';
import { createTestPlayer } from '../../__tests__/utils/fixtures';
import { worldState } from '../../engine/world';
import { PLAYER_RADIUS } from '../../engine/collision';

// --- Helpers: load maps into worldState for collision tests ---

function openMap(size: number = 20): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < size; y++) {
    map.push(new Array(size).fill(0));
  }
  return map;
}

function loadMap(map: number[][]): void {
  worldState.loadLevel({ map, width: map[0].length, height: map.length } as any);
}

beforeEach(() => {
  loadMap(openMap(20));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===================== rotate() =====================

describe('Player.rotate()', () => {
  it('rotates direction vector by 90 degrees', () => {
    const player = createTestPlayer(5, 5); // dirX=1, dirY=0
    player.rotate(Math.PI / 2);
    expect(player.dirX).toBeCloseTo(0, 5);
    expect(player.dirY).toBeCloseTo(1, 5);
  });

  it('rotates direction vector by 180 degrees', () => {
    const player = createTestPlayer(5, 5); // dirX=1, dirY=0
    player.rotate(Math.PI);
    expect(player.dirX).toBeCloseTo(-1, 5);
    expect(player.dirY).toBeCloseTo(0, 5);
  });

  it('rotates plane vector along with direction', () => {
    const player = createTestPlayer(5, 5); // planeX=0, planeY=0.66
    player.rotate(Math.PI / 2);
    expect(player.planeX).toBeCloseTo(-0.66, 5);
    expect(player.planeY).toBeCloseTo(0, 5);
  });

  it('zero-angle rotation changes nothing', () => {
    const player = createTestPlayer(5, 5);
    const dirXBefore = player.dirX;
    const dirYBefore = player.dirY;
    player.rotate(0);
    expect(player.dirX).toBe(dirXBefore);
    expect(player.dirY).toBe(dirYBefore);
  });
});

// ===================== move() =====================

describe('Player.move()', () => {
  it('moves forward in facing direction (open space)', () => {
    const player = createTestPlayer(5, 5); // facing +x
    player.move(1);
    expect(player.x).toBeCloseTo(6, 5);
    expect(player.y).toBeCloseTo(5, 5);
  });

  it('is blocked by a wall in front', () => {
    const map = openMap();
    map[5][3] = 1; // wall at tile (3, 5)
    loadMap(map);
    const player = createTestPlayer(2.5, 5.5); // facing +x
    player.move(0.6); // small step so target collides with wall tile
    expect(player.x).toBeLessThan(3);
    expect(player.x).toBeGreaterThan(2.5);
  });

  it('slides along wall when movement is diagonal', () => {
    const map = openMap();
    map[5][3] = 1; // wall at tile (3, 5)
    loadMap(map);
    const player = createTestPlayer(2.5, 5.5);
    player.rotate(Math.PI / 4); // face 45° (down-right)
    player.move(1);
    expect(player.x).toBeLessThan(3); // x blocked by wall
    expect(player.y).toBeGreaterThan(5.5); // y slid along wall
  });

  it('is blocked by enemy collision when moving toward enemy', () => {
    const enemy = { x: 5.7, y: 5, radius: PLAYER_RADIUS };
    const player = createTestPlayer(5, 5); // facing +x
    player.move(1);
    // first without enemy — moves freely
    expect(player.x).toBeCloseTo(6, 5);
    // now with enemy blocking
    const player2 = createTestPlayer(5, 5);
    player2.move(1, [enemy]);
    expect(player2.x).toBeLessThan(5.5); // blocked
  });

  it('allows movement away from enemy (escape)', () => {
    const enemy = { x: 6, y: 5, radius: PLAYER_RADIUS };
    const player = createTestPlayer(5, 5); // facing +x
    player.rotate(Math.PI); // face -x (away from enemy)
    player.move(1, [enemy]);
    expect(player.x).toBeCloseTo(4, 5);
  });

  it('scales movement proportionally with distance (delta-time scaling)', () => {
    const p1 = createTestPlayer(5, 5);
    p1.move(0.1);
    const p2 = createTestPlayer(5, 5);
    p2.move(0.2);
    expect(Math.abs(p2.x - 5)).toBeCloseTo(Math.abs(p1.x - 5) * 2, 1);
  });

  it('supports sprint-speed movement via larger distance', () => {
    const normal = createTestPlayer(5, 5);
    normal.move(0.5);
    const sprint = createTestPlayer(5, 5);
    sprint.move(1.0); // 2x speed
    expect(sprint.x - 5).toBeCloseTo((normal.x - 5) * 2, 1);
  });
});

// ===================== strafe() =====================

describe('Player.strafe()', () => {
  it('strafes perpendicular to facing direction', () => {
    const player = createTestPlayer(5, 5); // facing +x
    player.strafe(1);
    // strafe: strafeX = -dirY * distance = 0, strafeY = dirX * distance = 1
    expect(player.x).toBeCloseTo(5, 5);
    expect(player.y).toBeCloseTo(6, 5);
  });

  it('is blocked by wall when strafing into it', () => {
    const map = openMap();
    map[6][1] = 1; // wall at tile (1, 6)
    loadMap(map);
    const player = createTestPlayer(1.5, 5.5); // facing +x, strafe goes +y
    player.strafe(0.6); // small step so target collides with wall tile
    expect(player.y).toBeLessThan(6);
  });

  it('strafes correctly after rotation', () => {
    const player = createTestPlayer(5, 5); // facing +x
    player.rotate(Math.PI / 2); // now facing +y
    player.strafe(1);
    // After 90° rotation: dirX≈0, dirY≈1
    // strafeX = -dirY * 1 = -1, strafeY = dirX * 1 = 0
    expect(player.x).toBeCloseTo(4, 5);
    expect(player.y).toBeCloseTo(5, 5);
  });
});

// ===================== setPosition & getRadius =====================

describe('Player.setPosition() and getRadius()', () => {
  it('setPosition updates x and y', () => {
    const player = createTestPlayer(1, 1);
    player.setPosition(7.5, 3.5);
    expect(player.x).toBe(7.5);
    expect(player.y).toBe(3.5);
  });

  it('getRadius returns PLAYER_RADIUS', () => {
    const player = createTestPlayer(1, 1);
    expect(player.getRadius()).toBe(PLAYER_RADIUS);
  });
});
