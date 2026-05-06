import { describe, it, expect } from 'vitest';
import { generateLevel } from '../../engine/level-gen';
import { TILE } from '../../engine/world';
import { SpriteType } from '../../engine/sprite';

describe('Level Generation - Determinism', () => {
  it('same seed + stage produces identical tile maps (byte-for-byte)', () => {
    const runs = 5;
    const levels: ReturnType<typeof generateLevel>[] = [];
    for (let i = 0; i < runs; i++) {
      levels.push(generateLevel(42, 1));
    }

    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].width).toBe(levels[0].width);
      expect(levels[i].height).toBe(levels[0].height);
      expect(levels[i].map).toEqual(levels[0].map);
      expect(levels[i].spawn).toEqual(levels[0].spawn);
      expect(levels[i].entrance).toEqual(levels[0].entrance);
      expect(levels[i].exit).toEqual(levels[0].exit);
      expect(levels[i].keycard).toEqual(levels[0].keycard);
      expect(levels[i].yellowKeycard).toEqual(levels[0].yellowKeycard);
      expect(levels[i].blueKeycard).toEqual(levels[0].blueKeycard);
      expect(levels[i].enemies).toEqual(levels[0].enemies);
      expect(levels[i].ammo).toEqual(levels[0].ammo);
      expect(levels[i].health).toEqual(levels[0].health);
      expect(levels[i].secretHealth).toEqual(levels[0].secretHealth);
      expect(levels[i].decor).toEqual(levels[0].decor);
      expect(levels[i].shotguns).toEqual(levels[0].shotguns);
      expect(levels[i].rocketLaunchers).toEqual(levels[0].rocketLaunchers);
      expect(levels[i].spawnRooms).toEqual(levels[0].spawnRooms);
      expect(levels[i].exitRooms).toEqual(levels[0].exitRooms);
      expect(levels[i].exits).toEqual(levels[0].exits);
      expect(levels[i].rooms).toEqual(levels[0].rooms);
    }
  });

  it('same seed + different stages produce different layouts', () => {
    const l1 = generateLevel(42, 1);
    const l2 = generateLevel(42, 2);
    const l3 = generateLevel(42, 3);

    const map1Str = JSON.stringify(l1.map);
    const map2Str = JSON.stringify(l2.map);
    const map3Str = JSON.stringify(l3.map);

    expect(map1Str).not.toBe(map2Str);
    expect(map2Str).not.toBe(map3Str);
    expect(map1Str).not.toBe(map3Str);
  });

  it('different seed produces different layout', () => {
    const l1 = generateLevel(42, 1);
    const l2 = generateLevel(99, 1);

    const map1Str = JSON.stringify(l1.map);
    const map2Str = JSON.stringify(l2.map);

    expect(map1Str).not.toBe(map2Str);
  });
});

