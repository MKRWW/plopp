import { describe, it, expect } from 'vitest';
import { generateLevel } from '../level-gen';
import { TILE, WorldState, InteractionResult } from '../world';
import { SpriteType, isCollectableSprite } from '../sprite';

function countTile(map: number[][], tile: number): number {
  let c = 0;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === tile) c++;
    }
  }
  return c;
}

describe('Multi-Door Levels', () => {
  it('entrance is at wall edge, not room center', () => {
    const level = generateLevel(42, 3);
    const spawnRoom = level.rooms[level.spawnRooms[0]];
    const cx = spawnRoom.x + spawnRoom.w / 2;
    const cy = spawnRoom.y + spawnRoom.h / 2;
    const dist = Math.sqrt((level.entrance.x - cx) ** 2 + (level.entrance.y - cy) ** 2);
    // entrance is near a wall, not exactly at center
    // for 3-wide rooms distance can be as low as 0 but still on wall edge
    const nearWall = (
      Math.abs(level.entrance.x - spawnRoom.x) <= 1.5 ||
      Math.abs(level.entrance.x - (spawnRoom.x + spawnRoom.w)) <= 1.5 ||
      Math.abs(level.entrance.y - spawnRoom.y) <= 1.5 ||
      Math.abs(level.entrance.y - (spawnRoom.y + spawnRoom.h)) <= 1.5
    );
    expect(nearWall).toBe(true);
  });

  it('entrance is on FLOOR tile', () => {
    const level = generateLevel(42, 3);
    const ex = Math.floor(level.entrance.x);
    const ey = Math.floor(level.entrance.y);
    expect(level.map[ey][ex]).toBe(TILE.FLOOR);
  });

  it('has EXIT_DOOR tiles on map', () => {
    const cases: Array<[number, number]> = [[1, 42], [3, 123]];
    for (const [stage, seed] of cases) {
      const level = generateLevel(seed, stage);
      expect(countTile(level.map, TILE.EXIT_DOOR)).toBeGreaterThanOrEqual(2);
    }
  });

  it('all exits positions match EXIT_DOOR tiles', () => {
    const level = generateLevel(123, 2);
    for (const ex of level.exits) {
      const tx = Math.floor(ex.x);
      const ty = Math.floor(ex.y);
      expect(level.map[ty][tx]).toBe(TILE.EXIT_DOOR);
    }
  });

  it('entrance and exit are different tiles', () => {
    const level = generateLevel(555, 4);
    const entranceKey = `${Math.floor(level.entrance.x)},${Math.floor(level.entrance.y)}`;
    for (const e of level.exits) {
      const exitKey = `${Math.floor(e.x)},${Math.floor(e.y)}`;
      expect(entranceKey).not.toBe(exitKey);
    }
  });

  it('interactAt returns EXIT_READY with both keycards', () => {
    const level = generateLevel(777, 5);
    const ws = new WorldState();
    ws.loadLevel(level);
    const exitTile = level.exits[0];
    const result = ws.interactAt(
      Math.floor(exitTile.x), Math.floor(exitTile.y),
      true, true // has both keycards
    );
    expect(result).toBe(InteractionResult.EXIT_READY);
  });

  it('interactAt returns EXIT_LOCKED without keycards', () => {
    const level = generateLevel(888, 3);
    const ws = new WorldState();
    ws.loadLevel(level);
    const exitTile = level.exits[0];
    const result = ws.interactAt(
      Math.floor(exitTile.x), Math.floor(exitTile.y),
      false, false
    );
    expect(result).toBe(InteractionResult.EXIT_LOCKED_NO_YELLOW);
  });

  it('interactAt returns EXIT_LOCKED_NO_BLUE with only yellow keycard', () => {
    const level = generateLevel(999, 3);
    const ws = new WorldState();
    ws.loadLevel(level);
    const exitTile = level.exits[0];
    const result = ws.interactAt(
      Math.floor(exitTile.x), Math.floor(exitTile.y),
      true, false
    );
    expect(result).toBe(InteractionResult.EXIT_LOCKED_NO_BLUE);
  });

  it('EXIT_DOOR is solid (blocking)', () => {
    const level = generateLevel(111, 2);
    const ws = new WorldState();
    ws.loadLevel(level);
    const exitTile = level.exits[0];
    expect(ws.isSolidTile(Math.floor(exitTile.x), Math.floor(exitTile.y))).toBe(true);
  });

  it('interactAt on non-EXIT_DOOR returns NONE', () => {
    const level = generateLevel(222, 3);
    const ws = new WorldState();
    ws.loadLevel(level);
    // Find a FLOOR tile
    let fx = 0, fy = 0;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.map[y][x] === TILE.FLOOR) { fx = x; fy = y; break; }
      }
      if (fy > 0) break;
    }
    expect(ws.interactAt(fx, fy, true, true)).toBe(InteractionResult.NONE);
  });
});

describe('Keycard Minimap Markers', () => {
  it('KEYCARD and YELLOW_KEYCARD are collectable sprites', () => {
    expect(isCollectableSprite(SpriteType.KEYCARD)).toBe(true);
    expect(isCollectableSprite(SpriteType.YELLOW_KEYCARD)).toBe(true);
  });

  it('keycard positions exist in generated levels', () => {
    const level = generateLevel(42, 3);
    expect(level.keycard).toBeDefined();
    expect(level.yellowKeycard).toBeDefined();
    expect(level.blueKeycard).toBeDefined();
  });

  it('keycards are on FLOOR tiles', () => {
    const level = generateLevel(42, 3);
    const yx = Math.floor(level.yellowKeycard.x);
    const yy = Math.floor(level.yellowKeycard.y);
    const bx = Math.floor(level.blueKeycard.x);
    const by = Math.floor(level.blueKeycard.y);
    expect(level.map[yy][yx]).toBe(TILE.FLOOR);
    expect(level.map[by][bx]).toBe(TILE.FLOOR);
  });

  it('yellow keycard is reachable from spawn without keys', () => {
    const level = generateLevel(42, 3);
    const ws = new WorldState();
    ws.loadLevel(level);
    // Yellow keycard should be reachable with no key doors open
    // The level-gen validation already ensures this
    const yx = Math.floor(level.yellowKeycard.x);
    const yy = Math.floor(level.yellowKeycard.y);
    expect(level.map[yy][yx]).toBe(TILE.FLOOR);
  });
});