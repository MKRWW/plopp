/**
 * Placement functions for the level generator: doors, keycards, decor, items.
 */
import { TILE } from './world';
import { SpriteType } from './sprite';
import {
  type Vec2,
  type Room,
  type DecorType,
  type DecorPlacement,
  roomCenter,
  pointInRoom,
  bfsReachable,
  isReachable,
  shuffle,
} from './level-gen-utils';

export const DECOR_TYPES: DecorType[] = [
  SpriteType.BARREL,
  SpriteType.TERMINAL,
  SpriteType.LAMP,
  SpriteType.DEBRIS,
];

/**
 * Pick an entrance position on a room's perimeter. Returns a position 1 tile
 * inside from a randomly chosen wall edge.
 */
export function pickEntrancePosition(room: Room, rng: () => number): Vec2 {
  const choice = Math.floor(rng() * 4);
  switch (choice) {
    case 0:
      return { x: room.x + Math.floor(rng() * room.w), y: room.y + 1 };
    case 1:
      return { x: room.x + Math.floor(rng() * room.w), y: room.y + room.h - 2 };
    case 2:
      return { x: room.x + 1, y: room.y + Math.floor(rng() * room.h) };
    case 3:
      return { x: room.x + room.w - 2, y: room.y + Math.floor(rng() * room.h) };
    default:
      return { x: room.x, y: room.y };
  }
}

/**
 * Pick a wall tile on the room perimeter that is currently WALL_STONE
 * (i.e. uncarved by any corridor). Returns both wall tile and inside floor tile.
 */
export function pickExitDoor(
  map: number[][],
  room: Room,
  roomIdx: number,
  rng: () => number
): { wall: Vec2; access: Vec2; roomIdx: number } | null {
  type Cand = { wall: Vec2; access: Vec2; roomIdx: number };
  const cands: Cand[] = [];
  const h = map.length, w = map[0].length;
  const tryAdd = (wx: number, wy: number, ax: number, ay: number) => {
    if (wx < 0 || wy < 0 || wx >= w || wy >= h) return;
    if (map[wy][wx] !== TILE.WALL_STONE) return;
    if (map[ay][ax] !== TILE.FLOOR) return;
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = wx + dx, ny = wy + dy;
      if (nx === ax && ny === ay) continue;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (map[ny][nx] !== TILE.WALL_STONE) return;
    }
    cands.push({ wall: { x: wx, y: wy }, access: { x: ax, y: ay }, roomIdx });
  };

  for (let x = room.x; x < room.x + room.w; x++) {
    tryAdd(x, room.y - 1, x, room.y);
    tryAdd(x, room.y + room.h, x, room.y + room.h - 1);
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    tryAdd(room.x - 1, y, room.x, y);
    tryAdd(room.x + room.w, y, room.x + room.w - 1, y);
  }

  if (cands.length === 0) return null;
  return cands[Math.floor(rng() * cands.length)];
}

/**
 * Find corridor cells (floor cells NOT inside any room).
 */
export function getCorridorCells(map: number[][], rooms: Room[]): Vec2[] {
  const h = map.length, w = map[0].length;
  const cells: Vec2[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map[y][x] !== TILE.FLOOR) continue;
      if (rooms.some(r => pointInRoom(x, y, r))) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Place a YELLOW_KEY_DOOR on a corridor cell between spawn area and the
 * blueKeyCandidateRoom. Must be a true chokepoint: removing it disconnects
 * blueKeyCandidateRoom from spawn when yellow door is blocked.
 */
export function placeYellowDoor(
  map: number[][],
  spawn: Vec2,
  blueKeyCandidateRoom: Room,
  rooms: Room[],
  rng: () => number
): Vec2 | null {
  const corridorCells = getCorridorCells(map, rooms);
  shuffle(corridorCells, rng);
  const targetCenter = roomCenter(blueKeyCandidateRoom);

  for (const c of corridorCells) {
    map[c.y][c.x] = TILE.YELLOW_KEY_DOOR;
    const noYellow = bfsReachable(map, spawn, new Set());
    const withYellow = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));
    const isChoke =
      !isReachable(noYellow, targetCenter) && isReachable(withYellow, targetCenter);
    if (isChoke) return c;
    map[c.y][c.x] = TILE.FLOOR;
  }
  return null;
}

/**
 * Find a BLUE_KEY_DOOR corridor cell between the blue keycard room and the
 * exit access cells. Must be a true chokepoint: removing it disconnects
 * ALL exit access cells from spawn when blue door is blocked (even with
 * yellow door open).
 *
 * @param exitAccessCells array of floor cells inside exit rooms that lead to exit doors
 */
