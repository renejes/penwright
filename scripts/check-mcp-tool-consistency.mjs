#!/usr/bin/env node
/**
 * The tool list exists in more places than anyone can keep in their head.
 *
 * `src/mcp/server.ts` is the truth. Around it sit a manifest template, a
 * skill that teaches an agent which tool to reach for, a handbook, and several
 * documents that quote counts. Each drifted independently, and every drift has
 * the same shape: something names a tool that does not exist, or fails to name
 * one that does, or states a count that was true once.
 *
 * That matters more than untidiness. A skill naming `penwright_apply_theme`
 * teaches an agent to call a tool that has never existed; a manifest listing
 * fifty-three of sixty-three quietly hides ten from whoever installs from it.
 *
 * Run: node scripts/check-mcp-tool-consistency.mjs
 * Exit 1 on drift. Wired into `package:*` so a release cannot ship with it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(REPO, 'src', 'mcp', 'server.ts');

const problems = [];
const notes = [];
function fail(where, msg) { problems.push(`${where}: ${msg}`); }

// ─── The truth ──────────────────────────────────────────────────────

const serverSrc = fs.readFileSync(SERVER, 'utf-8');

/**
 * The same source with comments blanked out.
 *
 * Needed because the two rules below look for the ABSENCE of something, and
 * this file explains at length why each is absent — so scanning the raw text
 * flags the explanation as the violation. First version of this script did
 * exactly that, twice.
 */
const serverCode = serverSrc
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

/** Tool names as actually registered, in registration order. */
const registered = [...serverSrc.matchAll(/^tool\(\s*\n\s*'(penwright_[a-z_]+)'/gm)].map(m => m[1]);
if (registered.length === 0) {
  fail('src/mcp/server.ts', 'no tool registrations found — has the registration form changed?');
}
const known = new Set(registered);

// Nothing may bypass the wrapper: it is where annotations and the agent-facing
// notes are attached, so a direct server.tool call ships unclassified.
const direct = (serverCode.match(/server\.tool\(/g) ?? []).length;
if (direct > 0) fail('src/mcp/server.ts', `${direct} direct server.tool( call(s) — every tool must go through tool()`);

// outputSchema obliges every return to carry structuredContent.
if (/\boutputSchema\s*:/.test(serverCode)) fail('src/mcp/server.ts', 'outputSchema is declared somewhere');

// Every registered tool needs a metadata entry. The wrapper throws at runtime;
// this catches it before anyone runs the binary.
const metaBlock = serverSrc.match(/const TOOL_META: Record<string, ToolMeta> = \{([\s\S]*?)\n\};/);
if (!metaBlock) {
  fail('src/mcp/server.ts', 'TOOL_META table not found');
} else {
  const classified = new Set([...metaBlock[1].matchAll(/(penwright_[a-z_]+):/g)].map(m => m[1]));
  for (const name of registered) {
    if (!classified.has(name)) fail('src/mcp/server.ts', `${name} has no TOOL_META entry`);
  }
  for (const name of classified) {
    if (!known.has(name)) fail('src/mcp/server.ts', `TOOL_META names ${name}, which is not registered`);
  }
}

// instructions must be passed AND stay small — it is prepended to every
// conversation, so an unbounded one is a permanent tax.
const instr = serverSrc.match(/const SERVER_INSTRUCTIONS = `([\s\S]*?)`;/);
if (!instr) fail('src/mcp/server.ts', 'SERVER_INSTRUCTIONS not found');
else {
  const bytes = Buffer.byteLength(instr[1], 'utf-8');
  if (bytes > 2048) fail('src/mcp/server.ts', `SERVER_INSTRUCTIONS is ${bytes} B (max 2048)`);
  if (!/instructions:\s*SERVER_INSTRUCTIONS/.test(serverSrc)) {
    fail('src/mcp/server.ts', 'SERVER_INSTRUCTIONS is defined but never passed to McpServer');
  }
  notes.push(`instructions: ${bytes} B`);
}

notes.push(`${registered.length} tools registered`);

// ─── Everywhere else ────────────────────────────────────────────────

/** Files that name tools and are expected to be accurate. */
const CONSUMERS = [
  'src/mcp/manifest.template.json',
  'src/shared/skillTemplates.ts',
  'CLAUDE.md',
  'documentation/mcp-server.md',
  'documentation/handbuch.md',
  'documentation/handbook.md',
];

/**
 * Historical documents. A plan describing a tool it proposed to build is not
 * drift — it is a record. Flagging those would train everyone to ignore this
 * script, which is the only way it can actually fail.
 */
const HISTORY = /^documentation\/(done\/|project_status\.md|mcp-tool-audit\.md|mcp-tool-consolidation\.md|mcp-rebuild-plan\.md|app-mcp-parity\.md|handover\.md|next-steps\.md)/;

for (const rel of CONSUMERS) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) { fail(rel, 'missing'); continue; }
  if (HISTORY.test(rel)) continue;
  const src = fs.readFileSync(abs, 'utf-8');

  const named = new Set([...src.matchAll(/penwright_[a-z_]+/g)].map(m => m[0]));
  for (const name of named) {
    if (!known.has(name)) fail(rel, `names ${name}, which no tool provides`);
  }

  // A stated count that is wrong is worse than no count: it is read as fact.
  for (const m of src.matchAll(/(\d+)\s*(?:typed\s*)?[Tt]ools\b/g)) {
    if (Number(m[1]) !== registered.length) {
      fail(rel, `says "${m[0].trim()}" — there are ${registered.length}`);
    }
  }
}

