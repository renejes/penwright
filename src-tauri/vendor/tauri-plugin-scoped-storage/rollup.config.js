import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import typescript from "@rollup/plugin-typescript";

const pkg = JSON.parse(readFileSync(join(cwd(), "package.json"), "utf8"));
const entry = pkg.exports?.["."];

if (!entry?.import || !entry?.require) {
  throw new Error(
    'Invalid package.json exports: expected exports["."].import and exports["."].require',
  );
}

export default {
  input: "guest-js/index.ts",
  output: [
    {
      file: entry.import,
      format: "esm",
    },
    {
      file: entry.require,
      format: "cjs",
    },
  ],
  plugins: [
    typescript({
      declaration: true,
      declarationDir: "dist-js",
    }),
  ],
  external: [
    /^@tauri-apps\/api/,
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
};
