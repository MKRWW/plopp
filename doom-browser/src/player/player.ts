/**
 * Spieler-Entität mit Position, Richtung und Bewegung.
 */
import { slideAlongAxis, PLAYER_RADIUS, slideAroundEntity } from '../engine/collision';

export class Player {
  public x: number;
  public y: number;
  public dirX: number;
  public dirY: number;
  public planeX: number;
  public planeY: number;

  /** Kollisionsradius des Spielers in Tile-Einheiten */
  private readonly radius: number = PLAYER_RADIUS;

  // --- Phase 5: Gesundheit & Munition (verwaltet über Weapon-Klasse) ---
  public health: number = 100;
  public maxHealth: number = 100;
  public ammo: number = 50;
  public maxAmmo: number = 200;
  public score: number = 0;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.dirX = 1.0; // Blickrichtung nach rechts
    this.dirY = 0.0;
    this.planeX = 0.0; // Kameraebene (senkrecht zur Blickrichtung)
    this.planeY = 0.66; // FOV = 66° (0.66 = tan(33°))
  }

  /**
   * Rotiert den Spieler um den gegebenen Winkel (in Radiant).
   * Positiv = nach rechts, negativ = nach links.
   */
  public rotate(angle: number): void {
    const oldDirX = this.dirX;
    this.dirX = this.dirX * Math.cos(angle) - this.dirY * Math.sin(angle);
    this.dirY = oldDirX * Math.sin(angle) + this.dirY * Math.cos(angle);
    const oldPlaneX = this.planeX;
    this.planeX = this.planeX * Math.cos(angle) - this.planeY * Math.sin(angle);
    this.planeY = oldPlaneX * Math.sin(angle) + this.planeY * Math.cos(angle);
  }

  /**
   * Bewegt den Spieler in Blickrichtung mit Kollisionsprüfung (Sliding).
   * @param distance Positive = vorwärts, negative = rückwärts.
   * @param enemies Optional: Liste von Gegnern zum Um-Sliden.
   */
  public move(distance: number, enemies?: Array<{ x: number, y: number, radius: number }>): void {
    const deltaX = this.dirX * distance;
    const deltaY = this.dirY * distance;

    // Achsenseparat prüfen: erst X, dann Y (Sliding)
    this.x = slideAlongAxis(this.x, deltaX, this.y, this.radius);
    this.y = slideAlongAxis(this.y, deltaY, this.x, this.radius);

    // Entity collision: slide around enemies
    if (enemies) {
      this.slideAroundObstacles(this.x, this.y, deltaX, deltaY, enemies);
    }
  }

  /**
   * Seitliches Gleiten (Strafe) mit Kollisionsprüfung.
   * @param distance Positive = rechts, negative = links.
   * @param enemies Optional: Liste von Gegnern zum Um-Sliden.
   */
  public strafe(distance: number, enemies?: Array<{ x: number, y: number, radius: number }>): void {
    // Senkrecht zur Blickrichtung
    const strafeX = -this.dirY * distance;
    const strafeY = this.dirX * distance;

    // Achsenseparat prüfen
    this.x = slideAlongAxis(this.x, strafeX, this.y, this.radius);
    this.y = slideAlongAxis(this.y, strafeY, this.x, this.radius);

    // Entity collision: slide around enemies
    if (enemies) {
      this.slideAroundObstacles(this.x, this.y, strafeX, strafeY, enemies);
    }
  }

  /**
   * After wall sliding, resolve any remaining entity overlap by sliding
   * along the tangent of the obstacle. This allows the player to move
   * *around* an enemy rather than being completely blocked.
   */
  private slideAroundObstacles(
    baseX: number, baseY: number,
    moveX: number, moveY: number,
    obstacles: Array<{ x: number, y: number, radius: number }>
  ): void {
    // Try the full move first
    let tryX = baseX + moveX;
    let tryY = baseY + moveY;

    for (const obs of obstacles) {
      const result = slideAroundEntity(baseX, baseY, tryX, tryY, this.radius, obs);
      tryX = result.x;
      tryY = result.y;
    }

    this.x = tryX;
    this.y = tryY;
  }

  /**
   * Position direkt setzen (z.B. nach Kollisionsprüfung oder Respawn).
   */
  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Gibt den Kollisionsradius zurück.
   */
  public getRadius(): number {
    return this.radius;
  }
}