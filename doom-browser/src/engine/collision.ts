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

/** Radius für Rocket-Projectiles */
export const ROCKET_RADIUS = 0.15;

/**
 * Checks if a rocket projectile at (rx, ry) would overlap with any entity
 * in the obstacles list (e.g., enemies).
 */
export function rocketHitsEntity(
  rx: number, ry: number,
  obstacles: { x: number, y: number, radius: number }[]
): boolean {
  const rocketR = ROCKET_RADIUS;
  for (const obs of obstacles) {
    const dx = rx - obs.x;
    const dy = ry - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < rocketR + obs.radius) {
      return true;
    }
  }
  return false;
}

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
 * Berechnet die sichere X-Bewegung mit Sliding an Wänden.
 * Prüft positionCollides(testX, y, radius).
 *
 * @param currentX Aktuelle X-Position
 * @param deltaX Gewünschte X-Bewegung
 * @param y Fixierte Y-Position während des Checks
 * @param radius Kollisionsradius
 * @returns Die sichere neue X-Position
 */
export function slideAlongX(
  currentX: number,
  deltaX: number,
  y: number,
  radius: number = PLAYER_RADIUS
): number {
  const targetX = currentX + deltaX;

  if (!positionCollides(targetX, y, radius)) {
    return targetX;
  }

  if (positionCollides(currentX, y, radius)) {
    return currentX;
  }

  const direction = deltaX > 0 ? 1 : -1;
  let low = 0;
  let high = Math.abs(deltaX);
  const steps = 8;

  for (let i = 0; i < steps; i++) {
    const mid = (low + high) / 2;
    const testX = currentX + direction * mid;

    if (positionCollides(testX, y, radius)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return currentX + direction * low;
}

/**
 * Berechnet die sichere Y-Bewegung mit Sliding an Wänden.
 * Prüft positionCollides(x, testY, radius).
 *
 * @param currentY Aktuelle Y-Position
 * @param deltaY Gewünschte Y-Bewegung
 * @param x Fixierte X-Position während des Checks
 * @param radius Kollisionsradius
 * @returns Die sichere neue Y-Position
 */
export function slideAlongY(
  currentY: number,
  deltaY: number,
  x: number,
  radius: number = PLAYER_RADIUS
): number {
  const targetY = currentY + deltaY;

  if (!positionCollides(x, targetY, radius)) {
    return targetY;
  }

  if (positionCollides(x, currentY, radius)) {
    return currentY;
  }

  const direction = deltaY > 0 ? 1 : -1;
  let low = 0;
  let high = Math.abs(deltaY);
  const steps = 8;

  for (let i = 0; i < steps; i++) {
    const mid = (low + high) / 2;
    const testY = currentY + direction * mid;

    if (positionCollides(x, testY, radius)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return currentY + direction * low;
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
 * Checks if there is an unobstructed line of sight between two world positions.
 * Uses the DDA algorithm stepping through tiles until the target is reached
 * or a solid tile is hit.
 *
 * @param fromX - X position of the observer
 * @param fromY - Y position of the observer
 * @param toX - X position of the target
 * @param toY - Y position of the target
 * @returns true if the target is visible (no solid tile blocks the ray)
 */
export function hasLineOfSight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const targetMapX = Math.floor(toX);
  const targetMapY = Math.floor(toY);

  // Same tile — trivially visible
  if (Math.floor(fromX) === targetMapX && Math.floor(fromY) === targetMapY) {
    return true;
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.0001) {
    return true;
  }

  let mapX = Math.floor(fromX);
  let mapY = Math.floor(fromY);

  const deltaDistX = Math.abs(1 / (dx || 0.0001));
  const deltaDistY = Math.abs(1 / (dy || 0.0001));

  let stepX: number;
  let stepY: number;
  let sideDistX: number;
  let sideDistY: number;

  if (dx < 0) {
    stepX = -1;
    sideDistX = (fromX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1.0 - fromX) * deltaDistX;
  }

  if (dy < 0) {
    stepY = -1;
    sideDistY = (fromY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1.0 - fromY) * deltaDistY;
  }

  const maxSteps = Math.ceil(dist * 2) + 20;
  for (let i = 0; i < maxSteps; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
    }

    if (mapX === targetMapX && mapY === targetMapY) {
      return true;
    }

    if (worldState.isSolidTile(mapX, mapY)) {
      return false;
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