/**
 * Level-Flow-Modul: Level-Übergang, Installation, Sprite-Initialisierung und Reset.
 *
 * Nimmt die vier Methoden aus renderer.ts auf und bietet sie als freie Funktionen
 * an, die einen expliziten Kontext- + State-Parameter erwarten.
 */

import { Level, generateLevel } from './level-gen';
import {
  Sprite,
  SpriteType,
  generateSpriteTextures,
  EnemyAIState,
  EnemyClass,
  LatcherState,
  AI_IDLE_PATROL_RADIUS,
  AI_SHOOTER_RANGE,
  AI_SHOOTER_MIN_DIST,
  AI_SHOOTER_COOLDOWN,
  AI_SHOOTER_DAMAGE,
} from './sprite';
import { huskCorpseTexture, spitterCorpseTexture, SpriteTextureSet } from './sprite-textures';
import { Texture } from './textures';
import { worldState } from './world';
import { Player } from '../player/player';
import { GameState, GameStateManager } from '../game/state';
import { Weapon } from '../game/weapon';
import { WeaponInventory } from '../game/weapons';
import { SoundManager, SoundType } from '../audio/sound';

// -------------- Konstanten --------------

/** Dauer der Loading-Animation in Millisekunden. */
export const LOAD_ANIM_MS = 700;
/** Dauer des Stage-Banners in Sekunden. */
export const STAGE_BANNER_DURATION = 2.0;

// -------------- Interfaces --------------

export interface LevelFlowContext {
  player: Player;
  weapon: Weapon;
  inventory: WeaponInventory;
  gameStateManager: GameStateManager;
  soundManager: SoundManager;
  sprites: Sprite[];
}

export interface LevelFlowState {
  baseSeed: number;
  stage: number;
  currentLevel: Level;
  isLoading: boolean;
  pendingLevel: Level | null;
  loadingProgress: number;
  loadingTargetStage: number;
  loadingAnimStart: number;
  stageBannerTimer: number;
}

// -------------- Funktionen --------------

/**
 * Initialisiert alle Sprites für ein Level (Gegner, Items, Dekoration).
 * generateSpriteTextures() wird WÄHREND dieser Funktion aufgerufen.
 */
