/**
 * Procedural level generator: rooms-and-corridors with dual keycard progression.
 *
 * Pipeline per level:
 *   1. Place N non-overlapping rectangular rooms on a large (32-50x32-50) grid.
 *   2. Identify spawn rooms (2-3 near top-left) and exit rooms (2-3 farthest).
 *   3. Connect sequentially with L-corridors, then add cross-corridors.
 *   4. Place exit doors on each exit room perimeter.
 *   5. Place YELLOW_KEY_DOOR as chokepoint between spawn cluster and blue key zone.
 *   6. Place BLUE_KEY_DOOR as chokepoint between blue key zone and exit rooms.
 *   7. Place yellow keycard reachable WITHOUT any key door.
 *   8. Place blue keycard reachable only after yellow door is open.
 *   9. Scatter enemies, ammo, health, decor (excluding spawn/exit rooms).
 *   10. Validate reachability; retry on failure.
 */
import { TILE } from './world';
import { SpriteType } from './sprite';

export type DecorType =
  | SpriteType.BARREL
  | SpriteType.TERMINAL
  | SpriteType.LAMP
  | SpriteType.DEBRIS;

export interface Vec2 { x: number; y: number; }
export interface DecorPlacement { x: number; y: number; type: DecorType; }

export interface Level {
  stage: number;
  seed: number;
  width: number;
  height: number;
  map: number[][];
  spawn: { x: number; y: number; dirX: number; dirY: number };
  entrance: Vec2;
  /** Room indices forming the entrance cluster (2-3 rooms near each other). */
  spawnRooms: number[];
  /** Exit door positions — one per exit room. */
  exits: Vec2[];
  /** Room indices of the exit rooms (2-3 rooms in farthest corners). */
  exitRooms: number[];
  /** Kept for backwards compatibility: points to exits[0]. */
  exit: Vec2;
  /** New: Yellow keycard position (reachable from spawn without any keycard). */
  yellowKeycard: Vec2;
  /** Blue keycard position (reachable only after opening yellow key door). */
  blueKeycard: Vec2;
  /** Kept for backwards compatibility: points to blueKeycard. */
  keycard: Vec2;
  enemies: Vec2[];
  shooters: Vec2[];
  latchers: Vec2[];
  bosses: Vec2[];
  ammo: Vec2[];
  health: Vec2[];
  secretHealth: Vec2 | null;
  decor: DecorPlacement[];
  shotguns: Vec2[];
  rocketLaunchers: Vec2[];
  /** Exposed Room data for validation/debugging. Array of {x, y, w, h}. */
  rooms: Array<{ x: number; y: number; w: number; h: number }>;
}

interface Room { x: number; y: number; w: number; h: number; }

/** Mulberry32: small, fast, seedable PRNG. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function newGrid(w: number, h: number, fill: number): number[][] {
  const g: number[][] = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array<number>(w).fill(fill);
  return g;
}

function newBoolGrid(w: number, h: number): boolean[][] {
  const g: boolean[][] = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array<boolean>(w).fill(false);
  return g;
}

function roomCenter(r: Room): Vec2 {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function roomsOverlap(a: Room, b: Room, margin: number): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

function pointInRoom(x: number, y: number, r: Room): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

function carveRoom(map: number[][], r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      map[y][x] = TILE.FLOOR;
    }
  }
}

function carveCorridor(map: number[][], a: Vec2, b: Vec2, rng: () => number): void {
  if (rng() < 0.5) {
    carveH(map, a.x, b.x, a.y);
    carveV(map, a.y, b.y, b.x);
  } else {
    carveV(map, a.y, b.y, a.x);
    carveH(map, a.x, b.x, b.y);
  }
}

function carveH(map: number[][], x1: number, x2: number, y: number): void {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  for (let x = lo; x <= hi; x++) {
    if (map[y][x] === TILE.WALL_STONE) map[y][x] = TILE.FLOOR;
  }
}

function carveV(map: number[][], y1: number, y2: number, x: number): void {
  const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
  for (let y = lo; y <= hi; y++) {
    if (map[y][x] === TILE.WALL_STONE) map[y][x] = TILE.FLOOR;
  }
}

/**
 * BFS reachability from `start`. Tiles in `passableExtras` are passable in addition
 * to FLOOR. All other non-floor tiles (walls, EXIT_DOOR, doors not listed) block.
 */
