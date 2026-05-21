# Feature: Alien Enemy Redesign

## Problem

Beide Gegner-Klassen (`ENEMY` / Grunt, `SHOOTER`) teilen sich aktuell dieselbe
prozedurale Textur in [src/engine/sprite-textures.ts](../../doom-browser/src/engine/sprite-textures.ts).
Das Ergebnis ist ein humanoider Sack mit braun-roter Färbung, Frisur, Zähnen
und glühenden Augen — sieht nach "kleine Schwester mit Filzstift" aus und
unterscheidet die beiden Klassen optisch gar nicht.

Ziel:
1. Beide Gegner sehen wirklich **alien** aus — keine menschliche Anatomie mehr.
2. Beide Klassen haben **distinkte Silhouetten** — der Spieler erkennt aus
   30 Tiles Entfernung sofort, was ihn jagt.
3. Distinkte **Farbsignaturen** (Glow-Farbe + Carapace-Tönung).
4. Distinkte **Attack-Posen**, die zum Verhalten passen.

## Art Direction

### Grunt → "Husk" (Nahkampf, klein/schnell)

**Silhouette-Idee**: Geduckt, niedrig, Mantis-artig nach vorn gebeugt.

| Eigenschaft        | Spec                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Größe im 64×64-Frame | ~36 px hoch (kleiner als der jetzige humanoide 50-px-Sack)                            |
| Körper             | Chitinöses, segmentiertes Insektoid. Thorax + Kopf verschmolzen, kein Hals.            |
| Augen              | **Ein** horizontales Augen-Band über die Front, 3 kleine cyanfarbene Glow-Punkte.       |
| Arme               | 2 Mantis-Klingen — dünn, segmentiert (3 Glieder), enden in Sicheln                      |
| Beine              | 2 digitigrade Raptor-Beine (Knie nach hinten gebogen)                                   |
| Hintergrund-Layer  | Dünner Schatten unter dem Körper, kein Boden-Schatten gebacken                          |
| Idle-Animation     | Subtiles Atmen (Thorax 1 px hoch/runter)                                                |
| Walk-Animation     | Beine alternierend kicken, Arme leicht schwingen                                        |
| Attack-Animation   | Beide Mantis-Arme nach vorne/oben geklappt, Augen-Band heller                           |

**Palette** (alle als Hex-Konstanten in Code):
```ts
const HUSK_SHADOW    = '#05080a';  // tiefer Schatten unter Körper
const HUSK_CARAPACE  = '#0a0d10';  // Basis Carbon-Schwarz
const HUSK_PLATE     = '#173e4a';  // Teal-Highlight auf Carapace-Segmenten
const HUSK_PLATE_LIT = '#246079';  // hellerer Rim auf Top-Kanten
const HUSK_UNDERSIDE = '#1a2228';  // Bauch / unter den Platten
const HUSK_EYE_DIM   = '#1c4a55';  // Augen-Band dunkel (idle)
const HUSK_EYE       = '#3aa7b8';  // Augen-Band normal
const HUSK_EYE_HOT   = '#7be8f8';  // Augen-Band Attack
const HUSK_BLADE     = '#2b2f33';  // Mantis-Klingen
const HUSK_BLADE_LIT = '#4d575e';  // Klingen-Schneide
```

### Shooter → "Spitter" (Fernkampf, groß/erkennbar)

**Silhouette-Idee**: Hoch, top-heavy, **3 Beine** (Stativ-Stellung). Aus 30 Tiles
Entfernung sofort als "ranged threat" erkennbar.

| Eigenschaft        | Spec                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Größe im 64×64-Frame | ~58 px hoch — höher und top-heavy                                                     |
| Körper             | Bauchige Thorax-Blase (enthält den Bio-Emitter), längliches Profil                      |
| Auge               | **Ein** großes Stiel-Auge oben (Sklera + dunkle Iris, leicht beweglich)                  |
| Arm                | **Ein** dicker, fleischiger Emitter-Arm rechts, endet in puckered Orifice               |
| Beine              | **3** Tripod-Beine (back-left, back-right, front-center) — dünn, knochig                |
| Idle-Animation     | Auge schwenkt langsam (Stiel wackelt)                                                   |
| Walk-Animation     | Tripod-Shuffle (Beine versetzt anheben)                                                 |
| Attack-Animation   | Thorax dilatiert (+1–2 px), Emitter-Orifice glüht giftgelbgrün                          |