export function initializeSprites(ctx: LevelFlowContext, level: Level): void {
  const spriteSet: SpriteTextureSet = generateSpriteTextures();
  const flat = spriteSet.flat;
  const enemyTextures = flat.get(SpriteType.ENEMY);
  const ammoTextures = flat.get(SpriteType.AMMO);
  const healthTextures = flat.get(SpriteType.HEALTH);
  const keycardTextures = flat.get(SpriteType.KEYCARD);
  const yellowKeycardTextures = flat.get(SpriteType.YELLOW_KEYCARD);
  const decorTextures: Partial<Record<SpriteType, Texture[] | undefined>> = {
    [SpriteType.BARREL]: flat.get(SpriteType.BARREL),
    [SpriteType.TERMINAL]: flat.get(SpriteType.TERMINAL),
    [SpriteType.LAMP]: flat.get(SpriteType.LAMP),
    [SpriteType.DEBRIS]: flat.get(SpriteType.DEBRIS),
  };

  // Gegner
  for (const pos of level.enemies) {
    const enemy = new Sprite(pos.x, pos.y, SpriteType.ENEMY, enemyTextures?.[0] ?? null);
    if (enemyTextures) enemy.textures = enemyTextures;
    enemy.angleViews = spriteSet.huskAngleViews;
    enemy.facingAngle = Math.atan2(ctx.player.y - pos.y, ctx.player.x - pos.x);
    enemy.animationSpeed = 0.4;
    enemy.corpseTexture = huskCorpseTexture;
    enemy.aiState = EnemyAIState.IDLE;
    enemy.alertTimer = 0;
    enemy.alertFadeoutTimer = 0;
    enemy.heardGunshotTime = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * AI_IDLE_PATROL_RADIUS;
    enemy.idleWanderTargetX = pos.x + Math.cos(angle) * dist;
    enemy.idleWanderTargetY = pos.y + Math.sin(angle) * dist;
    enemy.idleWanderTimer = 1 + Math.random() * 2;
    ctx.sprites.push(enemy);
  }

  // Shooter enemies
  const spitterTextures = flat.get(SpriteType.SHOOTER);
  for (const pos of level.shooters) {
    const shooter = new Sprite(pos.x, pos.y, SpriteType.SHOOTER, spitterTextures?.[0] ?? enemyTextures?.[0] ?? null);
    if (spitterTextures) shooter.textures = spitterTextures; else if (enemyTextures) shooter.textures = enemyTextures;
    shooter.angleViews = spriteSet.spitterAngleViews;
    shooter.facingAngle = Math.atan2(ctx.player.y - pos.y, ctx.player.x - pos.x);
    shooter.animationSpeed = 0.4;
    shooter.corpseTexture = spitterCorpseTexture;
    shooter.aiState = EnemyAIState.IDLE;
    shooter.alertTimer = 0;
    shooter.alertFadeoutTimer = 0;
    shooter.heardGunshotTime = 0;
    shooter.enemyClass = EnemyClass.SHOOTER;
    shooter.health = 2;
    shooter.shooterRange = AI_SHOOTER_RANGE;
    shooter.shooterMinDist = AI_SHOOTER_MIN_DIST;
    shooter.shooterCooldown = AI_SHOOTER_COOLDOWN;
    shooter.shooterDamage = AI_SHOOTER_DAMAGE;
    shooter.muzzleFlashTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * AI_IDLE_PATROL_RADIUS;
    shooter.idleWanderTargetX = pos.x + Math.cos(angle) * dist;
    shooter.idleWanderTargetY = pos.y + Math.sin(angle) * dist;
    shooter.idleWanderTimer = 1 + Math.random() * 2;
    ctx.sprites.push(shooter);
  }

  // Latcher enemies — fast pounce parasites.
  const latcherTextures = flat.get(SpriteType.LATCHER);
  for (const pos of level.latchers) {
    const latcher = new Sprite(pos.x, pos.y, SpriteType.LATCHER, latcherTextures?.[0] ?? null);
    if (latcherTextures) latcher.textures = latcherTextures;
    latcher.angleViews = spriteSet.latcherAngleViews;
    latcher.facingAngle = Math.atan2(ctx.player.y - pos.y, ctx.player.x - pos.x);
    // Disable auto-frame-cycling — handleLatcherChase manually sets the
    // texture / currentFrame to reflect the AI state machine.
    latcher.animationSpeed = 9999;
    // Latcher corpses share the husk pile look for now — same chitin family.
    latcher.corpseTexture = huskCorpseTexture;
    latcher.aiState = EnemyAIState.IDLE;
    latcher.alertTimer = 0;
    latcher.alertFadeoutTimer = 0;
    latcher.heardGunshotTime = 0;
    latcher.enemyClass = EnemyClass.LATCHER;
    latcher.health = 1;  // single shot kills it
    latcher.latcherState = LatcherState.APPROACH;
    latcher.latcherStateTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * AI_IDLE_PATROL_RADIUS;
    latcher.idleWanderTargetX = pos.x + Math.cos(angle) * dist;
    latcher.idleWanderTargetY = pos.y + Math.sin(angle) * dist;
    latcher.idleWanderTimer = 1 + Math.random() * 2;
    ctx.sprites.push(latcher);
  }

  // Ammo
  for (const pos of level.ammo) {
    const a = new Sprite(pos.x, pos.y, SpriteType.AMMO, ammoTextures?.[0] ?? null);
    if (ammoTextures) a.textures = ammoTextures;
    a.animationSpeed = 0.12;
    ctx.sprites.push(a);
  }

  // Health
  for (const pos of level.health) {
    const h = new Sprite(pos.x, pos.y, SpriteType.HEALTH, healthTextures?.[0] ?? null);
    if (healthTextures) h.textures = healthTextures;
    h.animationSpeed = 0.12;
    ctx.sprites.push(h);
  }

  // Yellow keycard
  {
    const k = new Sprite(level.yellowKeycard.x, level.yellowKeycard.y, SpriteType.YELLOW_KEYCARD, yellowKeycardTextures?.[0] ?? null);
    if (yellowKeycardTextures) k.textures = yellowKeycardTextures;
    k.animationSpeed = 0.12;
    ctx.sprites.push(k);
  }

  // Blue keycard
  {
    const k = new Sprite(level.blueKeycard.x, level.blueKeycard.y, SpriteType.KEYCARD, keycardTextures?.[0] ?? null);
    if (keycardTextures) k.textures = keycardTextures;
    k.animationSpeed = 0.12;
    ctx.sprites.push(k);
  }

  // Optionales Secret-Health hinter SECRET_WALL
  if (level.secretHealth) {
    const s = new Sprite(level.secretHealth.x, level.secretHealth.y, SpriteType.HEALTH, healthTextures?.[0] ?? null);
    if (healthTextures) s.textures = healthTextures;
    s.animationSpeed = 0.12;
    ctx.sprites.push(s);
  }

  // Decor
  for (const d of level.decor) {
    const tex = decorTextures[d.type];
    const sprite = new Sprite(d.x, d.y, d.type, tex?.[0] ?? null);
    if (tex) sprite.textures = tex;
    ctx.sprites.push(sprite);
  }

  // Shotgun pickups
  const shotgunTextures = flat.get(SpriteType.WEAPON_SHOTGUN);
  for (const pos of level.shotguns) {
    const s = new Sprite(pos.x, pos.y, SpriteType.WEAPON_SHOTGUN, shotgunTextures?.[0] ?? null);
    if (shotgunTextures) s.textures = shotgunTextures;
    s.animationSpeed = 0.12;
    ctx.sprites.push(s);
  }

  // Rocket Launcher pickups
  const rocketTextures = flat.get(SpriteType.WEAPON_ROCKETLAUNCHER);
  for (const pos of level.rocketLaunchers) {
    const s = new Sprite(pos.x, pos.y, SpriteType.WEAPON_ROCKETLAUNCHER, rocketTextures?.[0] ?? null);
    if (rocketTextures) s.textures = rocketTextures;
    s.animationSpeed = 0.12;
    ctx.sprites.push(s);
  }
}

