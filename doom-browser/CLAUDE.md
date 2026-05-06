# Projekt: Browser Doom

## Architektur
- Raycasting-Engine (Raw Canvas, kein WebGL)
- TypeScript + Vite
- Render-Auflösung: 640x480
- Input: WASD + Mouse (Pointer Lock API) + Shift (Sprint)
- Entry: src/main.ts → Renderer → Game Loop (requestAnimationFrame)

## Engine-Module
- `src/engine/renderer.ts` - Raycasting-Loop, Textur-Mapping, Sprite-Rendering, HUD, Weapon
- `src/engine/world.ts` - WorldState, Tür-System (Blue Key Door, Secret Wall), Tile-Typen
- `src/engine/collision.ts` - Grid-basierte Kollision, Sliding, Radius-Check (0.2 Tiles)
- `src/engine/level-gen.ts` - Level-Generierung mit Seed-basiertem RNG
- `src/engine/textures.ts` - TextureManager, 64x64 Canvas-Generierung
- `src/engine/sprite.ts` - Sprite-Klasse, Animation, Z-Buffer Rendering
- `src/engine/zbuffer.ts` - Z-Buffer für Tiefentest
- `src/engine/sprite-textures.ts` - Sprite-Texture-Generierung

## Game-Module
- `src/game/state.ts` - GameStateManager (Menu, Playing, Dead, Win)
- `src/game/weapon.ts` - Weapon-State, Animation, Munition
- `src/game/minimap.ts` - Echtzeit-Minimap (160x160, Offscreen-Canvas)

## Player-Module
- `src/player/player.ts` - Position, Rotation, Movement, Strafe
- `src/player/input.ts` - Keyboard + Pointer Lock + Touch Input Handler

## Audio
- `src/audio/sound.ts` - Web Audio API, prozedurale Sounds (Schuss, Treffer, Pickup, etc.)

## Wichtige Konstanten
- MOVE_SPEED = 3.0 Tiles/s, SPRINT_MULTIPLIER = 1.8
- PLAYER_RADIUS = 0.2 Tiles
- FIRE_COOLDOWN = 0.2s
- Chase-Range = 8 Tiles, Attack-Range = 0.8 Tiles
- MINIMAP_SIZE = 160, TILE_SIZE = 10

## Code-Stil
- TypeScript mit typed interfaces
- Keine externen Dependencies (außer Vite/TypeScript)
- Canvas-Rendering via ImageData/putImageData
- Keine externen Assets (alles procedural generiert)

## Build
- `npm run dev` - Dev Server (Vite)
- `npm run build` - Produktion (ESBuild)

## Multi-Agent Workflow
- Claude Opus: Architektur-Pläne, Code-Reviews
- Qwen3.6-A3B: Code-Implementierung, Fixes
