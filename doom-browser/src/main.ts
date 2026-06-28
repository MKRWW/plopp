import { Player } from './player/player';
import { Renderer } from './engine/renderer';
import { GameStateManager } from './game/state';
import { Weapon } from './game/weapon';
import { WeaponInventory } from './game/weapons';
import { generateLevel } from './engine/level-gen';
import { worldState } from './engine/world';

/**
 * Entry Point für Plopp.
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

  const player = new Player(level.entrance.x, level.entrance.y);

  const spawnRoom = level.rooms[level.spawnRooms[0]];
  const centerX = spawnRoom.x + spawnRoom.w / 2;
  const centerY = spawnRoom.y + spawnRoom.h / 2;
  const dx = centerX - level.entrance.x;
  const dy = centerY - level.entrance.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0.001) {
    player.dirX = dx / len;
    player.dirY = dy / len;
    player.planeX = -player.dirY * 0.66;
    player.planeY = player.dirX * 0.66;
  } else {
    player.dirX = 1;
    player.dirY = 0;
    player.planeX = 0;
    player.planeY = 0.66;
  }

  const gameStateManager = new GameStateManager();
  const weapon = new Weapon();
  const inventory = new WeaponInventory();

  const renderer = new Renderer(player, gameStateManager, weapon, inventory, level, baseSeed);
  renderer.start();
}

main();
