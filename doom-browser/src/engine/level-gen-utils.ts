/**
 * Utility functions and shared types for the level generator.
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

export interface Room { x: number; y: number; w: number; h: number; }

/** Mulberry32: small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function newGrid(w: number, h: number, fill: number): number[][] {
  const g: number[][] = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array<number>(w).fill(fill);
  return g;
}

export function newBoolGrid(w: number, h: number): boolean[][] {
  const g: boolean[][] = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array<boolean>(w).fill(false);
  return g;
}

export function roomCenter(r: Room): Vec2 {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

export function roomsOverlap(a: Room, b: Room, margin: number): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

export function pointInRoom(x: number, y: number, r: Room): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function carveRoom(map: number[][], r: Room): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      map[y][x] = TILE.FLOOR;
    }
  }
}

export function carveCorridor(map: number[][], a: Vec2, b: Vec2, rng: () => number): void {
  if (rng() < 0.5) {
    carveH(map, a.x, b.x, a.y);
    carveV(map, a.y, b.y, b.x);
  } else {
    carveV(map, a.y, b.y, a.x);
    carveH(map, a.x, b.x, b.y);
  }
}

export function carveH(map: number[][], x1: number, x2: number, y: number): void {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  for (let x = lo; x <= hi; x++) {
    if (map[y][x] === TILE.WALL_STONE) map[y][x] = TILE.FLOOR;
  }
}

export function carveV(map: number[][], y1: number, y2: number, x: number): void {
  const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
  for (let y = lo; y <= hi; y++) {
    if (map[y][x] === TILE.WALL_STONE) map[y][x] = TILE.FLOOR;
  }
}

/**
 * BFS reachability from `start`. Tiles in `passableExtras` are passable in addition
 * to FLOOR. All other non-floor tiles (walls, EXIT_DOOR, doors not listed) block.
 */
export function bfsReachable(map: number[][], start: Vec2, passableExtras: Set<number>): boolean[][] {
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
export function isReachable(reachable: boolean[][], target: Vec2): boolean {
  const w = reachable[0].length, h = reachable.length;
  if (target.x < 0 || target.y < 0 || target.x >= w || target.y >= h) return false;
  return reachable[target.y][target.x];
}

export function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Compute the centroid of a set of Vec2.
 */
export function centroid(positions: Vec2[]): Vec2 {
  if (positions.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of positions) { sx += p.x; sy += p.y; }
  return { x: sx / positions.length, y: sy / positions.length };
}