export function placeBlueDoor(
  map: number[][],
  spawn: Vec2,
  exitAccessCells: Vec2[],
  rooms: Room[],
  rng: () => number
): Vec2 | null {
  const corridorCells = getCorridorCells(map, rooms);
  shuffle(corridorCells, rng);

  for (const c of corridorCells) {
    map[c.y][c.x] = TILE.BLUE_KEY_DOOR;
    // With both doors open, all exit access cells must be reachable
    const withBoth = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR, TILE.BLUE_KEY_DOOR]));
    // With only yellow door open, ALL exit access cells must be unreachable
    const noBlue = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));

    let allBlocked = true;
    let allReachableWithBoth = true;
    for (const ea of exitAccessCells) {
      if (isReachable(noBlue, ea)) { allBlocked = false; break; }
      if (!isReachable(withBoth, ea)) { allReachableWithBoth = false; break; }
    }
    if (allBlocked && allReachableWithBoth) return c;
    map[c.y][c.x] = TILE.FLOOR;
  }
  return null;
}

/**
 * Pick a room from candidates using a weighted random selection biased toward
 * greater Manhattan distance from reference point.
 */
export function weightedRandomByDistance(
  candidates: Array<{ room: Room; distance: number }>,
  rng: () => number
): { room: Room; distance: number } | null {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((sum, c) => sum + c.distance, 0);
  if (totalWeight === 0) {
    return candidates[Math.floor(rng() * candidates.length)];
  }
  let threshold = rng() * totalWeight;
  for (const c of candidates) {
    threshold -= c.distance;
    if (threshold <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

/**
 * Inverse-weighted: rooms closer to reference get higher weight.
 */
export function weightedRandomByProximity(
  candidates: Array<{ room: Room; distance: number }>,
  maxDist: number,
  rng: () => number
): { room: Room; distance: number } | null {
  if (candidates.length === 0) return null;
  const maxW = maxDist + 1;
  const weighted = candidates.map(c => ({
    room: c.room,
    distance: c.distance,
    weight: Math.max(1, maxW - c.distance),
  }));
  const totalWeight = weighted.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return candidates[Math.floor(rng() * candidates.length)];
  let threshold = rng() * totalWeight;
  for (const c of weighted) {
    threshold -= c.weight;
    if (threshold <= 0) return { room: c.room, distance: c.distance };
  }
  const last = candidates[candidates.length - 1];
  return { room: last.room, distance: last.distance };
}

/**
 * Pick a floor tile in one of the four corners of the room.
 */
export function pickCornerTile(
  room: Room,
  map: number[][],
  rng: () => number,
  used: Set<string>
): Vec2 {
  const corners: [number, number][] = [
    [room.x + 1, room.y + 1],
    [room.x + room.w - 2, room.y + 1],
    [room.x + 1, room.y + room.h - 2],
    [room.x + room.w - 2, room.y + room.h - 2],
  ];

  const validTiles: Vec2[] = [];
  for (const [cx, cy] of corners) {
    const offsets = [
      [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1],
    ];
    for (const [dx, dy] of offsets) {
      const tx = cx + dx, ty = cy + dy;
      if (tx < room.x || tx >= room.x + room.w || ty < room.y || ty >= room.y + room.h) continue;
      if (map[ty][tx] !== TILE.FLOOR) continue;
      const key = `${tx},${ty}`;
      if (used.has(key)) continue;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
      let adjWall = false;
      for (const [ddx, ddy] of dirs) {
        const nx = tx + ddx, ny = ty + ddy;
        if (nx < 0 || ny < 0 || nx >= map[0].length || ny >= map.length) { adjWall = true; break; }
        if (map[ny][nx] !== TILE.FLOOR) { adjWall = true; break; }
      }
      if (!adjWall) continue;
      validTiles.push({ x: tx, y: ty });
    }
  }

  if (validTiles.length === 0) {
    const center = roomCenter(room);
    used.add(`${center.x},${center.y}`);
    return center;
  }

  const pick = validTiles[Math.floor(rng() * validTiles.length)];
  used.add(`${pick.x},${pick.y}`);
  return pick;
}

/**
 * Find a free floor tile adjacent (within Chebyshev distance 2) to the
 * reference tile, within the same room, not yet used.
 */
export function placeCoverDecor(
  room: Room,
  map: number[][],
  refTile: Vec2,
  rng: () => number,
  used: Set<string>
): Vec2 | null {
  const neighbors: Vec2[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = refTile.x + dx, ny = refTile.y + dy;
      if (nx < room.x || nx >= room.x + room.w || ny < room.y || ny >= room.y + room.h) continue;
      if (map[ny][nx] !== TILE.FLOOR) continue;
      if (used.has(`${nx},${ny}`)) continue;
      neighbors.push({ x: nx, y: ny });
    }
  }
  if (neighbors.length === 0) return null;
  const pick = neighbors[Math.floor(rng() * neighbors.length)];
  used.add(`${pick.x},${pick.y}`);
  return pick;
}

/**
 * Try to embed a 1x1 secret pocket behind a SECRET_WALL.
 */
export function placeSecretRoom(
  map: number[][],
  rooms: Room[],
  rng: () => number,
  forbidden: Set<string>
): Vec2 | null {
  const h = map.length, w = map[0].length;
  const candidates: Array<{ wallX: number; wallY: number; pocketX: number; pocketY: number }> = [];
  for (const r of rooms) {
    const tryAdd = (wx: number, wy: number, px: number, py: number) => {
      if (wx <= 0 || wy <= 0 || wx >= w - 1 || wy >= h - 1) return;
      if (px <= 0 || py <= 0 || px >= w - 1 || py >= h - 1) return;
      if (map[wy][wx] !== TILE.WALL_STONE) return;
      if (map[py][px] !== TILE.WALL_STONE) return;
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = px + dx, ny = py + dy;
        if (nx === wx && ny === wy) continue;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (map[ny][nx] !== TILE.WALL_STONE) return;
      }
      if (forbidden.has(`${wx},${wy}`) || forbidden.has(`${px},${py}`)) return;
      candidates.push({ wallX: wx, wallY: wy, pocketX: px, pocketY: py });
    };
    for (let x = r.x; x < r.x + r.w; x++) {
      tryAdd(x, r.y - 1, x, r.y - 2);
      tryAdd(x, r.y + r.h, x, r.y + r.h + 1);
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      tryAdd(r.x - 1, y, r.x - 2, y);
      tryAdd(r.x + r.w, y, r.x + r.w + 1, y);
    }
  }
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(rng() * candidates.length)];
  map[pick.wallY][pick.wallX] = TILE.SECRET_WALL;
  map[pick.pocketY][pick.pocketX] = TILE.FLOOR;
  return { x: pick.pocketX + 0.5, y: pick.pocketY + 0.5 };
}

