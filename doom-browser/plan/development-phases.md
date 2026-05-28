# Plopp — Feature-Stand

Lebendes Dokument. Spiegelt wider, was tatsächlich im Code ist, und was offen.
Bei größeren Änderungen mitpflegen — nicht jeden Bugfix einzeln.

## Engine-Fundament

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| DDA-Raycaster, 640×480                        | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Z-Buffer Tiefentest                           | ✓      | [zbuffer.ts](../src/engine/zbuffer.ts)                            |
| Wand-Textur-Mapping (64×64, prozedural)       | ✓      | [textures.ts](../src/engine/textures.ts)                          |
| Distanz-Nebel + Seitenschattierung            | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Fisheye-Korrektur                             | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| FPS-Counter                                   | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |

## Player & Input

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| WASD + Maus (Pointer Lock)                    | ✓      | [input.ts](../src/player/input.ts)                                |
| Sprint (Shift, ×1.8)                          | ✓      | [input.ts](../src/player/input.ts)                                |
| Touch-Fallback Mobile                         | ✓      | [input.ts](../src/player/input.ts)                                |
| Grid-Kollision + Sliding + binäre Suche       | ✓      | [collision.ts](../src/engine/collision.ts)                        |
| Line-of-Sight                                 | ✓      | [collision.ts](../src/engine/collision.ts)                        |
| Entity-Overlap-Resolution                     | ✓      | [collision.ts](../src/engine/collision.ts)                        |

## Welt & Level

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| Prozedurale Level (Rooms & Corridors)         | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Seedbarer RNG (Mulberry32)                    | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Reachability-Validation + Retry               | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Multi-Stage mit steigender Komplexität        | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Dual-Keycard-Progression (Yellow → Blue)      | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Animierte Türen (open/opening/closed)         | ✓      | [world.ts](../src/engine/world.ts)                                |
| Secret Walls mit Crack-Hinweis                | ✓      | [world.ts](../src/engine/world.ts), [textures.ts](../src/engine/textures.ts) |
| Decor-Sprites (Barrel, Terminal, Lamp, Debris)| ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| Mehrere Exit-Rooms (`exits[]`)                | ✓      | [level-gen.ts](../src/engine/level-gen.ts)                        |
| `EXIT_DOOR`-Tile + [E]-Interaktion            | offen  | siehe [Roadmap](#roadmap)                                         |

## Gegner & Combat

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| Grunt (Melee-Chase)                           | ✓      | [sprite.ts](../src/engine/sprite.ts), [renderer.ts](../src/engine/renderer.ts) |
| Shooter (Ranged, Raycast, 5-Tile-Range)       | ✓      | [sprite.ts](../src/engine/sprite.ts), [renderer.ts](../src/engine/renderer.ts) |
| AI-State-Machine IDLE / ALERT / CHASE         | ✓      | [sprite.ts](../src/engine/sprite.ts)                              |
| Gunshot-Awareness (12-Tile-Radius)            | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| 8-Richtungs-Sprites pro Pose                  | ✓      | [sprite-textures.ts](../src/engine/sprite-textures.ts)            |
| Sterbe-Animation + Corpse-Persistence         | ✓      | [sprite.ts](../src/engine/sprite.ts)                              |
| Hit-Flash                                     | ✓      | [sprite.ts](../src/engine/sprite.ts)                              |

## Waffen

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| Pistol (Hitscan)                              | ✓      | [weapons.ts](../src/game/weapons.ts)                              |
| Shotgun (Hitscan)                             | ✓      | [weapons.ts](../src/game/weapons.ts)                              |
| Rocket Launcher (Projektil + AoE-Explosion)   | ✓      | [weapons.ts](../src/game/weapons.ts), [rocket-projectile.ts](../src/engine/rocket-projectile.ts) |
| Weapon-Inventory mit Switch                   | ✓      | [weapons.ts](../src/game/weapons.ts)                              |
| Recoil + Screen-Shake                         | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Muzzle-Flash (prozedural)                     | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |

## HUD, Audio, UX

| Feature                                       | Status | Quelle                                                            |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| Health/Ammo/Kills-HUD                         | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Damage-Flash (rote Ränder, 300ms)             | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Pickup-Hinweis im HUD                         | ✓      | [renderer.ts](../src/engine/renderer.ts)                          |
| Player-Centered Minimap mit Scrolling         | ✓      | [minimap.ts](../src/game/minimap.ts)                              |
| Web-Audio SFX (Schuss, Treffer, Tod, Pickup…) | ✓      | [sound.ts](../src/audio/sound.ts)                                 |
| MP3-Musik-Playlist mit Shuffle                | ✓      | [sound.ts](../src/audio/sound.ts), [resources/sound/](../resources/sound/) |
| Game-States Menu/Playing/Paused/Loading/Dead/Win | ✓   | [state.ts](../src/game/state.ts)                                  |
| Loading-Screen mit Progress-Bar               | ✓      | [state.ts](../src/game/state.ts)                                  |
| Pause via ESC + Auto-Resume bei Pointer-Lock  | ✓      | [state.ts](../src/game/state.ts)                                  |

## Tests

| Bereich                  | File                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| Kollision                | [collision.test.ts](../src/engine/__tests__/collision.test.ts)                    |
| Enemy-AI                 | [enemy-ai.test.ts](../src/engine/__tests__/enemy-ai.test.ts)                      |
| Level-Generierung        | [level-gen.test.ts](../src/engine/__tests__/level-gen.test.ts)                    |
| Rocket-Projectile        | [rocket-projectile.test.ts](../src/engine/__tests__/rocket-projectile.test.ts)    |
| Shooter                  | [shooter.test.ts](../src/engine/__tests__/shooter.test.ts)                        |
| Sprite-Lifecycle         | [sprite.test.ts](../src/engine/__tests__/sprite.test.ts)                          |
| State-Machine            | [state.test.ts](../src/game/__tests__/state.test.ts)                              |
| Waffen-Inventory         | [weapons.test.ts](../src/game/__tests__/weapons.test.ts)                          |
| Input                    | [input.test.ts](../src/player/__tests__/input.test.ts)                            |

Framework: Vitest 4 + jsdom + node-canvas, Coverage via c8.

## Roadmap

### Multi-Door-Levels (separate Entrance / Exit mit [E])
**Status:** teilweise. `level.entrance`, `level.exits[]` und `TILE.EXIT_DOOR` (=3)
existieren bereits. Was fehlt:
- `worldState.interactAt()` muss `EXIT_DOOR` handhaben (analog zu `BLUE_KEY_DOOR`)
- HUD-Hint "[E] to exit" wenn nahe einer Exit-Tür
- Level-Transition statt Auto-Win bei Exit-Berührung

Vollständiger Plan: [.hermes/plans/multi-door-levels.md](../../.hermes/plans/multi-door-levels.md)

### Test-Konsolidierung
[src/engine/level-gen.test.ts](../src/engine/level-gen.test.ts) und
[src/engine/__tests__/level-gen.test.ts](../src/engine/__tests__/level-gen.test.ts)
existieren parallel. Eine Version reicht.
