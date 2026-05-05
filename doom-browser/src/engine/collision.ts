import { MAP_WIDTH, MAP_HEIGHT, worldState } from './world';

/**
 * Kollisions-Utilities für grid-basierte Wand-Kollision.
 * 
 * Der Spieler hat einen Kollisions-Radius (~0.25 Tiles), wodurch er nicht
 * komplett in Wände schlüpfen kann. Bewegungen werden achsenseparat geprüft
 * (erst X, dann Y), was "Sliding" an Wänden ermöglicht.
 * 
 * WICHTIG: Alle Kollisionsprüfungen nutzen worldState.isSolidTile() statt
 * direkt WORLD_MAP, um dynamische Türzustände zu berücksichtigen.
 */

/** Radius des Spielers für Kollisionszwecke */
export const PLAYER_RADIUS = 0.25;

/** Radius eines Gegners für Kollisionszwecke (gleich wie Spieler) */
export const ENEMY_RADIUS = 0.25;

/** Mindestabstand zwischen Spieler und Gegner (Summe der Radien + kleiner Puffer) */
export const MIN_ENTITY_DIST = PLAYER_RADIUS + ENEMY_RADIUS + 0.05;

/**
 * Resolve circle-circle overlap between two entities.
 * Returns the push vector for entity A to move it out of entity B.
 */
export function resolveEntityCollision(
  ax: number, ay: number, aRadius: number,
  bx: number, by: number, bRadius: number
): { dx: number, dy: number } {
  const dx = ax - bx;
  const dy = ay - by;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = aRadius + bRadius;

  if (dist < 0.001) {
    // Entities are on top of each other — push A along +X
    return { dx: minDist, dy: 0 };
  }

  if (dist >= minDist) {
    return { dx: 0, dy: 0 }; // No overlap
  }

  // Push A away from B along the connection axis
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  return { dx: nx * overlap, dy: ny * overlap };
}

/**
 * Prüft, ob das gegebene Grid-Tile eine Wand ist.
 * Nutzt worldState.isSolidTile() um dynamische Türzustände zu berücksichtigen.
 */
export function isWall(mapX: number, mapY: number): boolean {
  if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
    return true; // Außerhalb der Karte = Wand
  }
  return worldState.isSolidTile(mapX, mapY);
}

/**
 * Prüft, ob ein Kreis (Mittelpunkt x/y, gegebener Radius) eine Wand berührt.
 *
 * Echtes Circle-vs-AABB-Sweep: für jedes Tile im Bounding-Box-Bereich des
 * Kreises wird der nächstgelegene Punkt des 1×1-Wand-Quadrats berechnet und
 * gegen den Radius geprüft. Damit sliden Spieler/Gegner korrekt um
 * Außenecken herum, statt an den Eckpunkten an einer unsichtbaren Wand
 * zu hängen (wie es ein reiner AABB-Eckpunkt-Check täte).
 */
export function positionCollides(
  x: number,
  y: number,
  radius: number = PLAYER_RADIUS
): boolean {
  const x0 = Math.floor(x - radius);
  const x1 = Math.floor(x + radius);
  const y0 = Math.floor(y - radius);
  const y1 = Math.floor(y + radius);
  const r2 = radius * radius;

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isWall(tx, ty)) continue;
      // Nächster Punkt der Tile-AABB [tx, tx+1] × [ty, ty+1] zum Kreismittelpunkt
      const px = x < tx ? tx : (x > tx + 1 ? tx + 1 : x);
      const py = y < ty ? ty : (y > ty + 1 ? ty + 1 : y);
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy < r2) return true;
    }
  }
  return false;
}

/**
 * Berechnet die sichere Bewegung auf einer einzelnen Achse mit Sliding.
 * 
 * Wenn die Zielposition kollidiert, wird die Bewegung schrittweise
 * reduziert, bis eine freie Position gefunden wird (oder die Bewegung
 * komplett blockiert ist).
 * 
 * @param currentPos Aktuelle Position auf der Achse (x oder y)
 * @param delta Gewünschte Bewegungsänderung
 * @param fixedPos Die andere Achse (fixiert während des Checks)
 * @param radius Kollisionsradius des Spielers
 * @returns Die sichere neue Position auf dieser Achse
 */
