/**
 * 2D-Karte des Levels mit dynamischem Türsystem.
 *
 * Tile-Typen:
 *   0 = leer (Boden)
 *   1 = dunkler Stein (Wand)
 *   2 = Metall/Gitter (Wand)
 *   3 = Exit-Tür (bleibt immer solide, keine Animation)
 *   4 = Blue Key Door (braucht Keycard, animiert)
 *   5 = Secret Wall (ohne Keycard öffnbar, animiert)
 *   6 = Yellow Key Door (braucht Yellow Keycard, animiert)
 *
 * Türzustände (für Tile 4, 5, und 6):
 *   { state: 'closed' | 'opening' | 'open', progress: 0..1 }
 *   - closed:    vollständig solide
 *   - opening:   noch solide bis progress > 0.7
 *   - open:      nicht mehr solide
 *
 * Die Karte ist nicht mehr statisch: `WORLD_MAP`, `MAP_WIDTH` und `MAP_HEIGHT`
 * sind `let`-Exporte, die beim Laden eines neuen Levels via `worldState.loadLevel()`
 * neu zugewiesen werden. ESM live bindings stellen sicher, dass alle Importer
 * automatisch die aktuelle Karte sehen.
 */

import type { Level } from './level-gen';

/** Tile-Typ-Konstanten */
export const TILE = {
  FLOOR: 0,
  WALL_STONE: 1,
  WALL_METAL: 2,
  EXIT_DOOR: 3,
  BLUE_KEY_DOOR: 4,
  SECRET_WALL: 5,
  YELLOW_KEY_DOOR: 6,
} as const;

/** Live binding: aktuelle Karte. Wird durch `worldState.loadLevel()` ersetzt. */
export let WORLD_MAP: number[][] = [[TILE.WALL_STONE]];
export let MAP_WIDTH = 1;
export let MAP_HEIGHT = 1;

/** Tür-Zustände */
export type DoorState = 'closed' | 'opening' | 'open';

/** Tür-Objekt für dynamische Tiles (4 = Blue Key Door, 5 = Secret Wall, 6 = Yellow Key Door) */
export interface Door {
  /** Basis-Typ (4, 5 oder 6) */
  type: typeof TILE.BLUE_KEY_DOOR | typeof TILE.SECRET_WALL | typeof TILE.YELLOW_KEY_DOOR;
  /** 'closed' | 'opening' | 'open' */
  state: DoorState;
  /** Fortschritt der Animation 0..1 */
  progress: number;
  /** Öffnungsgeschwindigkeit (progress pro Sekunde) */
  openSpeed: number;
}

/** Ergebnis einer Tile-Interaktion */
export enum InteractionResult {
  NONE = 0,
  DOOR_OPENING = 1,
  DOOR_LOCKED = 2,
  SECRET_FOUND = 3,
  YELLOW_DOOR_LOCKED = 4,
  EXIT_READY = 5,
  EXIT_LOCKED_NO_YELLOW = 6,
  EXIT_LOCKED_NO_BLUE = 7,
}

/**
 * Dynamischer World-State: hält die aktuelle Karte plus Tür-Animationen.
 * Beim Laden eines neuen Levels (`loadLevel`) wird die Karte ersetzt und alle
 * Türen frisch aus der neuen Karte gescannt.
 */
export class WorldState {
  private doors: Map<string, Door> = new Map();
  private currentLevel: Level | null = null;

  /** Lädt ein generiertes Level: ersetzt Karte, Größe und scannt Türen. */
  loadLevel(level: Level): void {
    WORLD_MAP = level.map;
    MAP_WIDTH = level.width;
    MAP_HEIGHT = level.height;
    this.currentLevel = level;
    this.scanDoors();
  }

