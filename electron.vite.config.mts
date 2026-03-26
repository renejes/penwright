import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store', '@polar-sh/sdk'] })],
    build: {
      outDir: 'dist/main',
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: 'src/main/preload-entry.ts',
      },
    },
  },
  renderer: {
    plugins: [svelte()],
    root: '.',
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: 'index.html',
      },
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@editor': path.resolve(__dirname, 'src/editor'),
      },
    },
  },
});