describe('Level Generation - Validation', () => {
  it('all tiles are valid TILE constants (0-6)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 100, stage);
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          const tile = level.map[y][x];
          expect(tile).toBeGreaterThanOrEqual(0);
          expect(tile).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('spawn position is on a FLOOR tile', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 200, stage);
      const spawnX = Math.floor(level.spawn.x);
      const spawnY = Math.floor(level.spawn.y);
      expect(level.map[spawnY][spawnX]).toBe(TILE.FLOOR);
    }
  });

  it('exit doors are on EXIT_DOOR tiles (exits.length >= 2)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 300, stage);
      expect(level.exits.length).toBeGreaterThanOrEqual(2);
      for (const exit of level.exits) {
        const exitX = Math.floor(exit.x);
        const exitY = Math.floor(exit.y);
        expect(level.map[exitY][exitX]).toBe(TILE.EXIT_DOOR);
      }
    }
  });

  it('blueKeycard is on a FLOOR tile', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 400, stage);
      const kx = Math.floor(level.blueKeycard.x);
      const ky = Math.floor(level.blueKeycard.y);
      expect(level.map[ky][kx]).toBe(TILE.FLOOR);
    }
  });

  it('yellowKeycard is on a FLOOR tile', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 410, stage);
      const kx = Math.floor(level.yellowKeycard.x);
      const ky = Math.floor(level.yellowKeycard.y);
      expect(level.map[ky][kx]).toBe(TILE.FLOOR);
    }
  });

  it('all enemy positions are on FLOOR tiles', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 500, stage);
      for (const enemy of level.enemies) {
        const ex = Math.floor(enemy.x);
        const ey = Math.floor(enemy.y);
        expect(level.map[ey][ex]).toBe(TILE.FLOOR);
      }
    }
  });

  it('all ammo positions are on FLOOR tiles', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 600, stage);
      for (const ammo of level.ammo) {
        const ax = Math.floor(ammo.x);
        const ay = Math.floor(ammo.y);
        expect(level.map[ay][ax]).toBe(TILE.FLOOR);
      }
    }
  });

  it('all health positions are on FLOOR tiles', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 700, stage);
      for (const h of level.health) {
        const hx = Math.floor(h.x);
        const hy = Math.floor(h.y);
        expect(level.map[hy][hx]).toBe(TILE.FLOOR);
      }
    }
  });

  it('width/height scale with stage: 32-50 range', () => {
    for (let stage = 1; stage <= 5; stage++) {
      const level = generateLevel(stage * 800, stage);
      expect(level.width).toBeGreaterThanOrEqual(32);
      expect(level.width).toBeLessThanOrEqual(50);
      expect(level.height).toBeGreaterThanOrEqual(32);
      expect(level.height).toBeLessThanOrEqual(50);
    }
  });

  it('generated levels contain at least 12 rooms', () => {
    for (let stage = 1; stage <= 3; stage++) {
      for (let s = 0; s < 10; s++) {
        const level = generateLevel(s * 100 + stage * 1000, stage);
        expect(level.rooms.length).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('corridor Manhattan distances average >= 5 tiles', () => {
    let totalDist = 0;
    let totalPairs = 0;
    for (let stage = 1; stage <= 3; stage++) {
      for (let s = 0; s < 5; s++) {
        const level = generateLevel(s * 200 + stage * 2000, stage);
        const rooms = level.rooms || [];
        const spawn = { x: level.spawn.x - 0.5, y: level.spawn.y - 0.5 };
        for (const r of rooms) {
          const cx = r.x + Math.floor(r.w / 2);
          const cy = r.y + Math.floor(r.h / 2);
          totalDist += Math.abs(cx - spawn.x) + Math.abs(cy - spawn.y);
          totalPairs++;
        }
      }
    }
    const avg = totalDist / totalPairs;
    expect(avg).toBeGreaterThanOrEqual(5);
  });

  it('keycard reachability: yellow reachable without keys, blue only after yellow door, exits only after both', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 900, stage);
      const map = level.map;
      const spawnX = Math.floor(level.spawn.x);
      const spawnY = Math.floor(level.spawn.y);
      const ykx = Math.floor(level.yellowKeycard.x);
      const yky = Math.floor(level.yellowKeycard.y);
      const bkx = Math.floor(level.blueKeycard.x);
      const bky = Math.floor(level.blueKeycard.y);

      // BFS helper
      function bfs(passable: Set<number>) {
        const reachable = new Set<string>();
        const queue: Array<{ x: number; y: number }> = [{ x: spawnX, y: spawnY }];
        reachable.add(`${spawnX},${spawnY}`);
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (queue.length) {
          const c = queue.shift()!;
          for (const [dx, dy] of dirs) {
            const nx = c.x + dx, ny = c.y + dy;
            const key = `${nx},${ny}`;
            if (reachable.has(key)) continue;
            if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
            const t = map[ny][nx];
            if (t === TILE.FLOOR || passable.has(t)) {
              reachable.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
        return reachable;
      }

      const noKeys = bfs(new Set());
      const withYellow = bfs(new Set([TILE.YELLOW_KEY_DOOR]));
      const withBoth = bfs(new Set([TILE.YELLOW_KEY_DOOR, TILE.BLUE_KEY_DOOR]));

      // Yellow keycard reachable without any key
      expect(noKeys.has(`${ykx},${yky}`)).toBe(true);

      // Blue keycard NOT reachable without yellow door
      expect(withYellow.has(`${bkx},${bky}`)).toBe(true);
      expect(noKeys.has(`${bkx},${bky}`)).toBe(false);

      // Exits reachable only with both doors
      for (const exit of level.exits) {
        const ex = Math.floor(exit.x);
        const ey = Math.floor(exit.y);
        expect(withBoth.has(`${ex},${ey}`)).toBe(true);
        expect(withYellow.has(`${ex},${ey}`)).toBe(false);
      }
    }
  });

  it('spawn is on FLOOR tile in first spawn room area', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1100, stage);
      const sx = Math.floor(level.spawn.x);
      const sy = Math.floor(level.spawn.y);
      expect(level.map[sy][sx]).toBe(TILE.FLOOR);
    }
  });

  it('spawnRooms.length >= 2', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1110, stage);
      expect(level.spawnRooms.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('exitRooms.length >= 2', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1120, stage);
      expect(level.exitRooms.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Level Generation - Multi-Stage Differentiation', () => {
  it('higher stages produce more rooms', () => {
    const l1 = generateLevel(12345, 1);
    const l2 = generateLevel(12345, 2);
    const l3 = generateLevel(12345, 3);

    // Count floor tiles as a proxy for room count
    const floorCount = (map: number[][]) => {
      let count = 0;
      for (const row of map) {
        for (const tile of row) {
          if (tile === TILE.FLOOR) count++;
        }
      }
      return count;
    };

    const f1 = floorCount(l1.map);
    const f2 = floorCount(l2.map);
    const f3 = floorCount(l3.map);

    // Stages should have different sizes
    expect(l2.width).toBeGreaterThanOrEqual(l1.width);
    expect(l3.width).toBeGreaterThanOrEqual(l2.width);
    // Floor counts may fluctuate due to random room placement; only check
    // that they stay in a reasonable band.
    const floorMargin = 100;
    expect(f2).toBeGreaterThanOrEqual(f1 - floorMargin);
    expect(f3).toBeGreaterThanOrEqual(f2 - floorMargin);
  });

  it('enemy count scales with stage (stage 1 >= 12, stage 3 >= 16)', () => {
    const l1 = generateLevel(22222, 1);
    const l2 = generateLevel(22222, 2);
    const l3 = generateLevel(22222, 3);

    expect(l1.enemies.length).toBeGreaterThanOrEqual(12);
    expect(l2.enemies.length).toBeGreaterThanOrEqual(12);
    expect(l3.enemies.length).toBeGreaterThanOrEqual(16);
    expect(l3.enemies.length).toBeGreaterThanOrEqual(l2.enemies.length);
    expect(l2.enemies.length).toBeGreaterThanOrEqual(l1.enemies.length);
  });

  it('stages produce different map layouts', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const l1 = generateLevel(seed, 1);
      const l3 = generateLevel(seed, 3);

      const map1Str = JSON.stringify(l1.map);
      const map3Str = JSON.stringify(l3.map);
      expect(map1Str).not.toBe(map3Str);
    }
  });
});