// The manifest template ships to users who install the .mcpb by hand; a tool
// missing from it is a tool they do not get.
const manifestPath = path.join(REPO, 'src', 'mcp', 'manifest.template.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const listed = new Set((manifest.tools ?? []).map(t => t.name));
    if (listed.size > 0) {
      const missing = registered.filter(n => !listed.has(n));
      if (missing.length > 0) {
        fail('src/mcp/manifest.template.json', `${missing.length} tool(s) not listed: ${missing.join(', ')}`);
      }
    }
  } catch (err) {
    fail('src/mcp/manifest.template.json', `unparseable: ${err.message}`);
  }
}

// ─── Counts asserted about things other than tools ──────────────────
//
// Same failure mode, different subject: descriptions that state how many
// design elements or fonts there are, written when the number was different.

function countIds(rel) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) return null;
  return [...fs.readFileSync(abs, 'utf-8').matchAll(/^\s*id:\s*'/gm)].length;
}

const elementCount = countIds('src/shared/designElements.ts');
if (elementCount) {
  notes.push(`${elementCount} design elements`);
  for (const m of serverSrc.matchAll(/(\d+)\s+(?:ready-made\s+)?design elements?/gi)) {
    if (Number(m[1]) !== elementCount) {
      fail('src/mcp/server.ts', `a description says "${m[0]}" — there are ${elementCount}`);
    }
  }
  for (const m of serverSrc.matchAll(/one of the (\d+) design elements/gi)) {
    if (Number(m[1]) !== elementCount) {
      fail('src/mcp/server.ts', `a description says "${m[0]}" — there are ${elementCount}`);
    }
  }
}

const fontsManifest = path.join(REPO, 'resources', 'fonts', 'manifest.json');
if (fs.existsSync(fontsManifest)) {
  try {
    const n = (JSON.parse(fs.readFileSync(fontsManifest, 'utf-8')).fonts ?? []).length;
    notes.push(`${n} bundled fonts`);
    for (const m of serverSrc.matchAll(/(\d+)\s+bundled OFL fonts/gi)) {
      if (Number(m[1]) !== n) fail('src/mcp/server.ts', `a description says "${m[0]}" — there are ${n}`);
    }
  } catch { /* manifest is regenerated by the fetch script */ }
}

// ─── Report ─────────────────────────────────────────────────────────

console.log(`[mcp-consistency] ${notes.join(' · ')}`);
if (problems.length === 0) {
  console.log('[mcp-consistency] consistent.');
  process.exit(0);
}
console.error(`\n[mcp-consistency] ${problems.length} inconsistency/ies:\n`);
for (const p of problems) console.error(`  ✗ ${p}`);
console.error('\nThe tool list in src/mcp/server.ts is the truth; fix the others to match.\n');
process.exit(1);
