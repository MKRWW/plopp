import { describe, it, expect } from 'vitest';
import { checkShotHit, type CombatContext } from '../combat';
import { createTestPlayer } from '../../__tests__/utils/fixtures';
import { createMockEnemySprite } from '../../__tests__/utils/mocks';

function ctxWith(player: any, sprites: any[]): CombatContext {
  return { player, sprites } as unknown as CombatContext;
}

describe('checkShotHit - range gating (melee vs hitscan)', () => {
  it('hits a distant enemy with the default (infinite) range', () => {
    const player = createTestPlayer(1.5, 1.5);   // facing +x
    const far = createMockEnemySprite(5.0, 1.5);  // ~3.5 tiles ahead
    const hit = checkShotHit(ctxWith(player, [far]));
    expect(hit).toBe(far);
  });

  it('misses a distant enemy when range is limited to melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const far = createMockEnemySprite(5.0, 1.5);  // ~3.5 tiles -> out of melee
    const hit = checkShotHit(ctxWith(player, [far]), 1.3);
    expect(hit).toBeNull();
  });

  it('hits an adjacent enemy within melee reach', () => {
    const player = createTestPlayer(1.5, 1.5);
    const near = createMockEnemySprite(2.5, 1.5); // ~1.0 tile -> within melee
    const hit = checkShotHit(ctxWith(player, [near]), 1.3);
    expect(hit).toBe(near);
  });
});
