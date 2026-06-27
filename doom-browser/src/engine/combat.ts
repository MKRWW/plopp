import { Sprite } from './sprite';
import { Player } from '../player/player';
import { WeaponInventory, WeaponType } from '../game/weapons';
import { Weapon } from '../game/weapon';
import { RocketProjectile } from './rocket-projectile';
import { BioProjectile } from './bio-projectile';
import { SoundManager, SoundType } from '../audio/sound';
import { MAP_WIDTH, MAP_HEIGHT, worldState } from './world';
import { positionCollides, ROCKET_RADIUS } from './collision';

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

export interface CombatContext {
  player: Player;
  inventory: WeaponInventory;
  weapon: Weapon;
  sprites: Sprite[];
  rockets: RocketProjectile[];
  bioProjectiles: BioProjectile[];
  soundManager: SoundManager;
  triggerDamageFlash: () => void;
  broadcastGunshot: () => void;
  triggerScreenShake: (intensity: number, duration: number) => void;
  setWallImpact: (x: number, y: number) => void;
  setHitMarker: () => void;
  // Visual-only damage flash (no sound) — used by rocket explosion which has
  // its own explosion SFX.
  flashCameraNoSound: () => void;
  // Berserk timer for damage multiplier
  berserkTimer: number;
}

/**
 * Applies damage to the player, absorbing through armor first.
 */
export function applyPlayerDamage(player: Player, rawDamage: number): void {
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rawDamage);
    player.armor -= absorbed;
    rawDamage -= absorbed;
  }
  if (rawDamage > 0) {
    player.health -= rawDamage;
  }
}

/**
 * Handelt einen Schuss: feuert Waffe, prüft Hit auf Gegner-Sprites.
 */