**Palette**:
```ts
const SPITTER_SHADOW    = '#070410';
const SPITTER_FLESH     = '#1a0f1f';  // tief violet-schwarz
const SPITTER_FLESH_LIT = '#3b1d4a';  // Violet-Highlight
const SPITTER_FLESH_RIM = '#7a3a8a';  // heller Rand
const SPITTER_LEG       = '#15090d';  // Beine fast schwarz
const SPITTER_LEG_LIT   = '#2a161b';
const SPITTER_EYE_WHITE = '#d8c7b5';  // Sklera (off-white, organisch)
const SPITTER_EYE_IRIS  = '#1a0a0a';  // Iris
const SPITTER_EMITTER   = '#5a6618';  // Emitter dunkel
const SPITTER_BIO       = '#c8e040';  // Bio-Glow giftig gelb-grün
const SPITTER_BIO_HOT   = '#f4ff8a';  // Attack-Glow heller
```

### Corpses

| Klasse  | Corpse-Look                                                                |
| ------- | -------------------------------------------------------------------------- |
| Husk    | Zusammengeklappter Chitin-Haufen, Augen-Band als schwache cyane Linie     |
| Spitter | Deflated Thorax-Blase, leckt grüne Bio-Flüssigkeit in einer Pfütze         |

## Architektur

Die ganze Arbeit passiert in 2 Dateien:

1. **[src/engine/sprite-textures.ts](../../doom-browser/src/engine/sprite-textures.ts)** — gesamter Refactor + neue Zeichenfunktionen
2. **[src/engine/renderer.ts](../../doom-browser/src/engine/renderer.ts)** — Shooter-Init-Loop zeigt auf die neuen Spitter-Texturen

Keine API-Änderungen außerhalb dieser beiden Dateien. `Sprite.angleViews`,
`Sprite.corpseTexture`, `Sprite.textures` bleiben unverändert.

### Erweitertes Interface (Ziel-Stand)

```ts
export interface SpriteTextureSet {
  flat: Map<SpriteType, Texture[]>;
  /** Husk (Grunt): 8-Richtungs-Views pro Pose. [poseIdx][angleIdx]. */
  huskAngleViews: Texture[][];
  /** Spitter (Shooter): 8-Richtungs-Views pro Pose. [poseIdx][angleIdx]. */
  spitterAngleViews: Texture[][];
}

// Statt einer geteilten corpseTexture:
export const huskCorpseTexture: Texture;
export const spitterCorpseTexture: Texture;
```

`SpriteType.ENEMY` (Grunt) → `huskAngleViews` + `huskCorpseTexture`  
`SpriteType.SHOOTER` → `spitterAngleViews` + `spitterCorpseTexture`

### Bestandsschutz (was NICHT angefasst wird)

- `Sprite`-Klasse, `EnemyClass`-Enum, AI-Konstanten in `sprite.ts`
- Items, Decor, Pickups (Ammo / Health / Keycards / Weapons / Barrel / Terminal / Lamp / Debris)
- Player, Collision, Level-Gen, Audio, State-Machine
- Bestehende öffentliche Exports außer den oben genannten

## Tasks

Jede Task ist klein genug für eine Qwen-Session und einen Review. Reihenfolge
ist linear — spätere Tasks bauen auf früheren auf.

### Task 1: Architektur-Refactor (kein Visual-Change)

**Goal**: `sprite-textures.ts` so umbauen, dass es **zwei separate** Enemy-Textur-Sets
liefert, ohne die Optik zu ändern. Beide Sets sind erstmal noch die alte
Humanoid-Textur — Spitter aber leicht eingefärbt, damit der Wiring-Test sichtbar ist.

**Acceptance**:
- Spiel startet, kein Crash
- Grunts sehen aus wie vorher
- Shooters sehen sichtbar anders aus als Grunts (Tönung reicht — Task 4 ersetzt das richtig)
- `npm test` läuft durch

### Task 2: Husk Front-View

**Goal**: Front-Pose (3 Frames: idle/walk/attack) durch das neue Husk-Design ersetzen.

**Acceptance**:
- Frontal angeschauter Grunt sieht aus wie die Husk-Spec (insektoid, geduckt, cyan-Augen-Band)
- Keine humanoiden Reste (kein Mund, keine Zähne, keine Frisur)
- Attack-Pose: beide Mantis-Arme erkennbar erhoben

### Task 3: Husk übrige Views (Quarter / Side / Back)

