/**
 * Standalone-Probe für die Kollisionslogik.
 *
 * Iteriert über alle (x,y) Positionen der Map mit feiner Auflösung und
 * vergleicht das Ergebnis von positionCollides() mit der mathematisch
 * korrekten Antwort (Euklidische Distanz zum nächsten Wand-Tile ≥ Radius).
 *
 * Außerdem: für eine Reihe "kritischer" Positionen (entlang Wandkanten und
 * Außenecken der Map) wird geprüft, ob der Spieler in 8 Richtungen freie
 * Bewegung hat, wenn die Geometrie es erlaubt.
 *
 * Run via:
 *   npx esbuild src/debug/collision-probe.ts --bundle --platform=node \
 *     --outfile=tmp-probe.cjs && node tmp-probe.cjs
 */

import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT } from '../engine/world';
import { positionCollides, PLAYER_RADIUS, slideAlongX, slideAlongY } from '../engine/collision';

function isWallTile(x: number, y: number): boolean {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true;
  return WORLD_MAP[y][x] > 0;
}

/** Brute-force minimum distance from (x,y) to the boundary of any wall tile. */
function trueMinWallDist(x: number, y: number): number {
  let best = Infinity;
  for (let ty = 0; ty < MAP_HEIGHT; ty++) {
    for (let tx = 0; tx < MAP_WIDTH; tx++) {
      if (!isWallTile(tx, ty)) continue;
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      const d = Math.hypot(x - cx, y - cy);
      if (d < best) best = d;
    }
  }
  return best;
}

function main(): void {
  const step = 0.02;
  let mismatches = 0;
  let mismatchSamples: Array<{ x: number, y: number, dist: number, collides: boolean }> = [];

  for (let y = step; y < MAP_HEIGHT; y += step) {
    for (let x = step; x < MAP_WIDTH; x += step) {
      // Skip positions inside walls (always collide, expected).
      if (isWallTile(Math.floor(x), Math.floor(y))) continue;
      const dist = trueMinWallDist(x, y);
      const collides = positionCollides(x, y, PLAYER_RADIUS);
      const shouldCollide = dist < PLAYER_RADIUS;
      if (collides !== shouldCollide) {
        mismatches++;
        if (mismatchSamples.length < 12) {
          mismatchSamples.push({ x, y, dist, collides });
        }
      }
    }
  }

  console.log(`positionCollides sweep:`);
  console.log(`  step=${step}, samples~${Math.round((MAP_WIDTH - step) * (MAP_HEIGHT - step) / (step * step))}`);
  console.log(`  mismatches: ${mismatches}`);
  if (mismatchSamples.length > 0) {
    console.log(`  first samples:`);
    for (const s of mismatchSamples) {
      console.log(`    pos=(${s.x.toFixed(3)}, ${s.y.toFixed(3)}) dist=${s.dist.toFixed(4)} collides=${s.collides}`);
    }
  }

  // Probe: critical "outside corners" — points slightly off a corner tile, walking past.
  // These reveal whether sliding around a single-tile pillar works.
  const pillars: Array<{ x: number, y: number }> = [];
  for (let ty = 0; ty < MAP_HEIGHT; ty++) {
    for (let tx = 0; tx < MAP_WIDTH; tx++) {
      if (!isWallTile(tx, ty)) continue;
      // pillar = wall tile with at least 2 free orthogonal neighbours
      let freeNb = 0;
      if (!isWallTile(tx + 1, ty)) freeNb++;
      if (!isWallTile(tx - 1, ty)) freeNb++;
      if (!isWallTile(tx, ty + 1)) freeNb++;
      if (!isWallTile(tx, ty - 1)) freeNb++;
      if (freeNb >= 3) pillars.push({ x: tx, y: ty });
    }
  }

  console.log(`\nfound ${pillars.length} outside-corner-rich tiles`);
  for (const p of pillars) {
    console.log(`  tile (${p.x},${p.y}):`);
    // Test if a player at center of each free neighbour can walk diagonally toward
    // and around the corner.
    const corners = [
      { dx: 1.5, dy: -0.5 }, // NE of tile
      { dx: 1.5, dy: 1.5 },  // SE
      { dx: -0.5, dy: 1.5 }, // SW
      { dx: -0.5, dy: -0.5 } // NW
    ];
    for (const c of corners) {
      const px = p.x + c.dx;
      const py = p.y + c.dy;
      if (px < 0.5 || py < 0.5 || px >= MAP_WIDTH - 0.5 || py >= MAP_HEIGHT - 0.5) continue;
      if (positionCollides(px, py, PLAYER_RADIUS)) continue; // stuck spawn — skip
      // Try a diagonal step toward the tile corner closest to (px,py)
      const tcx = c.dx > 0 ? p.x : p.x + 1;
      const tcy = c.dy > 0 ? p.y : p.y + 1;
      const stepLen = 0.3;
      const dirX = (tcx - px);
      const dirY = (tcy - py);
      const mag = Math.hypot(dirX, dirY) || 1;
      const moveX = (dirX / mag) * stepLen;
      const moveY = (dirY / mag) * stepLen;
      // Player.move emulation: axis-separate slideAlongX/slideAlongY.
      const newX = slideAlongX(px, moveX, py, PLAYER_RADIUS);
      const newY = slideAlongY(py, moveY, newX, PLAYER_RADIUS);
      const totalMoved = Math.hypot(newX - px, newY - py);
      const ratio = totalMoved / stepLen;
      if (ratio < 0.1) {
        console.log(`    [STUCK]    from (${px.toFixed(2)},${py.toFixed(2)}) toward (${tcx},${tcy}): moved ${totalMoved.toFixed(3)}/${stepLen}`);
      } else if (ratio < 0.6) {
        console.log(`    [reduced]  from (${px.toFixed(2)},${py.toFixed(2)}) toward (${tcx},${tcy}): moved ${totalMoved.toFixed(3)}/${stepLen} (${(ratio*100).toFixed(0)}%)`);
      }
    }
  }
}

main();
