import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');

// Preload must be CJS (contextBridge doesn't work in ESM preload)
// But electron is the only external, and preload runs in Electron context
// where the built-in should resolve correctly via the sandbox
await esbuild.build({
  entryPoints: ['src/main/preload.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/main/preload.js',
  external: ['electron'],
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
});

console.log('✓ Preload script built');
