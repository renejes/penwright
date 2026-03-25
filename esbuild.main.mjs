import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');

await esbuild.build({
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/main/main.mjs',
  external: ['electron', 'node-pty'],
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  // Required for ESM output with node built-ins
  banner: {
    js: [
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('✓ Main process built (ESM)');
