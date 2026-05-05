import { Player } from './player/player';
import { Renderer } from './engine/renderer';
import { GameStateManager } from './game/state';
import { Weapon } from './game/weapon';

/**
 * Entry Point für das Doom-Browser-Spiel.
 */
function main(): void {
  // Spieler initialisieren (in einem freien Bereich starten)
  const player = new Player(2.5, 2.5);

  // Game State Manager und Waffe erstellen
  const gameStateManager = new GameStateManager();
  const weapon = new Weapon();

  // Renderer starten
  const renderer = new Renderer(player, gameStateManager, weapon);
  renderer.start();
}

main();