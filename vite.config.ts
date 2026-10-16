import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle)
        .filter(
          (file) =>
            (file.type === 'chunk' &&
              (file.isEntry || file.isDynamicEntry || file.fileName.endsWith('.js'))) ||
            (file.type === 'asset' && file.fileName.endsWith('.css')),
        )
        .map((file) => file.fileName);
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(files),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/unwind.js/' : '/',
  plugins: [precacheManifest()],
  build: { target: 'es2022' },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
}));
