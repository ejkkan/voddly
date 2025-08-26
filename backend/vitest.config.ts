import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      'metadata/metadata.test.ts',
      'xtream/xtream.test.ts',
    ],
    environment: 'node',
  },
});