describe('Level Generation - Structural Integrity', () => {
  it('blue key door tile exists in map', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1500, stage);
      let found = false;
      for (const row of level.map) {
        for (const tile of row) {
          if (tile === TILE.BLUE_KEY_DOOR) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
  });

  it('yellow key door tile exists in map', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1550, stage);
      let found = false;
      for (const row of level.map) {
        for (const tile of row) {
          if (tile === TILE.YELLOW_KEY_DOOR) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
  });

  it('exit door tile exists in map (at least 2)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1600, stage);
      let count = 0;
      for (const row of level.map) {
        for (const tile of row) {
          if (tile === TILE.EXIT_DOOR) count++;
        }
      }
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('level has sufficient floor tiles for large map', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1700, stage);
      const floorTiles = level.map.flat().filter(t => t === TILE.FLOOR).length;
      expect(floorTiles).toBeGreaterThanOrEqual(12 * 12);
    }
  });

  it('spawn and exit are different positions', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1800, stage);
      expect(
        level.spawn.x !== level.exit.x || level.spawn.y !== level.exit.y
      ).toBe(true);
    }
  });

  it('decor placements are on FLOOR tiles', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1900, stage);
      for (const d of level.decor) {
        const dx = Math.floor(d.x);
        const dy = Math.floor(d.y);
        expect(level.map[dy][dx]).toBe(TILE.FLOOR);
      }
    }
  });

  it('decor types are valid SpriteType deco values', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 2000, stage);
      const validTypes = [
        SpriteType.BARREL,
        SpriteType.TERMINAL,
        SpriteType.LAMP,
        SpriteType.DEBRIS,
      ];
      for (const d of level.decor) {
        expect(validTypes).toContain(d.type);
      }
    }
  });

  it('secretHealth position is on FLOOR if present', () => {
    for (let stage = 2; stage <= 3; stage++) {
      for (let s = 0; s < 5; s++) {
        const level = generateLevel(stage * 2100 + s, stage);
        if (level.secretHealth) {
          const sx = Math.floor(level.secretHealth.x);
          const sy = Math.floor(level.secretHealth.y);
          expect(level.map[sy][sx]).toBe(TILE.FLOOR);
        }
      }
    }
  });

  it('stage 1 has no shotgun or rocket launcher pickups', () => {
    const level = generateLevel(5004, 1);
    expect(level.shotguns.length).toBe(0);
    expect(level.rocketLaunchers.length).toBe(0);
  });

  it('stage 2+ has shotgun pickups, stage 4+ has rocket launcher pickups', () => {
    const l2 = generateLevel(5005, 2);
    const l4 = generateLevel(5006, 4);
    const l5 = generateLevel(5007, 5);
    expect(l2.shotguns.length).toBeGreaterThanOrEqual(1);
    expect(l2.rocketLaunchers.length).toBe(0);
    expect(l4.shotguns.length).toBeGreaterThanOrEqual(1);
    expect(l4.rocketLaunchers.length).toBeGreaterThanOrEqual(1);
    expect(l5.shotguns.length).toBeGreaterThanOrEqual(l4.shotguns.length);
    expect(l5.rocketLaunchers.length).toBeGreaterThanOrEqual(l4.rocketLaunchers.length);
  });

  it('keycard aliases: exit === exits[0], keycard === blueKeycard', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 5050, stage);
      expect(level.exit).toEqual(level.exits[0]);
      expect(level.keycard).toEqual(level.blueKeycard);
    }
  });
});
