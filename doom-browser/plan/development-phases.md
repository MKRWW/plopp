"# Doom-Browser-Clone - Entwicklungsphasen

## Projektübersicht

**Technologie-Stack:** TypeScript, Vite, Raw Canvas (kein WebGL), Raycasting-Engine  
**Render-Auflösung:** 640x480 mit Skalierung  
**Input:** Pointer Lock API + Keyboard WASD + Shift  
**Architektur:** InputHandler → Renderer.updatePlayer(deltaTime) → Player → Renderer.castRays() → GameStateManager + Weapon

---

## Phase 1: Raycasting-Grundgerüst ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Raycasting-Kernel DDA-Algorithmus implementiert
- [x] 16×16 Weltkarte mit verschiedenen Wandtypen
- [x] Z-Buffer für Tiefeninformation
- [x] Render-Loop mit requestAnimationFrame
- [x] Farbige Wände mit Distanz-Nebel
- [x] Projektstruktur mit Vite + TypeScript aufgebaut

### Dateien
- `src/main.ts` - Entry Point
- `src/engine/renderer.ts` - Raycasting-Renderer (DDA)
- `src/engine/world.ts` - 2D-Weltkarte
- `src/engine/zbuffer.ts` - Z-Buffer-Implementierung
- `src/player/player.ts` - Spieler-Position & Blickrichtung
- `src/assets/map.json` - Weltkarte (optional)

---

## Phase 2: Spielerbewegung ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] WASD-Bewegung implementiert
- [x] Rotation via Maussteuerung (Pointer Lock API)
- [x] Delta-Time-basierte Bewegung
- [x] Sprint-Modus (Shift-Taste, 1.8x Geschwindigkeit)
- [x] Touch-Fallback für Mobile (TouchInputHandler)
- [x] Pause-Overlay bei Pointer-Lock-Verlust

### Dateien
- `src/player/input.ts` - InputHandler + TouchInputHandler + pointerLockSupported()
- `src/player/player.ts` - rotate(), move(), strafe() mit Kollisionsintegration

### Konstanten
- `MOVE_SPEED = 3.0` Tiles pro Sekunde
- `SPRINT_MULTIPLIER = 1.8`

---

## Phase 3: Kollisionssystem ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Grid-basierte Kollision gegen Wände
- [x] Sliding-Collision (an Wänden entlangrutschen)
- [x] Radius-basierter Spieler-Collisions-Check (~0.2 Tiles)
- [x] Separate Achsen prüfen (X dann Y)
- [x] Binäre Suche (8 steps) für präzises Sliding
- [x] Kollisions-Indikator im HUD

### Dateien
- `src/engine/collision.ts` - isWall(), positionCollides(), slideAlongAxis()

### Konstanten
- `PLAYER_RADIUS = 0.2` Tiles

---

## Phase 4: Textur-Mapping ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Texture-Mapping auf Wände (64x64 Pixel Canvas-Generierung)
- [x] U-Coordinate pro Ray berechnen
- [x] Textur-Spalte via ImageData/putImageData zeichnen
- [x] 2 Wandtypen: Ziegelstein (rot), Holzmaserung (grün)
- [x] Fisheye-Korrektur
- [x] Distanz-Nebel
- [x] Seitenschattierung

### Dateien
- `src/engine/textures.ts` - TextureManager + Texture-Interface

### Build
- Größe: ~11.15 kB JavaScript (kompiliert)

---

## Phase 5: Pointer Lock & HUD ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Pointer Lock API Integration (bereits in Phase 2 implementiert)
- [x] Game State Machine (Menu → Playing → Dead → Win)
- [x] HUD mit Health-Bar, Ammo, Score, Kills, Sprint-Indikator
- [x] Waffe-Rendering mit Animation (Bobbing, Muzzle Flash)
- [x] Schuss-Mechanik mit Cooldown (200ms)
- [x] Item-Pickup-System (Health, Ammo via E-Taste)
- [x] Damage-Feedback (rote Bildschirm-Ränder, 300ms)
- [x] Game-State-Screens (Menu, Pause, Dead, Win)
- [x] Item-Pickup-Hinweis im HUD (wenn Item in der Nähe)
- [x] Integration im Render-Loop (State-gesteuert)

### Dateien (neu)
- `src/game/weapon.ts` - Weapon-State, Animation, Munitions-Verwaltung
- `src/game/state.ts` - GameStateManager mit Übergängen
- `src/engine/renderer.ts` - `drawWeapon()`, `drawHUD()`, `drawDamageFlash()`, `handleShoot()`, `checkShotHit()`, `checkItemPickup()`

### Konstanten
- `FIRE_COOLDOWN = 0.2s` (200ms zwischen Schüssen)
- `FIRE_DURATION = 0.15s` (150ms Muzzle Flash)
- `DAMAGE_FLASH_DURATION = 0.3s` (300ms rote Ränder)
- `PICKUP_RADIUS = 0.5` Tiles

---

