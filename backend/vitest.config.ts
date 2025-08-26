import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig as any,
  defineConfig({
    test: {
      setupFiles: ['./vitest.setup.ts'],
      exclude: [
        'metadata/metadata.test.ts',
        'xtream/xtream.test.ts',
      ],
      environment: 'node',
    },
  })
);