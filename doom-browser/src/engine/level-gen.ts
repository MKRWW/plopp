/**
 * Procedural level generator: rooms-and-corridors with reachability validation.
 *
 * Pipeline per level:
 *   1. Place N non-overlapping rectangular rooms (1-tile margin between them).
 *   2. Connect them sequentially with L-corridors.
 *   3. Spawn = center of room 0; exit room = the room farthest from spawn (Manhattan).
 *   4. Pick an exit-door wall tile on the exit room's perimeter (must be uncarved
 *      WALL_STONE so it forms a dead-end). Player stands in the floor tile inside
 *      the room and presses [E].
 *   5. Place a BLUE_KEY_DOOR on a corridor tile such that removing it disconnects
 *      spawn from the exit-access cell — i.e. a true chokepoint.
 *   6. Place the keycard in a non-spawn, non-exit room reachable WITHOUT the
 *      blue door open.
 *   7. Optionally embed a 1-tile secret pocket behind a SECRET_WALL with a health
 *      pickup.
 *   8. Scatter enemies, ammo, health, decor across rooms (avoiding spawn/exit/key
 *      cells and a small radius around the player spawn).
 *
 * Difficulty scales with stage: more rooms, more enemies, slightly larger map.
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
  /** Center of the EXIT_DOOR wall tile — player checks distance to this. */
  exit: Vec2;
  keycard: Vec2;
  enemies: Vec2[];
  ammo: Vec2[];
  health: Vec2[];
  /** Bonus pickup behind a SECRET_WALL, if a secret room was placed. */
  secretHealth: Vec2 | null;
  decor: DecorPlacement[];
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
 * Pick a wall tile on the exit room perimeter that is currently WALL_STONE
 * (i.e. uncarved by any corridor). The tile becomes EXIT_DOOR; the floor tile
 * just inside the room becomes the player's "exit access" position.
 *
 * Returns both: the wall tile and the adjacent inside floor tile.
 */
function pickExitDoor(
  map: number[][],
  room: Room,
  rng: () => number
): { wall: Vec2; access: Vec2 } | null {
  type Cand = { wall: Vec2; access: Vec2 };
  const cands: Cand[] = [];
  const h = map.length, w = map[0].length;
  const tryAdd = (wx: number, wy: number, ax: number, ay: number) => {
    if (wx < 0 || wy < 0 || wx >= w || wy >= h) return;
    if (map[wy][wx] !== TILE.WALL_STONE) return; // must be uncarved
    if (map[ay][ax] !== TILE.FLOOR) return;      // inside must be floor
    // Die anderen drei Nachbarn der Wand MÜSSEN Wand sein. Sonst bekäme der
    // Spieler die Exit-Tür auch von außen erreicht (Korridor läuft direkt am
    // Exit-Tile vorbei) und könnte die Blue-Door umgehen.
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = wx + dx, ny = wy + dy;
      if (nx === ax && ny === ay) continue;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (map[ny][nx] !== TILE.WALL_STONE) return; // anderer Nachbar ist Floor → ungeeignet
    }
    cands.push({ wall: { x: wx, y: wy }, access: { x: ax, y: ay } });
  };

  // Top + bottom edges
  for (let x = room.x; x < room.x + room.w; x++) {
    tryAdd(x, room.y - 1, x, room.y);
    tryAdd(x, room.y + room.h, x, room.y + room.h - 1);
  }
  // Left + right edges
  for (let y = room.y; y < room.y + room.h; y++) {
    tryAdd(room.x - 1, y, room.x, y);
    tryAdd(room.x + room.w, y, room.x + room.w - 1, y);
  }

  if (cands.length === 0) return null;
  return cands[Math.floor(rng() * cands.length)];
}

/**
 * Find a corridor cell whose conversion to BLUE_KEY_DOOR forms a true chokepoint
 * between spawn and the exit-access cell.
 */
function placeBlueDoor(
  map: number[][],
  spawn: Vec2,
  exitAccess: Vec2,
  rooms: Room[],
  rng: () => number
): Vec2 | null {
  const h = map.length, w = map[0].length;
  const corridorCells: Vec2[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map[y][x] !== TILE.FLOOR) continue;
      if (rooms.some(r => pointInRoom(x, y, r))) continue;
      corridorCells.push({ x, y });
    }
  }
  // Shuffle for variety
  shuffle(corridorCells, rng);

  for (const c of corridorCells) {
    map[c.y][c.x] = TILE.BLUE_KEY_DOOR;
    const noBlue = bfsReachable(map, spawn, new Set());
    const withBlue = bfsReachable(map, spawn, new Set([TILE.BLUE_KEY_DOOR]));
    const isChoke =
      !noBlue[exitAccess.y][exitAccess.x] && withBlue[exitAccess.y][exitAccess.x];
    if (isChoke) return c;
    map[c.y][c.x] = TILE.FLOOR; // revert
  }
  return null;
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Try to embed a 1x1 secret pocket: a wall tile on a room's perimeter that has
 * solid wall on its outside neighbor. Convert the wall to SECRET_WALL, the
 * outside neighbor to FLOOR, and place a health bonus there.
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
      // Pocket must not touch any other floor (so it's truly hidden)
      const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = px + dx, ny = py + dy;
        if (nx === wx && ny === wy) continue; // ignore the secret-wall side
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
 * Pick a random floor tile inside a room, optionally avoiding tiles already used
 * (by exact tile coords).
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
 * Generate a level for `stage` using `seed`. Retries internally on validation
 * failure; throws if it can't produce a valid level after MAX_ATTEMPTS.
 */
