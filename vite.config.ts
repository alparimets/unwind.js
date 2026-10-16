import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/unwind.js/' : '/',
  build: { target: 'es2022' },
}));
