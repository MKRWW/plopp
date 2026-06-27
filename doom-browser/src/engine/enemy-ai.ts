import {
  Sprite,
  EnemyAIState,
  EnemyClass,
  BossPhase,
  AI_IDLE_PATROL_RADIUS,
  AI_AWARENESS_RADIUS,
  AI_GUNSHOT_RADIUS,
  AI_ALERT_TO_CHASE_DELAY,
  AI_CHASE_TO_ALERT_DELAY,
  AI_SHOOTER_MOVE_SPEED,
  LatcherState,
  AI_LATCHER_MOVE_SPEED,
  AI_LATCHER_LEAP_RANGE,
  AI_LATCHER_LEAP_MIN_DIST,
  AI_LATCHER_WINDUP_DURATION,
  AI_LATCHER_LEAP_DURATION,
  AI_LATCHER_LEAP_COOLDOWN,
  AI_LATCHER_DAMAGE,
  AI_LATCHER_CONTACT_RADIUS,
  AI_BOSS_SPEED,
  AI_BOSS_HP,
  AI_BOSS_ATTACK_RANGE,
  AI_BOSS_ATTACK_DAMAGE,
  AI_BOSS_ATTACK_COOLDOWN,
  BOSS_VOLLEY_COOLDOWN,
  BOSS_VOLLEY_FAN_DEG,
  BOSS_VOLLEY_DAMAGE,
  BOSS_VOLLEY_PROJECTILE_SPEED,
  BOSS_VOLLEY_PROJECTILE_LIFE,
  BOSS_RAGE_SPEED_MULTIPLIER,
  BOSS_RAGE_DAMAGE_MULTIPLIER,
} from './sprite';
import { Player } from '../player/player';
import { BioProjectile } from './bio-projectile';
import { SoundManager, SoundType } from '../audio/sound';
import { applyPlayerDamage } from './combat';
import {
  hasLineOfSight,
  slideAlongX,
  slideAlongY,
  resolveAllEntityOverlaps,
  resolveEntityCollision,
  wouldOverlapEntity,
  ENEMY_RADIUS,
  PLAYER_RADIUS,
  MIN_ENTITY_DIST,
} from './collision';

export interface AIContext {
  player: Player;
  sprites: Sprite[];
  bioProjectiles: BioProjectile[];
  soundManager: SoundManager;
  triggerDamageFlash: () => void;
}

function enemyIdleSoundType(sprite: Sprite): SoundType {
  if (sprite.enemyClass === EnemyClass.SHOOTER) return SoundType.SPITTER_IDLE;
  if (sprite.enemyClass === EnemyClass.LATCHER) return SoundType.LATCHER_IDLE;
  return SoundType.HUSK_IDLE;
}

function enemyAlertSoundType(sprite: Sprite): SoundType {
  if (sprite.enemyClass === EnemyClass.SHOOTER) return SoundType.SPITTER_ALERT;
  if (sprite.enemyClass === EnemyClass.LATCHER) return SoundType.LATCHER_ALERT;
  return SoundType.HUSK_ALERT;
}

const attackRange = MIN_ENTITY_DIST;
const chaseSpeed = 1.5;
const attackDamage = 15;
const attackCooldown = 1.0;

