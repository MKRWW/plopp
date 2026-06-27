# Plopp

Ein Wolfenstein-/Doom-artiger Raycaster im Browser. Reines Canvas, kein WebGL,
keine externen Assets — Texturen, Sprites und Sound-Effekte sind prozedural
generiert. Geschrieben in TypeScript, gebaut mit Vite.

> **Warum Plopp?** Wegen des Schuss-Sounds. Web Audio + prozedurale Synthese
> sollte eigentlich nach Schrotflinte klingen, klang aber wie eine
> Sektkorken-Imitation. Aus dem Bug wurde das Markenzeichen.

## Features

- **Raycasting-Engine** in 640×480, hochskaliert auf das Browser-Fenster
- **Prozedurale Level-Generierung** mit Seed-RNG (Mulberry32), Rooms-and-Corridors-Algorithmus, Reachability-Validation und Retry
- **Dual-Keycard-Progression** — Yellow Key → Blue Key → Exit, jeweils als Chokepoint platziert
- **Secret Walls** mit dezentem Crack-Hinweis in der Textur
- **3 Waffen** — Pistol, Shotgun, Rocket Launcher (Projektil + AoE-Explosion)
- **2 Gegner-Klassen** — Grunt (Nahkampf) und Shooter (Raycast-Fernkampf, 5-Tile-Range)
- **Gegner-KI mit State-Machine** — IDLE (Patrouille) → ALERT (Countdown) → CHASE, inklusive Gunshot-Awareness in 12 Tiles
- **8-Richtungs-Sprites** für Gegner, plus Sterbe-Animation und persistente Leichen
- **Echtzeit-Minimap** mit Player-Centered-Scrolling
- **Web-Audio-SFX** prozedural + MP3-Hintergrundmusik-Playlist (Shuffle)
- **Pause** via ESC, Auto-Resume bei Pointer-Lock-Regain
- **Loading-Screen** mit Progress-Bar zwischen Stages

## Quick Start

```bash
cd doom-browser
npm install
npm run dev
```

Öffnet einen Vite-Dev-Server. Spiel läuft im Browser-Fenster. Beim ersten Klick
fragt der Browser nach Pointer-Lock — bestätigen, dann geht's los.

```bash
npm run build      # Produktions-Build nach dist/
npm run preview    # gebaute Version lokal servieren
npm test           # Vitest einmal durchlaufen
npm run test:watch # Watch-Mode für Entwicklung
```

## Controls

| Taste                 | Aktion                                   |
| --------------------- | ---------------------------------------- |
| `W` `A` `S` `D`       | Bewegung (vor/zurück, strafe links/rechts) |
| `Maus`                | Umschauen (Pointer Lock)                 |
| `Shift`               | Sprint (×1.8)                            |
| `Linksklick`          | Schießen                                 |
| `1` / `2` / `3` oder Mausrad | Waffe wechseln                    |
| `E`                   | Tür öffnen / Item aufnehmen              |
| `ESC`                 | Pause                                    |
| `Enter` / `Space`     | Menü starten / nach Tod neu              |

## Architektur

```
doom-browser/
├── index.html
├── src/
│   ├── main.ts                 # Bootstrap: Seed → Level → Renderer → Loop
│   ├── engine/
│   │   ├── renderer.ts         # DDA-Raycaster, HUD, Sprite-Rendering
│   │   ├── world.ts            # WorldState, Tile-Typen, Türsystem
│   │   ├── level-gen.ts        # Prozedurale Level (Rooms & Corridors)
│   │   ├── collision.ts        # Grid-Kollision, Sliding, Line-of-Sight
│   │   ├── sprite.ts           # Sprite-Klasse, AI-States, Enemy-Klassen
│   │   ├── sprite-textures.ts  # Prozedurale Sprite-Texturen (8 Dirs)
│   │   ├── textures.ts         # TextureManager, Wand-Texturen
│   │   ├── rocket-projectile.ts # Raketen-Flug + AoE-Explosion
│   │   └── zbuffer.ts          # Tiefentest
│   ├── game/
│   │   ├── state.ts            # GameStateManager (Menu/Playing/Paused/Loading/Dead/Win)
│   │   ├── weapon.ts           # Aktive Waffe (Animation, Cooldown)
│   │   ├── weapons.ts          # Inventory + Definitionen (Pistol/Shotgun/Rocket)
│   │   └── minimap.ts          # Minimap-Rendering, Player-Centered
│   ├── player/
│   │   ├── player.ts           # Position, Rotation, Bewegung
│   │   └── input.ts            # Keyboard + Pointer Lock + Touch
│   ├── audio/
│   │   └── sound.ts            # Web Audio, prozedurale SFX, Music-Playlist
│   └── __tests__/utils/        # Mocks, Fixtures, Test-Levels
├── resources/sound/            # MP3 Background Music
└── plan/
    └── development-phases.md   # Feature-Stand
```

### Datenfluss pro Frame

```
InputHandler  ─►  Renderer.updatePlayer(dt)
                       │
                       ├─►  Player.move/rotate/strafe  ─►  Collision
                       ├─►  worldState.updateWorld(dt) (Türen)
                       ├─►  updateEnemyAI(dt)          (IDLE → ALERT → CHASE)
                       ├─►  Sprite.update(dt)          (Animation, Death-Timer)
                       └─►  Weapon.update(dt)          (Cooldown, Muzzle-Flash)

Renderer.render()
   ├─►  castRays()       (DDA, Texturen, Z-Buffer)
   ├─►  renderSprites()  (Painter's-Algorithmus, 8-Dir-Lookup)
   ├─►  drawWeapon() / drawHUD()
   ├─►  Minimap.draw()
   └─►  GameStateManager.render()  (Menu/Pause/Loading/Dead/Win Overlays)
```

## Tech-Stack

- **TypeScript 5.4** + **Vite 5.4**
- **Canvas 2D** (`ImageData` + `putImageData`) — kein WebGL
- **Web Audio API** für alle Sounds, prozedural via Oszillator + Noise
- **Vitest 4** + **jsdom** + **node-canvas** für Tests
- Keine Runtime-Dependencies

## Tests

```bash
cd doom-browser
npm test              # einmal durchlaufen
npm run test:watch    # interaktiv
npm run test:coverage # mit c8-Coverage-Report
```

Abgedeckt sind aktuell:
- Level-Generierung (Determinismus, Validität, Stage-Differenzierung)
- Sprite-Lifecycle (alive → dying → dead, Corpse-Persistence)
- Kollision + Line-of-Sight
- Enemy-AI (IDLE/ALERT/CHASE-Transitions)
- Shooter-Verhalten (Range, Cooldown, Damage)
- Rocket-Projectile (Flug, Explosion, AoE)
- Game-State-Machine (Transitions, resetGame)
- Waffen-Inventory (Switch, Ammo, Cooldown)
- Input-Handling

## Status

Spielbar end-to-end. Gegner kämpfen, Türen brauchen Keycards, Stages laden
nach. Aktuell offene Punkte sind in
[doom-browser/plan/development-phases.md](doom-browser/plan/development-phases.md)
dokumentiert.