**Goal**: 4 weitere Winkel-Views, damit die 8-Richtungs-Rotation funktioniert.

**Acceptance**:
- Beim Umkreisen wechselt der Husk sauber durch alle 8 Winkel ohne sichtbaren Bruch
- Side-View zeigt das digitigrade Bein-Profil
- Back-View zeigt segmentierte Carapace-Platten von hinten, kein Augen-Band

### Task 4: Spitter Front-View

**Goal**: Spitter-Front (3 Frames) implementieren — komplett neu.

**Acceptance**:
- Shooter ist **deutlich höher** als Husk und top-heavy
- 3 Beine sichtbar (Tripod)
- Augen-Stiel mit großem Sklera-Auge oben
- Attack-Pose: Emitter-Orifice glüht giftgelbgrün

### Task 5: Spitter übrige Views

**Goal**: Quarter / Side / Back.

**Acceptance**:
- Spitter-Silhouette bleibt aus allen Winkeln eindeutig "tripod + top-heavy"
- Side-View zeigt nur 2 Beine (das front-center Bein verdeckt das hintere)
- Back-View hat keinen Augen-Stiel-Fokus (Stiel zeigt nach vorne weg)

### Task 6: Corpses

**Goal**: Zwei distinkte Leichen-Texturen statt der einen generischen.

**Acceptance**:
- Husk-Corpse: Chitin-Haufen mit dimmem cyanen Augen-Band
- Spitter-Corpse: Deflated Blase mit grüner Bio-Pfütze
- Beide eindeutig als Leiche des jeweiligen Gegners erkennbar

### Task 7: Polish (optional)

**Goal**: Subtile Animations- und Hit-Flash-Politur.

- Husk Hit-Flash → cyaner Flash statt weißer
- Spitter Hit-Flash → grüner Flash
- Idle-Mikro-Animationen (Husk-Thorax-Breath, Spitter-Stiel-Sway)

**Acceptance**: rein optisches Feedback, keine neuen Gameplay-Effekte.

---

## Qwen-Prompts (Copy-Paste-Ready)

Jeder Prompt ist self-contained — referenziert diese Datei für den Kontext.
Reviewer (Mensch) checkt nach jeder Task im Browser per `npm run dev`.

### Prompt für Task 1

```
KONTEXT: Lies .hermes/plans/alien-enemy-sprites.md, Abschnitt "Architektur" und
"Task 1". Das ist der vollständige Plan.

AUFGABE: Refactor doom-browser/src/engine/sprite-textures.ts und
doom-browser/src/engine/renderer.ts, sodass es zwei separate Enemy-Texture-Sets
gibt (Husk + Spitter). Visuell sollen Husks GENAU wie vorher aussehen.
Spitters bekommen denselben Sprite, aber mit violet-Tint, damit man im Spiel
sofort sieht dass die Trennung greift.

KONKRETE SCHRITTE:

1. In sprite-textures.ts:
   - Rename Funktion `generateEnemyTexture` → `generateHuskTexture`
     (Signatur und Body bleiben gleich)
   - Add neue Funktion `generateSpitterTexture(pose, view, mirror)`:
     Body identisch zu generateHuskTexture, aber am Ende einen
     violetten Tint-Layer drüberlegen:
       ctx.globalCompositeOperation = 'multiply';
       ctx.fillStyle = '#9966cc';
       ctx.fillRect(0, 0, SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
       ctx.globalCompositeOperation = 'source-over';
   - Rename `buildEnemyAngleViews` → `buildHuskAngleViews`
   - Add `buildSpitterAngleViews(pose)` analog (ruft generateSpitterTexture)
   - SpriteTextureSet Interface: rename `enemyAngleViews` → `huskAngleViews`,
     add `spitterAngleViews: Texture[][]`
   - In generateSpriteTextures(): baue BEIDE Sets, schreibe flat.set(
     SpriteType.SHOOTER, [3 frontal Spitter-Frames])
   - Export const `huskCorpseTexture` (= bisheriger corpseTexture)
   - Export const `spitterCorpseTexture` (= corpseTexture mit demselben
     violet Multiply-Tint drüber)
   - Behalte `corpseTexture` als deprecated alias auf huskCorpseTexture,
     damit nichts bricht — wird in Task 6 entfernt

2. In renderer.ts initializeSprites():
   - Import { huskCorpseTexture, spitterCorpseTexture } aus sprite-textures
   - In der enemies-Schleife: `enemy.angleViews = spriteSet.huskAngleViews;`
                              `enemy.corpseTexture = huskCorpseTexture;`
   - In der shooters-Schleife: `shooter.angleViews = spriteSet.spitterAngleViews;`
                               `shooter.corpseTexture = spitterCorpseTexture;`
                               Plus: `shooter.textures = flat.get(SpriteType.SHOOTER) ?? enemyTextures;`

VERBOTEN:
- Keine anderen Funktionen anfassen (drawEnemyFront etc. bleiben unverändert)
- Keine API-Änderung in sprite.ts oder anderen Modulen
- Keine Änderung an Item/Decor-Texturen

VERIFY:
- `npm run build` läuft durch
- `npm test` läuft durch
- `npm run dev`: Im Spiel sind Grunts unverändert, Shooters violett getönt
```