export function slideAlongAxis(
  currentPos: number,
  delta: number,
  fixedPos: number,
  radius: number = PLAYER_RADIUS
): number {
  const targetPos = currentPos + delta;

  // Falls kein Kollisionscheck nötig, sofort zurück
  if (!positionCollides(targetPos, fixedPos, radius)) {
    return targetPos;
  }

  // Sliding: Bewegung schrittweise reduzieren
  // Schritt 1: Prüfe, ob gar keine Bewegung möglich
  if (positionCollides(currentPos, fixedPos, radius)) {
    // Spieler steckt fest (sollte nicht passieren), bleib an Ort
    return currentPos;
  }

  // Schritt 2: Binäre Suche nach der maximalen sicheren Bewegung
  const direction = delta > 0 ? 1 : -1;
  let low = 0;
  let high = Math.abs(delta);
  const steps = 8; // Präzision: 2^8 = 256 Unterteilungen reicht

  for (let i = 0; i < steps; i++) {
    const mid = (low + high) / 2;
    const testPos = currentPos + direction * mid;

    if (positionCollides(testPos, fixedPos, radius)) {
      high = mid; // Zu weit, reduzieren
    } else {
      low = mid; // OK, weiter testen
    }
  }

  return currentPos + direction * low;
}

/**
 * Checks if a proposed position (px, py) with the given radius would overlap
 * with any entity in the obstacles list.
 */
export function wouldOverlapEntity(
  px: number, py: number, pRadius: number,
  obstacles: { x: number, y: number, radius: number }[]
): boolean {
  for (const obs of obstacles) {
    const dx = px - obs.x;
    const dy = py - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < pRadius + obs.radius) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve all pairwise entity overlaps in a list of entities.
 * Each entity is pushed proportional to its inverse weight (higher weight = pushed less).
 * Pushes are wall-clamped: if a target position would land in a wall, that
 * entity stays put and the other side absorbs the full push (also wall-clamped).
 */
export function resolveAllEntityOverlaps(
  entities: { x: number, y: number, radius: number, weight: number }[]
): void {
  const n = entities.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = entities[i];
      const b = entities[j];
      const push = resolveEntityCollision(a.x, a.y, a.radius, b.x, b.y, b.radius);

      if (push.dx === 0 && push.dy === 0) continue;

      const totalWeight = a.weight + b.weight;
      let aFactor = b.weight / totalWeight;
      let bFactor = a.weight / totalWeight;

      const aTargetX = a.x + push.dx * aFactor;
      const aTargetY = a.y + push.dy * aFactor;
      const bTargetX = b.x - push.dx * bFactor;
      const bTargetY = b.y - push.dy * bFactor;

      const aBlocked = positionCollides(aTargetX, aTargetY, a.radius);
      const bBlocked = positionCollides(bTargetX, bTargetY, b.radius);

      if (!aBlocked && !bBlocked) {
        a.x = aTargetX; a.y = aTargetY;
        b.x = bTargetX; b.y = bTargetY;
      } else if (aBlocked && !bBlocked) {
        // a can't move — try to push b alone with the full overlap
        const fullBX = b.x - push.dx;
        const fullBY = b.y - push.dy;
        if (!positionCollides(fullBX, fullBY, b.radius)) {
          b.x = fullBX; b.y = fullBY;
        } else {
          b.x = bTargetX; b.y = bTargetY;
        }
      } else if (!aBlocked && bBlocked) {
        const fullAX = a.x + push.dx;
        const fullAY = a.y + push.dy;
        if (!positionCollides(fullAX, fullAY, a.radius)) {
          a.x = fullAX; a.y = fullAY;
        } else {
          a.x = aTargetX; a.y = aTargetY;
        }
      }
      // both blocked → leave both in place; engine will resolve next frame
    }
  }
}