export function handlePlayerShoot(ctx: CombatContext): void {
  if (!ctx.inventory.fire()) return;

  const def = ctx.inventory.getCurrent();
  const berserkMult = ctx.berserkTimer > 0 ? 2 : 1;

  // Set per-weapon animation state on Weapon
  ctx.weapon.triggerFire(
    def.flashDuration,
    def.recoilY,
    def.recoilXSpread
  );

  // Fire sound per weapon
  if (def.type === WeaponType.ROCKET_LAUNCHER) {
    ctx.soundManager.play(SoundType.ROCKET_SHOOT);
  } else if (def.isMelee) {
    ctx.soundManager.play(SoundType.MELEE);
  } else {
    ctx.soundManager.play(SoundType.SHOOT);
  }

  // Screen Shake: kurz leicht wackeln beim Schuss
  ctx.triggerScreenShake(def.screenShake, 0.08);

  if (def.isProjectile) {
    // Rocket: spawn projectile
    const rocketSpeed = def.projectileSpeed || 12;
    const rocket = new RocketProjectile(
      ctx.player.x, ctx.player.y, 0.3,
      ctx.player.dirX, ctx.player.dirY,
      rocketSpeed, 4,
      def.explosionRadius ?? 1.5,
      (def.explosionDamage ?? 10) * berserkMult
    );
    ctx.rockets.push(rocket);
    ctx.broadcastGunshot();
    return;
  }

  // Hitscan weapons: raycast in player direction
  const hit = checkShotHit(ctx, def.isMelee ? (def.meleeRange ?? 1.3) : Infinity);
  if (hit) {
    hit.health -= def.damage * berserkMult;

    hit.hitFlashTimer = 0.12;

    ctx.triggerScreenShake(def.screenShake + 2, 0.12);

    ctx.setHitMarker();

    ctx.soundManager.play(SoundType.HIT);

    if (hit.health <= 0) {
      if (hit.angleViews.length > 0) {
        const px = ctx.player.x;
        const py = ctx.player.y;
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
      ctx.inventory.kills++;
      ctx.player.score += 100;

      ctx.soundManager.play(SoundType.ENEMY_DEATH);
    }
  } else {
    triggerWallImpact(ctx);
  }
  ctx.broadcastGunshot();
}

/**
 * Prüft ob ein Schuss (in Blickrichtung) einen Gegner-Sprite trifft.
 * Gibt den getroffenen Sprite zurück oder null.
 */
export function checkShotHit(ctx: CombatContext, maxRange: number = Infinity): Sprite | null {
  const px = ctx.player.x;
  const py = ctx.player.y;
  const dirX = ctx.player.dirX;
  const dirY = ctx.player.dirY;

  let closestSprite: Sprite | null = null;
  let closestDist = Infinity;

  for (const sprite of ctx.sprites) {
    if (!sprite.isEnemy) continue;
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
    if (offset < 0.4 && dist <= maxRange && dist < closestDist) {
      closestDist = dist;
      closestSprite = sprite;
    }
  }

  return closestSprite;
}

/**
 * Berechnet die screen-space Position des Wand-Einschlags (in Blickrichtung).
 */
function triggerWallImpact(ctx: CombatContext): void {
  // Ray in Blickrichtung casten um Wand-Trefferpunkt zu finden
  const rayDirX = ctx.player.dirX;
  const rayDirY = ctx.player.dirY;

  let mapX = Math.floor(ctx.player.x);
  let mapY = Math.floor(ctx.player.y);
  const deltaDistX = Math.abs(1 / rayDirX);
  const deltaDistY = Math.abs(1 / rayDirY);

  let sideDistX: number, sideDistY: number;
  if (rayDirX < 0) {
    sideDistX = (ctx.player.x - mapX) * deltaDistX;
  } else {
    sideDistX = (mapX + 1.0 - ctx.player.x) * deltaDistX;
  }
  if (rayDirY < 0) {
    sideDistY = (ctx.player.y - mapY) * deltaDistY;
  } else {
    sideDistY = (mapY + 1.0 - ctx.player.y) * deltaDistY;
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
    wallX = ctx.player.y + sideDistX * rayDirY;
  } else {
    wallX = ctx.player.x + sideDistY * rayDirX;
  }

  // Screen-space Position (Mitte des Bildschirms mit leichtem Offset basierend auf Trefferpunkt)
  const hitOffset = (wallX - Math.floor(wallX) - 0.5) * 100;
  const impactX = SCREEN_WIDTH / 2 + hitOffset + (Math.random() - 0.5) * 20;
  const impactY = SCREEN_HEIGHT / 2 + (Math.random() - 0.5) * 30;
  ctx.setWallImpact(impactX, impactY);
}

/**
 * Rocket-Update-Loop: bewegt aktive Raketen, prüft Ablauf/Wand- und Gegner-
 * Treffer und triggert Explosion + Kill-Buchhaltung.
 */
export function updateRockets(ctx: CombatContext, deltaTime: number): void {
  for (let i = ctx.rockets.length - 1; i >= 0; i--) {
    const r = ctx.rockets[i];
    r.update(deltaTime);
    if (r.isExpired() || positionCollides(r.x, r.y, ROCKET_RADIUS)) {
      const result = r.explode(ctx.sprites.filter(s => (s.isEnemy) && s.isAlive && !s.isDying && !s.isDead));
      ctx.triggerScreenShake(12, 0.2);
      ctx.flashCameraNoSound();
      ctx.soundManager.play(SoundType.ROCKET_EXPLOSION);
      ctx.rockets.splice(i, 1);
      for (let k = 0; k < result.killed; k++) {
        ctx.inventory.kills++;
        ctx.player.score += 100;
        ctx.soundManager.play(SoundType.ENEMY_DEATH);
      }
      continue;
    }
    // Check direct enemy hit
    for (const sprite of ctx.sprites) {
      if ((sprite.isEnemy) && sprite.isAlive && !sprite.isDying && !sprite.isDead) {
        if (r.checkHit(sprite)) {
          const result = r.explode(ctx.sprites.filter(s => (s.isEnemy) && s.isAlive && !s.isDying && !s.isDead));
          ctx.triggerScreenShake(12, 0.2);
          ctx.flashCameraNoSound();
          ctx.soundManager.play(SoundType.ROCKET_EXPLOSION);
          ctx.rockets.splice(i, 1);
          for (let k = 0; k < result.killed; k++) {
            ctx.inventory.kills++;
            ctx.player.score += 100;
            ctx.soundManager.play(SoundType.ENEMY_DEATH);
          }
          break;
        }
      }
    }
  }
}

/**
 * Bio-Projectile-Update-Loop: nur Position und Splat-Effekte updaten.
 * Boss-volley projectilies mit damage > 0 apply damage on player collision.
 */
export function updateBioProjectiles(ctx: CombatContext, deltaTime: number): void {
  const px = ctx.player.x;
  const py = ctx.player.y;

  for (let i = ctx.bioProjectiles.length - 1; i >= 0; i--) {
    const proj = ctx.bioProjectiles[i];

    // Boss-volley projectiles that can damage the player.
    if (proj.damage > 0 && !proj.hasDamaged && !proj.isSplatting) {
      const pdx = px - proj.x;
      const pdy = py - proj.y;
      const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pDist < 0.5) {
        applyPlayerDamage(ctx.player, proj.damage);
        ctx.triggerDamageFlash();
        proj.hasDamaged = true;
        proj.triggerSplat();
      }
    }

    if (proj.update(deltaTime)) {
      ctx.bioProjectiles.splice(i, 1);
    }
  }
}
