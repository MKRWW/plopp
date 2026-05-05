/**
 * Spieler-Entität mit Position, Richtung und Bewegung.
 */
import { slideAlongAxis, PLAYER_RADIUS } from '../engine/collision';

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
    this.dirX = 1.0;
    this.dirY = 0.0;
    this.planeX = 0.0;
    this.planeY = 0.66;
  }

  public rotate(angle: number): void {
    const oldDirX = this.dirX;
    this.dirX = this.dirX * Math.cos(angle) - this.dirY * Math.sin(angle);
    this.dirY = oldDirX * Math.sin(angle) + this.dirY * Math.cos(angle);
    const oldPlaneX = this.planeX;
    this.planeX = this.planeX * Math.cos(angle) - this.planeY * Math.sin(angle);
    this.planeY = oldPlaneX * Math.sin(angle) + this.planeY * Math.cos(angle);
  }

  /**
   * Bewegt den Spieler in Blickrichtung mit Wand- und Entity-Kollision.
   * Sliding-Verhalten: Bei Blockade auf einer Achse bleibt die andere Achse frei.
   */
  public move(distance: number, enemies?: Array<{ x: number, y: number, radius: number }>): void {
    const deltaX = this.dirX * distance;
    const deltaY = this.dirY * distance;
    this.applyMove(deltaX, deltaY, enemies);
  }

  /**
   * Seitliches Gleiten (Strafe) mit Wand- und Entity-Kollision.
   */
  public strafe(distance: number, enemies?: Array<{ x: number, y: number, radius: number }>): void {
    const strafeX = -this.dirY * distance;
    const strafeY = this.dirX * distance;
    this.applyMove(strafeX, strafeY, enemies);
  }

  /**
   * Wendet eine Bewegung achsenseparat an: erst X, dann Y.
   * Pro Achse: erst Wand-Sliding via slideAlongAxis. Anschließend wird die
   * Achse nur dann verworfen, wenn die Bewegung die Überlappung mit
   * einem Gegner STRENG verschlechtert (also den Abstand verkleinert).
   * Bewegung, die den Abstand vergrößert oder gleich lässt, ist erlaubt —
   * der Spieler kann also vor einem nahen Gegner fliehen, auch wenn die
   * Kreise im Moment noch leicht überlappen.
   */
  private applyMove(
    deltaX: number,
    deltaY: number,
    enemies?: Array<{ x: number, y: number, radius: number }>
  ): void {
    let newX = slideAlongAxis(this.x, deltaX, this.y, this.radius);
    if (enemies && this.movementWorsensOverlap(this.x, this.y, newX, this.y, enemies)) {
      newX = this.x;
    }
    let newY = slideAlongAxis(this.y, deltaY, newX, this.radius);
    if (enemies && this.movementWorsensOverlap(newX, this.y, newX, newY, enemies)) {
      newY = this.y;
    }
    this.x = newX;
    this.y = newY;
  }

  /**
   * Liefert true, wenn die Bewegung von (fromX,fromY) nach (toX,toY) die
   * Überlappung mit irgendeinem Gegner STRENG verschlechtert (Distanz nimmt
   * ab UND Endposition liegt innerhalb des Mindestabstands).
   * Bewegungen, die den Abstand vergrößern oder gleich lassen — auch wenn
   * Endposition noch leicht überlappt — sind explizit erlaubt (Flucht).
   */
  private movementWorsensOverlap(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    enemies: Array<{ x: number, y: number, radius: number }>
  ): boolean {
    for (const e of enemies) {
      const minDist = this.radius + e.radius;
      const dxTo = toX - e.x;
      const dyTo = toY - e.y;
      const distToSq = dxTo * dxTo + dyTo * dyTo;
      if (distToSq >= minDist * minDist) continue; // keine Überlappung am Ziel
      const dxFrom = fromX - e.x;
      const dyFrom = fromY - e.y;
      const distFromSq = dxFrom * dxFrom + dyFrom * dyFrom;
      if (distToSq < distFromSq) return true; // Bewegung INS Innere des Gegners
    }
    return false;
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public getRadius(): number {
    return this.radius;
  }
}
