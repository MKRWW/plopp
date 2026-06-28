import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/engine/__tests__/multi-door.test.ts'],
    setupFiles: ['./src/engine/__tests__/setup-multidoor.ts'],
    pool: 'forks',
  },
});