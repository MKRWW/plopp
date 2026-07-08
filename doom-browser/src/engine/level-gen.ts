/** Procedural level generator: rooms-and-corridors with dual keycard progression. */
import { TILE } from './world';
import { SpriteType } from './sprite';

export type { Vec2, DecorType, DecorPlacement, Room } from './level-gen-utils';
import type { Vec2, DecorType, DecorPlacement, Room } from './level-gen-utils';

import {
  mulberry32, clamp, newGrid, roomCenter, roomsOverlap, carveRoom,
  carveCorridor, bfsReachable, isReachable, manhattan, centroid,
} from './level-gen-utils';

import {
  pickEntrancePosition, pickExitDoor, placeYellowDoor, placeBlueDoor,
  weightedRandomByDistance, weightedRandomByProximity, pickCornerTile,
  placeCoverDecor, placeSecretRoom, spawnFacing, placeItemsInRooms, placeDecorInRooms,
} from './level-gen-placement';

export const BOSS_STAGE = 10;

export interface Level {
  stage: number;
  seed: number;
  width: number;
  height: number;
  map: number[][];
  spawn: { x: number; y: number; dirX: number; dirY: number };
  entrance: Vec2;
  spawnRooms: number[];
  exits: Vec2[];
  exitRooms: number[];
  exit: Vec2;
  yellowKeycard: Vec2;
  blueKeycard: Vec2;
  keycard: Vec2;
  enemies: Vec2[];
  shooters: Vec2[];
  latchers: Vec2[];
  bosses: Vec2[];
  ammo: Vec2[];
  health: Vec2[];
  secretHealth: Vec2 | null;
  secretBerserk: Vec2 | null;
  armorPickups: Vec2[];
  decor: DecorPlacement[];
  shotguns: Vec2[];
  rocketLaunchers: Vec2[];
  rooms: Array<{ x: number; y: number; w: number; h: number }>;
}