### Prompt für Task 2

```
KONTEXT: Lies .hermes/plans/alien-enemy-sprites.md, Abschnitt "Art Direction →
Grunt → Husk" und "Task 2". Das ist die volle Spec inkl. Palette.

AUFGABE: Implementiere die Husk-FRONT-View (3 Posen: idle / walk / attack) in
doom-browser/src/engine/sprite-textures.ts. Die bestehende drawEnemyFront-Familie
(drawLegsFront, drawTorsoFront, drawShouldersFront, drawArmsFront, drawHeadFront)
wird durch eine neue drawHuskFront-Familie ersetzt.

KONKRETE SCHRITTE:

1. Definiere die HUSK_*-Farbkonstanten oben in der Datei (siehe Palette in Spec).

2. Schreibe folgende Funktionen, jede zeichnet auf den übergebenen ctx
   (Canvas ist 64x64, cx=32):

   function drawHuskFront(ctx, pose: EnemyPose): void
     - dispatcht zu den Body-Part-Funktionen unten in der richtigen
       Z-Order: shadow → legs → body → mantis arms → eye band

   function drawHuskShadow(ctx): void
     - elliptischer Schatten unter dem Husk, ca. 24×4 px, alpha 0.6,
       Farbe HUSK_SHADOW, y = 58

   function drawHuskLegs(ctx, pose): void
     - 2 digitigrade Beine, Knie nach hinten
     - Oberschenkel: HUSK_CARAPACE, 4×10 px, links/rechts vom cx
     - Unterschenkel knickt nach vorne, HUSK_PLATE
     - Fuß: 2 Krallen, HUSK_BLADE
     - Bei pose='walk': eines der Beine 2 px nach vorn versetzt (alternierend)
     - Bei pose='attack': beide Beine breiter gespreizt (Stand)

   function drawHuskBody(ctx, pose): void
     - Verschmolzener Thorax+Kopf, oval/segmentiert
     - Höhe ~24 px, Breite ~26 px, top bei y=18, bottom bei y=42
     - 3 horizontale Carapace-Segmente, jedes mit HUSK_PLATE oben und
       HUSK_PLATE_LIT als 1-px-Top-Rim
     - Unterseite: HUSK_UNDERSIDE als Schatten unten
     - Bei pose='idle': normale Höhe
     - Bei pose='attack': Thorax 1 px höher gedehnt (Aufrichtung)

   function drawHuskMantisArms(ctx, pose): void
     - 2 segmentierte Arme links/rechts vom Thorax
     - Pose 'idle' / 'walk': Arme hängen schräg nach vorne unten, leicht gebeugt
     - Pose 'attack': Arme nach oben/vorne geklappt, Klingen über Kopfhöhe
     - Jeder Arm: 2 dünne HUSK_CARAPACE-Segmente + scythe blade aus HUSK_BLADE
       mit HUSK_BLADE_LIT als 1-px-Schneide-Highlight

   function drawHuskEyeBand(ctx, pose): void
     - Horizontale Reihe von 3 Glow-Punkten, je 2×2 px, y=24
     - Punkte bei cx-7, cx-1, cx+5 (etwa)
     - Farbe abhängig von pose:
         idle  → HUSK_EYE_DIM
         walk  → HUSK_EYE
         attack→ HUSK_EYE_HOT mit ctx.shadowColor=HUSK_EYE_HOT, shadowBlur=6
     - Vergiss nicht shadowBlur danach auf 0 zurücksetzen

3. In generateHuskTexture (vorher generateEnemyTexture):
   - Switch-Case 'front' ruft jetzt drawHuskFront(ctx, pose) statt
     drawEnemyFront(ctx, cx, headY, torsoY, attacking, legKick, armSwing)
   - Lass die anderen Views (frontQuarter, side, backQuarter, back) erstmal
     noch auf die alten drawEnemyQuarter/drawEnemySide/drawEnemyBack zeigen —
     die kommen in Task 3 dran

VERBOTEN:
- drawEnemyQuarter / drawEnemySide / drawEnemyBack nicht anfassen
- Spitter-Code nicht anfassen
- Keine neuen Exports

VERIFY:
- `npm run build` läuft durch
- `npm test` läuft durch (oder gib Bescheid, welche Tests Sprite-Pixel asserten — die müssen evtl. nachgezogen werden)
- `npm run dev`: Stelle dich frontal vor einen Grunt:
  - keine menschlichen Features (kein Mund, keine Zähne, keine Frisur)
  - insektoid, geduckt, cyanes Augen-Band
  - bei Annäherung wechselt Pose zu attack, Augen werden heller
```

