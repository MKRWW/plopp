/**
 * Minimap-Rendering für das Doom-Browser-Spiel.
 * Zeigt eine Echtzeit-Karte in der oberen linken Ecke mit Spieler- und Gegner-Positionen.
 */

import { Player } from '../player/player';
import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT } from '../engine/world';
import { Sprite, SpriteType } from '../engine/sprite';

/**
 * Konfiguration der Minimap.
 */
const MINIMAP_SIZE = 160;           // Pixel-Größe (quadratisch)
const MINIMAP_X = 10;               // Position X (oben links)
const MINIMAP_Y = 10;               // Position Y
const MINIMAP_BORDER = 2;           // Rahmenbreite
const TILE_SIZE = MINIMAP_SIZE / 16; // 10 Pixel pro Tile (16x16 Map)

/**
 * Farben für die Minimap.
 */
const COLORS = {
  background: 'rgba(0, 0, 0, 0.7)',
  wall: '#555',
  floor: '#222',
  player: '#0f0',
  playerDir: '#0a0',
  enemy: '#f00',
  ammo: '#ff0',
  health: '#0f0',
  border: '#888'
};

/**
 * Minimap-Klasse: Rendert eine Echtzeit-Karte in der oberen linken Ecke.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // Offscreen-Canvas für die Minimap
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Rendert die Minimap mit der aktuellen Spielerposition, Blickrichtung und allen Sprites.
   */
  public render(player: Player, sprites: Sprite[]): void {
    const ctx = this.ctx;

    // Hintergrund (halb-transparent)
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Karte rendern
    this.renderMap(ctx);

    // Items rendern (Ammo + Health)
    for (const sprite of sprites) {
      if (sprite.type === SpriteType.ENEMY) continue;
      this.renderSpriteDot(ctx, sprite.x, sprite.y, sprite.type === SpriteType.AMMO ? COLORS.ammo : COLORS.health);
    }

    // Gegner rendern
    for (const sprite of sprites) {
      if (sprite.type !== SpriteType.ENEMY) continue;
      if (!sprite.isAlive) continue;
      this.renderSpriteDot(ctx, sprite.x, sprite.y, COLORS.enemy);
    }

    // Spieler rendern
    this.renderPlayer(ctx, player);

    // Rahmen
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = MINIMAP_BORDER;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  }

  /**
   * Gibt das Minimap-Canvas zurück (für Compositing in den Haupt-Renderer).
   */
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Gibt die X-Position der Minimap zurück.
   */
  public getX(): number {
    return MINIMAP_X;
  }

  /**
   * Gibt die Y-Position der Minimap zurück.
   */
  public getY(): number {
    return MINIMAP_Y;
  }

  /**
   * Gibt die Größe der Minimap zurück.
   */
  public getSize(): number {
    return MINIMAP_SIZE;
  }

  /**
   * Rendert die Weltkarte (Wände und Boden).
   */
  private renderMap(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = WORLD_MAP[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile > 0) {
          // Wand
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
          // Boden
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  /**
   * Rendert einen kleinen Punkt für ein Sprite (Item oder Gegner).
   */
  private renderSpriteDot(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, color: string): void {
    const px = worldX * TILE_SIZE;
    const py = worldY * TILE_SIZE;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Rendert den Spieler als grünen Punkt mit Blickrichtungs-Pfeil.
   */
  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const px = player.x * TILE_SIZE;
    const py = player.y * TILE_SIZE;

    // Spieler-Punkt
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Blickrichtungs-Pfeil
    ctx.strokeStyle = COLORS.playerDir;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.dirX * 12, py + player.dirY * 12);
    ctx.stroke();
  }
}
