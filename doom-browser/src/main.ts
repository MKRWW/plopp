import { Player } from './player/player';
import { Renderer } from './engine/renderer';
import { GameStateManager } from './game/state';
import { Weapon } from './game/weapon';
import { WeaponInventory } from './game/weapons';
import { generateLevel } from './engine/level-gen';
import { worldState } from './engine/world';

/**
 * Entry Point für das Doom-Browser-Spiel.
 *
 * Bootstrap-Reihenfolge:
 *   1. Basis-Seed wählen (per Run, daraus werden alle Stages abgeleitet).
 *   2. Stage 1 generieren und in den WorldState laden — DANACH erst kennt
 *      die Welt ihre Karte.
 *   3. Spieler an den Level-Spawn setzen.
 *   4. Renderer mit Level + Seed konstruieren (Sprites kommen aus dem Level).
 */
function main(): void {
  const baseSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
  const level = generateLevel(baseSeed, 1);
  worldState.loadLevel(level);

  const player = new Player(level.spawn.x, level.spawn.y);
  player.dirX = level.spawn.dirX;
  player.dirY = level.spawn.dirY;
  player.planeX = -level.spawn.dirY * 0.66;
  player.planeY = level.spawn.dirX * 0.66;

  const gameStateManager = new GameStateManager();
  const weapon = new Weapon();
  const inventory = new WeaponInventory();

  const renderer = new Renderer(player, gameStateManager, weapon, inventory, level, baseSeed);
  renderer.start();
}

main();
