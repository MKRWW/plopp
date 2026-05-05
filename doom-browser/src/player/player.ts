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
   * Pro Achse: Wand-Sliding via slideAlongAxis. Wenn die resultierende
   * Position einen Gegner überlappt, wird diese Achsenbewegung verworfen
   * (Player kann an Gegnern vorbeisliden, wenn die andere Achse frei ist).
   */
  private applyMove(
    deltaX: number,
    deltaY: number,
    enemies?: Array<{ x: number, y: number, radius: number }>
  ): void {
    let newX = slideAlongAxis(this.x, deltaX, this.y, this.radius);
    if (enemies && this.overlapsAnyEnemy(newX, this.y, enemies)) {
      newX = this.x;
    }
    let newY = slideAlongAxis(this.y, deltaY, newX, this.radius);
    if (enemies && this.overlapsAnyEnemy(newX, newY, enemies)) {
      newY = this.y;
    }
    this.x = newX;
    this.y = newY;
  }

  private overlapsAnyEnemy(
    px: number,
    py: number,
    enemies: Array<{ x: number, y: number, radius: number }>
  ): boolean {
    for (const e of enemies) {
      const dx = px - e.x;
      const dy = py - e.y;
      const minDist = this.radius + e.radius;
      if (dx * dx + dy * dy < minDist * minDist) return true;
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
