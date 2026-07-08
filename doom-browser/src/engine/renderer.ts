import { Player } from '../player/player';
import { MAP_WIDTH, MAP_HEIGHT, worldState, TILE, InteractionResult } from './world';
import { ZBuffer } from './zbuffer';
import { InputHandler, pointerLockSupported } from '../player/input';
import { TextureManager, Texture } from './textures';
import { Sprite, SpriteType, LatcherState } from './sprite';
import { updateEnemyAI, broadcastGunshot, type AIContext } from './enemy-ai';
import { handlePlayerShoot, updateRockets, updateBioProjectiles, type CombatContext } from './combat';
import {
  createEffectsState,
  spawnBlood,
  updateBloodParticles,
  updateHeartbeat,
  updateEffectTimers,
  updateHeadbobAndShake,
  renderBloodParticles,
  renderBioProjectiles,
  renderRockets,
  drawDamageFlash,
  drawLowHealthVignette,
  drawHitMarker,
  drawWallImpact,
  HIT_MARKER_DURATION,
  WALL_IMPACT_DURATION,
  type EffectsContext,
  type EffectsState,
} from './effects';
import { GameState, GameStateManager } from '../game/state';
import { Weapon } from '../game/weapon';
import { WeaponInventory, WeaponType, WEAPONS } from '../game/weapons';
import { drawWeapon, type WeaponRendererContext } from './weapon-renderer';
import { RocketProjectile } from './rocket-projectile';
import { BioProjectile } from './bio-projectile';
import { BloodParticle } from './blood-particle';
import { ENEMY_RADIUS } from './collision';
import { Minimap } from '../game/minimap';
import { SoundManager, SoundType } from '../audio/sound';
import { Level, BOSS_STAGE } from './level-gen';
import {
  initializeSprites as initSpritesFlow,
  beginLevelTransition as beginTransitionFlow,
  installLevel as installFlow,
  resetGameFlow,
  tickLoading,
  LOAD_ANIM_MS,
  STAGE_BANNER_DURATION,
  type LevelFlowContext,
  type LevelFlowState,
} from './level-flow';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const MOVE_SPEED = 3.0;          // Tiles pro Sekunde (Normal)
const SPRINT_MULTIPLIER = 1.8;  // Sprint-Faktor
const CORPSE_SCALE = 0.18;      // Corpse height as fraction of full sprite height

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
  private inventory: WeaponInventory;

  // Delta-Time tracking
  private lastTime: number = 0;

  // Fixed-timestep game loop (P2: decouple update from render)
  private readonly FIXED_DT: number = 1 / 60;
  private accumulator: number = 0;

  // FPS counter
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsTimer: number = 0;
  private readonly fpsInterval: number = 0.5; // update FPS every 500ms

  // Effects: blood, overlays, heartbeat, headbob, screen-shake, damage flash,
  // hit-marker, wall-impact. Grouped into a single object so the effects
  // module can mutate timers by reference.
  private effectsState: EffectsState = createEffectsState();

  // Keycard state
  private hasYellowKeycard: boolean = false;
  private hasBlueKeycard: boolean = false;
  private keycardPickupMessage: number = 0;  // timer for pickup message
  private readonly keycardMessageDuration: number = 2.0;

  // Door interaction HUD messages
  private doorMessage: string = '';
  private doorMessageTimer: number = 0;
  private readonly doorMessageDuration: number = 2.0;

  // Pause-Overlay
  private pauseOverlay!: HTMLDivElement;

  // Animation frame id for cancellation (C1-fix)
  private animationFrameId: number | null = null;

  // Disposed flag to prevent double-cleanup
  private disposed = false;

  // Bound listener references for cleanup (C2/C3-fix)
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundF1Keydown: ((e: KeyboardEvent) => void) | null = null;
  private boundCanvasClick: (() => void) | null = null;
  private boundPauseOverlayClick: (() => void) | null = null;

  // Pointer Lock verfügbar?
  private pointerLockAvailable: boolean;

  // Muzzle-Flash-Textur (prozedural generiert)
  private muzzleFlashTexture: Texture | null = null;

  // Phase 8: Minimap & Sound
  private minimap: Minimap;
  private soundManager: SoundManager;
  private stepTimer: number = 0;       // Timer für Schritt-Sounds
  private readonly stepInterval: number = 0.35; // Schritt alle 350ms beim Laufen

  private wasPointerLockedLastFrame: boolean = false;

  // Rocket projectiles
  private rockets: RocketProjectile[] = [];
  private bioProjectiles: BioProjectile[] = [];
  private bloodParticles: BloodParticle[] = [];

  // Ammo-low warning: edge-triggered when current weapon ammo drops at or
  // below LOW_AMMO_THRESHOLD. Auto-resets when ammo climbs back up (pickup
  // or weapon switch).
  private ammoLowWarned: boolean = false;
  private readonly LOW_AMMO_THRESHOLD: number = 5;

  // Edge-Triggering für Interaktion (E-Taste)
  private wasInteractPressedLastFrame: boolean = false;

  // Edge-Detection for TAB (reset after each poll)
  private wasTabLastFrame: boolean = false;

  // Edge-Detection for melee key (KeyV)
  private meleeKeyWasDown = false;

  // Weapon flash feedback
  private weaponFlashTimer: number = 0;
  private weaponFlashName: string = '';
  private readonly WEAPON_FLASH_DURATION: number = 1.5;

  // Powerup state
  private berserkTimer: number = 0;
  private readonly BERSERK_DURATION: number = 10; // seconds

  // Procedural Levels: Seed, Stage, aktuelles Level und Loading-Zustand
  // werden jetzt in levelFlowState gebündelt (siehe level-flow.ts).
  private levelFlowState: LevelFlowState;

  constructor(
    player: Player,
    gameStateManager: GameStateManager,
    weapon: Weapon,
    inventory: WeaponInventory,
    level: Level,
    baseSeed: number
  ) {
    this.player = player;
    this.gameStateManager = gameStateManager;
    this.weapon = weapon;
    this.inventory = inventory;
    this.levelFlowState = {
      baseSeed,
      stage: level.stage,
      currentLevel: level,
      isLoading: false,
      pendingLevel: null,
      loadingProgress: 0,
      loadingTargetStage: 0,
      loadingAnimStart: 0,
      stageBannerTimer: 0,
    };
    this.zBuffer = new ZBuffer(SCREEN_WIDTH);
    this.textureManager = new TextureManager();
    this.textureManager.initialize();
    this.generateMuzzleFlashTexture();
    initSpritesFlow(this.levelFlowCtx(), this.levelFlowState.currentLevel);
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
    this.boundMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && this.gameStateManager.getState() === GameState.PLAYING) {
        handlePlayerShoot(this.combatCtx());
      }
      // Sound beim ersten Klick initialisieren (Browser-Policy)
      this.soundManager.init();
    };
    this.canvas.addEventListener('mousedown', this.boundMouseDown);

    // F1: Kollisions-Debug-Overlay umschalten
    this.boundF1Keydown = (e: KeyboardEvent) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.minimap.toggleDebug();
      }
    };
    window.addEventListener('keydown', this.boundF1Keydown);

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

  private weaponRendererCtx(): WeaponRendererContext {
    return {
      ctx: this.ctx,
      weapon: this.weapon,
      inventory: this.inventory,
      muzzleFlashTexture: this.muzzleFlashTexture,
    };
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
        if (sprite.type === SpriteType.AMMO) {
          this.inventory.addAmmo(20);
        } else if (sprite.type === SpriteType.HEALTH) {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
        } else if (sprite.type === SpriteType.KEYCARD) {
          this.hasBlueKeycard = true;
          this.keycardPickupMessage = this.keycardMessageDuration;
          this.player.score += 50;
        } else if (sprite.type === SpriteType.YELLOW_KEYCARD) {
          this.hasYellowKeycard = true;
          this.keycardPickupMessage = this.keycardMessageDuration;
          this.player.score += 50;
        } else if (sprite.type === SpriteType.WEAPON_SHOTGUN) {
          this.inventory.addWeapon(WEAPONS[1]);
        } else if (sprite.type === SpriteType.WEAPON_ROCKETLAUNCHER) {
          this.inventory.addWeapon(WEAPONS[2]);
        } else if (sprite.type === SpriteType.ARMOR) {
          if (this.player.armor < 100) {
            this.player.armor = Math.min(100, this.player.armor + 50);
            this.soundManager.play(SoundType.POWERUP_ARMOR);
            this.sprites.splice(i, 1);
          }
          continue; // don't play the default PICKUP sound
        } else if (sprite.type === SpriteType.BERSERK) {
          this.berserkTimer = this.BERSERK_DURATION;
          this.player.score += 200;
          this.soundManager.play(SoundType.POWERUP_BERSERK);
          this.sprites.splice(i, 1);
          continue; // don't play the default PICKUP sound
        }
        this.soundManager.play(SoundType.PICKUP);
        this.sprites.splice(i, 1);
      }
    }
  }

  public triggerDamageFlash(): void {
    this.effectsState.damageFlashTimer = this.effectsState.damageFlashDuration;
    // Sound: Damage
    this.soundManager.play(SoundType.DAMAGE);
  }

  private aiCtx(): AIContext {
    return {
      player: this.player,
      sprites: this.sprites,
      bioProjectiles: this.bioProjectiles,
      soundManager: this.soundManager,
      triggerDamageFlash: () => this.triggerDamageFlash(),
    };
  }

  private combatCtx(): CombatContext {
    return {
      player: this.player,
      inventory: this.inventory,
      weapon: this.weapon,
      sprites: this.sprites,
      rockets: this.rockets,
      bioProjectiles: this.bioProjectiles,
      soundManager: this.soundManager,
      triggerDamageFlash: () => this.triggerDamageFlash(),
      broadcastGunshot: () => broadcastGunshot(this.aiCtx()),
      triggerScreenShake: (intensity, duration) => {
        this.effectsState.screenShakeTimer = duration;
        this.effectsState.screenShakeIntensity = intensity;
      },
      setWallImpact: (x, y) => {
        this.effectsState.wallImpactX = x;
        this.effectsState.wallImpactY = y;
        this.effectsState.wallImpactTimer = WALL_IMPACT_DURATION;
      },
      setHitMarker: () => {
        this.effectsState.hitMarkerTimer = HIT_MARKER_DURATION;
      },
      flashCameraNoSound: () => {
        this.effectsState.damageFlashTimer = this.effectsState.damageFlashDuration;
      },
      berserkTimer: this.berserkTimer,
    };
  }

  private effectsCtx(): EffectsContext {
    return {
      ctx: this.ctx,
      player: this.player,
      zBuffer: this.zBuffer,
      soundManager: this.soundManager,
      bloodParticles: this.bloodParticles,
      bioProjectiles: this.bioProjectiles,
      rockets: this.rockets,
    };
  }

  private levelFlowCtx(): LevelFlowContext {
    return {
      player: this.player,
      weapon: this.weapon,
      inventory: this.inventory,
      gameStateManager: this.gameStateManager,
      soundManager: this.soundManager,
      sprites: this.sprites,
    };
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
      // Floating-Offset für Items (Schweben) bzw. subtiler Idle-Bob für Gegner.
      let floatingOffset = sprite.getFloatingOffset();
      if ((sprite.isEnemy) && sprite.isAlive) {
        floatingOffset += Math.sin(sprite.floatingPhase) * 0.02;
      }

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

      // Vertical screen offset for Latchers in mid-leap — parabolic arc that
      // peaks at leapProgress 0.5 and lands at 0 / 1. Lift in tiles scaled by
      // inverse depth so the on-screen rise matches perspective.
      let verticalScreenOffset = 0;
      if (sprite.type === SpriteType.LATCHER && sprite.latcherState === LatcherState.LEAP) {
        const arcHeight = Math.sin(sprite.leapProgress * Math.PI) * 0.6; // tiles
        verticalScreenOffset = -arcHeight * (SCREEN_HEIGHT / transformY);
      }

      // Zeichen-Grenzen berechnen
      let drawStartY = -spriteHeight / 2 + SCREEN_HEIGHT / 2 + verticalScreenOffset;
      if (drawStartY < 0) drawStartY = 0;
      let drawEndY = spriteHeight / 2 + SCREEN_HEIGHT / 2 + verticalScreenOffset;
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
        (sprite.isEnemy) &&
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
      if ((sprite.isEnemy) && sprite.isDead && sprite.corpseTexture) {
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

              // Hit-Flash: pro Gegner-Klasse eingefärbt (Cyan für Husk, Bio-Grün
              // für Spitter, Orange für Boss). Latcher fällt in den Fallback.
              if (sprite.hitFlashTimer > 0) {
                if (sprite.type === SpriteType.SHOOTER) {
                  // Spitter: Bio-Grün (SPITTER_BIO_HOT-Richtung)
                  r = Math.min(255, r + 120);
                  g = Math.min(255, g + 200);
                  b = Math.min(255, b + 60);
                } else if (sprite.type === SpriteType.ENEMY) {
                  // Husk: Cyan (HUSK_EYE_HOT-Richtung)
                  r = Math.min(255, r + 50);
                  g = Math.min(255, g + 180);
                  b = Math.min(255, b + 220);
                } else if (sprite.type === SpriteType.BOSS) {
                  // Boss: Orange — reads as a big, dangerous target.
                  r = Math.min(255, r + 200);
                  g = Math.min(255, g + 120);
                  b = Math.min(255, b + 30);
                } else {
                  // Fallback (Latcher etc.)
                  r = Math.min(255, r + 180);
                  g = Math.min(255, g + 120);
                  b = Math.min(255, b + 80);
                }
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
    this.boundPauseOverlayClick = () => {
      if (this.gameStateManager.getState() === GameState.PAUSED) {
        this.gameStateManager.transitionTo(GameState.PLAYING);
      }
      this.pauseOverlay.style.display = 'none';
      this.input.requestPointerLock();
    };
    this.pauseOverlay.addEventListener('click', this.boundPauseOverlayClick);
  }

  /**
   * Canvas-Click → Pointer Lock anfordern.
   */
  private setupCanvasClick(): void {
    this.boundCanvasClick = () => {
      if (!this.input.getPointerLocked()) {
        if (this.gameStateManager.getState() === GameState.PAUSED) {
          this.gameStateManager.transitionTo(GameState.PLAYING);
        }
        this.input.requestPointerLock();
        this.pauseOverlay.style.display = 'none';
      }
    };
    this.canvas.addEventListener('click', this.boundCanvasClick);
  }

  /**
   * Cleans up all resources: cancels the game loop (C1), removes pause overlay (C3),
   * removes all event listeners (C2), and disposes the input handler.
   * Call this before creating a new Renderer or on game reset.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // C1: Cancel the running animation frame loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // C2: Remove canvas mousedown listener
    if (this.boundMouseDown) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.boundMouseDown = null;
    }

    // C2: Remove F1 keydown listener
    if (this.boundF1Keydown) {
      window.removeEventListener('keydown', this.boundF1Keydown);
      this.boundF1Keydown = null;
    }

    // C2: Remove canvas click listener
    if (this.boundCanvasClick) {
      this.canvas.removeEventListener('click', this.boundCanvasClick);
      this.boundCanvasClick = null;
    }

    // C2 + C3: Remove pause overlay click listener and DOM node
    if (this.boundPauseOverlayClick && this.pauseOverlay) {
      this.pauseOverlay.removeEventListener('click', this.boundPauseOverlayClick);
      this.boundPauseOverlayClick = null;
    }
    // C3: Remove pause overlay from DOM
    if (this.pauseOverlay && this.pauseOverlay.parentNode) {
      this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
    }

    // C2: Dispose input handler (removes its window/document listeners)
    this.input.dispose();
  }

  /**
   * Spielerbewegung basierend auf Input + Delta-Time.
   */
  private updatePlayer(deltaTime: number): void {
    // Sprint-Status prüfen
    this.effectsState.isSprinting = this.input.isSprinting();
    const currentSpeed = this.effectsState.isSprinting
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
      if ((sprite.isEnemy) && sprite.isAlive && !sprite.isDying && !sprite.isDead) {
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

      const baseTile = worldState.getTile(mapX, mapY);
      if (baseTile === TILE.EXIT_DOOR) {
        const dist = Math.sqrt(
          (mapX + 0.5 - this.player.x) ** 2 + (mapY + 0.5 - this.player.y) ** 2
        );
        if (dist <= 1.5) {
          const result = worldState.interactAt(mapX, mapY, this.hasYellowKeycard, this.hasBlueKeycard);
          if (result === InteractionResult.EXIT_READY) {
            this.player.score += 500;
            beginTransitionFlow(this.levelFlowCtx(), this.levelFlowState);
          } else {
            this.showDoorMessage(result);
          }
        }
        break;
      }

      // Stoppe am ersten soliden Tile
      if (worldState.isSolidTile(mapX, mapY)) {
        hit = worldState.getTile(mapX, mapY);

        // Prüfe Distanz zum Spieler (max. 1.5 Tiles)
        const dist = Math.sqrt(
          (mapX + 0.5 - this.player.x) ** 2 + (mapY + 0.5 - this.player.y) ** 2
        );
        if (dist <= 1.5 && worldState.isDoorTile(mapX, mapY)) {
          const result = worldState.interactAt(mapX, mapY, this.hasYellowKeycard, this.hasBlueKeycard);
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
          this.doorMessage = 'LOCKED: BLUE KEYCARD REQUIRED';
          this.doorMessageTimer = this.doorMessageDuration;
          this.soundManager.play(SoundType.DOOR);
          break;
      case InteractionResult.YELLOW_DOOR_LOCKED:
          this.doorMessage = 'LOCKED: YELLOW KEYCARD REQUIRED';
          this.doorMessageTimer = this.doorMessageDuration;
          this.soundManager.play(SoundType.DOOR);
          break;
      case InteractionResult.SECRET_FOUND:
        this.doorMessage = 'SECRET FOUND!';
        this.doorMessageTimer = this.doorMessageDuration;
        this.player.score += 200;
        this.soundManager.play(SoundType.DOOR);
        break;
      case InteractionResult.EXIT_LOCKED_NO_YELLOW:
        this.doorMessage = 'EXIT LOCKED: YELLOW KEYCARD REQUIRED';
        this.doorMessageTimer = this.doorMessageDuration;
        this.soundManager.play(SoundType.DOOR);
        break;
      case InteractionResult.EXIT_LOCKED_NO_BLUE:
        this.doorMessage = 'EXIT LOCKED: BLUE KEYCARD REQUIRED';
        this.doorMessageTimer = this.doorMessageDuration;
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
    const healthPct = this.player.health / this.player.maxHealth;
    const healthColor = healthPct > 0.5 ? '#0c0' : (healthPct > 0.25 ? '#cc0' : '#c00');
    ctx.fillStyle = healthColor;
    ctx.fillRect(healthBarX, healthBarY, healthBarW * healthPct, healthBarH);

    // Health-Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${this.player.health}`, healthBarX + 5, healthBarY + 15);

    // --- Armor Bar (below health bar) ---
    if (this.player.armor > 0) {
      const armorBarX = 20;
      const armorBarY = h - 28;
      const armorBarW = 200;
      const armorBarH = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(armorBarX - 2, armorBarY - 2, armorBarW + 4, armorBarH + 4);
      ctx.fillStyle = '#033';
      ctx.fillRect(armorBarX, armorBarY, armorBarW, armorBarH);
      const armorPct = this.player.armor / 100;
      ctx.fillStyle = '#0cc';
      ctx.fillRect(armorBarX, armorBarY, armorBarW * armorPct, armorBarH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ARMOR ${this.player.armor}`, armorBarX + 5, armorBarY + 10);
    }

    // --- Weapon Name + Ammo (unten rechts) ---
    const def = this.inventory.getCurrent();
    const ammo = this.inventory.getCurrentAmmo();
    const ammoStr = isFinite(ammo) ? String(ammo) : '∞';
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`${def.name} — ${ammoStr}`, w - 20, h - 30);

    // --- Score (oben rechts) ---
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE: ${this.player.score}`, w - 20, 25);

    // --- Kills (oben rechts, unter Score) ---
    ctx.font = '14px monospace';
    ctx.fillStyle = '#f88';
    ctx.fillText(`KILLS: ${this.inventory.kills}`, w - 20, 45);

    // --- Sprint-Indikator ---
    if (this.effectsState.isSprinting) {
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
        } else if (sprite.type === SpriteType.ARMOR) {
          ctx.fillStyle = '#0cc';
          ctx.fillText('[E] ARMOR einsammeln', w / 2, 60);
        } else if (sprite.type === SpriteType.BERSERK) {
          ctx.fillStyle = '#f44';
          ctx.fillText('[E] BERSERK einsammeln', w / 2, 60);
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
    if (this.hasYellowKeycard) {
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

    // --- Exit Door proximity check ---
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    let nearExit = false;
    let hasKeycards = this.hasYellowKeycard && this.hasBlueKeycard;
    for (let dy = -2; dy <= 2 && !nearExit; dy++) {
      for (let dx = -2; dx <= 2 && !nearExit; dx++) {
        const tx = px + dx, ty = py + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) continue;
        const tile = worldState.getTile(tx, ty);
        if (tile === TILE.EXIT_DOOR) {
          const tcx = tx + 0.5, tcy = ty + 0.5;
          const ddx = tcx - this.player.x, ddy = tcy - this.player.y;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 1.5) {
            nearExit = true;
          }
        }
      }
    }
    if (nearExit) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      if (hasKeycards) {
        ctx.fillStyle = '#0f0';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 8;
        ctx.fillText(`EXIT — [E] to Stage ${this.levelFlowState.stage + 1}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#f44';
        ctx.fillText('KEYCARD REQUIRED', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90);
      }
    }

    // --- Weapon Switch Flash (centered) ---
    if (this.weaponFlashTimer > 0) {
      const alpha = this.weaponFlashTimer / this.WEAPON_FLASH_DURATION;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.fillText(this.weaponFlashName, w / 2, h / 2);
      ctx.restore();
    }

    // --- Stage-Anzeige (oben Mitte, klein) ---
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`STAGE ${this.levelFlowState.stage}`, w / 2, 22);

    // --- Stage-Übergangs-Banner ---
    if (this.levelFlowState.stageBannerTimer > 0) {
      const alpha = Math.min(1, this.levelFlowState.stageBannerTimer / 0.7);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
      ctx.shadowColor = '#fc0';
      ctx.shadowBlur = 14;
      ctx.fillText(`STAGE ${this.levelFlowState.stage}`, w / 2, h / 2 - 60);
      ctx.shadowBlur = 0;
    }

    // --- Berserk active overlay ---
    if (this.berserkTimer > 0) {
      // Red border glow
      const alpha = Math.min(0.4, this.berserkTimer / this.BERSERK_DURATION * 0.4);
      ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.lineWidth = 1;

      // Countdown text (top center)
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = `rgba(255, 60, 60, ${0.7 + 0.3 * Math.sin(performance.now() / 150)})`;
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 12;
      ctx.fillText(`BERSERK ${this.berserkTimer.toFixed(1)}`, w / 2, 25);
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
  }

  public start(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;

    // Vorheriger Game State tracken (für Respawn-Erkennung)
    let previousState: GameState = this.gameStateManager.getState();

    const loop = (currentTime: number) => {
      // Raw frame delta (seconds), clamped to avoid spiral of death
      const rawDt = Math.min((currentTime - this.lastTime) / 1000.0, 0.1);
      this.lastTime = currentTime;
      this.accumulator += rawDt;

      // FPS counter (per rendered frame)
      this.frameCount++;
      this.fpsTimer -= rawDt;
      if (this.fpsTimer <= 0) {
        this.fps = Math.round(this.frameCount / (this.fpsInterval + this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = this.fpsInterval;
      }

      // Fixed-timestep game updates: run at deterministic 1/60s cadence
      while (this.accumulator >= this.FIXED_DT) {
        this.fixedUpdate(this.FIXED_DT, previousState);
        previousState = this.gameStateManager.getState();
        this.accumulator -= this.FIXED_DT;
      }

      // Rendering-only state updates (variable rate, always run for smooth HUD)
      const renderDt = rawDt;
      updateEffectTimers(this.effectsState, renderDt);
      if (this.keycardPickupMessage > 0) this.keycardPickupMessage -= renderDt;
      if (this.berserkTimer > 0) this.berserkTimer = Math.max(0, this.berserkTimer - renderDt);
      if (this.doorMessageTimer > 0) this.doorMessageTimer -= renderDt;
      if (this.levelFlowState.stageBannerTimer > 0) this.levelFlowState.stageBannerTimer -= renderDt;
      if (this.weaponFlashTimer > 0) this.weaponFlashTimer -= renderDt;

      // Render frame (always, at whatever frame rate the browser gives)
      const gameState = this.gameStateManager.getState();

      // Music control
      if (gameState === GameState.PLAYING) {
        this.soundManager.startMusic();
      } else {
        this.soundManager.stopMusic();
      }

      // Pause-Overlay show when PAUSED
      if (gameState === GameState.PAUSED && this.pointerLockAvailable) {
        this.pauseOverlay.style.display = 'flex';
      }

      // Clear
      this.ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Headbob + Screen Shake
      const isMovingNow = gameState === GameState.PLAYING && (
        this.input.isForward() || this.input.isBackward() ||
        this.input.isStrafeLeft() || this.input.isStrafeRight()
      );
      const { translateX, translateY } = updateHeadbobAndShake(this.effectsState, renderDt, isMovingNow);

      this.ctx.save();
      if (translateX !== 0 || translateY !== 0) {
        this.ctx.translate(translateX, translateY);
      }

      // LOADING: render loading screen, skip gameplay rendering
      if (gameState === GameState.LOADING) {
        this.gameStateManager.render(this.ctx, SCREEN_WIDTH, SCREEN_HEIGHT, this.player.health, this.levelFlowState.loadingProgress, this.levelFlowState.loadingTargetStage);
      } else {
        this.drawFloorAndCeiling();
        this.castRays();
        this.renderSprites();
        const effectsCtx = this.effectsCtx();
        renderBloodParticles(effectsCtx);
        renderBioProjectiles(effectsCtx);
        renderRockets(effectsCtx);

        if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
          drawWeapon(this.weaponRendererCtx());
          this.drawHUD();
          drawLowHealthVignette(effectsCtx, this.effectsState);
          drawDamageFlash(effectsCtx, this.effectsState);
          drawHitMarker(effectsCtx, this.effectsState);
          drawWallImpact(effectsCtx, this.effectsState);
          this.minimap.render(this.player, this.sprites);
          const mmSize = this.minimap.getSize();
          this.ctx.drawImage(
            this.minimap.getCanvas(),
            0, 0, mmSize, mmSize,
            this.minimap.getX(), this.minimap.getY(), mmSize, mmSize
          );
        }

        this.gameStateManager.render(this.ctx, SCREEN_WIDTH, SCREEN_HEIGHT, this.player.health);

        this.ctx.textAlign = 'left';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillStyle = '#0f0';
        this.ctx.fillText(`${this.fps} FPS`, 10, 9);
      }

      this.ctx.restore();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Fixed-timestep game update (P2: decouple from render).
   * All game-state mutations happen here at a deterministic 1/60s cadence.
   */
  private fixedUpdate(dt: number, previousState: GameState): void {
    const gameState = this.gameStateManager.getState();

    // Respawn: Wenn von DEAD/WIN zurück nach MENU → Spiel zurücksetzen
    if ((previousState === GameState.DEAD || previousState === GameState.WIN) &&
        gameState === GameState.MENU) {
      resetGameFlow(this.levelFlowCtx(), this.levelFlowState);
      this.effectsState.damageFlashTimer = 0;
      this.hasYellowKeycard = false;
      this.hasBlueKeycard = false;
      this.keycardPickupMessage = 0;
      this.doorMessage = '';
      this.doorMessageTimer = 0;
      this.weaponFlashTimer = 0;
      this.weaponFlashName = '';
      this.berserkTimer = 0;
      this.player.armor = 0;
    }

    // --- Loading screen updates ---
    if (gameState === GameState.LOADING) {
      const installed = tickLoading(this.levelFlowCtx(), this.levelFlowState);
      if (installed) {
        this.hasYellowKeycard = false;
        this.hasBlueKeycard = false;
        this.keycardPickupMessage = 0;
        this.doorMessage = '';
        this.doorMessageTimer = 0;
        this.berserkTimer = 0;
        this.player.armor = 0;
      }
    }

    // --- Game-state mutations: NUR im Zustand PLAYING ---
    if (gameState === GameState.PLAYING) {
      if (this.pointerLockAvailable) {
        this.pauseOverlay.style.display = 'none';
      }

      this.updatePlayer(dt);

      const tabPressed = this.input.getTabPressed();
      const wheelDown = this.input.getWheelDown();
      const wheelUp = this.input.getWheelUp();
      this.input.resetTabFlag();
      this.input.resetWheelFlags();

      const meleeKeyDown = this.input.isKey('KeyV');
      if (meleeKeyDown && !this.meleeKeyWasDown) {
        if (this.inventory.switchTo(WeaponType.FIST)) {
          this.weaponFlashTimer = this.WEAPON_FLASH_DURATION;
          this.weaponFlashName = this.inventory.getCurrent().name;
        }
      }
      this.meleeKeyWasDown = meleeKeyDown;

      let switched = false;
      if (tabPressed || wheelDown) {
        switched = this.inventory.switchNext();
      } else if (wheelUp) {
        switched = this.inventory.switchPrev();
      }
      if (switched) {
        this.weaponFlashTimer = this.WEAPON_FLASH_DURATION;
        this.weaponFlashName = this.inventory.getCurrent().name;
      }

      const isMoving = this.input.isForward() || this.input.isBackward() ||
                         this.input.isStrafeLeft() || this.input.isStrafeRight();
      this.weapon.update(dt, isMoving);
      this.inventory.update(dt);
      updateRockets(this.combatCtx(), dt);
      updateBioProjectiles(this.combatCtx(), dt);

      for (const sprite of this.sprites) {
        sprite.update(dt);
        if (sprite.hitFlashTimer > 0) sprite.hitFlashTimer -= dt;
        if (sprite.isDying && !sprite.bloodSpawned) {
          sprite.bloodSpawned = true;
          spawnBlood(this.effectsCtx(), sprite);
        }
        if (sprite.isDying) {
          sprite.deathTimer -= dt;
          if (sprite.deathTimer <= 0) {
            sprite.isDying = false;
            sprite.isDead = true;
          }
        }
      }

      updateBloodParticles(this.effectsCtx(), dt);

      const currentAmmo = this.inventory.getCurrentAmmo();
      if (currentAmmo <= this.LOW_AMMO_THRESHOLD && currentAmmo > 0 && !this.ammoLowWarned) {
        this.soundManager.play(SoundType.AMMO_LOW);
        this.ammoLowWarned = true;
      } else if (currentAmmo > this.LOW_AMMO_THRESHOLD) {
        this.ammoLowWarned = false;
      }

      updateHeartbeat(this.effectsCtx(), this.effectsState, dt, true);
      updateEnemyAI(this.aiCtx(), dt);
      this.checkItemPickup();
      worldState.updateWorld(dt);

      if (this.levelFlowState.stage === BOSS_STAGE) {
        const bossStillFighting = this.sprites.some(
          s => s.isBoss && !s.isDying && !s.isDead
        );
        if (!bossStillFighting) {
          this.gameStateManager.transitionTo(GameState.WIN);
        }
      }

      if (this.player.health <= 0) {
        this.player.health = 0;
        this.inventory.reset();
        this.gameStateManager.transitionTo(GameState.DEAD);
      }
    }

    // Pointer-Lock-Verlust → Pause
    const currentLocked = this.input.getPointerLocked();
    const currentState = this.gameStateManager.getState();
    if (this.pointerLockAvailable && !currentLocked && !this.wasPointerLockedLastFrame &&
        (currentState === GameState.PLAYING || currentState === GameState.LOADING)) {
      this.gameStateManager.transitionTo(GameState.PAUSED);
      this.pauseOverlay.style.display = 'flex';
    }
    this.wasPointerLockedLastFrame = currentLocked;
  }
}
