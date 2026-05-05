# Feature: Multi-Door Levels (Entrance + Exit)

## Feature-Beschreibung
Aktuell haben alle Level nur EINE Exit-Tür (am Ende des Levels). Die Feature soll es ermöglichen:
- Levels mit separaten ENTRANCE und EXIT Türen
- Player kann im Level VOR und ZURÜCK gehen (nicht linear)
- Levels werden nicht automatisch beendet, wenn man eine Tür berührt
- Player muss zur EXIT-Tür gehen und diese (mit [E]) bewusst "öffnen" um das Level zu verlassen
- Korridor-Design nutzen um Vorder- und Rückweg interessant zu machen

## Architektur-Änderungen

### Level-Generator (level-gen.ts)
- **Exit-Marker statt Exit-Door**: Level.exit bleibt Vec2 (Position), wird NICHT als TILE codiert
- **Entrance-Marker**: Neues Level-Field: `entrance: Vec2` (Start-Position des Players)
- **Exit-Door-Platzierung**: EXIT_DOOR wird nur auf der exit-Wand platziert, aber:
  - EXIT_DOOR ist ein neuer Tile-Typ (TILE.EXIT_DOOR = 3, bereits vorhanden)
  - Wird als WALL_STONE in der Karte codiert bis Player näher kommt
  - Bei level-load wird exit-Position gespeichert
- **Spawn-Mechanik**: 
  - Player spawned nicht mehr in Room 0 Mitte, sondern an `level.entrance`
  - entrance ist ein Punkt kurz INSIDE des Eingangsraums

### World-State (world.ts)
- Level.entrance neu hinzufügen
- EXIT_DOOR-Handling wie BLUE_KEY_DOOR: animiert, wird vom Player aktiviert
- Player-Sensor: Wenn Player < 0.5 Tiles von EXIT_DOOR entfernt ist, zeige "Press E to exit"

### Player / Game-State (player.ts, state.ts)
- Player startet mit currentLevel.entrance statt level.spawn
- Bei [E]-Taste auf EXIT_DOOR: Level-Transition zu nächstem Level (statt auto-exit)
- WIN-Zustand: Erst wenn exit-door "opened" wurde

### Renderer (renderer.ts)
- HUD: Zeige "Exit ahead" oder "Return to entrance" Hinweise
- HUD: "[E] to exit level" wenn Player nahe bei EXIT_DOOR

## Tasks

### Task 1: Extend Level Interface und Generator
**Beschreibung**: Level.interface um `entrance: Vec2` erweitern, Level-Generator so anpassen dass entrance NICHT in der Mitte von Room 0 liegt, sondern am Rand (nahe der Eingang-Wand).

**Details**:
- Level-Interface: Add `entrance: Vec2`
- Level-Generator: Wähle eine Wand-Position von Room 0 als Eingangsraum
- Randomisiert welche Wand (oben/unten/links/rechts)
- Entrance-Position: 1 Tile INSIDE des Raums (von der Wand aus)
- Teste: Level.entrance ist != Level.exit, beide sind im Raum

### Task 2: Add EXIT_DOOR Tile-Type und Platzierung
**Beschreibung**: TILE.EXIT_DOOR ist already exists (=3). Level-Generator soll es auf der exit-Wand platzieren.

**Details**:
- In level-gen.ts: Nach Exit-Position kalkuliert wird, lege EXIT_DOOR auf exit-Wand-Tile
- EXIT_DOOR wird als permanente Wand (nicht animiert wie BLUE_KEY_DOOR)
- WorldState muss EXIT_DOOR nicht tracking, es ist statisch
- EXIT_DOOR blockiert den Spieler bis zur Level-Transition
- Teste: EXIT_DOOR sichtbar auf der Exit-Seite

### Task 3: Load Entrance in Renderer + Player-Start
**Beschreibung**: Player startet nicht mehr bei spawn: { ...room 0 center }, sondern bei level.entrance. Renderer nutzt entrance position.

**Details**:
- renderer.ts: When loading level, set player.x/y to level.entrance
- player.ts: Keine Änderungen nötig (Player-Klasse bleibt gleich)
- Teste: Player spawnt neben Eingangs-Tür statt in Raum-Mitte

### Task 4: Add EXIT_DOOR Interaction + Level-Transition
**Beschreibung**: Player kann [E] drücken wenn nah bei EXIT_DOOR, triggert Level-Transition.

**Details**:
- world.ts: interactWith() soll EXIT_DOOR-Tile checken
- Wenn distanz < 0.5 Tiles zur EXIT_DOOR: triggere "exit level"
- game/state.ts: GameStateManager soll Level-Transition handhaben (wie "Win" aber mit "next level" logic)
- Teste: [E] bei EXIT_DOOR triggert nächstes Level

### Task 5: HUD Hints + Polish
**Beschreibung**: Renderer zeigt Hinweise wenn Player nah bei EXIT_DOOR ist.

**Details**:
- renderer.ts HUD: Zeige "[E] to exit" wenn near exit-door
- renderer.ts HUD: Zeige "Escape the level" Hinweis (early game)
- Teste: HUD-Text korrekt positioned, lesbar

### Task 6: Test + Verify
**Beschreibung**: Spielbare Level mit Entrance und Exit, Level-Transitions funktionieren, Minimap zeigt beide Türen.

**Details**:
- Manual playtest: Starten Level 1, gehe zu Exit-Tür, drücke [E]
- Verify: Level 2 lädt korrekt
- Verify: Minimap zeigt Eingangs- und Ausgangs-Türen
- Verify: Player kann vor und zurück gehen ohne Probleme

## Dependencies & Context

**Files to modify**:
- src/engine/level-gen.ts (entrance Platzierung)
- src/engine/world.ts (Level.entrance, EXIT_DOOR-Handling)
- src/engine/renderer.ts (player-spawn, HUD-hints)
- src/game/state.ts (Level-Transition logic)

**No external deps added, all procedural**

## Rollout-Plan
1. Task 1 → 2 → 3 (Core: Entrance + Exit-Door)
2. Task 4 → 5 (Interaction + Polish)
3. Task 6 (Verify)

## Success Criteria
- [ ] Levels haben separate Eingangs- und Ausgangs-Türen
- [ ] Player kann vor und zurück laufen
- [ ] [E] auf EXIT_DOOR triggert nächstes Level
- [ ] Level-Transition funktioniert
- [ ] Keine Regressions bei Enemies, Collisions, Minimap