export function generateLevel(seed: number, stage: number): Level {
  const rng = mulberry32(seed ^ (stage * 0x9E3779B9));
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

    for (let i = 0; i < 500 && rooms.length < targetRooms; i++) {
      const rw = 3 + Math.floor(rng() * 5);
      const rh = 3 + Math.floor(rng() * 5);
      const rx = 1 + Math.floor(rng() * Math.max(1, W - rw - 2));
      const ry = 1 + Math.floor(rng() * Math.max(1, H - rh - 2));
      const r: Room = { x: rx, y: ry, w: rw, h: rh };
      if (rooms.some(o => roomsOverlap(o, r, 1))) continue;
      rooms.push(r);
      carveRoom(map, r);
    }
    if (rooms.length < minRooms) continue;

    // Pick room closest to top-left as first spawn room
    let bestSpawnIdx = 0;
    let bestSpawnDist = manhattan(roomCenter(rooms[0]), { x: 1, y: 1 });
    for (let i = 1; i < rooms.length; i++) {
      const d = manhattan(roomCenter(rooms[i]), { x: 1, y: 1 });
      if (d < bestSpawnDist) { bestSpawnDist = d; bestSpawnIdx = i; }
    }
    [rooms[0], rooms[bestSpawnIdx]] = [rooms[bestSpawnIdx], rooms[0]];

    // Greedily pick next spawn rooms by closest center distance to rooms[0]
    const spawnRoomCenters: Vec2[] = [roomCenter(rooms[0])];
    for (let s = 1; s < numSpawnRooms && s < rooms.length; s++) {
      let bestIdx = s;
      let bestDist = Infinity;
      for (let i = s; i < rooms.length; i++) {
        const d = manhattan(roomCenter(rooms[i]), spawnRoomCenters[0]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      [rooms[s], rooms[bestIdx]] = [rooms[bestIdx], rooms[s]];
      spawnRoomCenters.push(roomCenter(rooms[s]));
    }
    const spawnRoomIndices = Array.from({ length: numSpawnRooms }, (_, i) => i);

    // Pick exit rooms farthest from spawn cluster centroid
    const spawnCentroid = centroid(spawnRoomCenters);
    const exitCandidates = rooms
      .map((r, i) => ({ idx: i, dist: manhattan(roomCenter(r), spawnCentroid) }))
      .filter(c => !spawnRoomIndices.includes(c.idx))
      .sort((a, b) => b.dist - a.dist);

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

    // Cross-corridors between non-adjacent middle zone rooms
    const numCrossCorridors = clamp(1 + Math.floor(stage / 3), 1, 3);
    const middleZoneIndices: number[] = [];
    for (let i = 0; i < rooms.length; i++) {
      if (!spawnRoomIndices.includes(i) && !exitRoomIndices.includes(i)) {
        middleZoneIndices.push(i);
      }
    }
    let crossCount = 0;
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
      carveCorridor(map, ca, cb, rng);
      crossCount++;
    }

    // Exit doors
    const exits: Vec2[] = [];
    const exitAccessCells: Vec2[] = [];
    for (const ei of exitRoomIndices) {
      const exitDoor = pickExitDoor(map, rooms[ei], ei, rng);
      if (!exitDoor) continue;
      map[exitDoor.wall.y][exitDoor.wall.x] = TILE.EXIT_DOOR;
      exits.push({ x: exitDoor.wall.x + 0.5, y: exitDoor.wall.y + 0.5 });
      exitAccessCells.push(exitDoor.access);
    }
    if (exits.length === 0) continue;

    const spawnRoom = rooms[0];
    const spawnTile = roomCenter(spawnRoom);
    const spawn: Vec2 = { x: spawnTile.x, y: spawnTile.y };
    const entranceTile = pickEntrancePosition(spawnRoom, rng);
    const entrance: Vec2 = { x: entranceTile.x + 0.5, y: entranceTile.y + 0.5 };

    // Yellow Key Door placement
    const middleZoneRooms = middleZoneIndices.map((_, ai) => rooms[middleZoneIndices[ai]]);
    const blueKeyRoomCandidates = middleZoneRooms.map(r => ({
      room: r, distance: manhattan(roomCenter(r), spawnCentroid),
    }));
    const blueKeyPick = weightedRandomByDistance(blueKeyRoomCandidates, rng);
    if (!blueKeyPick) continue;
    const yellowPos = placeYellowDoor(map, spawn, blueKeyPick.room, rooms, rng);
    if (!yellowPos) continue;

    // Blue Key Door placement
    const bluePos = placeBlueDoor(map, spawn, exitAccessCells, rooms, rng);
    if (!bluePos) continue;

    // Yellow keycard: reachable WITHOUT any key door
    const reachableNoKeys = bfsReachable(map, spawn, new Set());
    const yellowCandidates = rooms
      .map((r, i) => ({ room: r, idx: i, distance: manhattan(roomCenter(r), spawn) }))
      .filter(c =>
        !spawnRoomIndices.includes(c.idx) &&
        !exitRoomIndices.includes(c.idx) &&
        isReachable(reachableNoKeys, roomCenter(c.room))
      );
    const maxYellowDist = yellowCandidates.length > 0
      ? Math.max(...yellowCandidates.map(c => c.distance)) : 0;
    const yellowPick = weightedRandomByProximity(yellowCandidates, maxYellowDist, rng);
    if (!yellowPick) continue;

    // Blue keycard: reachable only with YELLOW_KEY_DOOR passable
    const reachableWithYellow = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));
    const reachableNoYellow = bfsReachable(map, spawn, new Set());
    const blueCandidates = rooms
      .map((r, i) => ({ room: r, idx: i, distance: manhattan(roomCenter(r), spawn) }))
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

    // Place sprites
    const used = new Set<string>();
    used.add(`${spawnTile.x},${spawnTile.y}`);
    for (const ea of exitAccessCells) used.add(`${ea.x},${ea.y}`);

    const yellowKeycardTile = pickCornerTile(yellowPick.room, map, rng, used);
    const blueKeycardTile = pickCornerTile(bluePick.room, map, rng, used);

    const decor: DecorPlacement[] = [];
    const cover1 = placeCoverDecor(yellowPick.room, map, yellowKeycardTile, rng, used);
    if (cover1) {
      const coverTypes: DecorType[] = [SpriteType.BARREL, SpriteType.DEBRIS, SpriteType.TERMINAL];
      decor.push({ x: cover1.x + 0.5, y: cover1.y + 0.5, type: coverTypes[Math.floor(rng() * 3)] });
    }
    const cover2 = placeCoverDecor(bluePick.room, map, blueKeycardTile, rng, used);
    if (cover2) {
      const coverTypes: DecorType[] = [SpriteType.BARREL, SpriteType.DEBRIS, SpriteType.TERMINAL];
      decor.push({ x: cover2.x + 0.5, y: cover2.y + 0.5, type: coverTypes[Math.floor(rng() * 3)] });
    }

    // Optional secret rooms
    const secretProb = stage >= 2 ? 0.8 : 0.4;
    const numSecretAttempts = stage >= 2 ? 3 : 1;
    let secretHealth: Vec2 | null = null;
    let secretBerserk: Vec2 | null = null;
    for (let s = 0; s < numSecretAttempts; s++) {
      if (rng() < secretProb) {
        const pos = placeSecretRoom(map, rooms, rng, used);
        if (pos) {
          if (rng() < 0.5) secretBerserk = pos;
          else secretHealth = pos;
          break;
        }
      }
    }

    // Scaled quantities
    const excludeSpawnExit = new Set<number>();
    for (const i of spawnRoomIndices) excludeSpawnExit.add(i);
    for (const i of exitRoomIndices) excludeSpawnExit.add(i);

    const numEnemies = clamp(12 + Math.floor(stage * 2), 12, 25);
    const enemies: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numEnemies, rng, used);
    const numShooters = clamp(Math.floor(stage * 1.2), 0, 8);
    const shooters: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numShooters, rng, used);
    const numLatchers = clamp(1 + Math.floor(stage * 1.5), 1, 10);
    const latchers: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numLatchers, rng, used);
    const numAmmo = clamp(6 + Math.floor(stage * 1.0), 6, 12);
    const ammo: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numAmmo, rng, used);
    const numHealth = clamp(4 + Math.floor(stage * 0.8), 4, 8);
    const health: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numHealth, rng, used);
    const numDecor = clamp(10 + Math.floor(stage * 2), 10, 20);
    decor.push(...placeDecorInRooms(map, rooms, excludeSpawnExit, numDecor, rng, used));
    const numShotguns = stage >= 2 ? 2 + Math.floor((stage - 2) / 2) : 0;
    const shotguns: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numShotguns, rng, used);
    const numRocketLaunchers = stage >= 4 ? 1 + Math.floor((stage - 4) / 2) : 0;
    const rocketLaunchers: Vec2[] = placeItemsInRooms(map, rooms, excludeSpawnExit, numRocketLaunchers, rng, used);

    let armorPickups: Vec2[] = [];
    if (stage > 1 && stage !== BOSS_STAGE && rng() < 0.4) {
      armorPickups = placeItemsInRooms(map, rooms, excludeSpawnExit, 1, rng, used);
    }

    if (!validateLevel(map, spawn, rooms, spawnRoomIndices, exitRoomIndices,
      exits, exitAccessCells, yellowKeycardTile, blueKeycardTile, numSpawnRooms, numExitRooms)) {
      continue;
    }

    const facing = spawnFacing(spawnRoom, spawn);

    // Boss-Stage: no normal enemies, one boss at exit room, extra loot in spawn
    let bosses: Vec2[] = [];
    if (stage === BOSS_STAGE) {
      enemies.length = 0;
      shooters.length = 0;
      latchers.length = 0;
      const exitRoomIdx = exitRoomIndices[0];
      const exitRoom = rooms[exitRoomIdx];
      bosses = [{ x: exitRoom.x + exitRoom.w / 2, y: exitRoom.y + exitRoom.h / 2 }];
      const spawnRoomBoss = rooms[spawnRoomIndices[0]];
      for (let i = 0; i < 3; i++) ammo.push({ x: spawnRoomBoss.x + 1 + i * 0.7, y: spawnRoomBoss.y + 1 });
      for (let i = 0; i < 2; i++) health.push({ x: spawnRoomBoss.x + 1 + i * 0.7, y: spawnRoomBoss.y + 2 });
    }

    return {
      stage, seed, width: W, height: H, map,
      spawn: { x: spawn.x + 0.5, y: spawn.y + 0.5, dirX: facing.dirX, dirY: facing.dirY },
      entrance, spawnRooms: spawnRoomIndices, exits, exitRooms: exitRoomIndices,
      exit: exits[0],
      yellowKeycard: { x: yellowKeycardTile.x + 0.5, y: yellowKeycardTile.y + 0.5 },
      blueKeycard: { x: blueKeycardTile.x + 0.5, y: blueKeycardTile.y + 0.5 },
      keycard: { x: blueKeycardTile.x + 0.5, y: blueKeycardTile.y + 0.5 },
      enemies, shooters, latchers, bosses, ammo, health,
      secretHealth, secretBerserk, armorPickups, decor, shotguns, rocketLaunchers,
      rooms: rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    };
  }

  throw new Error(`level-gen: failed to produce a valid level for stage ${stage} after ${MAX_ATTEMPTS} attempts`);
}

