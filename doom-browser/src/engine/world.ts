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
 *
 * Türzustände (für Tile 4 und 5):
 *   { state: 'closed' | 'opening' | 'open', progress: 0..1 }
 *   - closed:    vollständig solide
 *   - opening:   noch solide bis progress > 0.7
 *   - open:      nicht mehr solide
 *
 * Die statische Basis-Map bleibt WORLD_MAP, aber alle Gameplay-Abfragen
 * laufen über die WorldState-API, um dynamische Türzustate zu berücksichtigen.
 */

/** Basis-Map (statisch, unveränderlich).
 * Tile-Typen: 0=Boden, 1=Stein, 2=Metal, 3=Exit, 4=Blue Key Door, 5=Secret Wall
 * Layout:
 *   - Blue Key Door (4) bei (10,14) blockiert den Weg zum Exit (14,14)
 *   - Secret Wall (5) bei (3,10) mit Bonusbereich dahinter (3,11)+(4,11)
 *   - Keycard bei (13.5,2.5) ist erreichbar vor der Blue Key Door
 */
export const WORLD_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

export const MAP_WIDTH = WORLD_MAP[0].length;
export const MAP_HEIGHT = WORLD_MAP.length;

/** Tile-Typ-Konstanten */
export const TILE = {
  FLOOR: 0,
  WALL_STONE: 1,
  WALL_METAL: 2,
  EXIT_DOOR: 3,
  BLUE_KEY_DOOR: 4,
  SECRET_WALL: 5,
} as const;

/** Tür-Zustände */
export type DoorState = 'closed' | 'opening' | 'open';

/** Tür-Objekt für dynamische Tiles (4 = Blue Key Door, 5 = Secret Wall) */
export interface Door {
  /** Basis-Typ (4 oder 5) */
  type: typeof TILE.BLUE_KEY_DOOR | typeof TILE.SECRET_WALL;
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
}

/**
 * Dynamischer World-State: speichert Türzustände als Map von "x,y" → Door.
 * Die statische WORLD_MAP bleibt die Basis, aber alle Gameplay-Abfragen
 * nutzen getTile() / isSolidTile(), um dynamische Türzustände zu berücksichtigen.
 * 
 * Türdefinitionen werden automatisch aus WORLD_MAP gescannt (Tile 4 und 5).
 * Damit bleiben Map und WorldState immer synchron.
 */
export class WorldState {
  private doors: Map<string, Door> = new Map();

  /** Initialisiert alle Tür-Definitionen durch Scannen von WORLD_MAP. */
  init(): void {
    this.doors.clear();

    // Scanne WORLD_MAP nach Tür-Tiles (4 = Blue Key Door, 5 = Secret Wall)
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const base = WORLD_MAP[y]?.[x];
        if (base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL) {
          this.doors.set(`${x},${y}`, {
            type: base,
            state: 'closed',
            progress: 0,
            openSpeed: 1.2, // progress pro Sekunde
          });
        }
      }
    }
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
    if (base !== TILE.BLUE_KEY_DOOR && base !== TILE.SECRET_WALL) return base;

    const door = this.doors.get(`${x},${y}`);
    if (!door) return base; // Fallback: solide

    // Ab progress >= 0.7 ist die Tür passierbar (auch während "opening")
    if (door.state === 'open' || door.progress >= 0.7) return TILE.FLOOR;
    return base; // closed oder opening < 0.7 → solide
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
   * @returns InteractionResult
   */
  interactAt(x: number, y: number, hasKeycard: boolean): InteractionResult {
    const base = WORLD_MAP[y]?.[x];
    if (base !== TILE.BLUE_KEY_DOOR && base !== TILE.SECRET_WALL) return InteractionResult.NONE;

    const door = this.doors.get(`${x},${y}`);
    if (!door) return InteractionResult.NONE;

    // Tür muss geschlossen sein, um aktiviert zu werden
    if (door.state !== 'closed') return InteractionResult.NONE;

    // Blue Key Door braucht Keycard
    if (door.type === TILE.BLUE_KEY_DOOR && !hasKeycard) {
      return InteractionResult.DOOR_LOCKED;
    }

    // Tür öffnen
    door.state = 'opening';
    door.progress = 0;

    if (door.type === TILE.SECRET_WALL) {
      return InteractionResult.SECRET_FOUND;
    }
    return InteractionResult.DOOR_OPENING;
  }

  /**
   * Aktualisiert alle Türen pro Frame.
   * - 'opening' → progress += openSpeed * dt
   *   Wenn progress >= 1: state = 'open', progress = 1
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
    return base === TILE.BLUE_KEY_DOOR || base === TILE.SECRET_WALL;
  }

  /** Tür an Position erhalten (falls vorhanden). */
  getDoor(x: number, y: number): Door | null {
    return this.doors.get(`${x},${y}`) ?? null;
  }

  /** Reset aller Türzustände (für Neustart). */
  reset(): void {
    this.init();
  }

  /** Für Debug-Minimap: alle Türen mit Zustand. */
  getAllDoors(): Door[] {
    return Array.from(this.doors.values());
  }
}

/** Globale World-State-Instanz. */
export const worldState = new WorldState();
worldState.init();