/**
 * Minimap-Rendering für Plopp.
 * Zeigt eine Echtzeit-Karte in der oberen linken Ecke mit Spieler- und Gegner-Positionen.
 */

import { Player } from '../player/player';
import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT, worldState, TILE } from '../engine/world';
import { Sprite, SpriteType, isCollectableSprite, EnemyAIState } from '../engine/sprite';
import { positionCollides, PLAYER_RADIUS, ENEMY_RADIUS } from '../engine/collision';

/**
 * Konfiguration der Minimap.
 */
const MINIMAP_SIZE = 160;           // Pixel-Größe (quadratisch)
const MINIMAP_X = 10;               // Position X (oben links)
const MINIMAP_Y = 10;               // Position Y
const MINIMAP_BORDER = 2;           // Rahmenbreite
const TILE_SIZE = MINIMAP_SIZE / 16; // 10 Pixel pro Tile (16x16 Map)

const DEBUG_SIZE = 480;            // Vergrößerte Debug-Minimap (3x)
const DEBUG_TILE = DEBUG_SIZE / 16; // 30 Pixel pro Tile in Debug-Modus

/**
 * Farben für die Minimap.
 */
const COLORS = {
  background: 'rgba(0, 0, 0, 0.7)',
  wall: '#555',
  floor: '#222',
  player: '#0f0',
  playerDir: '#0a0',
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
  private debugMode: boolean = false;

  constructor() {
    // Offscreen-Canvas für die Minimap (groß genug für Debug-Modus)
    this.canvas = document.createElement('canvas');
    this.canvas.width = DEBUG_SIZE;
    this.canvas.height = DEBUG_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public toggleDebug(): void {
    this.debugMode = !this.debugMode;
  }

  public isDebug(): boolean {
    return this.debugMode;
  }

  /**
   * Rendert die Minimap mit der aktuellen Spielerposition, Blickrichtung und allen Sprites.
   */
  public render(player: Player, sprites: Sprite[]): void {
    if (this.debugMode) {
      this.renderDebug(player, sprites);
      return;
    }
    this.renderNormal(player, sprites);
  }

  private renderNormal(player: Player, sprites: Sprite[]): void {
    const ctx = this.ctx;
    const reachable = this.computeReachableTiles(player);
    const centerX = MINIMAP_SIZE / 2;
    const centerY = MINIMAP_SIZE / 2;
    const offsetX = centerX - player.x * TILE_SIZE;
    const offsetY = centerY - player.y * TILE_SIZE;

    ctx.clearRect(0, 0, DEBUG_SIZE, DEBUG_SIZE);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    this.renderMap(ctx, TILE_SIZE, reachable, offsetX, offsetY);

    // Gegner NICHT auf der normalen Minimap anzeigen — das wäre ein Gameplay-Spoiler.
    // Sie sind nur im Debug-Modus (F1) sichtbar.
    for (const sprite of sprites) {
      if (sprite.isEnemy) continue;
      if (!isCollectableSprite(sprite.type)) continue;
      if (!this.isReachableWorldPosition(sprite.x, sprite.y, reachable)) continue;
      const color =
        sprite.type === SpriteType.AMMO ? COLORS.ammo :
        sprite.type === SpriteType.HEALTH ? COLORS.health :
        '#5af';
      this.renderSpriteDot(ctx, sprite.x, sprite.y, TILE_SIZE, offsetX, offsetY, color);
    }

    this.renderPlayer(ctx, player, TILE_SIZE, centerX, centerY);

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = MINIMAP_BORDER;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  }

  private renderDebug(player: Player, sprites: Sprite[]): void {
    const ctx = this.ctx;
    const tile = DEBUG_TILE;
    const centerX = DEBUG_SIZE / 2;
    const centerY = DEBUG_SIZE / 2;
    const offsetX = centerX - player.x * tile;
    const offsetY = centerY - player.y * tile;

    ctx.clearRect(0, 0, DEBUG_SIZE, DEBUG_SIZE);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, DEBUG_SIZE, DEBUG_SIZE);

    this.renderMap(ctx, tile, undefined, offsetX, offsetY);

    // Tile-Gitter
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= MAP_WIDTH; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tile + offsetX, 0);
      ctx.lineTo(i * tile + offsetX, MAP_HEIGHT * tile + offsetY);
      ctx.stroke();
    }
    for (let j = 0; j <= MAP_HEIGHT; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * tile + offsetY);
      ctx.lineTo(MAP_WIDTH * tile + offsetX, j * tile + offsetY);
      ctx.stroke();
    }

    // Collectable Items (farbig) + Deko (neutral grau)
    for (const sprite of sprites) {
      if (sprite.isEnemy) continue;
      if (!isCollectableSprite(sprite.type)) {
        // Deko-Sprites neutral grau
        this.renderSpriteDot(ctx, sprite.x, sprite.y, tile, offsetX, offsetY, '#888');
        continue;
      }
      const color =
        sprite.type === SpriteType.AMMO ? COLORS.ammo :
        sprite.type === SpriteType.HEALTH ? COLORS.health :
        '#5af';
      this.renderSpriteDot(ctx, sprite.x, sprite.y, tile, offsetX, offsetY, color);
    }

    // Gegner mit Kollisionskreis und state-based colors
    for (const sprite of sprites) {
      if (!sprite.isEnemy) continue;
      if (!sprite.isAlive) continue;
      const ex = sprite.x * tile + offsetX;
      const ey = sprite.y * tile + offsetY;
      const isShooter = sprite.type === SpriteType.SHOOTER;
      const isLatcher = sprite.type === SpriteType.LATCHER;
      const fill = isShooter
        ? '#c0c'
        : isLatcher
          ? '#f7c'
          : (sprite.aiState === EnemyAIState.ALERT ? '#ffa500'
            : sprite.aiState === EnemyAIState.CHASE ? '#f44'
              : '#667');
      const strokeColor = isShooter ? 'rgba(180,80,220,0.9)' : isLatcher ? 'rgba(255,100,180,0.9)' : 'rgba(255,80,80,0.9)';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, ENEMY_RADIUS * tile, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ghost-Wand-Probe: Sweep um den Spieler herum, markiere Punkte, an denen
    // positionCollides true zurückgibt — so siehst du, ob die Geometrie der
    // "verbotenen Zone" mit den sichtbaren Wänden übereinstimmt.
    const probeRange = 1.5;       // Tile-Radius um Spieler
    const probeStep = 0.05;       // Auflösung
    const r2 = (probeStep * tile) * 0.5;
    for (let dx = -probeRange; dx <= probeRange; dx += probeStep) {
      for (let dy = -probeRange; dy <= probeRange; dy += probeStep) {
        const wx = player.x + dx;
        const wy = player.y + dy;
        if (positionCollides(wx, wy, PLAYER_RADIUS)) {
          ctx.fillStyle = 'rgba(255,0,128,0.35)';
          ctx.fillRect(wx * tile + offsetX - r2, wy * tile + offsetY - r2, r2 * 2, r2 * 2);
        }
      }
    }

    // 8-Richtungs-Movement-Probe: zeigt an, in welche Richtung Bewegung möglich ist.
    const stepDist = 0.15;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const tx = player.x + Math.cos(ang) * stepDist;
      const ty = player.y + Math.sin(ang) * stepDist;
      const blocked = positionCollides(tx, ty, PLAYER_RADIUS);
      ctx.strokeStyle = blocked ? '#f00' : '#0f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(tx * tile + offsetX, ty * tile + offsetY);
      ctx.stroke();
    }

    // Spieler-Kollisionskreis (am wichtigsten)
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, PLAYER_RADIUS * tile, 0, Math.PI * 2);
    ctx.stroke();

    // Spielerzentrum + Blickrichtung
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + player.dirX * tile * 0.6, centerY + player.dirY * tile * 0.6);
    ctx.stroke();

    // HUD-Text mit Position
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`pos: (${player.x.toFixed(3)}, ${player.y.toFixed(3)})`, 8, DEBUG_SIZE - 22);
    ctx.fillText(`F1: debug off | grün=frei  rot=blockiert`, 8, DEBUG_SIZE - 6);

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = MINIMAP_BORDER;
    ctx.strokeRect(0, 0, DEBUG_SIZE, DEBUG_SIZE);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getX(): number {
    return MINIMAP_X;
  }

  public getY(): number {
    return MINIMAP_Y;
  }

  public getSize(): number {
    return this.debugMode ? DEBUG_SIZE : MINIMAP_SIZE;
  }

  private renderMap(
    ctx: CanvasRenderingContext2D,
    tileSize: number,
    reachable?: boolean[][],
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const base = WORLD_MAP[y][x];
        const px = x * tileSize + offsetX;
        const py = y * tileSize + offsetY;

        // Türzustände berücksichtigen
        if (base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL) {
          const door = worldState.getDoor(x, y);
          if (base === TILE.SECRET_WALL && door?.state === 'closed') {
            // Secret Walls tarnen sich auf der normalen Minimap als normale Wand.
            ctx.fillStyle = COLORS.wall;
          } else if (door?.state === 'open') {
            // Geöffnete Tür = Boden
            ctx.fillStyle = COLORS.floor;
          } else if (door?.state === 'opening') {
            // Öffnende Tür = gelb/orange
            ctx.fillStyle = '#cc0';
          } else {
            // Geschlossene Tür = blau (Blue Key Door) oder grün (Secret Wall)
            ctx.fillStyle = base === TILE.BLUE_KEY_DOOR ? '#44f' : '#4a4';
          }
        } else if (base > 0) {
          ctx.fillStyle = COLORS.wall;
        } else if (reachable && !reachable[y][x]) {
          // Versteckte, nicht erreichbare Bodenbereiche (z.B. Secret Room)
          // nicht auf der normalen Minimap spoilern.
          ctx.fillStyle = COLORS.wall;
        } else {
          ctx.fillStyle = COLORS.floor;
        }
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }

  private computeReachableTiles(player: Player): boolean[][] {
    const reachable = Array.from(
      { length: MAP_HEIGHT },
      () => Array<boolean>(MAP_WIDTH).fill(false)
    );
    const startX = Math.floor(player.x);
    const startY = Math.floor(player.y);
    if (startX < 0 || startX >= MAP_WIDTH || startY < 0 || startY >= MAP_HEIGHT) {
      return reachable;
    }
    if (worldState.isSolidTile(startX, startY)) {
      return reachable;
    }

    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    reachable[startY][startX] = true;

    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const next of neighbors) {
        if (next.x < 0 || next.x >= MAP_WIDTH || next.y < 0 || next.y >= MAP_HEIGHT) continue;
        if (reachable[next.y][next.x]) continue;
        if (worldState.isSolidTile(next.x, next.y)) continue;
        reachable[next.y][next.x] = true;
        queue.push(next);
      }
    }

    return reachable;
  }

  private isReachableWorldPosition(worldX: number, worldY: number, reachable: boolean[][]): boolean {
    const tileX = Math.floor(worldX);
    const tileY = Math.floor(worldY);
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return false;
    return reachable[tileY][tileX];
  }

  private renderSpriteDot(
    ctx: CanvasRenderingContext2D,
    worldX: number,
    worldY: number,
    tileSize: number,
    offsetX: number,
    offsetY: number,
    color: string
  ): void {
    const px = worldX * tileSize + offsetX;
    const py = worldY * tileSize + offsetY;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, tileSize * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    tileSize: number,
    centerX: number,
    centerY: number
  ): void {
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.playerDir;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + player.dirX * tileSize * 1.2, centerY + player.dirY * tileSize * 1.2);
    ctx.stroke();
  }
}