### Prompt für Task 3

```
KONTEXT: Lies .hermes/plans/alien-enemy-sprites.md, Abschnitt "Art Direction →
Grunt → Husk" und "Task 3". Task 2 ist abgeschlossen, drawHuskFront existiert.

AUFGABE: Die übrigen 4 Husk-Views implementieren — frontQuarter, side,
backQuarter, back. Mirror-Flag wird vom bestehenden Mechanismus gehandhabt
(über mirrorTextureHorizontal), du brauchst nur die 4 unmirrored Versionen.

KONKRETE SCHRITTE:

1. Schreibe pro View eine drawHuskXxx(ctx, pose)-Funktion analog zu Task 2.
   Jede besteht aus shadow + legs + body + arms + eyeBand, projektiert für
   den jeweiligen Winkel:

   drawHuskFrontQuarter(ctx, pose)
     - 3/4-Sicht von vorne-seitlich: Körper horizontal um Faktor 0.78
       komprimiert, ~3 px nach rechts versetzt (foreground-Seite)
     - Augen-Band sichtbar aber verkürzt (nur 2 der 3 Punkte voll, 1 verdeckt)
     - 1 Mantis-Arm im Vordergrund (größer), 1 dahinter (kleiner)

   drawHuskSide(ctx, pose)
     - Reines Seitenprofil
     - Nur 1 Bein voll sichtbar (das andere verdeckt — als dünne Linie dahinter zeichnen)
     - 1 Mantis-Arm sichtbar, der andere dahinter angedeutet
     - Augen-Band wird zu 1 länglichem Glow-Streifen seitlich, ca. 4×2 px
     - Thorax-Profil zeigt segmentierte Linien deutlich

   drawHuskBackQuarter(ctx, pose)
     - Wie frontQuarter, aber von hinten-seitlich
     - KEIN Augen-Band (Augen sind vorne)
     - Carapace-Platten von hinten gezeichnet (3 horizontale Segmente, HUSK_PLATE,
       1-px HUSK_PLATE_LIT Top-Rim pro Segment)
     - 1 Mantis-Arm-Stumpf von hinten sichtbar

   drawHuskBack(ctx, pose)
     - Reine Rückansicht
     - Symmetrisch
     - 3 Carapace-Segmente von hinten, deutliche Rim-Highlights
     - 2 Bein-Stümpfe unten
     - Mantis-Arme angedeutet seitlich
     - KEIN Augen-Band

2. In generateHuskTexture, switch-case alle 4 Views auf die neuen draw-Funktionen umstellen.
   drawEnemyQuarter, drawEnemySide, drawEnemyBack und alle ihre Helper können dann
   gelöscht werden (sind nirgendwo sonst referenziert — vorher mit grep prüfen).

VERBOTEN:
- Spitter-Code anfassen
- drawHuskFront aus Task 2 verändern

VERIFY:
- `npm run build` + `npm test` grün
- `npm run dev`: Umkreise einen Grunt langsam. Erwartung:
  - Alle 8 Winkel zeigen einen konsistenten Husk (gleiche Proportionen, gleiche Farben)
  - Augen-Band ist nur in front/frontQuarter/side sichtbar, weg in back-Views
  - Side-View zeigt das digitigrade Beinprofil
```

### Prompt für Task 4