/**
 * Startet einen asynchronen Level-Übergang mit Loading-Screen.
 *
 * generateLevel kann nach MAX_ATTEMPTS pathologischer Seed/Stage-Kombinationen
 * werfen. Früher hat das die Loading-Anzeige bei 0% deadlocken lassen, weil
 * `pendingLevel` dann nie gesetzt wurde. Jetzt: try/catch um den Aufruf,
 * Retries mit perturbiertem Seed, und bei wiederholtem Fehlschlag ein
 * sauberer Fallback zurück ins Hauptmenü statt eingefrorenem Screen.
 */
export function beginLevelTransition(ctx: LevelFlowContext, state: LevelFlowState): void {
  if (state.isLoading) return;
  state.isLoading = true;
  state.loadingTargetStage = state.stage + 1;
  state.loadingProgress = 0;
  ctx.gameStateManager.transitionTo(GameState.LOADING);

  setTimeout(() => {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const trySeed = (state.baseSeed ^ (attempt * 0x85EBCA6B)) >>> 0;
      try {
        state.pendingLevel = generateLevel(trySeed, state.loadingTargetStage);
        state.loadingAnimStart = performance.now();
        return;
      } catch (err) {
        console.warn(`beginLevelTransition: generateLevel attempt ${attempt + 1}/${MAX_RETRIES} for stage ${state.loadingTargetStage} failed:`, err);
      }
    }

    // All retries exhausted — bail out to the menu instead of hanging the
    // loading screen forever.
    console.error(`beginLevelTransition: giving up on stage ${state.loadingTargetStage} after ${MAX_RETRIES} attempts. Returning to menu.`);
    state.isLoading = false;
    state.pendingLevel = null;
    state.loadingProgress = 0;
    ctx.gameStateManager.transitionTo(GameState.MENU);
  }, 0);
}