export function updateEnemyAI(ctx: AIContext, deltaTime: number): void {
  const px = ctx.player.x;
  const py = ctx.player.y;

  const aliveEnemies = ctx.sprites.filter(
    s => (s.isEnemy) && s.isAlive && !s.isDying && !s.isDead
  );

  for (const sprite of aliveEnemies) {
    const dx = px - sprite.x;
    const dy = py - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angleToPlayer = Math.atan2(dy, dx);

    switch (sprite.aiState) {
      case EnemyAIState.IDLE: {
        sprite.idleWanderTimer -= deltaTime;
        if (sprite.idleWanderTimer <= 0) {
          const wanderAngle = Math.random() * Math.PI * 2;
          const wanderDist = Math.random() * AI_IDLE_PATROL_RADIUS;
          sprite.idleWanderTargetX = sprite.spawnX + Math.cos(wanderAngle) * wanderDist;
          sprite.idleWanderTargetY = sprite.spawnY + Math.sin(wanderAngle) * wanderDist;
          sprite.idleWanderTimer = 1 + Math.random() * 2;
        }

        const toTargetX = sprite.idleWanderTargetX - sprite.x;
        const toTargetY = sprite.idleWanderTargetY - sprite.y;
        const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

        if (toTargetDist > 0.2) {
          const patrolX = (toTargetX / toTargetDist) * chaseSpeed * 0.3 * deltaTime;
          const patrolY = (toTargetY / toTargetDist) * chaseSpeed * 0.3 * deltaTime;
          sprite.x = slideAlongX(sprite.x, patrolX, sprite.y, ENEMY_RADIUS);
          sprite.y = slideAlongY(sprite.y, patrolY, sprite.x, ENEMY_RADIUS);
          sprite.facingAngle = Math.atan2(toTargetY, toTargetX);
        }

        // Per-class idle voice: chirp at random cadence so distant enemies
        // make the level feel alive without spamming the audio bed.
        sprite.idleSoundCooldown -= deltaTime;
        if (sprite.idleSoundCooldown <= 0) {
          ctx.soundManager.playAt(enemyIdleSoundType(sprite), dist);
          sprite.idleSoundCooldown = (Math.random() * 4) + 4;
        }

        if (dist <= AI_AWARENESS_RADIUS && hasLineOfSight(sprite.x, sprite.y, px, py)) {
          sprite.aiState = EnemyAIState.ALERT;
          sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
          sprite.facingAngle = angleToPlayer;
          ctx.soundManager.playAt(enemyAlertSoundType(sprite), dist);
        }
        break;
      }

      case EnemyAIState.ALERT: {
        sprite.facingAngle = angleToPlayer;

        if (sprite.alertFadeoutTimer > 0) {
          sprite.alertFadeoutTimer -= deltaTime;
          if (sprite.alertFadeoutTimer <= 0) {
            sprite.aiState = EnemyAIState.IDLE;
            sprite.alertFadeoutTimer = 0;
            sprite.alertTimer = 0;
            break;
          }
          if (dist <= AI_AWARENESS_RADIUS && hasLineOfSight(sprite.x, sprite.y, px, py)) {
            sprite.aiState = EnemyAIState.CHASE;
            sprite.alertFadeoutTimer = 0;
            sprite.alertTimer = 0;
            ctx.soundManager.playAt(enemyAlertSoundType(sprite), dist);
            break;
          }
          break;
        }

        if (dist > AI_AWARENESS_RADIUS || !hasLineOfSight(sprite.x, sprite.y, px, py)) {
          sprite.alertTimer -= deltaTime;
        }

        if (sprite.alertTimer <= 0) {
          sprite.aiState = EnemyAIState.IDLE;
          sprite.alertTimer = 0;
        } else if (dist <= AI_AWARENESS_RADIUS && hasLineOfSight(sprite.x, sprite.y, px, py)) {
          sprite.aiState = EnemyAIState.CHASE;
          sprite.alertTimer = 0;
          ctx.soundManager.playAt(enemyAlertSoundType(sprite), dist);
        }
        break;
      }

      case EnemyAIState.CHASE: {
        if (dist > AI_AWARENESS_RADIUS && !hasLineOfSight(sprite.x, sprite.y, px, py)) {
          sprite.aiState = EnemyAIState.ALERT;
          sprite.alertFadeoutTimer = AI_CHASE_TO_ALERT_DELAY;
          sprite.alertTimer = 0;
          sprite.facingAngle = angleToPlayer;
          break;
        }

        sprite.facingAngle = angleToPlayer;

        if (sprite.enemyClass === EnemyClass.SHOOTER) {
          handleShooterChase(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime);
        } else if (sprite.enemyClass === EnemyClass.LATCHER) {
          handleLatcherChase(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime);
        } else if (sprite.enemyClass === EnemyClass.BOSS) {
          handleBossChase(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime);
        } else {
          handleGruntChase(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime);
        }
        break;
      }
    }
  }

  // --- Penetration resolution pass ---
  const entities: Array<{ x: number, y: number, radius: number, weight: number }> = [
    { x: px, y: py, radius: PLAYER_RADIUS, weight: 0.7 },
    ...aliveEnemies.map(s => ({ x: s.x, y: s.y, radius: ENEMY_RADIUS, weight: 0.3 }))
  ];
  resolveAllEntityOverlaps(entities);

  ctx.player.x = entities[0].x;
  ctx.player.y = entities[0].y;
  for (let i = 0; i < aliveEnemies.length; i++) {
    aliveEnemies[i].x = entities[i + 1].x;
    aliveEnemies[i].y = entities[i + 1].y;
  }
}