```
KONTEXT: Lies .hermes/plans/alien-enemy-sprites.md, Abschnitt "Art Direction →
Shooter → Spitter" und "Task 4". Task 1 hat die Spitter-Wiring bereits gelegt,
generateSpitterTexture liefert aktuell nur einen violet-getönten Husk.

AUFGABE: Implementiere die Spitter-FRONT-View (idle / walk / attack) komplett
neu. Ersetzt den violet-Tint-Hack aus Task 1 für die Front-Pose.

KONKRETE SCHRITTE:

1. Definiere die SPITTER_*-Farbkonstanten oben in der Datei (siehe Palette in Spec).

2. Schreibe folgende Funktionen:

   function drawSpitterFront(ctx, pose: EnemyPose): void
     - Z-Order: shadow → tripod legs → thorax body → emitter arm → eye stalk

   function drawSpitterShadow(ctx): void
     - Ellipse 28×4 px alpha 0.6, Farbe SPITTER_SHADOW, y=60
     - Etwas breiter als der Husk-Schatten

   function drawSpitterTripodLegs(ctx, pose): void
     - 3 Beine in Stativ-Anordnung:
       - back-left bei cx-10, geht hoch zu Thorax-Bottom links
       - back-right bei cx+10, geht hoch zu Thorax-Bottom rechts
       - front-center bei cx, geht NACH VORNE und hoch zu Thorax-Mitte
     - Jedes Bein: ~3 px breit, 24 px lang, knöchern segmentiert (2 Glieder)
     - Farbe SPITTER_LEG, mit SPITTER_LEG_LIT als 1-px-Highlight an Vorderkante
     - Bei pose='walk': front-center Bein leicht angehoben (2 px), back-Beine
       fest. Bei nächstem Walk-Frame umgekehrt — der Loop entsteht durch das
       Frame-Wechseln in der Sprite-Klasse.

   function drawSpitterThorax(ctx, pose): void
     - Bauchige Blase, Mittelpunkt ca. cy=28
     - Höhe 22 px, Breite 28 px, oben spitzer als unten (eher Tropfen-Form)
     - Basis-Fill: SPITTER_FLESH
     - Vertikaler Gradient von SPITTER_FLESH_LIT oben zu SPITTER_FLESH unten
     - Rim-Highlight oben rechts: SPITTER_FLESH_RIM, ca. 2 px breit
     - Bei pose='attack': 1-2 px höher und breiter (dilatiert)

   function drawSpitterEmitterArm(ctx, pose): void
     - Rechter Arm, dicker fleischiger Schlauch
     - Startet an der rechten Thorax-Seite (cx+12, y=28)
     - Hängt schräg nach unten, ca. 16 px lang, 5 px dick
     - Endet in Orifice: kreisrunde Öffnung, ~6 px Durchmesser
       - idle: SPITTER_EMITTER dunkel, mit kleinem SPITTER_BIO-Tropfen drin
       - walk: identisch zu idle
       - attack: Orifice glüht hell SPITTER_BIO_HOT mit
         ctx.shadowColor=SPITTER_BIO_HOT, shadowBlur=8.
         shadowBlur am Ende auf 0 zurücksetzen.
     - Farbe Arm: SPITTER_FLESH mit SPITTER_FLESH_RIM 1-px-Highlight oben

   function drawSpitterEyeStalk(ctx, pose): void
     - Stiel ragt aus Thorax-Oberseite nach oben/hinten, ca. 8 px lang, 2 px dick
     - Farbe SPITTER_FLESH_LIT
     - Auge oben am Stielende:
       - Sklera: Kreis ~5 px Durchmesser, SPITTER_EYE_WHITE
       - Iris: kleinerer Kreis ~2 px in der Mitte, SPITTER_EYE_IRIS
       - Iris-Position leicht abhängig von pose:
           idle   → Iris zentriert
           walk   → Iris 1 px nach vorne (unten in Front-View)
           attack → Iris ganz nach vorne, weit aufgerissen (Sklera +1px)

3. In generateSpitterTexture: case 'front' ruft drawSpitterFront(ctx, pose).
   Den violet-Tint-Hack aus Task 1 ENTFERNEN — der war Platzhalter.
   Die anderen Views (Quarter/Side/Back) behalten den Tint vorläufig
   (kommen in Task 5).

VERBOTEN:
- Husk-Code anfassen
- Animations-Timing oder Frame-Anzahl ändern
- Den globalen Sprite-Größen-Konstante SPRITE_TEXTURE_SIZE ändern

VERIFY:
- `npm run build` + `npm test` grün
- `npm run dev`: Stelle dich frontal vor einen Shooter:
  - Deutlich höher als ein Husk daneben (Husk ist ~36 px, Spitter ~58 px)
  - 3 Beine in Tripod erkennbar
  - Stiel-Auge oben mit beweglicher Iris
  - Beim Schießen: Emitter glüht giftgrün, Thorax dilatiert
  - Andere Winkel sind noch violet — das ist OK, kommt in Task 5
```