## Phase 6: Sprite-System ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Z-Buffer basiertes Sprite-Rendering
- [x] Billboard-Technik für Sprites (immer zur Kamera drehen)
- [x] Gegner-Sprites (feindliche Entities)
- [x] Item-Sprites (Health-Packs, Ammo-Boxen)
- [x] Sortierung nach Distanz (Painter's Algorithmus)
- [x] Sprite-Animation (Frame-basiert: Gegner Idle/Attack, Items Floating)

### Dateien (neu)
- `src/engine/sprite.ts` - Sprite-Klasse mit `update()`, `getFloatingOffset()`, Animation-Properties

### Animation-Details
- **Gegner:** 2 Frames (Idle-Pose + Attack-Pose), 2.5 FPS, wechselt Arme-Position
- **Items:** Floating-Animation via Sinus-Offset (±0.05 Tiles, 2 Hz)
- **Sprite.update(deltaTime):** Frame-Timer + Floating-Phase im Render-Loop

---

## Phase 7: Shooting & Game Logic ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Schuss-Mechanik mit Hit-Registrierung (in Phase 5 implementiert)
- [x] Gegner-KI (Chase-Verhalten: bewegt sich auf Spieler zu)
- [x] Gegner-Schaden (Player wird angegriffen, 15 HP pro Hit, 1s Cooldown)
- [x] Win-Bedingung (alle Gegner tot → WIN-Status)
- [x] Lose-Bedingung (Health = 0 → DEAD-Status)
- [x] Respawn-System (Neustart bei DEAD/WIN → MENU: Spieler, Waffe, Sprites zurücksetzen)
- [x] Score/Zählung (100 Punkte pro Kill)
- [x] Gegner-Health (3 Hits zum Töten, statt sofort töten)

### Dateien (modifiziert)
- `src/engine/renderer.ts` - `updateEnemyAI()`, `resetGame()`, `handleShoot()` mit Health
- `src/engine/sprite.ts` - `attackTimer`, `isAlive`, `health` Properties
- `src/game/weapon.ts` - `reset()` Methode für Respawn

### KI-Details
- **Chase-Range:** 8 Tiles (Gegner aktiviert sich in diesem Radius)
- **Attack-Range:** 0.8 Tiles (Angriff wenn nah genug)
- **Chase-Speed:** 1.5 Tiles/s (langsamer als Spieler)
- **Attack-Damage:** 15 HP pro Angriff
- **Attack-Cooldown:** 1.0 Sekunden zwischen Angriffen
- **Kollision:** Gegner nutzt `slideAlongAxis()` für Wand-Sliding

---

## Phase 8: Minimap & Sound ✅ ABGESCHLOSSEN

**Status:** `ABGESCHLOSSEN`

### Aufgaben
- [x] Echtzeit-Minimap-Rendering (obere Ecke, 160×160 Pixel)
- [x] Spieler auf Minimap markieren (grüner Punkt + Blickrichtungs-Pfeil)
- [x] Gegner auf Minimap markieren (roter Punkt)
- [x] Items auf Minimap markieren (Ammo = gelb, Health = grün)
- [x] Sound-Effekte via Web Audio API (prozedural generiert)
  - [x] Schuss-Sound (Noise-Burst + Bass-Oszillator)
  - [x] Treffer-Sound (kurzer "Platsch")
  - [x] Gegner-Tod-Sound (tiefes Krächzen + Noise)
  - [x] Damage-Sound (roter "Ouch"-Ton)
  - [x] Item-Pickup-Sound (aufsteigender "Ding")
  - [x] Schritt-Sound (leises Knistern, 350ms Intervall)
- [x] Sound-Toggle (ein/aus schaltbar)
- [x] Sound-Initialisierung nach User-Interaktion (Browser-Policy)

### Dateien (neu)
- `src/game/minimap.ts` - Minimap-Rendering (Offscreen-Canvas, 10px/Tile)
- `src/audio/sound.ts` - SoundManager mit Web Audio API (6 Sound-Typen)

### Dateien (modifiziert)
- `src/engine/renderer.ts` - Minimap-Integration im Render-Loop, Sound-Trigger in `handleShoot()`, `triggerDamageFlash()`, `checkItemPickup()`, `updatePlayer()`

### Konstanten
- `MINIMAP_SIZE = 160` Pixel
- `TILE_SIZE = 10` Pixel pro Tile
- `MINIMAP_X = 10`, `MINIMAP_Y = 10` (oben links)
- `STEP_INTERVAL = 0.35s` (Schritt-Sound alle 350ms)
- `MASTER_GAIN = 0.3` (Master-Lautstärke)

---

## Projektstruktur (aktuell)

```
doom-browser/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── plan/
│   └── development-phases.md
└── src/
    ├── main.ts
    ├── engine/
    │   ├── renderer.ts
    │   ├── world.ts
    │   ├── zbuffer.ts
    │   ├── collision.ts
    │   ├── textures.ts
    │   └── sprite.ts
    ├── player/
    │   ├── player.ts
    │   └── input.ts
    ├── game/
    │   ├── state.ts
    │   ├── weapon.ts
    │   └── minimap.ts
    └── audio/
        └── sound.ts
```

---

## Nächste Schritte

**Alle Phasen abgeschlossen!** Das Spiel ist spielbar mit:
- Raycasting-Engine mit Textur-Mapping
- Spielerbewegung + Kollision + Sprint
- Gegner-KI (Chase + Angriff)
- Waffe + HUD + Game States
- Minimap + Sound-Effekte

---

*Letzte Aktualisierung: 4. Mai 2026 (Phase 8 abgeschlossen)*