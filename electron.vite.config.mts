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
        '@docs': path.resolve(__dirname, 'documentation'),
      },
    },
    server: {
      fs: {
        // Allow serving files from the host repo root when running inside a
        // git worktree. The worktree's node_modules is empty; dependencies
        // like pdfjs-dist's worker script live under the parent project's
        // node_modules, so Vite's default cwd-only allowlist blocks them.
        allow: [path.resolve(__dirname, '..', '..', '..')],
      },
    },
  },
});