function handleGruntChase(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  aliveEnemies: Sprite[],
  deltaTime: number
): void {
  if (dist < attackRange) {
    if (!sprite.attackTimer) sprite.attackTimer = 0;
    sprite.attackTimer += deltaTime;
    if (sprite.attackTimer >= attackCooldown) {
      sprite.attackTimer = 0;
      applyPlayerDamage(ctx.player, attackDamage);
      ctx.triggerDamageFlash();
    }
  } else {
    const moveX = (dx / dist) * chaseSpeed * deltaTime;
    const moveY = (dy / dist) * chaseSpeed * deltaTime;
    let newX = slideAlongX(sprite.x, moveX, sprite.y, ENEMY_RADIUS);
    let newY = slideAlongY(sprite.y, moveY, newX, ENEMY_RADIUS);
    if (wouldOverlapEntity(newX, newY, ENEMY_RADIUS,
      [{ x: px, y: py, radius: PLAYER_RADIUS }])) {
      const push = resolveEntityCollision(newX, newY, ENEMY_RADIUS, px, py, PLAYER_RADIUS);
      newX += push.dx;
      newY += push.dy;
    }
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

/**
 * Boss chase: three-phase state machine driven by HP thresholds.
 *
 * Phase transitions (one-shot, latched):
 *  - MELEE  → VOLLEY when hpPct <= 0.5 (50% HP)
 *  - VOLLEY → RAGE   when hpPct <= 0.2 (20% HP)
 *
 * MELEE: Husk-style melee chase (base speed, damage, cooldown).
 * VOLLEY: Stationary, fires 3-projectile fans every BOSS_VOLLEY_COOLDOWN.
 * RAGE:   Like MELEE but with 2× speed and 1.25× damage.
 */
function handleBossChase(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  aliveEnemies: Sprite[],
  deltaTime: number
): void {
  const hpPct = sprite.health / AI_BOSS_HP;

  // --- One-shot phase transitions ---
  if (hpPct <= 0.2 && !sprite.bossRageActivated) {
    sprite.bossPhase = BossPhase.RAGE;
    sprite.bossRageActivated = true;
  } else if (hpPct <= 0.5 && sprite.bossPhase === BossPhase.MELEE) {
    sprite.bossPhase = BossPhase.VOLLEY;
    sprite.bossVolleyTimer = BOSS_VOLLEY_COOLDOWN;
  }

  // --- Phase-specific behaviour ---
  switch (sprite.bossPhase) {
    case BossPhase.MELEE: {
      handleBossMelee(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime,
        AI_BOSS_SPEED, AI_BOSS_ATTACK_DAMAGE);
      break;
    }

    case BossPhase.VOLLEY: {
      handleBossVolley(ctx, sprite, px, py, dist, dx, dy, deltaTime);
      break;
    }

    case BossPhase.RAGE: {
      handleBossMelee(ctx, sprite, px, py, dist, dx, dy, aliveEnemies, deltaTime,
        AI_BOSS_SPEED * BOSS_RAGE_SPEED_MULTIPLIER,
        AI_BOSS_ATTACK_DAMAGE * BOSS_RAGE_DAMAGE_MULTIPLIER);
      break;
    }
  }
}

/**
 * Boss melee behaviour (used by both MELEE and RAGE phases).
 * Husk-style chase with configurable speed and damage.
 */
function handleBossMelee(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  aliveEnemies: Sprite[],
  deltaTime: number,
  speed: number,
  damage: number
): void {
  if (dist < AI_BOSS_ATTACK_RANGE) {
    if (!sprite.attackTimer) sprite.attackTimer = 0;
    sprite.attackTimer += deltaTime;
    if (sprite.attackTimer >= AI_BOSS_ATTACK_COOLDOWN) {
      sprite.attackTimer = 0;
      applyPlayerDamage(ctx.player, damage);
      ctx.triggerDamageFlash();
    }
  } else {
    const moveX = (dx / dist) * speed * deltaTime;
    const moveY = (dy / dist) * speed * deltaTime;
    let newX = slideAlongX(sprite.x, moveX, sprite.y, ENEMY_RADIUS);
    let newY = slideAlongY(sprite.y, moveY, newX, ENEMY_RADIUS);
    if (wouldOverlapEntity(newX, newY, ENEMY_RADIUS,
      [{ x: px, y: py, radius: PLAYER_RADIUS }])) {
      const push = resolveEntityCollision(newX, newY, ENEMY_RADIUS, px, py, PLAYER_RADIUS);
      newX += push.dx;
      newY += push.dy;
    }
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

/**
 * Boss volley behaviour: stationary, fires 3-projectile fans toward player.
 * Damage is applied in updateBioProjectiles (combat.ts) via proj.damage > 0.
 */
function handleBossVolley(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  deltaTime: number
): void {
  // Boss stays stationary while volleying (no movement).

  // Muzzle flash on the boss to give a visual cue of firing.
  if (!sprite.muzzleFlashTimer) sprite.muzzleFlashTimer = 0;

  sprite.bossVolleyTimer -= deltaTime;
  if (sprite.bossVolleyTimer <= 0) {
    sprite.bossVolleyTimer = BOSS_VOLLEY_COOLDOWN;
    sprite.muzzleFlashTimer = 0.2;

    // Fire a 3-projectile fan toward the player.
    const baseAngle = Math.atan2(dy, dx);
    const fanRad = BOSS_VOLLEY_FAN_DEG * (Math.PI / 180);

    for (let i = -1; i <= 1; i++) {
      const angle = baseAngle + (fanRad / 2) * i;
      const emitX = sprite.x + Math.cos(angle) * 0.4;
      const emitY = sprite.y + Math.sin(angle) * 0.4;
      ctx.bioProjectiles.push(new BioProjectile(
        emitX, emitY,
        Math.cos(angle), Math.sin(angle),
        BOSS_VOLLEY_PROJECTILE_SPEED,
        BOSS_VOLLEY_PROJECTILE_LIFE,
        BOSS_VOLLEY_DAMAGE
      ));
    }
  }

  if (sprite.muzzleFlashTimer > 0) {
    sprite.muzzleFlashTimer -= deltaTime;
  }
}

function handleShooterChase(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  aliveEnemies: Sprite[],
  deltaTime: number
): void {
  const hasLOS = hasLineOfSight(sprite.x, sprite.y, px, py);
  const speed = AI_SHOOTER_MOVE_SPEED;

  if (dist < sprite.shooterMinDist) {
    // Too close — back away
    const awayX = -(dx / dist) * speed * deltaTime;
    const awayY = -(dy / dist) * speed * deltaTime;
    let newX = slideAlongX(sprite.x, awayX, sprite.y, ENEMY_RADIUS);
    let newY = slideAlongY(sprite.y, awayY, newX, ENEMY_RADIUS);
    applyEntityAvoidance(newX, newY, sprite, px, py, aliveEnemies);
  } else if (dist > sprite.shooterRange) {
    // Too far — close in
    const moveX = (dx / dist) * speed * deltaTime;
    const moveY = (dy / dist) * speed * deltaTime;
    let newX = slideAlongX(sprite.x, moveX, sprite.y, ENEMY_RADIUS);
    let newY = slideAlongY(sprite.y, moveY, newX, ENEMY_RADIUS);
    applyEntityAvoidance(newX, newY, sprite, px, py, aliveEnemies);
  } else if (hasLOS) {
    // In optimal range with LOS — shoot
    if (!sprite.attackTimer) sprite.attackTimer = 0;
    sprite.attackTimer += deltaTime;
    if (sprite.attackTimer >= sprite.shooterCooldown) {
      sprite.attackTimer = 0;
      applyPlayerDamage(ctx.player, sprite.shooterDamage);
      ctx.triggerDamageFlash();
      sprite.muzzleFlashTimer = 0.2;
      broadcastGunshot(ctx);

      // Visual-only bio projectile from the emitter toward player.
      // Spawned slightly in front of the Spitter so it doesn't pop out of
      // the body silhouette. Lifetime covers the full shooter range plus
      // a small buffer; positionCollides() ends it early on wall impact.
      const ndx = dx / dist;
      const ndy = dy / dist;
      const emitX = sprite.x + ndx * 0.25;
      const emitY = sprite.y + ndy * 0.25;
      const projSpeed = 18;
      const projLife = sprite.shooterRange / projSpeed + 0.05;
      ctx.bioProjectiles.push(new BioProjectile(emitX, emitY, ndx, ndy, projSpeed, projLife));
    }
  }
  // No LOS in range — stay put, don't move

  if (sprite.muzzleFlashTimer > 0) {
    sprite.muzzleFlashTimer -= deltaTime;
  }
}

/**
 * Latcher AI: small parasite that approaches at high speed, freezes for
 * a brief wind-up tell, then leaps in a parabolic arc toward the player's
 * position at the start of the leap. Touch damage on contact during the
 * leap, then a recovery cooldown before it can wind up again.
 */
function handleLatcherChase(
  ctx: AIContext,
  sprite: Sprite,
  px: number, py: number,
  dist: number, dx: number, dy: number,
  aliveEnemies: Sprite[],
  deltaTime: number
): void {
  sprite.latcherStateTimer += deltaTime;

  switch (sprite.latcherState) {
    case LatcherState.APPROACH: {
      // Close in toward the player at walking speed.
      if (dist <= AI_LATCHER_LEAP_RANGE && dist > AI_LATCHER_LEAP_MIN_DIST &&
          hasLineOfSight(sprite.x, sprite.y, px, py)) {
        // In leap range — switch to wind-up.
        sprite.latcherState = LatcherState.WINDUP;
        sprite.latcherStateTimer = 0;
        sprite.currentFrame = 1; // 'walk' pose maps to windup
        if (sprite.textures.length > 1) sprite.texture = sprite.textures[1];
        break;
      }

      const speed = AI_LATCHER_MOVE_SPEED;
      const moveX = (dx / dist) * speed * deltaTime;
      const moveY = (dy / dist) * speed * deltaTime;
      const newX = slideAlongX(sprite.x, moveX, sprite.y, ENEMY_RADIUS);
      const newY = slideAlongY(sprite.y, moveY, newX, ENEMY_RADIUS);
      applyEntityAvoidance(newX, newY, sprite, px, py, aliveEnemies);
      sprite.currentFrame = 0;
      if (sprite.textures.length > 0) sprite.texture = sprite.textures[0];

      // Bite if we're already touching.
      if (dist < AI_LATCHER_CONTACT_RADIUS && !sprite.attackTimer) {
        applyPlayerDamage(ctx.player, AI_LATCHER_DAMAGE);
        ctx.triggerDamageFlash();
        sprite.attackTimer = AI_LATCHER_LEAP_COOLDOWN;
      }
      if (sprite.attackTimer > 0) sprite.attackTimer -= deltaTime;
      break;
    }

    case LatcherState.WINDUP: {
      // Freeze and crouch. After WINDUP_DURATION, snapshot player position
      // and launch into the leap arc.
      sprite.currentFrame = 1;
      if (sprite.textures.length > 1) sprite.texture = sprite.textures[1];
      if (sprite.latcherStateTimer >= AI_LATCHER_WINDUP_DURATION) {
        sprite.latcherState = LatcherState.LEAP;
        sprite.latcherStateTimer = 0;
        sprite.leapStartX = sprite.x;
        sprite.leapStartY = sprite.y;
        sprite.leapTargetX = px;
        sprite.leapTargetY = py;
        sprite.leapProgress = 0;
        sprite.currentFrame = 2; // 'attack' pose = leap
        if (sprite.textures.length > 2) sprite.texture = sprite.textures[2];
      }
      break;
    }

    case LatcherState.LEAP: {
      // Move along the line from leapStart to leapTarget. Vertical Z-arc is
      // computed at render time via leapProgress.
      sprite.leapProgress = Math.min(1, sprite.latcherStateTimer / AI_LATCHER_LEAP_DURATION);
      const t = sprite.leapProgress;
      sprite.x = sprite.leapStartX + (sprite.leapTargetX - sprite.leapStartX) * t;
      sprite.y = sprite.leapStartY + (sprite.leapTargetY - sprite.leapStartY) * t;

      // Bite check during flight.
      const ldx = px - sprite.x;
      const ldy = py - sprite.y;
      const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
      if (ldist < AI_LATCHER_CONTACT_RADIUS) {
        applyPlayerDamage(ctx.player, AI_LATCHER_DAMAGE);
        ctx.triggerDamageFlash();
        sprite.latcherState = LatcherState.RECOVER;
        sprite.latcherStateTimer = 0;
        sprite.leapProgress = 0;
        break;
      }

      if (sprite.leapProgress >= 1) {
        // Landed without hitting — recover.
        sprite.latcherState = LatcherState.RECOVER;
        sprite.latcherStateTimer = 0;
        sprite.leapProgress = 0;
      }
      break;
    }

    case LatcherState.RECOVER: {
      // Brief stunned recovery, then resume approach.
      sprite.currentFrame = 0;
      if (sprite.textures.length > 0) sprite.texture = sprite.textures[0];
      if (sprite.latcherStateTimer >= AI_LATCHER_LEAP_COOLDOWN) {
        sprite.latcherState = LatcherState.APPROACH;
        sprite.latcherStateTimer = 0;
      }
      break;
    }
  }
}

function applyEntityAvoidance(
  newX: number,
  newY: number,
  sprite: Sprite,
  px: number,
  py: number,
  aliveEnemies: Sprite[]
): void {
  let mx = newX, my = newY;
  if (wouldOverlapEntity(mx, my, ENEMY_RADIUS,
    [{ x: px, y: py, radius: PLAYER_RADIUS }])) {
    const push = resolveEntityCollision(mx, my, ENEMY_RADIUS, px, py, PLAYER_RADIUS);
    mx += push.dx;
    my += push.dy;
  }
  for (const other of aliveEnemies) {
    if (other === sprite) continue;
    if (wouldOverlapEntity(mx, my, ENEMY_RADIUS,
      [{ x: other.x, y: other.y, radius: ENEMY_RADIUS }])) {
      const push = resolveEntityCollision(mx, my, ENEMY_RADIUS,
        other.x, other.y, ENEMY_RADIUS);
      mx += push.dx;
      my += push.dy;
    }
  }
  sprite.x = mx;
  sprite.y = my;
}

/**
 * Informs all alive enemies that a gunshot occurred at the player's position.
 * Enemies within AI_GUNSHOT_RADIUS transition to (or stay in) ALERT state with
 * their alert timer reset.
 */
export function broadcastGunshot(ctx: AIContext): void {
  const px = ctx.player.x;
  const py = ctx.player.y;

  for (const sprite of ctx.sprites) {
    if (!sprite.isEnemy) continue;
    if (!sprite.isAlive || sprite.isDying || sprite.isDead) continue;

    const dx = px - sprite.x;
    const dy = py - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > AI_GUNSHOT_RADIUS) continue;

    const angleToPlayer = Math.atan2(dy, dx);

    if (sprite.aiState === EnemyAIState.IDLE) {
      sprite.aiState = EnemyAIState.ALERT;
      sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
      sprite.facingAngle = angleToPlayer;
      sprite.heardGunshotTime = performance.now() / 1000;
      ctx.soundManager.playAt(enemyAlertSoundType(sprite), dist);
    } else if (sprite.aiState === EnemyAIState.ALERT) {
      sprite.alertTimer = AI_ALERT_TO_CHASE_DELAY;
      sprite.facingAngle = angleToPlayer;
      sprite.heardGunshotTime = performance.now() / 1000;
    } else if (sprite.aiState === EnemyAIState.CHASE) {
      sprite.heardGunshotTime = performance.now() / 1000;
    }
  }
}
