import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/mcp/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/mcp/server.mjs',
  external: [
    '@modelcontextprotocol/server',
    'zod',
  ],
  banner: {
    js: 'import { createRequire } from "module";\nconst require = createRequire(import.meta.url);',
  },
});

console.log('✓ MCP server built → dist/mcp/server.js');
