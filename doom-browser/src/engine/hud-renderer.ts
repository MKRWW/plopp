/**
 * HUD renderer module.
 * Extracted from renderer.ts to keep it manageable.
 * Uses free functions + explicit context object (no new classes).
 */
import { Player } from '../player/player';
import { WeaponInventory } from '../game/weapons';
import { Sprite, SpriteType } from './sprite';
import { EffectsState } from './effects';
import { LevelFlowState } from './level-flow';
import { worldState, MAP_WIDTH, MAP_HEIGHT, TILE } from './world';

/** Context object for HUD rendering */
export interface HUDContext {
  ctx: CanvasRenderingContext2D;
  player: Player;
  inventory: WeaponInventory;
  sprites: Sprite[];
  effectsState: EffectsState;
  hasYellowKeycard: boolean;
  hasBlueKeycard: boolean;
  keycardPickupMessage: number;
  doorMessage: string;
  doorMessageTimer: number;
  weaponFlashTimer: number;
  weaponFlashName: string;
  weaponFlashDuration: number;
  levelFlowState: LevelFlowState;
  berserkTimer: number;
  berserkDuration: number;
}

const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

/**
 * Renders the complete HUD: health, armor, ammo, score, kills,
 * sprint, pickup hints, keycard/door messages, stage, berserk, weapon flash.
 */
