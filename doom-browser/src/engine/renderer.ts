import { Player } from '../player/player';
import { MAP_WIDTH, MAP_HEIGHT, worldState, InteractionResult } from './world';
import { ZBuffer } from './zbuffer';
import { InputHandler, pointerLockSupported } from '../player/input';
import { TextureManager, Texture } from './textures';
import { Sprite, SpriteType, generateSpriteTextures } from './sprite';
import { corpseTexture } from './sprite-textures';
import { GameState, GameStateManager } from '../game/state';
import { Weapon, WeaponState } from '../game/weapon';
import { slideAlongX, slideAlongY, PLAYER_RADIUS, ENEMY_RADIUS, MIN_ENTITY_DIST,
         resolveAllEntityOverlaps, wouldOverlapEntity, resolveEntityCollision } from './collision';
import { Minimap } from '../game/minimap';
import { SoundManager, SoundType } from '../audio/sound';
import { Level, generateLevel } from './level-gen';

/**
 * Konstanten für den Raycaster.
 */
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const MOVE_SPEED = 3.0;          // Tiles pro Sekunde (Normal)
const SPRINT_MULTIPLIER = 1.8;  // Sprint-Faktor
const CORPSE_SCALE = 0.18;      // Corpse height as fraction of full sprite height

/**
 * Raycasting-Renderer.
 * Implementiert den klassischen DDA-Algorithmus (Digital Differential Analyzer)
 * für Wolfenstein-3D-Style Rendering.
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player: Player;
  private zBuffer: ZBuffer;
  private input: InputHandler;
  private textureManager: TextureManager;
  private sprites: Sprite[] = [];
  private gameStateManager: GameStateManager;
  private weapon: Weapon;

  // Delta-Time tracking
  private lastTime: number = 0;

  // Sprint-Status für HUD
  private isSprinting: boolean = false;

  // Keycard state
  private hasKeycard: boolean = false;
  private keycardPickupMessage: number = 0;  // timer for pickup message
  private readonly keycardMessageDuration: number = 2.0;

  // Door interaction HUD messages
  private doorMessage: string = '';
  private doorMessageTimer: number = 0;
  private readonly doorMessageDuration: number = 2.0;

  // Pause-Overlay
  private pauseOverlay!: HTMLDivElement;

  // Pointer Lock verfügbar?
  private pointerLockAvailable: boolean;

  // Damage-Feedback Timer (rote Bildschirmränder)
  private damageFlashTimer: number = 0;
  private readonly damageFlashDuration: number = 0.3; // 300ms

  // Muzzle-Flash-Textur (prozedural generiert)
  private muzzleFlashTexture: Texture | null = null;

  // Screen Shake
  private screenShakeTimer: number = 0;
  private screenShakeIntensity: number = 0;

  // Hit Feedback (Hitmarker in Bildschirmmitte)
  private hitMarkerTimer: number = 0;
  private readonly hitMarkerDuration: number = 0.15;

  // Wall Impact Sparks (screen-space)
  private wallImpactTimer: number = 0;
  private readonly wallImpactDuration: number = 0.2;
  private wallImpactX: number = 0;
  private wallImpactY: number = 0;

  // Phase 8: Minimap & Sound
  private minimap: Minimap;
  private soundManager: SoundManager;
  private stepTimer: number = 0;       // Timer für Schritt-Sounds
  private readonly stepInterval: number = 0.35; // Schritt alle 350ms beim Laufen

  // Edge-Triggering für Interaktion (E-Taste)
  private wasInteractPressedLastFrame: boolean = false;
  // Separates Edge-Tracking für Exit-Door-E (verhindert Mehrfach-Trigger pro Druck)
  private wasExitEPressed: boolean = false;

  // Procedural Levels: aktuelles Level + Stage-Counter + Basis-Seed.
  // Das Level wird beim Stage-Wechsel mit (baseSeed, stage) neu generiert,
  // damit Spielzüge reproduzierbar sind, falls man den Seed kennt.
  private currentLevel: Level;
  private stage: number;
  private baseSeed: number;

  // Stage-Übergangs-HUD (Banner mit "STAGE N")
  private stageBannerTimer: number = 0;
  private readonly stageBannerDuration: number = 2.0;

  constructor(
    player: Player,
    gameStateManager: GameStateManager,
    weapon: Weapon,
    level: Level,
    baseSeed: number
  ) {
    this.player = player;
    this.gameStateManager = gameStateManager;
    this.weapon = weapon;
    this.currentLevel = level;
    this.stage = level.stage;
    this.baseSeed = baseSeed;
    this.zBuffer = new ZBuffer(SCREEN_WIDTH);
    this.textureManager = new TextureManager();
    this.textureManager.initialize();
    this.generateMuzzleFlashTexture();
    this.initializeSprites();
    this.pointerLockAvailable = pointerLockSupported();

    // Phase 8: Minimap & Sound initialisieren
    this.minimap = new Minimap();
    this.soundManager = new SoundManager();

    // Canvas erstellen
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = SCREEN_WIDTH;
    this.canvas.height = SCREEN_HEIGHT;

    // Input-Handler initialisieren
    this.input = new InputHandler(this.canvas);

    // Mouse-Click → Schießen + Sound initialisieren (erster User-Interaktion)
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0 && this.gameStateManager.getState() === GameState.PLAYING) {
        this.handleShoot();
      }
      // Sound beim ersten Klick initialisieren (Browser-Policy)
      this.soundManager.init();
    });

    // F1: Kollisions-Debug-Overlay umschalten
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.minimap.toggleDebug();
      }
    });

    // Pause-Overlay erstellen (falls Pointer Lock unterstützt)
    if (this.pointerLockAvailable) {
      this.createPauseOverlay();
      this.setupCanvasClick();
    }
  }

  /**
   * Generiert eine Muzzle-Flash-Textur (prozedural).
   */
  private generateMuzzleFlashTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Transparenter Hintergrund
    ctx.clearRect(0, 0, 64, 64);

    // Feuer-Kern: hellgelb/weiß in der Mitte
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
    gradient.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 240, 100, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 180, 30, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Flammen-Spitzen
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const fx = 32 + Math.cos(angle) * 20;
      const fy = 32 + Math.sin(angle) * 20;
      const flameGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12);
      flameGrad.addColorStop(0, 'rgba(255, 200, 50, 0.7)');
      flameGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    this.muzzleFlashTexture = {
      canvas,
      width: 64,
      height: 64,
      data: ctx.getImageData(0, 0, 64, 64)
    };
  }

  /**
   * Handelt einen Schuss: feuert Waffe, prüft Hit auf Gegner-Sprites.
   */
  private handleShoot(): void {
    if (!this.weapon.fire()) return;

    // Sound: Schuss
    this.soundManager.play(SoundType.SHOOT);

    // Screen Shake: kurz leicht wackeln beim Schuss
    this.screenShakeTimer = 0.08;
    this.screenShakeIntensity = 3;

    // Raycast in Blickrichtung → prüfe ob ein Gegner-Sprite getroffen wird
    const hit = this.checkShotHit();
    if (hit) {
      // Schaden an Gegner (1 HP pro Schuss)
      hit.health--;

      // Hit-Feedback: kurz aufblitzen
      hit.hitFlashTimer = 0.12;

      // Screen Shake: stärker beim Treffer
      this.screenShakeTimer = 0.12;
      this.screenShakeIntensity = 5;

      // Hitmarker in Bildschirmmitte
      this.hitMarkerTimer = this.hitMarkerDuration;

      // Sound: Treffer
      this.soundManager.play(SoundType.HIT);

      // Wenn Gegner tot → Death-Animation starten
      if (hit.health <= 0) {
        // Letzte angle-aware Textur einfrieren, damit die Death-Animation
        // den zuletzt gesehenen Blickwinkel behält statt auf "front" zurückzuspringen.
        if (hit.angleViews.length > 0) {
          const px = this.player.x;
          const py = this.player.y;
          const angleToCamera = Math.atan2(py - hit.y, px - hit.x);
          const rel = angleToCamera - hit.facingAngle;
          const norm = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const angleIdx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8;
          const poseIdx = Math.min(hit.currentFrame, hit.angleViews.length - 1);
          const frozen = hit.angleViews[poseIdx]?.[angleIdx];
          if (frozen) hit.texture = frozen;
        }

        hit.isAlive = false;
        hit.isDying = true;
        hit.deathTimer = hit.deathDuration;
        this.weapon.killCount++;
        this.player.score += 100;

        // Sound: Gegner-Tod
        this.soundManager.play(SoundType.ENEMY_DEATH);
      }
    } else {
      // Kein Gegner getroffen → Wand-Einschlag (wall impact spark)
      this.triggerWallImpact();
    }
  }

  /**
   * Berechnet die screen-space Position des Wand-Einschlags (in Blickrichtung).
   */
  private triggerWallImpact(): void {
    // Ray in Blickrichtung casten um Wand-Trefferpunkt zu finden
    const rayDirX = this.player.dirX;
    const rayDirY = this.player.dirY;

    let mapX = Math.floor(this.player.x);
    let mapY = Math.floor(this.player.y);
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    let sideDistX: number, sideDistY: number;
    if (rayDirX < 0) {
      sideDistX = (this.player.x - mapX) * deltaDistX;
    } else {
      sideDistX = (mapX + 1.0 - this.player.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      sideDistY = (this.player.y - mapY) * deltaDistY;
    } else {
      sideDistY = (mapY + 1.0 - this.player.y) * deltaDistY;
    }

    let hit = 0;
    let steps = 0;
    const maxSteps = 50;
    while (hit === 0 && steps < maxSteps) {
      steps++;
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += (rayDirX < 0 ? -1 : 1);
      } else {
        sideDistY += deltaDistY;
        mapY += (rayDirY < 0 ? -1 : 1);
      }
      if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        hit = 1;
      } else if (worldState.isSolidTile(mapX, mapY)) {
        hit = worldState.getTile(mapX, mapY);
      }
    }

    // Wand-Trefferpunkt berechnen
    let wallX: number;
    if (rayDirX < 0) {
      wallX = this.player.y + sideDistX * rayDirY;
    } else {
      wallX = this.player.x + sideDistY * rayDirX;
    }

    // Screen-space Position (Mitte des Bildschirms mit leichtem Offset basierend auf Trefferpunkt)
    const hitOffset = (wallX - Math.floor(wallX) - 0.5) * 100;
    this.wallImpactX = SCREEN_WIDTH / 2 + hitOffset + (Math.random() - 0.5) * 20;
    this.wallImpactY = SCREEN_HEIGHT / 2 + (Math.random() - 0.5) * 30;
    this.wallImpactTimer = this.wallImpactDuration;
  }

  /**
   * Prüft ob ein Schuss (in Blickrichtung) einen Gegner-Sprite trifft.
   * Gibt den getroffenen Sprite zurück oder null.
   */
  private checkShotHit(): Sprite | null {
    const px = this.player.x;
    const py = this.player.y;
    const dirX = this.player.dirX;
    const dirY = this.player.dirY;

    let closestSprite: Sprite | null = null;
    let closestDist = Infinity;

    for (const sprite of this.sprites) {
      if (sprite.type !== SpriteType.ENEMY) continue;
      if (sprite.isDying || sprite.isDead) continue;

      // Vektor vom Spieler zum Sprite
      const toSpriteX = sprite.x - px;
      const toSpriteY = sprite.y - py;
      const dist = Math.sqrt(toSpriteX * toSpriteX + toSpriteY * toSpriteY);

      // Projektion des Sprite-Vektors auf die Blickrichtung (Dot Product)
      const dot = toSpriteX * dirX + toSpriteY * dirY;
      if (dot < 0) continue; // Sprite ist hinter dem Spieler

      // Abstand der Sprite-Mitte zur Blicklinie
      const projX = px + dirX * dot;
      const projY = py + dirY * dot;
      const offset = Math.sqrt((sprite.x - projX) ** 2 + (sprite.y - projY) ** 2);

      // Treffer wenn nah genug an der Blicklinie (Sprite-Radius ~0.4 Tiles)
      if (offset < 0.4 && dist < closestDist) {
        closestDist = dist;
        closestSprite = sprite;
      }
    }

    return closestSprite;
  }

  /**
   * Prüft ob der Spieler nah genug an einem collectable Sprite ist zum Einsammeln.
   * Nur AMMO, HEALTH und KEYCARD sind einsammelbar. Deko (BARREL, TERMINAL, LAMP, DEBRIS)
   * wird ignoriert.
   */
  private checkItemPickup(): void {
    const pickupRadius = 0.5;
    const px = this.player.x;
    const py = this.player.y;

    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const sprite = this.sprites[i];
      if (!sprite.isCollectable) continue;

      const dx = sprite.x - px;
      const dy = sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < pickupRadius) {
        // Item einsammeln
        if (sprite.type === SpriteType.AMMO) {
          this.weapon.addAmmo(20);
        } else if (sprite.type === SpriteType.HEALTH) {
          this.weapon.addHealth(25);
        } else if (sprite.type === SpriteType.KEYCARD) {
          this.hasKeycard = true;
          this.keycardPickupMessage = this.keycardMessageDuration;
          this.player.score += 50;
        }
        this.soundManager.play(SoundType.PICKUP);
        this.sprites.splice(i, 1);
      }
    }
  }

  /**
   * Setzt Damage-Flash-Timer (wird vom HUD gerendert).
   */
  public triggerDamageFlash(): void {
    this.damageFlashTimer = this.damageFlashDuration;
    // Sound: Damage
    this.soundManager.play(SoundType.DAMAGE);
  }

  /**
   * Spawnt alle Sprites des aktuellen Levels: Gegner, Items, Keycard, Decor und
   * optionales Secret-Item. Liest ausschließlich aus `this.currentLevel`.
   */
  private initializeSprites(): void {
    const spriteSet = generateSpriteTextures();
    const flat = spriteSet.flat;
    const enemyTextures = flat.get(SpriteType.ENEMY);
    const ammoTextures = flat.get(SpriteType.AMMO);
    const healthTextures = flat.get(SpriteType.HEALTH);
    const keycardTextures = flat.get(SpriteType.KEYCARD);
    const decorTextures: Partial<Record<SpriteType, Texture[] | undefined>> = {
      [SpriteType.BARREL]: flat.get(SpriteType.BARREL),
      [SpriteType.TERMINAL]: flat.get(SpriteType.TERMINAL),
      [SpriteType.LAMP]: flat.get(SpriteType.LAMP),
      [SpriteType.DEBRIS]: flat.get(SpriteType.DEBRIS),
    };

    const level = this.currentLevel;

    // Gegner
    for (const pos of level.enemies) {
      const enemy = new Sprite(pos.x, pos.y, SpriteType.ENEMY, enemyTextures?.[0] ?? null);
      if (enemyTextures) enemy.textures = enemyTextures;
      enemy.angleViews = spriteSet.enemyAngleViews;
      enemy.facingAngle = Math.atan2(this.player.y - pos.y, this.player.x - pos.x);
      enemy.animationSpeed = 0.4;
      enemy.corpseTexture = corpseTexture;
      this.sprites.push(enemy);
    }

    // Ammo
    for (const pos of level.ammo) {
      const a = new Sprite(pos.x, pos.y, SpriteType.AMMO, ammoTextures?.[0] ?? null);
      if (ammoTextures) a.textures = ammoTextures;
      a.animationSpeed = 0.12;
      this.sprites.push(a);
    }

    // Health
    for (const pos of level.health) {
      const h = new Sprite(pos.x, pos.y, SpriteType.HEALTH, healthTextures?.[0] ?? null);
      if (healthTextures) h.textures = healthTextures;
      h.animationSpeed = 0.12;
      this.sprites.push(h);
    }

    // Keycard
    {
      const k = new Sprite(level.keycard.x, level.keycard.y, SpriteType.KEYCARD, keycardTextures?.[0] ?? null);
      if (keycardTextures) k.textures = keycardTextures;
      k.animationSpeed = 0.12;
      this.sprites.push(k);
    }

    // Optionales Secret-Health hinter SECRET_WALL
    if (level.secretHealth) {
      const s = new Sprite(level.secretHealth.x, level.secretHealth.y, SpriteType.HEALTH, healthTextures?.[0] ?? null);
      if (healthTextures) s.textures = healthTextures;
      s.animationSpeed = 0.12;
      this.sprites.push(s);
    }

    // Decor
    for (const d of level.decor) {
      const tex = decorTextures[d.type];
      const sprite = new Sprite(d.x, d.y, d.type, tex?.[0] ?? null);
      if (tex) sprite.textures = tex;
      this.sprites.push(sprite);
    }
  }

  /**
   * Generiert das nächste Level und installiert es: Welt-State, Spielerposition,
   * Sprites und transienter HUD-Banner. Health/Score/Ammo bleiben erhalten —
   * Stages sind kumulativ wie im Original-Doom.
   */
  private advanceStage(): void {
    const nextStage = this.stage + 1;
    const nextLevel = generateLevel(this.baseSeed, nextStage);
    worldState.loadLevel(nextLevel);
    this.currentLevel = nextLevel;
    this.stage = nextStage;

    // Spieler positionieren + Blickrichtung
    this.player.setPosition(nextLevel.spawn.x, nextLevel.spawn.y);
    this.player.dirX = nextLevel.spawn.dirX;
    this.player.dirY = nextLevel.spawn.dirY;
    // Camera-Plane senkrecht zur Blickrichtung, |plane| = 0.66 (FOV ≈ 66°)
    this.player.planeX = -nextLevel.spawn.dirY * 0.66;
    this.player.planeY = nextLevel.spawn.dirX * 0.66;

    // Pro-Stage-Reset
    this.hasKeycard = false;
    this.keycardPickupMessage = 0;
    this.doorMessage = '';
    this.doorMessageTimer = 0;
    this.sprites = [];
    this.initializeSprites();

    this.stageBannerTimer = this.stageBannerDuration;
    this.soundManager.play(SoundType.DOOR);
  }

  /**
   * Sortiert Sprites nach Distanz zum Spieler (weitester zuerst = Painter's Algorithmus).
   */
  private sortSpritesByDistance(): void {
    const px = this.player.x;
    const py = this.player.y;

    this.sprites.sort((a, b) => {
      const distA = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
      const distB = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
      return distB - distA; // weitester zuerst
    });
  }

  /**
   * Rendert alle Sprites mit Transformations-Matrix, Projektion und Z-Buffer-Tiefentest.
   */
  private renderSprites(): void {
    this.sortSpritesByDistance();

    const dirX = this.player.dirX;
    const dirY = this.player.dirY;
    const planeX = this.player.planeX;
    const planeY = this.player.planeY;
    const px = this.player.x;
    const py = this.player.y;

    // Inverse Determinante der Kamera-Matrix
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (const sprite of this.sprites) {
      // Floating-Offset für Items (Schweben)
      let floatingOffset = sprite.getFloatingOffset();

      // Death-Animation: Gegner sackt nach unten und wird kleiner
      let deathProgress = 0;
      if (sprite.isDying) {
        deathProgress = 1.0 - (sprite.deathTimer / sprite.deathDuration); // 0 → 1
        floatingOffset -= deathProgress * 0.3; // nach unten sacken
      }

      // Sprite-Position relativ zum Spieler (mit Floating-Offset)
      const spriteX = sprite.x - px;
      const spriteY = sprite.y + floatingOffset - py;

      // Transformations-Matrix: ins Kamerakoordinatensystem
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

      // Nur rendern wenn Sprite vor der Kamera ist
      if (transformY <= 0.1) continue;

      // Bildschirm-X-Zentrum des Sprites
      const spriteScreenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));

      // Sprite-Höhe (basierend auf Distanz) → quadratisch
      let spriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY));
      // Death-Animation: kleiner werden
      if (sprite.isDying) {
        spriteHeight = Math.floor(spriteHeight * (1.0 - deathProgress * 0.5));
      }
      const spriteWidth = spriteHeight;

      // Zeichen-Grenzen berechnen
      let drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2;
      if (drawStartY < 0) drawStartY = 0;
      let drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2;
      if (drawEndY >= SCREEN_HEIGHT) drawEndY = SCREEN_HEIGHT - 1;

      let drawStartX = -spriteWidth / 2 + spriteScreenX;
      if (drawStartX < 0) drawStartX = 0;
      let drawEndX = spriteWidth / 2 + spriteScreenX;
      if (drawEndX >= SCREEN_WIDTH) drawEndX = SCREEN_WIDTH - 1;

      // Distanz-basierte Helligkeit (gleich wie Wände)
      const baseBrightness = Math.min(1.0, 2.0 / (1.0 + transformY * 0.3));

      // Sprite-Textur wählen: Gegner mit angleViews → richtungsabhängig
      let texture: Texture | null = sprite.texture;
      if (
        sprite.type === SpriteType.ENEMY &&
        sprite.angleViews.length > 0 &&
        !sprite.isDying &&
        !sprite.isDead
      ) {
        const angleToCamera = Math.atan2(py - sprite.y, px - sprite.x);
        const rel = angleToCamera - sprite.facingAngle;
        const norm = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const angleIdx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8;
        const poseIdx = Math.min(sprite.currentFrame, sprite.angleViews.length - 1);
        const views = sprite.angleViews[poseIdx];
        if (views && views[angleIdx]) {
          texture = views[angleIdx];
        }
      }

      // Corpse rendering: flat, small, anchored to floor — no shadow, no flash, no death-tint
      if (sprite.type === SpriteType.ENEMY && sprite.isDead && sprite.corpseTexture) {
        texture = sprite.corpseTexture;
        const fullSpriteHeight = Math.abs(Math.floor(SCREEN_HEIGHT / transformY));
        spriteHeight = fullSpriteHeight * CORPSE_SCALE;
        const spriteWidthCorpse = spriteHeight;
        // Anchor corpse bottom to floor line (horizon + half full height)
        const corpseDrawEndY = SCREEN_HEIGHT / 2 + Math.floor(fullSpriteHeight / 2);
        const corpseDrawStartY = Math.max(0, Math.floor(corpseDrawEndY - spriteHeight));
        const corpseDrawStartX = Math.floor(spriteScreenX - spriteWidthCorpse / 2);
        const corpseDrawEndX = Math.floor(spriteScreenX + spriteWidthCorpse / 2);

        // Skip shadow for corpses (body IS the shadow)
        const baseCorpseBrightness = Math.min(1.0, 2.0 / (1.0 + transformY * 0.3));

        const stripeWidth = corpseDrawEndX - corpseDrawStartX;
        const corpseCenterX = (corpseDrawStartX + corpseDrawEndX) / 2;
        const corpseHalfWidth = Math.max(1, (corpseDrawEndX - corpseDrawStartX) / 2);

        for (let stripe = Math.max(0, corpseDrawStartX); stripe < Math.min(SCREEN_WIDTH, corpseDrawEndX); stripe++) {
          if (transformY < this.zBuffer.get(stripe)) {
            const texX = Math.floor(((stripe - corpseDrawStartX) * texture.width) / Math.max(1, stripeWidth));
            const edgeDist = Math.abs(stripe - corpseCenterX) / corpseHalfWidth;
            const volumeShade = 1.0 - 0.35 * edgeDist * edgeDist;
            const brightness = baseCorpseBrightness * volumeShade;

            for (let y = corpseDrawStartY; y < Math.min(SCREEN_HEIGHT - 1, corpseDrawEndY); y++) {
              const texY = Math.floor(((y - corpseDrawStartY) * texture.height) / Math.max(1, corpseDrawEndY - corpseDrawStartY));
              const srcIdx = (texY * texture.width + texX) * 4;
              const srcData = texture.data.data;
              const alpha = srcData[srcIdx + 3];
              if (alpha > 0) {
                const r = Math.min(255, Math.floor(srcData[srcIdx] * brightness));
                const g = Math.min(255, Math.floor(srcData[srcIdx + 1] * brightness));
                const b = Math.min(255, Math.floor(srcData[srcIdx + 2] * brightness));
                this.ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
                this.ctx.fillRect(stripe, y, 1, 1);
              }
            }
          }
        }
        continue; // skip rest of per-sprite rendering for corpses
      }

      // Boden-Schatten: flache Ellipse am Sprite-Fuß (z-buffer-aware)
      if (!sprite.isDying || deathProgress < 0.5) {
        const shadowCenterY = SCREEN_HEIGHT / 2 + spriteHeight / 2;
        const shadowRX = Math.max(2, spriteWidth * 0.32);
        const shadowRY = Math.max(1, spriteHeight * 0.06);
        const shadowAlpha = 0.5 * baseBrightness;
        this.ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        const sxStart = Math.floor(spriteScreenX - shadowRX);
        const sxEnd = Math.ceil(spriteScreenX + shadowRX);
        for (let sx = sxStart; sx <= sxEnd; sx++) {
          if (sx < 0 || sx >= SCREEN_WIDTH) continue;
          if (transformY >= this.zBuffer.get(sx)) continue;
          const dxNorm = (sx - spriteScreenX) / shadowRX;
          if (dxNorm < -1 || dxNorm > 1) continue;
          const halfH = shadowRY * Math.sqrt(Math.max(0, 1 - dxNorm * dxNorm));
          const y0 = Math.floor(shadowCenterY - halfH);
          const y1 = Math.floor(shadowCenterY + halfH);
          const yClamped0 = Math.max(0, y0);
          const yClamped1 = Math.min(SCREEN_HEIGHT - 1, y1);
          if (yClamped1 >= yClamped0) {
            this.ctx.fillRect(sx, yClamped0, 1, yClamped1 - yClamped0 + 1);
          }
        }
      }

      // Volumen-Shading-Vorab: Mitte und Halbweite für die per-Spalten-Vignette
      const spriteCenterX = (drawStartX + drawEndX) / 2;
      const halfSpriteWidth = Math.max(1, (drawEndX - drawStartX) / 2);

      // Von rechts nach links zeichnen (Z-Buffer-Tiefentest)
      const stripeWidth = drawEndX - drawStartX;
      for (let stripe = Math.floor(drawStartX); stripe < drawEndX; stripe++) {
        // Nur zeichnen wenn Sprite näher als die Wand in dieser Spalte
        if (transformY < this.zBuffer.get(stripe)) {
          const texX = Math.floor(((stripe - drawStartX) * texture!.width) / stripeWidth);

          // Volumen-Shading: Spalten-Distanz vom Sprite-Zentrum (0 = Mitte, 1 = Rand)
          const edgeDist = Math.abs(stripe - spriteCenterX) / halfSpriteWidth;
          const volumeShade = 1.0 - 0.35 * edgeDist * edgeDist;
          const brightness = baseBrightness * volumeShade;

          for (let y = Math.floor(drawStartY); y < drawEndY; y++) {
            const texY = Math.floor(((y - drawStartY) * texture!.height) / (drawEndY - drawStartY));

            const srcIdx = (texY * texture!.width + texX) * 4;
            const srcData = texture!.data.data;

            // Alpha-Check: transparentes Sprite unterstützen
            const alpha = srcData[srcIdx + 3];
            if (alpha > 0) {
              let r = srcData[srcIdx] * brightness;
              let g = srcData[srcIdx + 1] * brightness;
              let b = srcData[srcIdx + 2] * brightness;

              // Hit-Flash: rot/weiß aufblitzen
              if (sprite.hitFlashTimer > 0) {
                r = Math.min(255, r + 180);
                g = Math.min(255, g + 120);
                b = Math.min(255, b + 80);
              }

              // Death-Animation: dunkler + rot + ausfaden
              if (sprite.isDying) {
                const fade = 1.0 - deathProgress * 0.6;
                r = r * fade + 80 * deathProgress; // rot-Tint
                g = g * fade * 0.4;
                b = b * fade * 0.3;
              }

              this.ctx.fillStyle = `rgba(${Math.min(255, Math.floor(r))},${Math.min(255, Math.floor(g))},${Math.min(255, Math.floor(b))},${alpha / 255})`;
              this.ctx.fillRect(stripe, y, 1, 1);
            }
          }
        }
      }
    }
  }

  /**
   * Pause-Overlay für Pointer-Lock-Verlust.
   */
  private createPauseOverlay(): void {
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.position = 'fixed';
    this.pauseOverlay.style.top = '0';
    this.pauseOverlay.style.left = '0';
    this.pauseOverlay.style.width = '100%';
    this.pauseOverlay.style.height = '100%';
    this.pauseOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.pauseOverlay.style.display = 'none';
    this.pauseOverlay.style.flexDirection = 'column';
    this.pauseOverlay.style.justifyContent = 'center';
    this.pauseOverlay.style.alignItems = 'center';
    this.pauseOverlay.style.zIndex = '1000';
    this.pauseOverlay.style.cursor = 'pointer';

    const title = document.createElement('h1');
    title.style.color = '#fff';
    title.style.fontFamily = 'monospace';
    title.style.fontSize = '32px';
    title.style.marginBottom = '16px';
    title.textContent = 'PAUSE';

    const subtitle = document.createElement('p');
    subtitle.style.color = '#aaa';
    subtitle.style.fontFamily = 'monospace';
    subtitle.style.fontSize = '16px';
    subtitle.textContent = 'Klicken zum Fortsetzen';

    this.pauseOverlay.appendChild(title);
    this.pauseOverlay.appendChild(subtitle);
    document.body.appendChild(this.pauseOverlay);

    // Overlay-Click → Pointer Lock wiederherstellen
    this.pauseOverlay.addEventListener('click', () => {
      this.input.requestPointerLock();
      this.pauseOverlay.style.display = 'none';
    });
  }

  /**
   * Canvas-Click → Pointer Lock anfordern.
   */
  private setupCanvasClick(): void {
    this.canvas.addEventListener('click', () => {
      if (!this.input.getPointerLocked()) {
        this.input.requestPointerLock();
        this.pauseOverlay.style.display = 'none';
      }
    });
  }

  /**
   * Spielerbewegung basierend auf Input + Delta-Time.
   */
  private updatePlayer(deltaTime: number): void {
    // Sprint-Status prüfen
    this.isSprinting = this.input.isSprinting();
    const currentSpeed = this.isSprinting
      ? MOVE_SPEED * SPRINT_MULTIPLIER
      : MOVE_SPEED;

    // Maus-Rotation (nur wenn Pointer Lock aktiv)
    if (this.input.getPointerLocked()) {
      const mouseDelta = this.input.getMouseDelta();
      if (mouseDelta.dx !== 0) {
        this.player.rotate(mouseDelta.dx);
      }
      this.input.resetMouseDelta();
    } else {
      // Fallback: Keyboard-Rotation wenn kein Pointer Lock
      if (this.input.isKey('ArrowLeft') || this.input.isKey('KeyQ')) {
        this.player.rotate(-0.03);
      }
      if (this.input.isKey('ArrowRight') || this.input.isKey('KeyE')) {
        this.player.rotate(0.03);
      }
    }

    // Build list of alive enemy obstacles for entity collision
    const enemyObstacles: Array<{ x: number, y: number, radius: number }> = [];
    for (const sprite of this.sprites) {
      if (sprite.type === SpriteType.ENEMY && sprite.isAlive && !sprite.isDying && !sprite.isDead) {
        enemyObstacles.push({ x: sprite.x, y: sprite.y, radius: ENEMY_RADIUS });
      }
    }

    // Vorwärts / Rückwärts (mit Delta-Time skaliert)
    if (this.input.isForward()) {
      this.player.move(currentSpeed * deltaTime, enemyObstacles);
      this.stepTimer += deltaTime;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.soundManager.play(SoundType.STEP);
      }
    }
    if (this.input.isBackward()) {
      this.player.move(-currentSpeed * deltaTime, enemyObstacles);
      this.stepTimer += deltaTime;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.soundManager.play(SoundType.STEP);
      }
    }

    // Strafe links / rechts
    if (this.input.isStrafeLeft()) {
      this.player.strafe(-currentSpeed * deltaTime, enemyObstacles);
      this.stepTimer += deltaTime;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.soundManager.play(SoundType.STEP);
      }
    }
    if (this.input.isStrafeRight()) {
      this.player.strafe(currentSpeed * deltaTime, enemyObstacles);
      this.stepTimer += deltaTime;
      if (this.stepTimer >= this.stepInterval) {
        this.stepTimer = 0;
        this.soundManager.play(SoundType.STEP);
      }
    }

    // Item-Pickup und Tür-Interaktion mit E-Taste (Edge-Triggered)
    const isInteractPressed = this.input.isKey('KeyE');
    if (isInteractPressed && !this.wasInteractPressedLastFrame) {
      // E-Taste wurde gerade neu gedrückt → Interaktion ausführen
      this.checkItemPickup();
      this.checkDoorInteraction();
    }
    this.wasInteractPressedLastFrame = isInteractPressed;
  }

  /**
   * Prüft ob der Spieler eine Tür vor sich aktiviert (E-Taste).
   * Raycast in Blickrichtung bis zum ersten soliden Tile.
   * Nur wenn das erste solide Tile eine Tür ist und nah genug → interagieren.
   */
  private checkDoorInteraction(): void {
    const rayDirX = this.player.dirX;
    const rayDirY = this.player.dirY;

    let mapX = Math.floor(this.player.x);
    let mapY = Math.floor(this.player.y);
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    let sideDistX: number, sideDistY: number;
    if (rayDirX < 0) {
      sideDistX = (this.player.x - mapX) * deltaDistX;
    } else {
      sideDistX = (mapX + 1.0 - this.player.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      sideDistY = (this.player.y - mapY) * deltaDistY;
    } else {
      sideDistY = (mapY + 1.0 - this.player.y) * deltaDistY;
    }

    let stepX: number, stepY: number;
    if (rayDirX < 0) stepX = -1; else stepX = 1;
    if (rayDirY < 0) stepY = -1; else stepY = 1;

    let hit = 0;
    let steps = 0;
    const maxSteps = 20;

    while (hit === 0 && steps < maxSteps) {
      steps++;
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
      }

      if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) break;

      // Stoppe am ersten soliden Tile
      if (worldState.isSolidTile(mapX, mapY)) {
        hit = worldState.getTile(mapX, mapY);

        // Prüfe Distanz zum Spieler (max. 1.5 Tiles)
        const dist = Math.sqrt(
          (mapX + 0.5 - this.player.x) ** 2 + (mapY + 0.5 - this.player.y) ** 2
        );
        if (dist <= 1.5 && worldState.isDoorTile(mapX, mapY)) {
          const result = worldState.interactAt(mapX, mapY, this.hasKeycard);
          this.showDoorMessage(result);
          return;
        }
        // Erstes solides Tile ist keine Tür → abbrechen
        break;
      }
    }
  }

  /**
   * Zeigt eine HUD-Nachricht für Tür-Interaktionen.
   */
  private showDoorMessage(result: InteractionResult): void {
    switch (result) {
      case InteractionResult.DOOR_OPENING:
        this.doorMessage = 'DOOR OPENING';
        this.doorMessageTimer = this.doorMessageDuration;
        this.soundManager.play(SoundType.DOOR);
        break;
      case InteractionResult.DOOR_LOCKED:
        this.doorMessage = 'LOCKED: KEYCARD REQUIRED';
        this.doorMessageTimer = this.doorMessageDuration;
        this.soundManager.play(SoundType.DOOR);
        break;
      case InteractionResult.SECRET_FOUND:
        this.doorMessage = 'SECRET FOUND!';
        this.doorMessageTimer = this.doorMessageDuration;
        this.player.score += 200;
        this.soundManager.play(SoundType.DOOR);
        break;
    }
  }

  /**
   * Raycasting-Kernel: Castet eine Ray pro Bildschirmspalte.
   * Verwendet den DDA-Algorithmus für effizientes Grid-Tracing.
   * Berücksichtigt Türanimationen visuell.
   */
  private castRays(): void {
    this.zBuffer.clear();

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // Kamera-X-Position (-1 links, 0 mitte, 1 rechts)
      const cameraX = 2 * (x / SCREEN_WIDTH) - 1;

      // Richtung der Ray
      const rayDirX = this.player.dirX + this.player.planeX * cameraX;
      const rayDirY = this.player.dirY + this.player.planeY * cameraX;

      // Aktuelles Grid-Zelle
      let mapX = Math.floor(this.player.x);
      let mapY = Math.floor(this.player.y);

      // Länge der Ray von einem Side-Schritt zum nächsten
      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let sideDistX: number;
      let sideDistY: number;
      let stepX: number;
      let stepY: number;
      let side = 0; // 0 = NS, 1 = EW

      // Berechnung der Schritte und initialen sideDist
      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (this.player.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - this.player.x) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (this.player.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - this.player.y) * deltaDistY;
      }

      // DDA-Suche bis Wand gefunden
      let hit = 0;
      let doorProgress = 0; // Türfortschritt für Animation
      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        // Grenzwert-Check (nutzt dynamischen WorldState für Türen)
        if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
          hit = 1; // Außerhalb der Karte = Wand
        } else if (worldState.isSolidTile(mapX, mapY)) {
          hit = worldState.getTile(mapX, mapY);
          // Türfortschritt speichern für visuelle Animation
          const door = worldState.getDoor(mapX, mapY);
          if (door && door.state === 'opening') {
            doorProgress = door.progress;
          }
        }
      }

      // Perpendiculare Distanz berechnen (vermeidet Fisheye)
      let perpWallDist: number;
      if (side === 0) {
        perpWallDist = (sideDistX - deltaDistX);
      } else {
        perpWallDist = (sideDistY - deltaDistY);
      }

      // Z-Buffer speichern
      this.zBuffer.set(x, perpWallDist);

      // Wandhöhe berechnen
      const lineHeight = Math.floor(SCREEN_HEIGHT / perpWallDist);

      // Start/Ende der Wand-Zeichnung
      let drawStart = Math.floor(-lineHeight / 2 + SCREEN_HEIGHT / 2);
      if (drawStart < 0) drawStart = 0;
      let drawEnd = Math.floor(lineHeight / 2 + SCREEN_HEIGHT / 2);
      if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;

      // --- Textur-Coordinate berechnen ---
      // Wo hat die Ray die Wand getroffen? (0.0 - 1.0 innerhalb des Tiles)
      let wallX: number;
      if (side === 0) {
        wallX = this.player.y + perpWallDist * rayDirY;
      } else {
        wallX = this.player.x + perpWallDist * rayDirX;
      }
      wallX -= Math.floor(wallX); // Auf 0.0-1.0 normieren

      // U-Coordinate (0 = links der Textur, 1 = rechts).
      // Flip-Konvention so gewählt, dass die natürliche Textur-Orientierung
      // (Texte/Asymmetrien wie das "EXIT"-Schild) korrekt herum dargestellt wird.
      let u = wallX;
      if ((side === 0 && rayDirX < 0) || (side === 1 && rayDirY > 0)) {
        u = 1.0 - u;
      }

      // Textur holen
      const texture = this.textureManager.getTexture(hit);

      // Helligkeit berechnen (Distanz-Nebel + Seitenschattierung + Türanimation)
      const sideShade = side === 1 ? 0.7 : 1.0;
      let brightness = Math.min(1.0, 2.0 / (1.0 + perpWallDist * 0.3)) * sideShade;

      // Türanimation: während "opening" wird Tür von unten nach oben geöffnet
      // - Obere Hälfte bleibt sichtbar (Tür "sackt" nach unten)
      // - Helligkeit nimmt mit progress zu (Tür wird heller/transparenter)
      if (doorProgress > 0 && doorProgress < 1) {
        const doorShade = 1.0 - doorProgress * 0.6; // bis zu 60% heller
        brightness *= doorShade;
      }

      // Textur-Spalte zeichnen
      if (texture) {
        this.drawTexturedColumn(x, drawStart, drawEnd, lineHeight, texture, u, brightness, doorProgress);
      } else {
        // Fallback: Einfarbige Wand (sollte nicht passieren)
        const baseColor = hit === 1 ? [180, 50, 50] : (hit === 2 ? [50, 180, 50] : [200, 50, 50]);
        let r = Math.floor(baseColor[0] * brightness);
        let g = Math.floor(baseColor[1] * brightness);
        let b = Math.floor(baseColor[2] * brightness);
        // Tür-Animation im Fallback
        if (doorProgress > 0 && doorProgress < 1) {
          const doorShade = 1.0 - doorProgress * 0.6;
          r = Math.floor(r * doorShade);
          g = Math.floor(g * doorShade);
          b = Math.floor(b * doorShade);
        }
        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
      }
    }
  }

  /**
   * Zeichnet eine einzelne Textur-Spalte auf den Canvas.
   * 
   * @param screenX Bildschirmspalte
   * @param drawStart Oberer Rand der Wand
   * @param drawEnd Unterer Rand der Wand
   * @param wallLineHeight Urspruengliche projizierte Wandhoehe vor Screen-Clipping
   * @param texture Die Textur
   * @param u Texture-Koordinate (0.0 - 1.0)
   * @param brightness Helligkeitsfaktor
   * @param doorProgress Türöffnungs-Fortschritt 0..1 (für sichtbare Animation)
   */
  private drawTexturedColumn(
    screenX: number,
    drawStart: number,
    drawEnd: number,
    wallLineHeight: number,
    texture: Texture,
    u: number,
    brightness: number,
    doorProgress: number = 0
  ): void {
    const texWidth = texture.width;
    const texHeight = texture.height;
    const texData = texture.data.data;

    // Textur-X-Position (Pixel-Index)
    const texX = Math.floor(u * texWidth) & (texWidth - 1); // Bitmask für Power-of-2

    const visibleHeight = drawEnd - drawStart;
    if (visibleHeight <= 0) return;

    // ImageData für diese Spalte erstellen
    const columnData = new ImageData(1, visibleHeight);
    const colPixels = columnData.data;
    const texStep = texHeight / wallLineHeight;
    let texPos = (drawStart - SCREEN_HEIGHT / 2 + wallLineHeight / 2) * texStep;

    // Türanimation: Berechne den sichtbaren Bereich
    // Bei progress > 0 wird die Tür von unten nach oben "geöffnet"
    // - Obere Bereiche bleiben sichtbar
    // - Untere Bereiche werden freigegeben (Boden sichtbar)
    let doorClipY = 0; // Ab welchem y-Wert (relativ zu drawStart) die Tür noch sichtbar ist
    if (doorProgress > 0 && doorProgress < 1) {
      // Tür wird von unten nach oben geöffnet
      // Bei progress=0.5 ist die untere Hälfte weg, bei progress=1 alles weg
      doorClipY = Math.floor(visibleHeight * (1.0 - doorProgress));
    }

    for (let y = 0; y < visibleHeight; y++) {
      // Vertikale Textur-Koordinate
      const texY = Math.floor(texPos) & (texHeight - 1);
      texPos += texStep;

      // Destination-Index in der Spalte
      const dstIdx = y * 4;

      // Tür-Clip: Wenn y >= doorClipY, dann ist dieser Bereich bereits "geöffnet"
      if (doorProgress > 0 && doorProgress < 1 && y >= doorClipY) {
        // Scanline-Illusion: abwechselnd verdunkelte/hellere Streifen
        // simulieren das Sichtbarwerden des Bodens ohne Transparenz
        const isScanline = (y % 4) < 2;
        const scanlineDarken = isScanline ? 0.35 : 0.65;
        // Source-Pixel aus Textur lesen
        const srcIdx = (texY * texWidth + texX) * 4;
        colPixels[dstIdx]     = texData[srcIdx] * brightness * scanlineDarken;
        colPixels[dstIdx + 1] = texData[srcIdx + 1] * brightness * scanlineDarken;
        colPixels[dstIdx + 2] = texData[srcIdx + 2] * brightness * scanlineDarken;
        colPixels[dstIdx + 3] = 255; // Immer undurchsichtig
        continue;
      }

      // Source-Pixel aus Textur lesen
      const srcIdx = (texY * texWidth + texX) * 4;

      // Farbe mit Helligkeit multiplizieren
      colPixels[dstIdx] = texData[srcIdx] * brightness;
      colPixels[dstIdx + 1] = texData[srcIdx + 1] * brightness;
      colPixels[dstIdx + 2] = texData[srcIdx + 2] * brightness;
      colPixels[dstIdx + 3] = 255; // Vollständig undurchsichtig
    }

    // Spalte auf Canvas zeichnen
    this.ctx.putImageData(columnData, screenX, drawStart);
  }

  /**
   * Decke und Boden rendern.
   */
  private drawFloorAndCeiling(): void {
    const floorTexture = this.textureManager.getFloorTexture();
    const ceilingTexture = this.textureManager.getCeilingTexture();

    if (!floorTexture || !ceilingTexture) {
      // Fallback falls der TextureManager noch nicht bereit ist.
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
      this.ctx.fillStyle = '#555';
      this.ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
      return;
    }

    const frame = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    const pixels = frame.data;

    // Basisfarben decken auch die Horizontlinie ab, bei der Floor-Casting unendlich weit waere.
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      const isCeiling = y < SCREEN_HEIGHT / 2;
      const r = isCeiling ? 42 : 58;
      const g = isCeiling ? 28 : 58;
      const b = isCeiling ? 18 : 58;
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const idx = (y * SCREEN_WIDTH + x) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      }
    }

    const dirX = this.player.dirX;
    const dirY = this.player.dirY;
    const planeX = this.player.planeX;
    const planeY = this.player.planeY;

    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;

    const floorData = floorTexture.data.data;
    const ceilingData = ceilingTexture.data.data;
    const floorMaskX = floorTexture.width - 1;
    const floorMaskY = floorTexture.height - 1;
    const ceilingMaskX = ceilingTexture.width - 1;
    const ceilingMaskY = ceilingTexture.height - 1;
    const halfHeight = SCREEN_HEIGHT / 2;
    const posZ = 0.5 * SCREEN_HEIGHT;

    for (let y = Math.floor(halfHeight) + 1; y < SCREEN_HEIGHT; y++) {
      const p = y - halfHeight;
      const rowDistance = posZ / p;
      const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / SCREEN_WIDTH;
      const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / SCREEN_WIDTH;

      let floorX = this.player.x + rowDistance * rayDirX0;
      let floorY = this.player.y + rowDistance * rayDirY0;

      const floorBrightness = Math.min(1.0, 2.2 / (1.0 + rowDistance * 0.14));
      const ceilingBrightness = Math.min(0.78, 1.8 / (1.0 + rowDistance * 0.18));
      const ceilingY = SCREEN_HEIGHT - y - 1;

      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const cellX = Math.floor(floorX);
        const cellY = Math.floor(floorY);

        const floorTexX = Math.floor(floorTexture.width * (floorX - cellX)) & floorMaskX;
        const floorTexY = Math.floor(floorTexture.height * (floorY - cellY)) & floorMaskY;
        const floorSrc = (floorTexY * floorTexture.width + floorTexX) * 4;
        const floorDst = (y * SCREEN_WIDTH + x) * 4;

        pixels[floorDst] = floorData[floorSrc] * floorBrightness;
        pixels[floorDst + 1] = floorData[floorSrc + 1] * floorBrightness;
        pixels[floorDst + 2] = floorData[floorSrc + 2] * floorBrightness;
        pixels[floorDst + 3] = 255;

        const ceilingTexX = Math.floor(ceilingTexture.width * (floorX - cellX)) & ceilingMaskX;
        const ceilingTexY = Math.floor(ceilingTexture.height * (floorY - cellY)) & ceilingMaskY;
        const ceilingSrc = (ceilingTexY * ceilingTexture.width + ceilingTexX) * 4;
        const ceilingDst = (ceilingY * SCREEN_WIDTH + x) * 4;

        pixels[ceilingDst] = ceilingData[ceilingSrc] * ceilingBrightness;
        pixels[ceilingDst + 1] = ceilingData[ceilingSrc + 1] * ceilingBrightness;
        pixels[ceilingDst + 2] = ceilingData[ceilingSrc + 2] * ceilingBrightness;
        pixels[ceilingDst + 3] = 255;

        floorX += floorStepX;
        floorY += floorStepY;
      }
    }

    this.ctx.putImageData(frame, 0, 0);
  }

  /**
   * Rendert die Waffe am unteren Bildschirmrand mit Bobbing-Animation.
   * Retro-FPS-Pistole: dunkler Slide, sichtbarer Lauf, braune Griffschalen,
   * Highlights/Schatten, Pixel-Art-Optik.
   */
  private drawWeapon(): void {
    const bobY = this.weapon.getBobOffset();
    const bobX = this.weapon.getBobXOffset();
    const recoilY = this.weapon.getRecoilY();
    const recoilX = this.weapon.getRecoilX();

    // Basis-Position: unten mittig
    const cx = SCREEN_WIDTH / 2 + bobX + recoilX;
    const baseY = SCREEN_HEIGHT + bobY + recoilY;

    const ctx = this.ctx;

    // ── Griff (Handle) ──
    // Linke Griffschale (braun)
    ctx.fillStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.moveTo(cx - 28, baseY - 100);
    ctx.lineTo(cx - 10, baseY - 100);
    ctx.lineTo(cx - 6, baseY - 10);
    ctx.lineTo(cx - 32, baseY - 10);
    ctx.closePath();
    ctx.fill();

    // Rechte Griffschale
    ctx.fillStyle = '#6b4422';
    ctx.beginPath();
    ctx.moveTo(cx + 10, baseY - 100);
    ctx.lineTo(cx + 28, baseY - 100);
    ctx.lineTo(cx + 32, baseY - 10);
    ctx.lineTo(cx + 6, baseY - 10);
    ctx.closePath();
    ctx.fill();

    // Griff-Griffel-Textur (beide Seiten)
    ctx.fillStyle = '#4a2a10';
    for (let i = 0; i < 7; i++) {
      const ly = baseY - 92 + i * 11;
      ctx.fillRect(cx - 26, ly, 16, 2);
      ctx.fillRect(cx + 10, ly, 16, 2);
    }

    // Griff-Highlight (linke Kante)
    ctx.fillStyle = 'rgba(255,220,180,0.12)';
    ctx.fillRect(cx - 27, baseY - 95, 2, 75);

    // Griff-Schatten (rechte Kante)
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx + 27, baseY - 95, 2, 75);

    // ── Frame / Unterseite des Slides (dunkles Metall) ──
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 34, baseY - 130, 68, 34);

    // Frame-Highlight (oben)
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx - 33, baseY - 129, 66, 2);

    // Frame-Schatten (unten)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - 33, baseY - 99, 66, 2);

    // ── Trigger-Vertiefung ──
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 5, baseY - 100, 10, 14);
    // Trigger (hell)
    ctx.fillStyle = '#888';
    ctx.fillRect(cx - 2, baseY - 96, 4, 8);

    // ── Slide (oben, dunkles Metall) ──
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(cx - 36, baseY - 155, 72, 28);

    // Slide-Highlight (oben links)
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - 35, baseY - 154, 30, 2);

    // Slide-Schatten (unten)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx - 35, baseY - 129, 70, 2);

    // Slide-Griffel (feine Linien)
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx - 28 + i * 10, baseY - 148, 6, 2);
    }

    // ── Lauf (Barrel) ──
    // Hauptläufer
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 14, baseY - 185, 28, 32);

    // Lauf-Innen (dunkel)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 8, baseY - 183, 16, 28);

    // Lauf-Highlight (links)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx - 13, baseY - 184, 3, 28);

    // Lauf-Schatten (rechts)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx + 10, baseY - 184, 3, 28);

    // Lauf-Mündung (Muzzle Ring)
    ctx.fillStyle = '#666';
    ctx.fillRect(cx - 16, baseY - 186, 32, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(cx - 10, baseY - 186, 20, 3);

    // ── Front Sight (Vorderer Visierpunkt) ──
    ctx.fillStyle = '#777';
    ctx.fillRect(cx - 2, baseY - 189, 4, 5);

    // ── Rear Sight (Hinterer Visierpunkt) ──
    ctx.fillStyle = '#666';
    ctx.fillRect(cx - 4, baseY - 158, 3, 4);
    ctx.fillRect(cx + 1, baseY - 158, 3, 4);

    // ── Safety / Deko-Details am Frame ──
    ctx.fillStyle = '#777';
    ctx.fillRect(cx - 36, baseY - 120, 4, 6);

    // ── Muzzle Flash ──
    if (this.weapon.state === WeaponState.FIRING && this.muzzleFlashTexture) {
      const flashSize = 120 * this.weapon.flashScale;
      const flashX = cx - 4 - flashSize / 2 + this.weapon.flashOffsetX;
      const flashY = baseY - 210 + this.weapon.flashOffsetY;

      const texData = this.muzzleFlashTexture.data.data;
      for (let ty = 0; ty < this.muzzleFlashTexture.height; ty++) {
        for (let tx = 0; tx < this.muzzleFlashTexture.width; tx++) {
          const srcIdx = (ty * this.muzzleFlashTexture.width + tx) * 4;
          const alpha = texData[srcIdx + 3];
          if (alpha > 0) {
            const screenX = Math.floor(flashX + (tx / this.muzzleFlashTexture.width) * flashSize);
            const screenY = Math.floor(flashY + (ty / this.muzzleFlashTexture.height) * flashSize);
            if (screenX >= 0 && screenX < SCREEN_WIDTH && screenY >= 0 && screenY < SCREEN_HEIGHT) {
              const r = Math.min(255, texData[srcIdx] * 1.3);
              const g = Math.min(255, texData[srcIdx + 1] * 1.3);
              const b = Math.min(255, texData[srcIdx + 2] * 1.1);
              ctx.fillStyle = `rgba(${r},${g},${b},${alpha / 255})`;
              const pxSize = Math.ceil(flashSize / this.muzzleFlashTexture.width);
              ctx.fillRect(screenX, screenY, pxSize, pxSize);
            }
          }
        }
      }

      // Extra: kleiner weißer Kern-Flash für mehr Punch
      const coreSize = 30 * this.weapon.flashScale;
      const coreGrad = ctx.createRadialGradient(
        cx + this.weapon.flashOffsetX,
        baseY - 200 + this.weapon.flashOffsetY,
        0,
        cx + this.weapon.flashOffsetX,
        baseY - 200 + this.weapon.flashOffsetY,
        coreSize / 2
      );
      coreGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
      coreGrad.addColorStop(0.5, 'rgba(255,240,150,0.5)');
      coreGrad.addColorStop(1, 'rgba(255,150,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(
        cx + this.weapon.flashOffsetX,
        baseY - 200 + this.weapon.flashOffsetY,
        coreSize / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  /**
   * Zeichnet das HUD: Health-Bar, Ammo, Score, Sprint-Indikator.
   */
  private drawHUD(): void {
    const ctx = this.ctx;
    const w = SCREEN_WIDTH;
    const h = SCREEN_HEIGHT;

    // --- Health Bar (unten links) ---
    const healthBarX = 20;
    const healthBarY = h - 50;
    const healthBarW = 200;
    const healthBarH = 20;

    // Hintergrund
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(healthBarX - 2, healthBarY - 2, healthBarW + 4, healthBarH + 4);

    // Leere Bar
    ctx.fillStyle = '#400';
    ctx.fillRect(healthBarX, healthBarY, healthBarW, healthBarH);

    // Füllstand
    const healthPct = this.weapon.health / this.weapon.maxHealth;
    const healthColor = healthPct > 0.5 ? '#0c0' : (healthPct > 0.25 ? '#cc0' : '#c00');
    ctx.fillStyle = healthColor;
    ctx.fillRect(healthBarX, healthBarY, healthBarW * healthPct, healthBarH);

    // Health-Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${this.weapon.health}`, healthBarX + 5, healthBarY + 15);

    // --- Ammo (unten rechts) ---
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`AMMO: ${this.weapon.ammo}`, w - 20, h - 30);

    // --- Score (oben rechts) ---
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE: ${this.player.score}`, w - 20, 25);

    // --- Kills (oben rechts, unter Score) ---
    ctx.font = '14px monospace';
    ctx.fillStyle = '#f88';
    ctx.fillText(`KILLS: ${this.weapon.killCount}`, w - 20, 45);

    // --- Sprint-Indikator ---
    if (this.isSprinting) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#ff0';
      ctx.fillText('⚡ SPRINT', w / 2, h - 60);
    }

    // --- Item-Pickup-Hinweis (nur für collectable Items) ---
    const pickupRadius = 0.5;
    for (const sprite of this.sprites) {
      if (!sprite.isCollectable) continue;
      const dx = sprite.x - this.player.x;
      const dy = sprite.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < pickupRadius) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px monospace';
        if (sprite.type === SpriteType.KEYCARD) {
          ctx.fillStyle = '#5af';
          ctx.fillText('[E] KEYCARD einsammeln', w / 2, 60);
        } else {
          ctx.fillStyle = sprite.type === SpriteType.AMMO ? '#ff0' : '#0f0';
          const itemName = sprite.type === SpriteType.AMMO ? 'AMMO' : 'HEALTH';
          ctx.fillText(`[E] ${itemName} einsammeln`, w / 2, 60);
        }
        break;
      }
    }

    // --- Keycard Pickup Message (kurz anzeigen) ---
    if (this.keycardPickupMessage > 0) {
      const alpha = Math.min(1, this.keycardPickupMessage / 0.5);
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = `rgba(90, 184, 255, ${alpha})`;
      ctx.shadowColor = '#5af';
      ctx.shadowBlur = 10;
      ctx.fillText('KEYCARD GEFUNDEN!', w / 2, h / 2 - 40);
      ctx.shadowBlur = 0;
    }

    // --- Keycard Indicator (oben links) ---
    if (this.hasKeycard) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#5af';
      ctx.fillText('CARD', 20, 25);
    }

    // --- Door Message (Mitte oben) ---
    if (this.doorMessageTimer > 0) {
      const alpha = Math.min(1, this.doorMessageTimer / 0.5);
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      let msgColor = '#ff0';
      if (this.doorMessage.includes('LOCKED')) msgColor = '#f44';
      else if (this.doorMessage.includes('SECRET')) msgColor = '#0f0';
      else if (this.doorMessage.includes('OPENING')) msgColor = '#5af';
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = msgColor;
      ctx.shadowBlur = 8;
      ctx.fillText(this.doorMessage, w / 2, 80);
      ctx.shadowBlur = 0;
    }

    // --- Exit Door proximity check (Position aus Level) ---
    const exitDoorPos = this.currentLevel.exit;
    const exitDx = exitDoorPos.x - this.player.x;
    const exitDy = exitDoorPos.y - this.player.y;
    const exitDist = Math.sqrt(exitDx * exitDx + exitDy * exitDy);
    if (exitDist < 1.5) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      if (this.hasKeycard) {
        ctx.fillStyle = '#0f0';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 8;
        ctx.fillText(`EXIT — [E] zu Stage ${this.stage + 1}`, w / 2, h - 90);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#f44';
        ctx.fillText('KEYCARD REQUIRED', w / 2, h - 90);
      }
    }

    // --- Stage-Anzeige (oben Mitte, klein) ---
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`STAGE ${this.stage}`, w / 2, 22);

    // --- Stage-Übergangs-Banner ---
    if (this.stageBannerTimer > 0) {
      const alpha = Math.min(1, this.stageBannerTimer / 0.7);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
      ctx.shadowColor = '#fc0';
      ctx.shadowBlur = 14;
      ctx.fillText(`STAGE ${this.stage}`, w / 2, h / 2 - 60);
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
  }

  /**
   * Zeichnet den Damage-Flash (rote Bildschirmränder).
   */
  private drawDamageFlash(): void {
    if (this.damageFlashTimer <= 0) return;

    const intensity = this.damageFlashTimer / this.damageFlashDuration;
    const alpha = intensity * 0.5;
    const border = 40;

    this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;

    // Oben
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, border);
    // Unten
    this.ctx.fillRect(0, SCREEN_HEIGHT - border, SCREEN_WIDTH, border);
    // Links
    this.ctx.fillRect(0, 0, border, SCREEN_HEIGHT);
    // Rechts
    this.ctx.fillRect(SCREEN_WIDTH - border, 0, border, SCREEN_HEIGHT);
  }

  /**
   * Zeichnet den Hitmarker (kurzes Kreuz in Bildschirmmitte).
   */
  private drawHitMarker(): void {
    if (this.hitMarkerTimer <= 0) return;

    const intensity = this.hitMarkerTimer / this.hitMarkerDuration;
    const alpha = intensity;
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const size = 8;

    this.ctx.strokeStyle = `rgba(255, 255, 200, ${alpha})`;
    this.ctx.lineWidth = 2;

    // Kleines X-Kreuz
    this.ctx.beginPath();
    this.ctx.moveTo(cx - size, cy - size);
    this.ctx.lineTo(cx + size, cy + size);
    this.ctx.moveTo(cx + size, cy - size);
    this.ctx.lineTo(cx - size, cy + size);
    this.ctx.stroke();
  }

  /**
   * Zeichnet einen kurzen Impact-Funken am Wand-Trefferpunkt.
   */
  private drawWallImpact(): void {
    if (this.wallImpactTimer <= 0) return;

    const intensity = this.wallImpactTimer / this.wallImpactDuration;
    const alpha = intensity;
    const sparkSize = 6 * intensity;

    // Gelb/orange Funken
    this.ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(this.wallImpactX, this.wallImpactY, sparkSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Helle Mitte
    this.ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
    this.ctx.beginPath();
    this.ctx.arc(this.wallImpactX, this.wallImpactY, sparkSize * 0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Reset des Spiels nach Tod: neuer Basis-Seed + frisches Stage 1.
   * Jeder Run hat dadurch eine andere Level-Sequenz.
   */
  private resetGame(): void {
    this.baseSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    this.stage = 1;
    const level = generateLevel(this.baseSeed, this.stage);
    worldState.loadLevel(level);
    this.currentLevel = level;

    // Spieler an Spawn des neuen Stage 1
    this.player.setPosition(level.spawn.x, level.spawn.y);
    this.player.dirX = level.spawn.dirX;
    this.player.dirY = level.spawn.dirY;
    this.player.planeX = -level.spawn.dirY * 0.66;
    this.player.planeY = level.spawn.dirX * 0.66;
    this.player.score = 0;

    this.weapon.reset();
    this.damageFlashTimer = 0;
    this.hasKeycard = false;
    this.keycardPickupMessage = 0;

    this.sprites = [];
    this.initializeSprites();

    this.doorMessage = '';
    this.doorMessageTimer = 0;
    this.stageBannerTimer = 0;
  }

  /**
   * Update der Gegner-KI: Chase-Verhalten + Angriff.
   * - Gegner kollidieren nicht mit Spieler (stoppen bei MIN_ENTITY_DIST).
   * - Gegner kollidieren nicht mit anderen Gegnern.
   * - Nach allen Moves: Penetrations-Auflösung (Spieler 70%, Gegner 30%).
   */
  private updateEnemyAI(deltaTime: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const chaseRange = 8.0;
    const attackRange = MIN_ENTITY_DIST;  // ~0.55 — direkt vor dem Spieler
    const chaseSpeed = 1.5;
    const attackDamage = 15;
    const attackCooldown = 1.0;

    // Collect all alive enemies for pairwise collision
    const aliveEnemies = this.sprites.filter(
      s => s.type === SpriteType.ENEMY && s.isAlive && !s.isDying && !s.isDead
    );

    for (const sprite of aliveEnemies) {
      const dx = px - sprite.x;
      const dy = py - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > chaseRange) continue;

      // Bei Sicht zum Spieler die Blickrichtung mitführen (außer beim Sterben).
      sprite.facingAngle = Math.atan2(dy, dx);

      if (dist < attackRange) {
        // Angriff wenn nah genug
        if (!sprite.attackTimer) sprite.attackTimer = 0;
        sprite.attackTimer += deltaTime;

        if (sprite.attackTimer >= attackCooldown) {
          sprite.attackTimer = 0;
          this.weapon.takeDamage(attackDamage);
          this.triggerDamageFlash();
        }
      } else {
        // Chase: berechne Zielposition
        const moveX = (dx / dist) * chaseSpeed * deltaTime;
        const moveY = (dy / dist) * chaseSpeed * deltaTime;

        // Wall collision (Sliding) — use ENEMY_RADIUS
        let newX = slideAlongX(sprite.x, moveX, sprite.y, ENEMY_RADIUS);
        let newY = slideAlongY(sprite.y, moveY, newX, ENEMY_RADIUS);

        // Check: would new position overlap with player?
        if (wouldOverlapEntity(newX, newY, ENEMY_RADIUS,
          [{ x: px, y: py, radius: PLAYER_RADIUS }])) {
          // Clamp: stop at MIN_ENTITY_DIST from player
          const push = resolveEntityCollision(newX, newY, ENEMY_RADIUS, px, py, PLAYER_RADIUS);
          newX += push.dx;
          newY += push.dy;
        }

        // Check: would new position overlap with other enemies?
        for (const other of aliveEnemies) {
          if (other === sprite) continue;
          if (wouldOverlapEntity(newX, newY, ENEMY_RADIUS,
            [{ x: other.x, y: other.y, radius: ENEMY_RADIUS }])) {
            const push = resolveEntityCollision(newX, newY, ENEMY_RADIUS,
              other.x, other.y, ENEMY_RADIUS);
            newX += push.dx;
            newY += push.dy;
          }
        }

        sprite.x = newX;
        sprite.y = newY;
      }
    }

    // --- Penetration resolution pass ---
    // Resolve any remaining overlaps between player and all enemies.
    // Player gets pushed 70%, enemy gets pushed 30% (player keeps control).
    const entities: Array<{ x: number, y: number, radius: number, weight: number }> = [
      { x: px, y: py, radius: PLAYER_RADIUS, weight: 0.7 },
      ...aliveEnemies.map(s => ({ x: s.x, y: s.y, radius: ENEMY_RADIUS, weight: 0.3 }))
    ];
    resolveAllEntityOverlaps(entities);

    // Write back resolved positions
    this.player.x = entities[0].x;
    this.player.y = entities[0].y;
    for (let i = 0; i < aliveEnemies.length; i++) {
      aliveEnemies[i].x = entities[i + 1].x;
      aliveEnemies[i].y = entities[i + 1].y;
    }
  }

  /**
   * Main Render Loop mit Delta-Time.
   */
  public start(): void {
    this.lastTime = performance.now();

    // Vorheriger Game State tracken (für Respawn-Erkennung)
    let previousState: GameState = this.gameStateManager.getState();

    const loop = (currentTime: number) => {
      // Delta-Time berechnen (in Sekunden)
      const deltaTime = (currentTime - this.lastTime) / 1000.0;
      this.lastTime = currentTime;

      // Game State prüfen
      const gameState = this.gameStateManager.getState();

      // Musik-Steuerung: Starten wenn PLAYING, stoppen wenn nicht
      if (gameState === GameState.PLAYING) {
        this.soundManager.startMusic();
      } else {
        this.soundManager.stopMusic();
      }

      // Respawn: Wenn von DEAD/WIN zurück nach MENU → Spiel zurücksetzen
      if ((previousState === GameState.DEAD || previousState === GameState.WIN) &&
          gameState === GameState.MENU) {
        this.resetGame();
      }
      previousState = gameState;

      // Update-Logik (nur wenn PLAYING)
      if (gameState === GameState.PLAYING) {
        this.updatePlayer(deltaTime);

        // Weapon-Animation updaten
        const isMoving = this.input.isForward() || this.input.isBackward() ||
                         this.input.isStrafeLeft() || this.input.isStrafeRight();
        this.weapon.update(deltaTime, isMoving);

        // Sprite-Animationen updaten + Hit/Death-Timer
        for (const sprite of this.sprites) {
          sprite.update(deltaTime);

          // Hit-Flash-Timer herunterzählen
          if (sprite.hitFlashTimer > 0) {
            sprite.hitFlashTimer -= deltaTime;
          }

          // Death-Animation: Timer herunterzählen und in Corpse-Status übergehen.
          // Mit prozeduralen Stages gibt es kein Auto-WIN bei "alle Gegner tot" mehr —
          // Fortschritt läuft ausschliesslich über die Exit-Tür.
          if (sprite.isDying) {
            sprite.deathTimer -= deltaTime;
            if (sprite.deathTimer <= 0) {
              sprite.isDying = false;
              sprite.isDead = true;
            }
          }
        }

        // Gegner-KI updaten (Chase + Angriff)
        this.updateEnemyAI(deltaTime);

        // Damage-Flash-Timer herunterzählen
        if (this.damageFlashTimer > 0) {
          this.damageFlashTimer -= deltaTime;
        }

        // Screen Shake Timer herunterzählen
        if (this.screenShakeTimer > 0) {
          this.screenShakeTimer -= deltaTime;
        }

        // Hit Marker Timer herunterzählen
        if (this.hitMarkerTimer > 0) {
          this.hitMarkerTimer -= deltaTime;
        }

        // Wall Impact Timer herunterzählen
        if (this.wallImpactTimer > 0) {
          this.wallImpactTimer -= deltaTime;
        }

        // Keycard Pickup Message Timer herunterzählen
        if (this.keycardPickupMessage > 0) {
          this.keycardPickupMessage -= deltaTime;
        }

        // Item-Pickup prüfen
        this.checkItemPickup();

        // Tür-Animationen updaten
        worldState.updateWorld(deltaTime);

        // Door Message Timer herunterzählen
        if (this.doorMessageTimer > 0) {
          this.doorMessageTimer -= deltaTime;
        }

        // Stage-Banner-Timer
        if (this.stageBannerTimer > 0) {
          this.stageBannerTimer -= deltaTime;
        }

        // Exit-Door: Spieler mit Keycard an der Exit-Tür → nächste Stage.
        // Edge-getriggert über `wasInteractPressedLastFrame` (oben in updatePlayer
        // aktualisiert), damit die Stage nicht mehrfach pro Tastendruck wechselt.
        if (this.hasKeycard && this.input.isKey('KeyE') && !this.wasExitEPressed) {
          const exitDx = this.currentLevel.exit.x - this.player.x;
          const exitDy = this.currentLevel.exit.y - this.player.y;
          const exitDistSq = exitDx * exitDx + exitDy * exitDy;
          if (exitDistSq < 1.5 * 1.5) {
            this.player.score += 500;
            this.advanceStage();
          }
        }
        this.wasExitEPressed = this.input.isKey('KeyE');

        // Pointer-Lock-Verlust → Pause-Overlay zeigen
        if (this.pointerLockAvailable && !this.input.getPointerLocked()) {
          this.pauseOverlay.style.display = 'flex';
        }

        // Prüfen ob Spieler tot ist
        if (this.weapon.isDead()) {
          this.gameStateManager.transitionTo(GameState.DEAD);
        }
      } else if (gameState === GameState.PAUSED) {
        // Pause-Overlay zeigen
        if (this.pointerLockAvailable) {
          this.pauseOverlay.style.display = 'flex';
        }
      }

      // Clear
      this.ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Screen Shake: Canvas transform anwenden
      this.ctx.save();
      if (this.screenShakeTimer > 0) {
        const shakeIntensity = this.screenShakeIntensity * (this.screenShakeTimer / 0.12);
        const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
        this.ctx.translate(shakeX, shakeY);
      }

      // Render (immer, auch im Menu)
      this.drawFloorAndCeiling();
      this.castRays();
      this.renderSprites();

      // Weapon nur im Spiel rendern
      if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
        this.drawWeapon();
        this.drawHUD();
        this.drawDamageFlash();
        this.drawHitMarker();
        this.drawWallImpact();

        // Phase 8: Minimap rendern (Debug-Modus: vergrößert + Kollisions-Overlay)
        this.minimap.render(this.player, this.sprites);
        const mmSize = this.minimap.getSize();
        this.ctx.drawImage(
          this.minimap.getCanvas(),
          0, 0, mmSize, mmSize,
          this.minimap.getX(), this.minimap.getY(), mmSize, mmSize
        );
      }

      // Screen Shake: Transform zurücksetzen
      this.ctx.restore();

      // Game State Screens (Menu, Dead, Win, Paused)
      this.gameStateManager.render(this.ctx, SCREEN_WIDTH, SCREEN_HEIGHT, this.weapon.health);

      // Nächster Frame
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