### Prompt für Task 5

```
KONTEXT: .hermes/plans/alien-enemy-sprites.md, Task 5. Tasks 1-4 sind erledigt,
drawSpitterFront existiert.

AUFGABE: Die übrigen 4 Spitter-Views implementieren (frontQuarter, side,
backQuarter, back). Wiring ist schon da, nur die draw-Funktionen fehlen.

KONKRETE SCHRITTE: Analog zu Task 3 für Husk — pro View eine Funktion:

drawSpitterFrontQuarter(ctx, pose)
  - 3/4-Sicht: Körper-x-Achse 0.85 komprimiert, +3 px Richtung Foreground
  - Tripod-Beine: front-center Bein sichtbar groß im Vordergrund, beide
    back-Beine als dünnere Linien dahinter
  - Emitter-Arm im Vordergrund größer, falls Foreground-Seite die Emitter-Seite ist
  - Stiel-Auge sichtbar, Iris zur Foreground-Seite gedreht

drawSpitterSide(ctx, pose)
  - Reines Seitenprofil
  - Nur 2 Beine sichtbar (front-center + 1 back), das andere back-Bein verdeckt
  - Thorax-Silhouette zeigt charakteristisches Tropfen-Profil sehr deutlich
  - Emitter-Arm streckt sich nach vorne (in Bewegungsrichtung)
  - Stiel-Auge ragt nach oben, Iris zur Seite gedreht

drawSpitterBackQuarter(ctx, pose)
  - 3/4-Sicht von hinten
  - Stiel-Auge zeigt von hinten — nur Stiel + Rückseite Sklera (= heller Kreis,
    keine Iris)
  - Emitter-Arm-Stumpf von hinten sichtbar, kein Glow
  - Thorax-Rückseite zeigt vertikale Saug-Linien als 2-3 dunkle Streifen
    (SPITTER_FLESH dark auf SPITTER_FLESH base)

drawSpitterBack(ctx, pose)
  - Reine Rückansicht
  - Symmetrisch
  - 3 Beine sichtbar als Stümpfe
  - Thorax-Rückseite mit Saug-Linien
  - Stiel-Auge: nur Hinterkopf-Stielansatz, kein Glow / keine Iris

In generateSpitterTexture: alle 4 Views auf die neuen draw-Funktionen mappen.
Den violet-Tint-Multiply-Hack komplett entfernen.

VERBOTEN:
- Spitter-Front aus Task 4 anfassen
- Husk-Code anfassen

VERIFY:
- `npm run build` + `npm test` grün
- `npm run dev`: Umkreise einen Shooter. Erwartung:
  - Aus jedem Winkel: tripod, top-heavy, eindeutig kein Husk
  - Side-View zeigt nur 2 Beine
  - Back-Views haben keinen Glow (Auge zeigt weg)
  - Kein violet-Tint mehr irgendwo
```

### Prompt für Task 6