  /** Scannt die aktuelle WORLD_MAP nach Tür-Tiles und legt Door-Objekte an. */
  private scanDoors(): void {
    this.doors.clear();
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const base = WORLD_MAP[y]?.[x];
        if (base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL || base === TILE.YELLOW_KEY_DOOR) {
          this.doors.set(`${x},${y}`, {
            type: base,
            state: 'closed',
            progress: 0,
            openSpeed: 1.2,
          });
        }
      }
    }
  }

  /** Aktuelles Level (oder null falls keins geladen). */
  getCurrentLevel(): Level | null {
    return this.currentLevel;
  }

  /**
   * Gibt den effektiven Tile-Wert an der Position zurück.
   * Berücksichtigt dynamische Türzustände:
   *   - closed:          → Tile-Typ (4 oder 5), vollständig solide
   *   - opening < 0.7:   → Tile-Typ (4 oder 5), noch solide
   *   - opening >= 0.7:  → 0 (Boden), passierbar (Animation läuft weiter)
   *   - open:            → 0 (Boden), vollständig passierbar
   */
  getTile(x: number, y: number): number {
    const base = WORLD_MAP[y]?.[x] ?? 1;
    if (base !== TILE.BLUE_KEY_DOOR && base !== TILE.SECRET_WALL && base !== TILE.YELLOW_KEY_DOOR) return base;

    const door = this.doors.get(`${x},${y}`);
    if (!door) return base;

    if (door.state === 'open' || door.progress >= 0.7) return TILE.FLOOR;
    return base;
  }

  /**
   * Prüft ob ein Tile für Gameplay/Raycasting/Kollision solide ist.
   * 0 = Boden (nicht solide), >0 = Wand/Tür (solide).
   * Türen sind ab progress >= 0.7 NICHT mehr solide.
   */
  isSolidTile(x: number, y: number): boolean {
    return this.getTile(x, y) > 0;
  }

  /**
   * Versucht eine Interaktion (E-Taste) am Tile vor dem Spieler.
   */
  interactAt(x: number, y: number, hasYellowKeycard: boolean, hasBlueKeycard: boolean): InteractionResult {
    const base = WORLD_MAP[y]?.[x];
    if (base === TILE.EXIT_DOOR) {
      if (!hasYellowKeycard) return InteractionResult.EXIT_LOCKED_NO_YELLOW;
      if (!hasBlueKeycard) return InteractionResult.EXIT_LOCKED_NO_BLUE;
      return InteractionResult.EXIT_READY;
    }
    if (base !== TILE.BLUE_KEY_DOOR && base !== TILE.SECRET_WALL && base !== TILE.YELLOW_KEY_DOOR) return InteractionResult.NONE;

    const door = this.doors.get(`${x},${y}`);
    if (!door) return InteractionResult.NONE;
    if (door.state !== 'closed') return InteractionResult.NONE;

    if (door.type === TILE.BLUE_KEY_DOOR && !hasBlueKeycard) {
      return InteractionResult.DOOR_LOCKED;
    }
    if (door.type === TILE.YELLOW_KEY_DOOR && !hasYellowKeycard) {
      return InteractionResult.YELLOW_DOOR_LOCKED;
    }

    door.state = 'opening';
    door.progress = 0;

    if (door.type === TILE.SECRET_WALL) {
      return InteractionResult.SECRET_FOUND;
    }
    return InteractionResult.DOOR_OPENING;
  }

  /**
   * Aktualisiert alle Türen pro Frame.
   */
  updateWorld(deltaTime: number): void {
    for (const door of this.doors.values()) {
      if (door.state === 'opening') {
        door.progress += door.openSpeed * deltaTime;
        if (door.progress >= 1) {
          door.progress = 1;
          door.state = 'open';
        }
      }
    }
  }

  /** Prüft ob ein Tile eine Tür ist (4 oder 5). */
  isDoorTile(x: number, y: number): boolean {
    const base = WORLD_MAP[y]?.[x];
    return base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL || base === TILE.YELLOW_KEY_DOOR;
  }

  /** Tür an Position erhalten (falls vorhanden). */
  getDoor(x: number, y: number): Door | null {
    return this.doors.get(`${x},${y}`) ?? null;
  }

  /** Reset aller Türzustände (für Neustart) — neu scannen. */
  reset(): void {
    this.scanDoors();
  }

  /** Für Debug-Minimap: alle Türen mit Zustand. */
  getAllDoors(): Door[] {
    return Array.from(this.doors.values());
  }
}

/** Globale World-State-Instanz. Lädt initial KEIN Level — main.ts bootstrappt. */
export const worldState = new WorldState();
