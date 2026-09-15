import { defineConfig } from 'vitest/config';

// Unit tests cover pure functions in src/lib, so a plain Node environment is enough.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
