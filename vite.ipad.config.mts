import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Tauri on iOS loads `index.html` and resolves assets relative to it.
  base: './',
  plugins: [
    svelte(),
    {
      name: 'ipad-index-html',
      apply: 'build',
      closeBundle() {
        const dir = path.resolve(root, 'dist/ipad');
        const from = path.join(dir, 'index.ipad.html');
        const to = path.join(dir, 'index.html');
        if (fs.existsSync(from)) fs.renameSync(from, to);
      },
    },
  ],
  root,
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist/ipad',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, 'index.ipad.html'),
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'src/shared'),
      '@editor': path.resolve(root, 'src/editor'),
      '@docs': path.resolve(root, 'documentation'),
    },
  },
});
