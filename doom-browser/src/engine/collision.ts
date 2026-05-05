import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT } from './world';

/**
 * Kollisions-Utilities für grid-basierte Wand-Kollision.
 * 
 * Der Spieler hat einen Kollisions-Radius (~0.25 Tiles), wodurch er nicht
 * komplett in Wände schlüpfen kann. Bewegungen werden achsenseparat geprüft
 * (erst X, dann Y), was "Sliding" an Wänden ermöglicht.
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
 */
export function isWall(mapX: number, mapY: number): boolean {
  if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
    return true; // Außerhalb der Karte = Wand
  }
  return WORLD_MAP[mapY][mapX] > 0;
}

/**
 * Prüft, ob eine Kreis-Position (mit Radius) eine Wand berührt.
 * Testet alle vier Ecken des Bounding-Quadrats um den Kreis sowie
 * das Mittelpunkt-Tile (für Robustheit bei größeren Radien).
 */
export function positionCollides(
  x: number,
  y: number,
  radius: number = PLAYER_RADIUS
): boolean {
  // Teste die vier Ecken des Bounding-Quadrats
  const corners = (
    isWall(Math.floor(x - radius), Math.floor(y - radius)) ||
    isWall(Math.floor(x + radius), Math.floor(y - radius)) ||
    isWall(Math.floor(x - radius), Math.floor(y + radius)) ||
    isWall(Math.floor(x + radius), Math.floor(y + radius))
  );

  // Zusätzlich Mittelpunkt-Tile prüfen (robuster bei Radius > 0.5)
  const center = isWall(Math.floor(x), Math.floor(y));

  return corners || center;
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
 * Slide a proposed move around an entity obstacle.
 * If the direct move would overlap, project the movement onto the tangent
 * around the obstacle so the mover can still "slide past" it.
 * Returns { x, y } — the safe new position.
 */
export function slideAroundEntity(
  fromX: number, fromY: number,
  toX: number, toY: number,
  moverRadius: number,
  obstacle: { x: number, y: number, radius: number }
): { x: number, y: number } {
  const minDist = moverRadius + obstacle.radius;
  const dx = toX - obstacle.x;
  const dy = toY - obstacle.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= minDist) {
    // No overlap — move is safe
    return { x: toX, y: toY };
  }

  if (dist < 0.001) {
    // Directly on top — push to minDist along +X
    return { x: obstacle.x + minDist, y: obstacle.y };
  }

  // Project onto the circle boundary at minDist
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: obstacle.x + nx * minDist,
    y: obstacle.y + ny * minDist
  };
}

/**
 * Resolve all pairwise entity overlaps in a list of entities.
 * Each entity is pushed proportional to its inverse weight (higher weight = pushed less).
 * This is the "penetration resolution pass" run after all moves.
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

      // Split push proportional to inverse weight
      const totalWeight = a.weight + b.weight;
      const aFactor = b.weight / totalWeight; // a moves more if b is heavier
      const bFactor = a.weight / totalWeight; // b moves more if a is heavier

      a.x += push.dx * aFactor;
      a.y += push.dy * aFactor;
      b.x -= push.dx * bFactor;
      b.y -= push.dy * bFactor;
    }
  }
}