export function drawHUD(ctx: HUDContext): void {
  const c = ctx.ctx;
  const w = SCREEN_WIDTH;
  const h = SCREEN_HEIGHT;

  // --- Health Bar (bottom left) ---
  const healthBarX = 20;
  const healthBarY = h - 50;
  const healthBarW = 200;
  const healthBarH = 20;

  // Background
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(healthBarX - 2, healthBarY - 2, healthBarW + 4, healthBarH + 4);

  // Empty Bar
  c.fillStyle = '#400';
  c.fillRect(healthBarX, healthBarY, healthBarW, healthBarH);

  // Fill level
  const healthPct = ctx.player.health / ctx.player.maxHealth;
  const healthColor = healthPct > 0.5 ? '#0c0' : (healthPct > 0.25 ? '#cc0' : '#c00');
  c.fillStyle = healthColor;
  c.fillRect(healthBarX, healthBarY, healthBarW * healthPct, healthBarH);

  // Health Text
  c.fillStyle = '#fff';
  c.font = 'bold 14px monospace';
  c.textAlign = 'left';
  c.fillText(`HP ${ctx.player.health}`, healthBarX + 5, healthBarY + 15);

  // --- Armor Bar (below health bar) ---
  if (ctx.player.armor > 0) {
    const armorBarX = 20;
    const armorBarY = h - 28;
    const armorBarW = 200;
    const armorBarH = 12;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(armorBarX - 2, armorBarY - 2, armorBarW + 4, armorBarH + 4);
    c.fillStyle = '#033';
    c.fillRect(armorBarX, armorBarY, armorBarW, armorBarH);
    const armorPct = ctx.player.armor / 100;
    c.fillStyle = '#0cc';
    c.fillRect(armorBarX, armorBarY, armorBarW * armorPct, armorBarH);
    c.fillStyle = '#fff';
    c.font = 'bold 10px monospace';
    c.textAlign = 'left';
    c.fillText(`ARMOR ${ctx.player.armor}`, armorBarX + 5, armorBarY + 10);
  }

  // --- Weapon Name + Ammo (bottom right) ---
  const def = ctx.inventory.getCurrent();
  const ammo = ctx.inventory.getCurrentAmmo();
  const ammoStr = isFinite(ammo) ? String(ammo) : '∞';
  c.textAlign = 'right';
  c.font = 'bold 18px monospace';
  c.fillStyle = '#ff0';
  c.fillText(`${def.name} — ${ammoStr}`, w - 20, h - 30);

  // --- Score (top right) ---
  c.textAlign = 'right';
  c.font = 'bold 16px monospace';
  c.fillStyle = '#fff';
  c.fillText(`SCORE: ${ctx.player.score}`, w - 20, 25);

  // --- Kills (top right, below Score) ---
  c.font = '14px monospace';
  c.fillStyle = '#f88';
  c.fillText(`KILLS: ${ctx.inventory.kills}`, w - 20, 45);

  // --- Sprint Indicator ---
  if (ctx.effectsState.isSprinting) {
    c.textAlign = 'center';
    c.font = 'bold 16px monospace';
    c.fillStyle = '#ff0';
    c.fillText('⚡ SPRINT', w / 2, h - 60);
  }

  // --- Item Pickup Hint (only for collectable Items) ---
  const pickupRadius = 0.5;
  for (const sprite of ctx.sprites) {
    if (!sprite.isCollectable) continue;
    const dx = sprite.x - ctx.player.x;
    const dy = sprite.y - ctx.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < pickupRadius) {
      c.textAlign = 'center';
      c.font = 'bold 18px monospace';
      if (sprite.type === SpriteType.KEYCARD) {
        c.fillStyle = '#5af';
        c.fillText('[E] KEYCARD einsammeln', w / 2, 60);
      } else if (sprite.type === SpriteType.ARMOR) {
        c.fillStyle = '#0cc';
        c.fillText('[E] ARMOR einsammeln', w / 2, 60);
      } else if (sprite.type === SpriteType.BERSERK) {
        c.fillStyle = '#f44';
        c.fillText('[E] BERSERK einsammeln', w / 2, 60);
      } else {
        c.fillStyle = sprite.type === SpriteType.AMMO ? '#ff0' : '#0f0';
        const itemName = sprite.type === SpriteType.AMMO ? 'AMMO' : 'HEALTH';
        c.fillText(`[E] ${itemName} einsammeln`, w / 2, 60);
      }
      break;
    }
  }

  // --- Keycard Pickup Message (brief display) ---
  if (ctx.keycardPickupMessage > 0) {
    const alpha = Math.min(1, ctx.keycardPickupMessage / 0.5);
    c.textAlign = 'center';
    c.font = 'bold 24px monospace';
    c.fillStyle = `rgba(90, 184, 255, ${alpha})`;
    c.shadowColor = '#5af';
    c.shadowBlur = 10;
    c.fillText('KEYCARD GEFUNDEN!', w / 2, h / 2 - 40);
    c.shadowBlur = 0;
  }

  // --- Keycard Indicator (top left) ---
  if (ctx.hasYellowKeycard) {
    c.textAlign = 'left';
    c.font = 'bold 14px monospace';
    c.fillStyle = '#5af';
    c.fillText('CARD', 20, 25);
  }

  // --- Door Message (center top) ---
  if (ctx.doorMessageTimer > 0) {
    const alpha = Math.min(1, ctx.doorMessageTimer / 0.5);
    c.textAlign = 'center';
    c.font = 'bold 20px monospace';
    let msgColor = '#ff0';
    if (ctx.doorMessage.includes('LOCKED')) msgColor = '#f44';
    else if (ctx.doorMessage.includes('SECRET')) msgColor = '#0f0';
    else if (ctx.doorMessage.includes('OPENING')) msgColor = '#5af';
    c.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    c.shadowColor = msgColor;
    c.shadowBlur = 8;
    c.fillText(ctx.doorMessage, w / 2, 80);
    c.shadowBlur = 0;
  }

  // --- Exit Door proximity check ---
  const px = Math.floor(ctx.player.x);
  const py = Math.floor(ctx.player.y);
  let nearExit = false;
  let hasKeycards = ctx.hasYellowKeycard && ctx.hasBlueKeycard;
  for (let dy = -2; dy <= 2 && !nearExit; dy++) {
    for (let dx = -2; dx <= 2 && !nearExit; dx++) {
      const tx = px + dx, ty = py + dy;
      if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) continue;
      const tile = worldState.getTile(tx, ty);
      if (tile === TILE.EXIT_DOOR) {
        const tcx = tx + 0.5, tcy = ty + 0.5;
        const ddx = tcx - ctx.player.x, ddy = tcy - ctx.player.y;
        if (Math.sqrt(ddx * ddx + ddy * ddy) < 1.5) {
          nearExit = true;
        }
      }
    }
  }
  if (nearExit) {
    c.textAlign = 'center';
    c.font = 'bold 20px monospace';
    if (hasKeycards) {
      c.fillStyle = '#0f0';
      c.shadowColor = '#0f0';
      c.shadowBlur = 8;
      c.fillText(`EXIT — [E] to Stage ${ctx.levelFlowState.stage + 1}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90);
      c.shadowBlur = 0;
    } else {
      c.fillStyle = '#f44';
      c.fillText('KEYCARD REQUIRED', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90);
    }
  }

  // --- Weapon Switch Flash (centered) ---
  if (ctx.weaponFlashTimer > 0) {
    const alpha = ctx.weaponFlashTimer / ctx.weaponFlashDuration;
    c.save();
    c.textAlign = 'center';
    c.font = 'bold 32px monospace';
    c.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    c.shadowColor = '#fff';
    c.shadowBlur = 10;
    c.fillText(ctx.weaponFlashName, w / 2, h / 2);
    c.restore();
  }

  // --- Stage Display (top center, small) ---
  c.textAlign = 'center';
  c.font = 'bold 14px monospace';
  c.fillStyle = '#aaa';
  c.fillText(`STAGE ${ctx.levelFlowState.stage}`, w / 2, 22);

  // --- Stage Transition Banner ---
  if (ctx.levelFlowState.stageBannerTimer > 0) {
    const alpha = Math.min(1, ctx.levelFlowState.stageBannerTimer / 0.7);
    c.textAlign = 'center';
    c.font = 'bold 36px monospace';
    c.fillStyle = `rgba(255, 220, 80, ${alpha})`;
    c.shadowColor = '#fc0';
    c.shadowBlur = 14;
    c.fillText(`STAGE ${ctx.levelFlowState.stage}`, w / 2, h / 2 - 60);
    c.shadowBlur = 0;
  }

  // --- Berserk active overlay ---
  if (ctx.berserkTimer > 0) {
    // Red border glow
    const alpha = Math.min(0.4, ctx.berserkTimer / ctx.berserkDuration * 0.4);
    c.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
    c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
    c.lineWidth = 1;

    // Countdown text (top center)
    c.textAlign = 'center';
    c.font = 'bold 22px monospace';
    c.fillStyle = `rgba(255, 60, 60, ${0.7 + 0.3 * Math.sin(performance.now() / 150)})`;
    c.shadowColor = '#f00';
    c.shadowBlur = 12;
    c.fillText(`BERSERK ${ctx.berserkTimer.toFixed(1)}`, w / 2, 25);
    c.shadowBlur = 0;
  }

  c.textAlign = 'left';
}