function validateLevel(
  map: number[][],
  spawn: Vec2,
  _rooms: Room[],
  spawnRoomIndices: number[],
  exitRoomIndices: number[],
  exits: Vec2[],
  exitAccessCells: Vec2[],
  yellowKeycardTile: Vec2,
  blueKeycardTile: Vec2,
  minSpawnRooms: number,
  minExitRooms: number
): boolean {
  if (spawnRoomIndices.length < minSpawnRooms) return false;
  if (exitRoomIndices.length < minExitRooms) return false;
  if (exits.length < 2) return false;
  const reachableNoKeys = bfsReachable(map, spawn, new Set());
  if (!isReachable(reachableNoKeys, yellowKeycardTile)) return false;
  if (isReachable(reachableNoKeys, blueKeycardTile)) return false;
  const reachableWithYellow = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR]));
  if (!isReachable(reachableWithYellow, blueKeycardTile)) return false;
  for (const ea of exitAccessCells) {
    if (isReachable(reachableWithYellow, ea)) return false;
  }
  const reachableWithBoth = bfsReachable(map, spawn, new Set([TILE.YELLOW_KEY_DOOR, TILE.BLUE_KEY_DOOR]));
  for (const ea of exitAccessCells) {
    if (!isReachable(reachableWithBoth, ea)) return false;
  }
  let hasYellow = false, hasBlue = false;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === TILE.YELLOW_KEY_DOOR) hasYellow = true;
      if (map[y][x] === TILE.BLUE_KEY_DOOR) hasBlue = true;
    }
  }
  if (!hasYellow || !hasBlue) return false;
  if (map[yellowKeycardTile.y][yellowKeycardTile.x] !== TILE.FLOOR) return false;
  if (map[blueKeycardTile.y][blueKeycardTile.x] !== TILE.FLOOR) return false;
  return true;
}
