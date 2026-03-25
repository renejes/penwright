import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@editor': path.resolve(__dirname, 'src/editor'),
    },
  },
});
