/**
 * Git committer-identity fallback (electron-free — shared by the main
 * process and the MCP server, both of which commit via simple-git).
 *
 * Penwright's audience is writers, not developers — many machines have never
 * seen `git config --global user.email`. git then falls back to gecos +
 * hostname auto-detection, which (a) produces ugly identities like
 * `user@Renes-MacBook.local` with a warning, and (b) HARD-FAILS with
 * "Please tell me who you are" (exit 128) wherever auto-detection is
 * unavailable or disabled (`user.useConfigOnly=true`, managed machines,
 * some Windows setups). `git:saveVersion` has no catch for that, so the
 * user's very first "Version speichern" would throw.
 *
 * Rule: a resolved (global/system/local) identity always wins — we only
 * write a REPO-LOCAL fallback when name or email is missing. Repo-local
 * fits the project-first philosophy: the identity travels inside the
 * project's `.git/`, and setting a global identity later takes effect for
 * new projects while existing ones keep working.
 */

import * as os from 'node:os';
import type { SimpleGit } from 'simple-git';

export async function ensureGitIdentity(git: SimpleGit): Promise<void> {
  let name = '';
  let email = '';
  // `git config <key>` exits 1 when the key is unset → simple-git throws.
  try { name = (await git.raw(['config', 'user.name'])).trim(); } catch { /* unset */ }
  try { email = (await git.raw(['config', 'user.email'])).trim(); } catch { /* unset */ }
  if (name && email) return;

  let username = 'Penwright';
  try { username = os.userInfo().username || 'Penwright'; } catch { /* keep default */ }

  try {
    if (!name) await git.addConfig('user.name', username);
    if (!email) {
      const slug = username.toLowerCase().replace(/[^a-z0-9._-]+/g, '.') || 'penwright';
      await git.addConfig('user.email', `${slug}@penwright.local`);
    }
  } catch { /* best effort — the commit may still succeed via auto-detection */ }
}
