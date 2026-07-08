import { Texture } from '../textures';
import { SpriteType } from '../sprite';
import { EnemyPose, buildRotatingItemFrames } from './shared';
import { generateHuskTexture, buildHuskAngleViews } from './husk-textures';
import { generateSpitterTexture, buildSpitterAngleViews } from './spitter-textures';
import { generateLatcherTexture, buildLatcherAngleViews } from './latcher-textures';
import { generateBossTexture, buildBossAngleViews } from './boss-textures';
import {
  generateAmmoFront, generateAmmoBack,
  generateHealthFront, generateHealthBack,
  generateKeycardFront, generateKeycardBack,
  generateYellowKeycardFront, generateYellowKeycardBack,
  generateShotgunFront, generateShotgunBack,
  generateRocketLauncherFront, generateRocketLauncherBack,
  generateArmorFront, generateArmorBack,
  generateBerserkFront, generateBerserkBack,
  generateBarrelTexture, generateTerminalTexture, generateLampTexture, generateDebrisTexture
} from './item-textures';

// Re-exports for public API compatibility
export { huskCorpseTexture, generateHuskCorpseTexture } from './husk-textures';
export { spitterCorpseTexture, generateSpitterCorpseTexture } from './spitter-textures';
export { bossCorpseTexture } from './boss-textures';

export interface SpriteTextureSet {
  flat: Map<SpriteType, Texture[]>;
  /** Latcher (small parasite) 8-direction views per pose. The Latcher is
   *  roughly radially symmetric so all 8 angle slots share one texture per
   *  pose, but the field still indexes the same way other enemies do. */
  latcherAngleViews: Texture[][];
  huskAngleViews: Texture[][];
  spitterAngleViews: Texture[][];
  bossAngleViews: Texture[][];
}

export function generateSpriteTextures(): SpriteTextureSet {
  const flat = new Map<SpriteType, Texture[]>();

  // Husk (Grunt): legacy frontal frames as fallback (idle/walk/attack)
  flat.set(SpriteType.ENEMY, [
    generateHuskTexture('idle', 'front', false),
    generateHuskTexture('walk', 'front', false),
    generateHuskTexture('attack', 'front', false)
  ]);

  // Spitter (Shooter): frontal frames as fallback (idle/walk/attack)
  flat.set(SpriteType.SHOOTER, [
    generateSpitterTexture('idle', 'front', false),
    generateSpitterTexture('walk', 'front', false),
    generateSpitterTexture('attack', 'front', false)
  ]);

  // Latcher: 3 frontal frames mapped to (idle / windup / leap). The Latcher
  // is small and radially symmetric, so we reuse the same texture for all
  // 8 angle slots rather than authoring per-direction art.
  flat.set(SpriteType.LATCHER, [
    generateLatcherTexture('idle'),
    generateLatcherTexture('walk'),
    generateLatcherTexture('attack')
  ]);

  // 8-direction angle views per pose for all enemy types
  const poses: EnemyPose[] = ['idle', 'walk', 'attack'];
  const huskAngleViews: Texture[][] = poses.map(pose => buildHuskAngleViews(pose));
  const spitterAngleViews: Texture[][] = poses.map(pose => buildSpitterAngleViews(pose));
  const latcherAngleViews: Texture[][] = poses.map(pose => buildLatcherAngleViews(pose));
  const bossAngleViews: Texture[][] = poses.map(pose => buildBossAngleViews(pose));

  // Boss: single frontal frame as fallback
  flat.set(SpriteType.BOSS, [
    generateBossTexture('idle', 'front', false),
    generateBossTexture('walk', 'front', false),
    generateBossTexture('attack', 'front', false)
  ]);

  // Rotating items: 8 frames each
  flat.set(SpriteType.AMMO, buildRotatingItemFrames(generateAmmoFront, generateAmmoBack));
  flat.set(SpriteType.HEALTH, buildRotatingItemFrames(generateHealthFront, generateHealthBack));
  flat.set(SpriteType.KEYCARD, buildRotatingItemFrames(generateKeycardFront, generateKeycardBack));
  flat.set(SpriteType.YELLOW_KEYCARD, buildRotatingItemFrames(generateYellowKeycardFront, generateYellowKeycardBack));

   // Weapon pickups: 8-frame rotating sprites
   flat.set(SpriteType.WEAPON_SHOTGUN, buildRotatingItemFrames(generateShotgunFront, generateShotgunBack));
   flat.set(SpriteType.WEAPON_ROCKETLAUNCHER, buildRotatingItemFrames(generateRocketLauncherFront, generateRocketLauncherBack));

   // Powerup pickups: 8-frame rotating sprites
   flat.set(SpriteType.ARMOR, buildRotatingItemFrames(generateArmorFront, generateArmorBack));
   flat.set(SpriteType.BERSERK, buildRotatingItemFrames(generateBerserkFront, generateBerserkBack));

   // Decor (single frame, no shadow baked in)
   flat.set(SpriteType.BARREL, [generateBarrelTexture()]);
   flat.set(SpriteType.TERMINAL, [generateTerminalTexture()]);
   flat.set(SpriteType.LAMP, [generateLampTexture()]);
   flat.set(SpriteType.DEBRIS, [generateDebrisTexture()]);

   return { flat, latcherAngleViews, huskAngleViews, spitterAngleViews, bossAngleViews };
}

