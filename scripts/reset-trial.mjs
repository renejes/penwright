#!/usr/bin/env node
/**
 * Reset (or expire) the local Penwright trial for testing.
 *
 *   node scripts/reset-trial.mjs            # fresh 14-day trial on next launch
 *   node scripts/reset-trial.mjs --expire   # force an EXPIRED trial (test gates)
 *   node scripts/reset-trial.mjs --now      # start the 14 days from right now
 *
 * The trial clock lives in the electron-store file `penwright-settings.json`
 * (global, per-device) under the key `trialStartedAt` (epoch ms; null = not yet
 * started → stamped to Date.now() on first launch). See persistenceManager.ts
 * (`ensureTrialStarted`) and licenseManager.ts (`getEntitlement`, 14-day TRIAL).
 *
 * IMPORTANT: quit Penwright first, otherwise it overwrites this file on exit.
 * On next launch the in-app entitlement AND the MCP demo unlock
 * (PENWRIGHT_TRIAL_UNTIL, re-baked by initMcpRegistration) both refresh.
 *
 * No dependencies — plain Node, runnable with `node scripts/reset-trial.mjs`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE_FILE = 'penwright-settings.json';
const DAY_MS = 86_400_000;
const TRIAL_DAYS = 14;

/** Candidate electron-store dirs. macOS is case-insensitive so `penwright` and
 *  `Penwright` collapse, but we list both for Windows/Linux correctness. */
function candidateDirs() {
  const home = os.homedir();
  const names = ['penwright', 'Penwright'];
  if (process.platform === 'darwin') {
    return names.map((n) => path.join(home, 'Library', 'Application Support', n));
  }
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return names.map((n) => path.join(appdata, n));
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return names.map((n) => path.join(xdg, n));
}

function findSettingsFile() {
  for (const dir of candidateDirs()) {
    const f = path.join(dir, STORE_FILE);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

const mode = process.argv.includes('--expire')
  ? 'expire'
  : process.argv.includes('--now')
    ? 'now'
    : 'fresh';

const file = findSettingsFile();

if (!file) {
  console.log(`No ${STORE_FILE} found — Penwright will start a fresh trial on first launch anyway.`);
  console.log('Looked in:');
  for (const d of candidateDirs()) console.log('  ', path.join(d, STORE_FILE));
  process.exit(0);
}

let json;
try {
  json = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not parse ${file}:\n  ${err.message}`);
  console.error('Refusing to overwrite a malformed settings file.');
  process.exit(1);
}

const prev = json.trialStartedAt ?? null;
let next;
if (mode === 'expire') next = Date.now() - (TRIAL_DAYS + 1) * DAY_MS; // already past the window
else if (mode === 'now') next = Date.now(); // 14 days from now
else next = null; // re-stamped to "now" by the app on next launch

json.trialStartedAt = next;
// Match the file's tab indentation; the app reformats on its next write anyway.
fs.writeFileSync(file, JSON.stringify(json, null, '\t') + '\n', 'utf8');

const human = (v) => (v == null ? 'null' : `${v} (${new Date(v).toISOString()})`);
console.log(`✓ Trial ${mode === 'expire' ? 'EXPIRED' : 'reset'}.`);
console.log('  file:           ', file);
console.log('  trialStartedAt: ', human(prev), '→', human(next));
if (mode === 'expire') {
  console.log('  → entitlement will be "expired" on next launch (tests the gates / lock screens).');
} else {
  console.log(`  → fresh ${TRIAL_DAYS}-day trial; in-app features + MCP demo unlock on next launch.`);
}
console.log('  NOTE: quit Penwright first, or it will overwrite this on exit.');
