# Plopp — Claude-Projekt-Kontext

Wolfenstein-/Doom-artiger Raycaster im Browser. Reines Canvas (kein WebGL),
keine externen Assets, alles prozedural. TypeScript + Vite.

## Architektur

- **Renderer-Loop**: `requestAnimationFrame` → `Renderer.updatePlayer(dt)` →
  `Renderer.render()`. Pause-Overlay bei Pointer-Lock-Verlust.
- **Render-Auflösung**: 640×480, vom Canvas auf Fenstergröße skaliert
- **Input**: WASD + Maus (Pointer Lock) + Shift (Sprint) + 1/2/3 oder Mausrad (Waffe) + E (Interagieren) + ESC (Pause)
- **Live-Bindings**: `WORLD_MAP`, `MAP_WIDTH`, `MAP_HEIGHT` in [world.ts](src/engine/world.ts) sind `let`-Exporte, die `worldState.loadLevel()` neu zuweist. ESM stellt sicher, dass alle Importer automatisch die aktuelle Karte sehen.

## Module

### Engine ([src/engine/](src/engine/))
- [renderer.ts](src/engine/renderer.ts) — DDA-Raycaster, Sprite-Rendering, HUD, Waffe, Enemy-AI-Tick, Pickup-Logik, Level-Transitions *(großer Monolith, ~100KB — Refactor-Kandidat)*
- [world.ts](src/engine/world.ts) — `WorldState`, Tile-Konstanten, Tür-Animationen, Interaktion
- [level-gen.ts](src/engine/level-gen.ts) — Prozedurale Level: Rooms-and-Corridors, Mulberry32-RNG, Reachability-Validation, Decor-Streuung
- [collision.ts](src/engine/collision.ts) — Grid-Kollision, Sliding (binäre Suche, 8 Schritte), Line-of-Sight, Entity-Overlap-Resolution
- [sprite.ts](src/engine/sprite.ts) — `Sprite`-Klasse, Enemy-AI-States (IDLE/ALERT/CHASE), Enemy-Klassen (Grunt/Shooter), Death-Animation, Corpse-Persistence
- [sprite-textures.ts](src/engine/sprite-textures.ts) — Prozedurale 8-Richtungs-Sprites
- [textures.ts](src/engine/textures.ts) — Wand-Texturen (64×64 Canvas-Generierung)
- [rocket-projectile.ts](src/engine/rocket-projectile.ts) — Raketen-Flug, AoE-Explosion
- [zbuffer.ts](src/engine/zbuffer.ts) — Tiefentest pro Pixel-Spalte

### Game ([src/game/](src/game/))
- [state.ts](src/game/state.ts) — `GameStateManager` mit States MENU / PLAYING / PAUSED / LOADING / DEAD / WIN
- [weapon.ts](src/game/weapon.ts) — Aktive Waffe (Cooldown, Muzzle-Flash, Animation)
- [weapons.ts](src/game/weapons.ts) — `WeaponInventory`, 3 Waffen-Defs (Pistol, Shotgun, Rocket Launcher)
- [minimap.ts](src/game/minimap.ts) — Player-Centered Minimap, Offscreen-Canvas

### Player ([src/player/](src/player/))
- [player.ts](src/player/player.ts) — Position, Richtung, `move()`/`strafe()`/`rotate()` mit Kollisionsintegration
- [input.ts](src/player/input.ts) — Keyboard, Pointer Lock, Touch-Fallback

### Audio ([src/audio/](src/audio/))
- [sound.ts](src/audio/sound.ts) — Web Audio API, prozedurale SFX, MP3-Music-Playlist mit Shuffle

## Wichtige Konstanten

| Konstante                    | Wert         | Ort                                       |
| ---------------------------- | ------------ | ----------------------------------------- |
| `MOVE_SPEED`                 | 3.0 Tiles/s  | [renderer.ts](src/engine/renderer.ts)     |
| `SPRINT_MULTIPLIER`          | 1.8          | [renderer.ts](src/engine/renderer.ts)     |
| `PLAYER_RADIUS`              | 0.2 Tiles    | [collision.ts](src/engine/collision.ts)   |
| `AI_AWARENESS_RADIUS`        | 8.0 Tiles    | [sprite.ts](src/engine/sprite.ts)         |
| `AI_GUNSHOT_RADIUS`          | 12.0 Tiles   | [sprite.ts](src/engine/sprite.ts)         |
| `AI_SHOOTER_RANGE`           | 5.0 Tiles    | [sprite.ts](src/engine/sprite.ts)         |
| `AI_SHOOTER_COOLDOWN`        | 2.5 s        | [sprite.ts](src/engine/sprite.ts)         |
| `MINIMAP_SIZE`               | 160 px       | [minimap.ts](src/game/minimap.ts)         |
| Pistol `fireCooldown`        | 0.2 s        | [weapons.ts](src/game/weapons.ts)         |
| Rocket `explosionRadius`     | 1.5 Tiles    | [weapons.ts](src/game/weapons.ts)         |

## Tile-Typen ([world.ts](src/engine/world.ts))

| ID | Typ                | Verhalten                                              |
| -- | ------------------ | ------------------------------------------------------ |
| 0  | `FLOOR`            | Boden, passierbar                                      |
| 1  | `WALL_STONE`       | Solide Wand                                            |
| 2  | `WALL_METAL`       | Solide Wand                                            |
| 3  | `EXIT_DOOR`        | Solide (aktuell ohne Interaktion — siehe Plan)         |
| 4  | `BLUE_KEY_DOOR`    | Animiert, braucht Blue Keycard                         |
| 5  | `SECRET_WALL`      | Animiert, ohne Keycard öffnbar (Crack-Hinweis)         |
| 6  | `YELLOW_KEY_DOOR`  | Animiert, braucht Yellow Keycard                       |

Türen werden ab `progress >= 0.7` nicht-solide (passierbar während Animation).

## Build & Test

```bash
npm run dev            # Vite-Dev-Server
npm run build          # Produktion (esbuild via Vite)
npm test               # Vitest einmal
npm run test:watch     # Vitest interaktiv
npm run test:coverage  # mit c8
```

## Code-Stil

- TypeScript mit Interfaces, keine `any`
- Keine Runtime-Dependencies
- Canvas-Rendering via `ImageData` / `putImageData`
- Texturen + Sprites + SFX vollständig prozedural (Music ist die einzige Ausnahme)
- Tests in `__tests__/` neben dem getesteten Modul

## Offene Punkte

- [renderer.ts](src/engine/renderer.ts) ist 98KB und mischt Rendering, AI-Tick, Pickup-Logik, Level-Transitions — Aufbrechen wäre fällig
- Multi-Door-Levels (separate Entrance/Exit-Türen mit [E]-Interaktion) sind teilweise implementiert: `level.entrance`, `exits[]` und `EXIT_DOOR`-Tile existieren, die `[E]`-Interaktion in `worldState.interactAt()` fehlt aber noch. Plan: [plan/multi-door-levels.md](../.hermes/plans/multi-door-levels.md)
- Eine ältere Test-Datei [level-gen.test.ts](src/engine/level-gen.test.ts) existiert noch parallel zu [__tests__/level-gen.test.ts](src/engine/__tests__/level-gen.test.ts) — konsolidieren