/**
 * Pick a random floor tile inside a room, avoiding used tile coords.
 */
export function randomFloorInRoom(
  room: Room,
  rng: () => number,
  used: Set<string>
): Vec2 | null {
  const free: Vec2[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const key = `${x},${y}`;
      if (used.has(key)) continue;
      free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const pick = free[Math.floor(rng() * free.length)];
  used.add(`${pick.x},${pick.y}`);
  return pick;
}

/** Choose initial player facing: away from the nearest wall in the spawn room. */
export function spawnFacing(spawnRoom: Room, spawn: Vec2): { dirX: number; dirY: number } {
  const distLeft = spawn.x - spawnRoom.x;
  const distRight = (spawnRoom.x + spawnRoom.w - 1) - spawn.x;
  const distUp = spawn.y - spawnRoom.y;
  const distDown = (spawnRoom.y + spawnRoom.h - 1) - spawn.y;
  const max = Math.max(distLeft, distRight, distUp, distDown);
  if (max === distRight) return { dirX: 1, dirY: 0 };
  if (max === distLeft) return { dirX: -1, dirY: 0 };
  if (max === distDown) return { dirX: 0, dirY: 1 };
  return { dirX: 0, dirY: -1 };
}

/**
 * Place items in a set of rooms, avoiding rooms whose indices are in excludeSet.
 * Each item is placed in a random floor tile of a randomly chosen eligible room.
 */
export function placeItemsInRooms(
  _map: number[][],
  rooms: Room[],
  excludeIndices: Set<number>,
  count: number,
  rng: () => number,
  used: Set<string>
): Vec2[] {
  const eligible = rooms.filter((_, i) => !excludeIndices.has(i));
  if (eligible.length === 0) return [];
  const result: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const room = eligible[Math.floor(rng() * eligible.length)];
    const tile = randomFloorInRoom(room, rng, used);
    if (!tile) continue;
    result.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
  }
  return result;
}

/**
 * Place decor items in a set of rooms.
 */
export function placeDecorInRooms(
  _map: number[][],
  rooms: Room[],
  excludeIndices: Set<number>,
  count: number,
  rng: () => number,
  used: Set<string>
): DecorPlacement[] {
  const eligible = rooms.filter((_, i) => !excludeIndices.has(i));
  if (eligible.length === 0) return [];
  const result: DecorPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const room = eligible[Math.floor(rng() * eligible.length)];
    const tile = randomFloorInRoom(room, rng, used);
    if (!tile) continue;
    const type = DECOR_TYPES[Math.floor(rng() * DECOR_TYPES.length)];
    result.push({ x: tile.x + 0.5, y: tile.y + 0.5, type });
  }
  return result;
}