/**
 * Installiert ein vorbereitetes Level: setzt Welt, Spieler-Position, Sprites.
 */
export function installLevel(ctx: LevelFlowContext, state: LevelFlowState, level: Level): void {
  worldState.loadLevel(level);
  state.currentLevel = level;
  state.stage = level.stage;

  ctx.player.setPosition(level.spawn.x, level.spawn.y);
  ctx.player.dirX = level.spawn.dirX;
  ctx.player.dirY = level.spawn.dirY;
  ctx.player.planeX = -level.spawn.dirY * 0.66;
  ctx.player.planeY = level.spawn.dirX * 0.66;

  // Keycard/Door-State Reset bleibt im Renderer (Nicht-Level-Flow-Felder).

  // ctx.sprites ist eine Referenz auf das Renderer-Array — in-place leeren,
  // nicht reassign (das würde nur die lokale Property überschreiben).
  ctx.sprites.length = 0;
  initializeSprites(ctx, level);

  state.stageBannerTimer = STAGE_BANNER_DURATION;
  ctx.soundManager.play(SoundType.DOOR);
}

/**
 * Setzt den kompletten Level-Flow zurück (neuer Seed, Stage 1, neues Level).
 *
 * RESET NICHT: damageFlashTimer, hasYellowKeycard/hasBlueKeycard,
 * keycardPickupMessage, doorMessage/doorMessageTimer,
 * weaponFlashTimer/weaponFlashName — das bleibt im Renderer.
 */
export function resetGameFlow(ctx: LevelFlowContext, state: LevelFlowState): void {
  state.baseSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
  state.stage = 1;
  const level = generateLevel(state.baseSeed, state.stage);
  worldState.loadLevel(level);
  state.currentLevel = level;

  ctx.player.setPosition(level.spawn.x, level.spawn.y);
  ctx.player.dirX = level.spawn.dirX;
  ctx.player.dirY = level.spawn.dirY;
  ctx.player.planeX = -level.spawn.dirY * 0.66;
  ctx.player.planeY = level.spawn.dirX * 0.66;
  ctx.player.score = 0;

  ctx.weapon.reset();

  // In-place leeren, nicht reassign (siehe installLevel).
  ctx.sprites.length = 0;
  initializeSprites(ctx, level);

  state.isLoading = false;
  state.pendingLevel = null;
  state.loadingProgress = 0;
  state.stageBannerTimer = 0;
}

/**
 * Tick-Funktion für den Loading-Screen.
 *
 * Wird im Spiel-Loop aufgerufen, wenn GameState === LOADING.
 * Liefert true, wenn in diesem Frame ein neues Level installiert wurde —
 * der Renderer nutzt das, um seine Nicht-Level-Flow-Felder (Keycards,
 * Door-Messages) zurückzusetzen.
 */
export function tickLoading(ctx: LevelFlowContext, state: LevelFlowState): boolean {
  if (state.pendingLevel !== null) {
    const elapsed = performance.now() - state.loadingAnimStart;
    state.loadingProgress = Math.min(elapsed / LOAD_ANIM_MS, 1.0);
    if (state.loadingProgress >= 1.0) {
      installLevel(ctx, state, state.pendingLevel);
      state.isLoading = false;
      state.pendingLevel = null;
      ctx.gameStateManager.transitionTo(GameState.PLAYING);
      return true;
    }
  }
  return false;
}
