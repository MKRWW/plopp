import { generateLevel, Level } from '../../engine/level-gen';

export function createTestLevel(
  seed: number,
  stage: number,
  overrides?: Partial<Level>
): Level {
  const level = generateLevel(seed, stage);
  return { ...level, ...overrides };
}

export function createDeterminismLevels(seed: number, stage: number, count: number): Level[] {
  const levels: Level[] = [];
  for (let i = 0; i < count; i++) {
    levels.push(createTestLevel(seed, stage));
  }
  return levels;
}
