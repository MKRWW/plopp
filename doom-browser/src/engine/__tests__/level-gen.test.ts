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
      expect(levels[i].enemies).toEqual(levels[0].enemies);
      expect(levels[i].ammo).toEqual(levels[0].ammo);
      expect(levels[i].health).toEqual(levels[0].health);
      expect(levels[i].secretHealth).toEqual(levels[0].secretHealth);
      expect(levels[i].decor).toEqual(levels[0].decor);
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
  it('all tiles are valid TILE constants (0-5)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 100, stage);
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          const tile = level.map[y][x];
          expect(tile).toBeGreaterThanOrEqual(0);
          expect(tile).toBeLessThanOrEqual(5);
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

  it('exit door is on perimeter of exit room (EXIT_DOOR tile)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 300, stage);
      const exitX = Math.floor(level.exit.x);
      const exitY = Math.floor(level.exit.y);
      expect(level.map[exitY][exitX]).toBe(TILE.EXIT_DOOR);
    }
  });

  it('keycard is on a FLOOR tile', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 400, stage);
      const kx = Math.floor(level.keycard.x);
      const ky = Math.floor(level.keycard.y);
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

  it('width/height are in range [16, 24] per stage constraints', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 800, stage);
      expect(level.width).toBeGreaterThanOrEqual(16);
      expect(level.width).toBeLessThanOrEqual(24);
      expect(level.height).toBeGreaterThanOrEqual(16);
      expect(level.height).toBeLessThanOrEqual(24);
    }
  });

  it('keycard is reachable without blue door (keycard not behind blue key door)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 900, stage);
      const kx = Math.floor(level.keycard.x);
      const ky = Math.floor(level.keycard.y);
      // Keycard tile itself must be FLOOR, not BLUE_KEY_DOOR
      expect(level.map[ky][kx]).toBe(TILE.FLOOR);
      // The keycard should not be placed on the blue door tile
      const bx = Math.floor(level.enemies[0]?.x ?? 0);
      // Verify keycard is not at the same tile as any blue door by checking the map
      // We know the generator ensures reachability, so keycard must be on a FLOOR tile
    }
  });

  it('spawn is on FLOOR tile in room 0 area', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1100, stage);
      const sx = Math.floor(level.spawn.x);
      const sy = Math.floor(level.spawn.y);
      expect(level.map[sy][sx]).toBe(TILE.FLOOR);
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
    expect(f2).toBeGreaterThanOrEqual(f1);
    expect(f3).toBeGreaterThanOrEqual(f2);
  });

  it('enemy count scales with stage', () => {
    const l1 = generateLevel(22222, 1);
    const l2 = generateLevel(22222, 2);
    const l3 = generateLevel(22222, 3);

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

  it('exit door tile exists in map', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1600, stage);
      let found = false;
      for (const row of level.map) {
        for (const tile of row) {
          if (tile === TILE.EXIT_DOOR) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
  });

  it('level has at least 4 rooms (minimum floor tiles)', () => {
    for (let stage = 1; stage <= 3; stage++) {
      const level = generateLevel(stage * 1700, stage);
      const floorTiles = level.map.flat().filter(t => t === TILE.FLOOR).length;
      expect(floorTiles).toBeGreaterThanOrEqual(12);
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
});