function bfsReachable(map: number[][], start: Vec2, passableExtras: Set<number>): boolean[][] {
  const h = map.length, w = map[0].length;
  const reachable = newBoolGrid(w, h);
  const isPassable = (t: number) => t === TILE.FLOOR || passableExtras.has(t);
  if (start.x < 0 || start.y < 0 || start.x >= w || start.y >= h) return reachable;
  if (!isPassable(map[start.y][start.x])) return reachable;

  const queue: Vec2[] = [{ x: start.x, y: start.y }];
  reachable[start.y][start.x] = true;
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (reachable[ny][nx]) continue;
      if (!isPassable(map[ny][nx])) continue;
      reachable[ny][nx] = true;
      queue.push({ x: nx, y: ny });
    }
  }
  return reachable;
}

/**
 * Check if a cell is reachable from start given the reachable grid.
 */
function isReachable(reachable: boolean[][], target: Vec2): boolean {
  const w = reachable[0].length, h = reachable.length;
  if (target.x < 0 || target.y < 0 || target.x >= w || target.y >= h) return false;
  return reachable[target.y][target.x];
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Pick an entrance position on a room's perimeter. Returns a position 1 tile
 * inside from a randomly chosen wall edge.
 */
function pickEntrancePosition(room: Room, rng: () => number): Vec2 {
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
function pickExitDoor(
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
function getCorridorCells(map: number[][], rooms: Room[]): Vec2[] {
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
function placeYellowDoor(
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
function placeBlueDoor(
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
function weightedRandomByDistance(
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
function weightedRandomByProximity(
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
function pickCornerTile(
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
function placeCoverDecor(
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
function placeSecretRoom(
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
function randomFloorInRoom(
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

const DECOR_TYPES: DecorType[] = [
  SpriteType.BARREL,
  SpriteType.TERMINAL,
  SpriteType.LAMP,
  SpriteType.DEBRIS,
];

/** Choose initial player facing: away from the nearest wall in the spawn room. */
function spawnFacing(spawnRoom: Room, spawn: Vec2): { dirX: number; dirY: number } {
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
 * Compute the centroid of a set of Vec2.
 */
function centroid(positions: Vec2[]): Vec2 {
  if (positions.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of positions) { sx += p.x; sy += p.y; }
  return { x: sx / positions.length, y: sy / positions.length };
}

/**
 * Place items in a set of rooms, avoiding rooms whose indices are in excludeSet.
 * Each item is placed in a random floor tile of a randomly chosen eligible room.
 */
function placeItemsInRooms(
  map: number[][],
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
function placeDecorInRooms(
  map: number[][],
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

/**
 * Generate a level for `stage` using `seed`. Retries internally on validation
 * failure; throws if it can't produce a valid level after MAX_ATTEMPTS.
 */
export function generateLevel(seed: number, stage: number): Level {
  const rng = mulberry32(seed ^ (stage * 0x9E3779B9));

  // Step 3b: map sizing
  const W = clamp(32 + Math.floor(stage / 2) * 2, 32, 50);
  const H = W;
  const targetRooms = clamp(12 + Math.floor(stage * 1.5), 12, 30);
  const minRooms = 8;
  const numSpawnRooms = stage >= 5 ? 3 : 2;
  const numExitRooms = stage >= 5 ? 3 : 2;

  const MAX_ATTEMPTS = 80;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = newGrid(W, H, TILE.WALL_STONE);
    const rooms: Room[] = [];

    // Room placement: slightly larger rooms for big maps (4-8 range)
    for (let i = 0; i < 500 && rooms.length < targetRooms; i++) {
      const rw = 3 + Math.floor(rng() * 5); // 3..7
      const rh = 3 + Math.floor(rng() * 5);
      const rx = 1 + Math.floor(rng() * Math.max(1, W - rw - 2));
      const ry = 1 + Math.floor(rng() * Math.max(1, H - rh - 2));
      const r: Room = { x: rx, y: ry, w: rw, h: rh };
      if (rooms.some(o => roomsOverlap(o, r, 1))) continue;
      rooms.push(r);
      carveRoom(map, r);
    }
    if (rooms.length < minRooms) continue;

    // Step 3c: Multi-entrance room selection
    // Pick room closest to top-left (1,1) as first spawn room, swap to index 0
    let bestSpawnIdx = 0;
    let bestSpawnDist = manhattan(roomCenter(rooms[0]), { x: 1, y: 1 });
    for (let i = 1; i < rooms.length; i++) {
      const d = manhattan(roomCenter(rooms[i]), { x: 1, y: 1 });
      if (d < bestSpawnDist) {
        bestSpawnDist = d;
        bestSpawnIdx = i;
      }
    }
    // Swap bestSpawnIdx to index 0
    [rooms[0], rooms[bestSpawnIdx]] = [rooms[bestSpawnIdx], rooms[0]];

    // Greedily pick next numSpawnRooms-1 by closest center distance to rooms[0]
    const spawnRoomCenters: Vec2[] = [roomCenter(rooms[0])];
    for (let s = 1; s < numSpawnRooms && s < rooms.length; s++) {
      let bestIdx = s;
      let bestDist = Infinity;
      for (let i = s; i < rooms.length; i++) {
        const d = manhattan(roomCenter(rooms[i]), spawnRoomCenters[0]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      [rooms[s], rooms[bestIdx]] = [rooms[bestIdx], rooms[s]];
      spawnRoomCenters.push(roomCenter(rooms[s]));
    }
    const spawnRoomIndices = Array.from({ length: numSpawnRooms }, (_, i) => i);

    // Step 3d: Multi-exit room selection
    // Pick rooms farthest from spawn cluster centroid
    const spawnCentroid = centroid(spawnRoomCenters);
    const exitCandidates = rooms
      .map((r, i) => ({
        idx: i,
        dist: manhattan(roomCenter(r), spawnCentroid),
      }))
      .filter(c => !spawnRoomIndices.includes(c.idx))
      .sort((a, b) => b.dist - a.dist);

    // Move farthest exit rooms to the END of the rooms array via swaps
    const chosenExitCount = Math.min(numExitRooms, exitCandidates.length);
    for (let e = 0; e < chosenExitCount; e++) {
      const targetPos = rooms.length - (chosenExitCount - e);
      if (exitCandidates[e].idx < targetPos) {
        [rooms[exitCandidates[e].idx], rooms[targetPos]] = [rooms[targetPos], rooms[exitCandidates[e].idx]];
      }
    }
    const exitRoomIndices = Array.from({ length: chosenExitCount }, (_, i) => rooms.length - 1 - i);

    // Connect sequentially with L-corridors
    for (let i = 1; i < rooms.length; i++) {
      carveCorridor(map, roomCenter(rooms[i - 1]), roomCenter(rooms[i]), rng);
    }

    // Step 3e: Cross-corridors (1-3 between non-adjacent middle zone rooms with Manhattan distance > 3)
    const numCrossCorridors = clamp(1 + Math.floor(stage / 3), 1, 3);
    const middleZoneIndices: number[] = [];
    for (let i = 0; i < rooms.length; i++) {
      if (!spawnRoomIndices.includes(i) && !exitRoomIndices.includes(i)) {
        middleZoneIndices.push(i);
      }
    }

    let crossCount = 0;
    const crossPairs: Array<[number, number]> = [];
    const usedPairs = new Set<string>();
    for (let tryI = 0; tryI < 50 && crossCount < numCrossCorridors; tryI++) {
      const a = middleZoneIndices[Math.floor(rng() * middleZoneIndices.length)];
      const b = middleZoneIndices[Math.floor(rng() * middleZoneIndices.length)];
      if (a === b) continue;
      const pairKey = Math.min(a, b) + ',' + Math.max(a, b);
      if (usedPairs.has(pairKey)) continue;
      const ca = roomCenter(rooms[a]), cb = roomCenter(rooms[b]);
      if (manhattan(ca, cb) <= 3) continue;
      usedPairs.add(pairKey);
      crossPairs.push([a, b]);
      carveCorridor(map, ca, cb, rng);
      crossCount++;
    }

    // Step 3f: Exit doors
    const exits: Vec2[] = [];
    const exitAccessCells: Vec2[] = [];
    for (const ei of exitRoomIndices) {
      const exitRoom = rooms[ei];
      const exitDoor = pickExitDoor(map, exitRoom, ei, rng);
      if (!exitDoor) continue; // if no valid door on this room, skip it for now
      map[exitDoor.wall.y][exitDoor.wall.x] = TILE.EXIT_DOOR;
      exits.push({ x: exitDoor.wall.x + 0.5, y: exitDoor.wall.y + 0.5 });
      exitAccessCells.push(exitDoor.access);
    }
    if (exits.length === 0) continue;

    // Spawn position: center of room 0
    const spawnRoom = rooms[0];
    const spawnTile = roomCenter(spawnRoom);
    const spawn: Vec2 = { x: spawnTile.x, y: spawnTile.y };

    // Entrance: pick wall edge in first spawn room
    const entranceTile = pickEntrancePosition(spawnRoom, rng);
    const entrance: Vec2 = { x: entranceTile.x + 0.5, y: entranceTile.y + 0.5 };

    // --- Yellow Key Door placement (step 3g) ---
    // Pick a room from the middle zone as the "blue key candidate" (where blue keycard will go)
    // It should be far enough from spawn to require the yellow door
    const middleZoneRooms = middleZoneIndices.map((_, ai) => rooms[middleZoneIndices[ai]]);
    // Weight the selection by distance from spawnCentroid - want it somewhat far
    const blueKeyRoomCandidates = middleZoneRooms.map(r => ({
      room: r,
      distance: manhattan(roomCenter(r), spawnCentroid),
    }));
    const blueKeyPick = weightedRandomByDistance(blueKeyRoomCandidates, rng);
    if (!blueKeyPick) continue;
    const blueKeyCandidateRoom = blueKeyPick.room;

    const yellowPos = placeYellowDoor(map, spawn, blueKeyCandidateRoom, rooms, rng);
    if (!yellowPos) continue;

    // Step 3h: Blue Key Door placement
    const bluePos = placeBlueDoor(map, spawn, exitAccessCells, rooms, rng);
    if (!bluePos) continue;

    // Step 3i: Keycard placement
    // Yellow keycard: reachable WITHOUT any key door
    const reachableNoKeys = bfsReachable(map, spawn, new Set());

    // Find non-spawn, non-exit rooms reachable without any key
    const yellowCandidates = rooms
      .map((r, i) => ({
        room: r,
        idx: i,
        distance: manhattan(roomCenter(r), spawn),
      }))
      .filter(c =>
        !spawnRoomIndices.includes(c.idx) &&
        !exitRoomIndices.includes(c.idx) &&
        isReachable(reachableNoKeys, roomCenter(c.room))
      );

    // Weighted by proximity to spawn (closer = higher weight = more likely picked)
    const maxYellowDist = yellowCandidates.length > 0
      ? Math.max(...yellowCandidates.map(c => c.distance))
      : 0;
    const yellowPick = weightedRandomByProximity(yellowCandidates, maxYellowDist, rng);
    if (!yellowPick) continue;

    // Blue keycard: reachable only with YELLOW_KEY_DOOR passable (not BLUE_KEY_DOOR)
    const reachableWithYellow = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));
    const reachableNoYellow = bfsReachable(map, spawn, new Set());

    const blueCandidates = rooms
      .map((r, i) => ({
        room: r,
        idx: i,
        distance: manhattan(roomCenter(r), spawn),
      }))
      .filter(c =>
        !spawnRoomIndices.includes(c.idx) &&
        !exitRoomIndices.includes(c.idx) &&
        !isReachable(reachableNoYellow, roomCenter(c.room)) &&
        isReachable(reachableWithYellow, roomCenter(c.room))
      );

    if (blueCandidates.length === 0) continue;
    const maxBlueDist = Math.max(...blueCandidates.map(c => c.distance));
    const bluePick = weightedRandomByProximity(blueCandidates, maxBlueDist, rng);
    if (!bluePick) continue;

    // --- From here generation succeeded structurally. Place sprites. ---
    const used = new Set<string>();
    used.add(`${spawnTile.x},${spawnTile.y}`);
    for (const ea of exitAccessCells) {
      used.add(`${ea.x},${ea.y}`);
    }

    // Place yellow keycard in corner of its room
    const yellowKeycardTile = pickCornerTile(yellowPick.room, map, rng, used);
    // Place blue keycard in corner of its room
    const blueKeycardTile = pickCornerTile(bluePick.room, map, rng, used);

    // Cover decor: place one decorative sprite adjacent to each keycard
    const decor: DecorPlacement[] = [];
    const cover1 = placeCoverDecor(yellowPick.room, map, yellowKeycardTile, rng, used);
    if (cover1) {
      const coverTypes: DecorType[] = [SpriteType.BARREL, SpriteType.DEBRIS, SpriteType.TERMINAL];
      const coverType = coverTypes[Math.floor(rng() * 3)];
      decor.push({ x: cover1.x + 0.5, y: cover1.y + 0.5, type: coverType });
    }
    const cover2 = placeCoverDecor(bluePick.room, map, blueKeycardTile, rng, used);
    if (cover2) {
      const coverTypes: DecorType[] = [SpriteType.BARREL, SpriteType.DEBRIS, SpriteType.TERMINAL];
      const coverType = coverTypes[Math.floor(rng() * 3)];
      decor.push({ x: cover2.x + 0.5, y: cover2.y + 0.5, type: coverType });
    }

    // Optional secret rooms (increased probability for stage 2+)
    const secretProb = stage >= 2 ? 0.8 : 0.4;
    const numSecretAttempts = stage >= 2 ? 3 : 1;
    let secretHealth: Vec2 | null = null;
    for (let s = 0; s < numSecretAttempts; s++) {
      if (rng() < secretProb) {
        secretHealth = placeSecretRoom(map, rooms, rng, used);
        if (secretHealth) break;
      }
    }

    // Step 3j: Scaled quantities
    const excludeSpawnExit = new Set<number>();
    for (const i of spawnRoomIndices) excludeSpawnExit.add(i);
    for (const i of exitRoomIndices) excludeSpawnExit.add(i);

    const numEnemies = clamp(12 + Math.floor(stage * 2), 12, 25);
    const enemies: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numEnemies, rng, used);

    const numShooters = clamp(Math.floor(stage * 1.2), 0, 8);
    const shooters: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numShooters, rng, used);

    // Latchers: small, fast pounce parasites. Appear from stage 1 onwards
    // and scale up faster than shooters because they're squishy.
    const numLatchers = clamp(1 + Math.floor(stage * 1.5), 1, 10);
    const latchers: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numLatchers, rng, used);

    const numAmmo = clamp(6 + Math.floor(stage * 1.0), 6, 12);
    const ammo: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numAmmo, rng, used);

    const numHealth = clamp(4 + Math.floor(stage * 0.8), 4, 8);
    const health: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numHealth, rng, used);

    const numDecor = clamp(10 + Math.floor(stage * 2), 10, 20);
    const moreDecor = placeDecorInRooms(map, rooms, excludeSpawnExit, numDecor, rng, used);
    decor.push(...moreDecor);

    const numShotguns = stage >= 2 ? 2 + Math.floor((stage - 2) / 2) : 0;
    const shotguns: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numShotguns, rng, used);

    const numRocketLaunchers = stage >= 4 ? 1 + Math.floor((stage - 4) / 2) : 0;
    const rocketLaunchers: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numRocketLaunchers, rng, used);

    // Validation
    if (!validateLevel(map, spawn, rooms, spawnRoomIndices, exitRoomIndices,
      exits, exitAccessCells, yellowKeycardTile, blueKeycardTile, numSpawnRooms, numExitRooms)) {
      continue;
    }

    const facing = spawnFacing(spawnRoom, spawn);

    // Step 3k: return with all new fields
    return {
      stage,
      seed,
      width: W,
      height: H,
      map,
      spawn: { x: spawn.x + 0.5, y: spawn.y + 0.5, dirX: facing.dirX, dirY: facing.dirY },
      entrance,
      spawnRooms: spawnRoomIndices,
      exits,
      exitRooms: exitRoomIndices,
      exit: exits[0],
      yellowKeycard: { x: yellowKeycardTile.x + 0.5, y: yellowKeycardTile.y + 0.5 },
      blueKeycard: { x: blueKeycardTile.x + 0.5, y: blueKeycardTile.y + 0.5 },
      keycard: { x: blueKeycardTile.x + 0.5, y: blueKeycardTile.y + 0.5 },
      enemies,
      shooters,
      latchers,
      bosses: [],
      ammo,
      health,
      secretHealth,
      decor,
      shotguns,
      rocketLaunchers,
      rooms: rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    };
  }

  throw new Error(`level-gen: failed to produce a valid level for stage ${stage} after ${MAX_ATTEMPTS} attempts`);
}

function validateLevel(
  map: number[][],
  spawn: Vec2,
  rooms: Room[],
  spawnRoomIndices: number[],
  exitRoomIndices: number[],
  exits: Vec2[],
  exitAccessCells: Vec2[],
  yellowKeycardTile: Vec2,
  blueKeycardTile: Vec2,
  minSpawnRooms: number,
  minExitRooms: number
): boolean {
  // Must have at least the required spawn and exit rooms
  if (spawnRoomIndices.length < minSpawnRooms) return false;
  if (exitRoomIndices.length < minExitRooms) return false;
  if (exits.length < 2) return false;

  // Yellow keycard must be reachable without any key doors
  const reachableNoKeys = bfsReachable(map, spawn, new Set());
  if (!isReachable(reachableNoKeys, yellowKeycardTile)) return false;

  // Blue keycard must NOT be reachable without yellow door
  if (isReachable(reachableNoKeys, blueKeycardTile)) return false;

  // Blue keycard must BE reachable with yellow door
  const reachableWithYellow = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));
  if (!isReachable(reachableWithYellow, blueKeycardTile)) return false;

  // Exit access cells must NOT be reachable with only yellow door
  for (const ea of exitAccessCells) {
    if (isReachable(reachableWithYellow, ea)) return false;
  }

  // All exit access cells must be reachable with both doors
  const reachableWithBoth = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR, TILE.BLUE_KEY_DOOR]));
  for (const ea of exitAccessCells) {
    if (!isReachable(reachableWithBoth, ea)) return false;
  }

  // Both doors must be present in the map
  let hasYellow = false, hasBlue = false;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === TILE.YELLOW_KEY_DOOR) hasYellow = true;
      if (map[y][x] === TILE.BLUE_KEY_DOOR) hasBlue = true;
    }
  }
  if (!hasYellow || !hasBlue) return false;

  // All positions must be on FLOOR tiles
  if (map[yellowKeycardTile.y][yellowKeycardTile.x] !== TILE.FLOOR) return false;
  if (map[blueKeycardTile.y][blueKeycardTile.x] !== TILE.FLOOR) return false;

  return true;
}