```
KONTEXT: .hermes/plans/alien-enemy-sprites.md, Task 6. Tasks 1-5 erledigt,
Husk und Spitter sind komplett individuell gezeichnet. Aktuell teilen sich
beide noch dieselbe corpseTexture (huskCorpseTexture == spitterCorpseTexture
mit violet-Tint).

AUFGABE: Zwei distinkte Corpse-Texturen schreiben.

KONKRETE SCHRITTE:

1. In sprite-textures.ts, ersetze die existierende generateCorpseTexture-Funktion
   durch zwei neue Funktionen:

   function generateHuskCorpseTexture(w, h): Texture
     - 64x64 transparent base
     - Boden-Pfütze: dunkles Teal (HUSK_PLATE alpha 0.5), ellipse 28×8, y=cy+4
     - Chitin-Haufen: 3 zerbrochene Carapace-Stücke übereinander, HUSK_CARAPACE
       mit HUSK_PLATE Rims, jeweils unregelmäßige Polygone ~12-16 px breit
     - Schwaches Augen-Band Glow: 2 px Streifen HUSK_EYE_DIM (alpha 0.5),
       ohne shadowBlur
     - Vereinzelte schwarze Splitter (HUSK_CARAPACE 2x2 px) verstreut

   function generateSpitterCorpseTexture(w, h): Texture
     - 64x64 transparent base
     - Bio-Pfütze: SPITTER_BIO bei alpha 0.6, ellipse 32×10, y=cy+5
       (größer und heller als Husk-Pfütze)
     - Deflated Thorax: bauchige Blob-Silhouette mit SPITTER_FLESH, eingedellt
       (verwende quadraticCurveTo, einseitig konkav)
     - Bio-Tropfen-Spritzer SPITTER_BIO verteilt um die Pfütze
     - Stiel + Auge danebenliegend, Stiel SPITTER_FLESH_LIT, Auge geschlossen
       (kein Iris-Detail, nur SPITTER_EYE_WHITE Kreis halb verdeckt)
     - 1-2 Beine geknickt daneben als dünne SPITTER_LEG Striche

2. Exportiere beide:
     export const huskCorpseTexture = generateHuskCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);
     export const spitterCorpseTexture = generateSpitterCorpseTexture(SPRITE_TEXTURE_SIZE, SPRITE_TEXTURE_SIZE);

3. Entferne den alten `corpseTexture` Export komplett.
   In renderer.ts den Import anpassen — nur huskCorpseTexture und
   spitterCorpseTexture importieren. Beide Verwendungsstellen in
   initializeSprites zeigen schon richtig (aus Task 1).

VERBOTEN:
- Lebende Husk/Spitter-Texturen anfassen

VERIFY:
- `npm run build` + `npm test` grün
- `npm run dev`: Töte einen Husk und einen Spitter:
  - Husk-Leiche: Chitin-Haufen mit Teal-Akzent
  - Spitter-Leiche: deflated Blase mit grüner Pfütze
  - Beide deutlich unterscheidbar als der jeweilige Gegner
```

### Prompt für Task 7 (optional)

```
KONTEXT: .hermes/plans/alien-enemy-sprites.md, Task 7. Polish-Pass, rein optisch.

AUFGABE: Subtile Animations- und Hit-Flash-Politur.

KONKRETE SCHRITTE:

1. Hit-Flash-Farbe pro Klasse:
   Aktuell wird der Hit-Flash in renderer.ts beim Sprite-Rendering als weiße
   Tönung auf hitFlashTimer > 0 angewendet. Such die Stelle und mach die Farbe
   abhängig von sprite.enemyClass:
     - EnemyClass.GRUNT  → cyan (rgba(122, 232, 248, alpha))
     - EnemyClass.SHOOTER → grün (rgba(200, 224, 64, alpha))

2. Husk-Atem in drawHuskBody:
   Body-Höhe leicht moduliert mit Math.sin(sprite.floatingPhase) * 0.5
   (max 1 px Modulation). floatingPhase wird in sprite.update bereits
   inkrementiert für ENEMY-Typen — check ob das auch für SHOOTER getriggert wird,
   ggf. anpassen.

3. Spitter-Augen-Stiel-Sway in drawSpitterEyeStalk:
   Stiel-Spitze (und damit Auge) horizontal um Math.sin(floatingPhase) * 2 px
   schwingen lassen — der Stiel-Basis bleibt fest, nur Top wackelt.

VERBOTEN:
- Game-Logik anfassen (kein Schaden, kein AI-Verhalten)
- Frame-Anzahl oder Pose-System ändern

VERIFY:
- `npm run dev`: Schieße auf beide:
  - Husk-Flash ist cyan, Spitter-Flash ist grün
  - Im Idle: Husk-Thorax pulsiert subtil, Spitter-Auge wackelt sanft seitlich
```

## Review-Checkliste

Was bei jeder Task vor dem Merge prüfen:

- [ ] `npm run build` ohne Errors
- [ ] `npm test` grün (oder Tests sinnvoll angepasst, nicht weggelöscht)
- [ ] `npm run dev` lädt ohne Console-Errors
- [ ] Visueller Smoke-Test passt zur Spec (siehe VERIFY pro Task)
- [ ] Keine Datei außerhalb der erlaubten 2 (sprite-textures.ts, renderer.ts) angefasst
- [ ] Keine Game-Logik geändert (AI, Damage, Collision, etc.)
- [ ] Keine neuen Runtime-Dependencies in package.json