export function generateLevel(seed: number, stage: number): Level {
  const rng = mulberry32(seed ^ (stage * 0x9E3779B9));

  const W = clamp(16 + Math.floor(stage / 2), 16, 24);
  const H = W;
  const targetRooms = clamp(5 + Math.floor(stage / 2), 5, 9);
  const minRooms = 4;

  const MAX_ATTEMPTS = 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = newGrid(W, H, TILE.WALL_STONE);
    const rooms: Room[] = [];

    for (let i = 0; i < 200 && rooms.length < targetRooms; i++) {
      const rw = 3 + Math.floor(rng() * 4); // 3..6
      const rh = 3 + Math.floor(rng() * 4);
      const rx = 1 + Math.floor(rng() * (W - rw - 2));
      const ry = 1 + Math.floor(rng() * (H - rh - 2));
      const r: Room = { x: rx, y: ry, w: rw, h: rh };
      if (rooms.some(o => roomsOverlap(o, r, 1))) continue;
      rooms.push(r);
      carveRoom(map, r);
    }
    if (rooms.length < minRooms) continue;

    // Connect sequentially: room[i] ↔ room[i+1] via L-corridor through centers.
    for (let i = 1; i < rooms.length; i++) {
      carveCorridor(map, roomCenter(rooms[i - 1]), roomCenter(rooms[i]), rng);
    }

    const spawnRoom = rooms[0];
    const spawnTile = roomCenter(spawnRoom);
    const spawn: Vec2 = { x: spawnTile.x, y: spawnTile.y };

    // Exit room = farthest from spawn (Manhattan).
    let exitIdx = -1, bestDist = -1;
    for (let i = 1; i < rooms.length; i++) {
      const c = roomCenter(rooms[i]);
      const d = Math.abs(c.x - spawn.x) + Math.abs(c.y - spawn.y);
      if (d > bestDist) { bestDist = d; exitIdx = i; }
    }
    if (exitIdx < 0) continue;
    const exitRoom = rooms[exitIdx];

    const exitDoor = pickExitDoor(map, exitRoom, rng);
    if (!exitDoor) continue;
    map[exitDoor.wall.y][exitDoor.wall.x] = TILE.EXIT_DOOR;

    const bluePos = placeBlueDoor(map, spawn, exitDoor.access, rooms, rng);
    if (!bluePos) continue;
    // bluePos already mutated map to BLUE_KEY_DOOR.

    // Keycard: pick a non-spawn, non-exit room reachable WITHOUT blue door.
    const reachableNoBlue = bfsReachable(map, spawn, new Set());
    const candidateRooms = rooms
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== 0 && i !== exitIdx);
    shuffle(candidateRooms, rng);

    let keycardTile: Vec2 | null = null;
    for (const { r } of candidateRooms) {
      const c = roomCenter(r);
      if (reachableNoBlue[c.y][c.x]) {
        keycardTile = c;
        break;
      }
    }
    if (!keycardTile) continue;

    // From here generation succeeded structurally. Place sprites.
    const used = new Set<string>();
    used.add(`${spawnTile.x},${spawnTile.y}`);
    used.add(`${keycardTile.x},${keycardTile.y}`);
    used.add(`${exitDoor.access.x},${exitDoor.access.y}`);

    // Optional secret room (50% on stage 2+, otherwise skipped).
    let secretHealth: Vec2 | null = null;
    if (stage >= 2 && rng() < 0.7) {
      secretHealth = placeSecretRoom(map, rooms, rng, used);
    }

    // --- Enemies (in non-spawn rooms; minimum distance from spawn). ---
    const numEnemies = clamp(4 + Math.floor(stage * 1.2), 4, 14);
    const enemies: Vec2[] = [];
    const nonSpawnRooms = rooms.filter((_, i) => i !== 0);
    for (let i = 0; i < numEnemies; i++) {
      const room = nonSpawnRooms[Math.floor(rng() * nonSpawnRooms.length)];
      const tile = randomFloorInRoom(room, rng, used);
      if (!tile) continue;
      enemies.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
    }

    // --- Ammo & health ---
    const numAmmo = 2 + Math.floor(stage / 2);
    const ammo: Vec2[] = [];
    for (let i = 0; i < numAmmo; i++) {
      const room = rooms[Math.floor(rng() * rooms.length)];
      const tile = randomFloorInRoom(room, rng, used);
      if (!tile) continue;
      ammo.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
    }

    const numHealth = 1 + Math.floor(stage / 3);
    const health: Vec2[] = [];
    for (let i = 0; i < numHealth; i++) {
      const room = rooms[Math.floor(rng() * rooms.length)];
      const tile = randomFloorInRoom(room, rng, used);
      if (!tile) continue;
      health.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
    }

    // --- Decor ---
    const numDecor = 4 + Math.floor(stage / 2);
    const decor: DecorPlacement[] = [];
    for (let i = 0; i < numDecor; i++) {
      const room = rooms[Math.floor(rng() * rooms.length)];
      const tile = randomFloorInRoom(room, rng, used);
      if (!tile) continue;
      const type = DECOR_TYPES[Math.floor(rng() * DECOR_TYPES.length)];
      decor.push({ x: tile.x + 0.5, y: tile.y + 0.5, type });
    }

    const facing = spawnFacing(spawnRoom, spawn);

    return {
      stage,
      seed,
      width: W,
      height: H,
      map,
      spawn: { x: spawn.x + 0.5, y: spawn.y + 0.5, dirX: facing.dirX, dirY: facing.dirY },
      exit: { x: exitDoor.wall.x + 0.5, y: exitDoor.wall.y + 0.5 },
      keycard: { x: keycardTile.x + 0.5, y: keycardTile.y + 0.5 },
      enemies,
      ammo,
      health,
      secretHealth,
      decor,
    };
  }

  throw new Error(`level-gen: failed to produce a valid level for stage ${stage} after ${MAX_ATTEMPTS} attempts`);
}
