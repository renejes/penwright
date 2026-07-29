/**
 * One scaffold for every way a project comes into existence.
 *
 * There are four: "New Project" and "New from preset" in the app,
 * `penwright_create_project` and `penwright_create_from_preset` over MCP. They
 * produced measurably different projects. The app's route laid down a Git repo,
 * a `.gitignore`, `assets/` and `sources/`, the `.penwright/` skeleton, five
 * Claude skills and a `style.typ` wired into the root. The MCP route created
 * the template files, an `assets/` folder, and stopped.
 *
 * The consequences were not cosmetic:
 *
 *   - No Git meant "Save Version" had nothing to restore from, in exactly the
 *     projects an agent had just written a lot of text into.
 *   - No `.gitignore` meant the first commit swallowed `.penwright/` — the
 *     backups and the undo net went into the history as content.
 *   - No `.claude/skills` meant the agent that would work in this project next
 *     had no idea what its conventions were. Measured across the shipped
 *     preset library: nought of thirty-five.
 *
 * Everything here is electron-free and takes its two variable pieces —
 * the skill texts and the default `style.typ` — as arguments, so `shared/`
 * gains no dependency on either process.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SimpleGit } from 'simple-git';
import { findRootFileIn } from './rootFinder';
import { ensureStyleInclude } from './styleParser';
import { isDesignAdopted } from './styleWrite';

export const GITIGNORE_REQUIRED_LINES = ['.penwright/', '.penwright-*', '*.pdf'];

export const GITIGNORE_TEMPLATE = `# Penwright
${GITIGNORE_REQUIRED_LINES.join('\n')}

# OS
.DS_Store
Thumbs.db
`;

/** Folders every project has, so the file tree shows where things belong. */
export const STANDARD_DIRS = ['assets', 'sources'];

/**
 * Creates or extends `.gitignore`.
 *
 * Extending rather than replacing matters for the preset and hand-made cases:
 * the project may already ignore its own things, and losing those would put
 * build output into the user's history.
 */
export function planGitignore(dir: string): { abs: string; content: string } | null {
  const abs = path.join(dir, '.gitignore');
  let existing = '';
  try {
    if (fs.existsSync(abs)) existing = fs.readFileSync(abs, 'utf-8');
  } catch {
    return null;
  }
  if (existing.length === 0) return { abs, content: GITIGNORE_TEMPLATE };

  const lines = existing.split('\n').map(l => l.trim());
  const missing = GITIGNORE_REQUIRED_LINES.filter(req => !lines.includes(req));
  if (missing.length === 0) return null;

  const prefix = existing.endsWith('\n') ? '' : '\n';
  return { abs, content: existing + prefix + '\n# Penwright\n' + missing.join('\n') + '\n' };
}

/** The `.penwright/` folders the app expects to find. */
export function ensurePenwrightSkeleton(dir: string): void {
  for (const sub of ['', 'backups', 'ai-snapshots']) {
    try {
      fs.mkdirSync(path.join(dir, '.penwright', sub), { recursive: true });
    } catch {
      /* best-effort */
    }
  }
}

export interface SkillFile {
  slug: string;
  content: string;
}

/**
 * Deploys the project skills, per file.
 *
 * Per file, not per directory: a user who has customised one skill must still
 * receive a new one, and must not have their edits overwritten. An existing
 * SKILL.md is always left alone.
 */
export function ensureSkills(dir: string, skills: SkillFile[]): string[] {
  const written: string[] = [];
  // No skills asked for → not even the folder. Creating an empty `.claude/`
  // in someone's document folder because they clicked "Save Version" is the
  // kind of uninvited change this whole round is about not making.
  if (skills.length === 0) return written;

  const skillsDir = path.join(dir, '.claude', 'skills');
  try {
    fs.mkdirSync(skillsDir, { recursive: true });
  } catch {
    return written;
  }
  for (const skill of skills) {
    const target = path.join(skillsDir, skill.slug, 'SKILL.md');
    try {
      if (fs.existsSync(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, skill.content, 'utf-8');
      written.push(path.relative(dir, target));
    } catch {
      /* one skill failing must not stop the rest */
    }
  }
  return written;
}

/**
 * Gives the project a `style.typ` (its "Look") and the tokens behind it.
 *
 * `wireRoot` also puts `#import "style.typ": *` + `#show: apply-style` at the
 * top of the root file. Only ever true for a project being created: on open we
 * pass false, because silently restyling a document somebody already made is
 * not ours to do.
 *
 * A project whose design lives in a hand-written `style.typ` gets NOTHING from
 * here — not even a default `style.json`. That is not tidiness: `style.json`
 * used to be what the overwrite guard keyed on, so creating one disarmed the
 * protection (`c744ce5`). The marker in `style.typ` is the whole contract now,
 * and this function asks the same question everything else does.
 */
export function ensureStyleFiles(args: {
  dir: string;
  wireRoot: boolean;
  defaultStyleJson: string;
  renderStyleTyp: (styleJson: string) => string;
}): void {
  const { dir, wireRoot } = args;
  if (!fs.existsSync(dir)) return;
  if (!isDesignAdopted(dir)) return;

  const rootFile = findRootFileIn(dir);
  const rootDir = rootFile ? path.dirname(rootFile) : dir;
  const styleTypPath = path.join(rootDir, 'style.typ');
  const jsonPath = path.join(dir, '.penwright', 'style.json');

  let styleJson = args.defaultStyleJson;
  try {
    if (fs.existsSync(jsonPath)) {
      styleJson = fs.readFileSync(jsonPath, 'utf-8');
    } else {
      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
      fs.writeFileSync(jsonPath, styleJson, 'utf-8');
    }
  } catch {
    /* tokens are recoverable; the .typ below is what the document needs */
  }

  try {
    if (!fs.existsSync(styleTypPath)) {
      fs.writeFileSync(styleTypPath, args.renderStyleTyp(styleJson), 'utf-8');
    }
  } catch {
    return;
  }

  if (wireRoot && rootFile && fs.existsSync(rootFile) && fs.existsSync(styleTypPath)) {
    try {
      const before = fs.readFileSync(rootFile, 'utf-8');
      const after = ensureStyleInclude(before);
      if (after !== before) fs.writeFileSync(rootFile, after, 'utf-8');
    } catch {
      /* the style file still stands on its own */
    }
  }
}

export interface ScaffoldOptions {
  dir: string;
  /** Skills to deploy. Pass [] to skip. */
  skills: SkillFile[];
  /**
   * Create `assets/` and `sources/`. True when a project is being CREATED, so
   * the file tree shows where things belong; false on the paths that merely
   * bring an existing folder up to date — "Save Version" reaches this function
   * too, and a save must not start creating folders the user did not ask for.
   */
  standardDirs?: boolean;
  /** Serialised default ProjectStyle, used only when none exists yet. */
  defaultStyleJson: string;
  /** ProjectStyle JSON → the generated `style.typ` source. */
  renderStyleTyp: (styleJson: string) => string;
  /** True only when creating a project — see `ensureStyleFiles`. */
  wireRoot: boolean;
  /** Message for the initial commit. */
  initialCommitMessage: string;
  /**
   * Git access, injected because the two processes construct it differently
   * and `shared/` should not decide. Return null to skip Git entirely.
   */
  git: (dir: string) => SimpleGit | null;
  /** Repo-local identity fallback — writers' machines often have no global one. */
  ensureIdentity?: (git: SimpleGit) => Promise<void>;
}

export interface ScaffoldResult {
  gitInitialized: boolean;
  committed: boolean;
  skillsWritten: string[];
  warnings: string[];
}

/**
 * Brings a directory up to what Penwright — and the agent working in it next —
 * expects to find. Idempotent: safe on an existing project, which is why the
 * "open an existing folder" path can call it too.
 *
 * Order matters. `.gitignore` before `git init` + `add -A`, or the first
 * commit captures `.penwright/` as content. Style files before the commit, so
 * the initial version contains the look the user is about to see.
 */
export async function scaffoldProject(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const result: ScaffoldResult = {
    gitInitialized: false,
    committed: false,
    skillsWritten: [],
    warnings: [],
  };
  if (!fs.existsSync(opts.dir)) {
    result.warnings.push(`${opts.dir} does not exist.`);
    return result;
  }

  if (opts.standardDirs) {
    for (const sub of STANDARD_DIRS) {
      try { fs.mkdirSync(path.join(opts.dir, sub), { recursive: true }); } catch { /* best-effort */ }
    }
  }

  const ignore = planGitignore(opts.dir);
  if (ignore) {
    try { fs.writeFileSync(ignore.abs, ignore.content, 'utf-8'); }
    catch { result.warnings.push('Could not write .gitignore.'); }
  }

  ensurePenwrightSkeleton(opts.dir);
  result.skillsWritten = ensureSkills(opts.dir, opts.skills);

  ensureStyleFiles({
    dir: opts.dir,
    wireRoot: opts.wireRoot,
    defaultStyleJson: opts.defaultStyleJson,
    renderStyleTyp: opts.renderStyleTyp,
  });

  const git = opts.git(opts.dir);
  if (git) {
    try {
      if (!(await git.checkIsRepo())) {
        await git.init();
        // Older Git still defaults to "master".
        try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch { /* fine */ }
        result.gitInitialized = true;
        if (opts.ensureIdentity) await opts.ensureIdentity(git);
        await git.add('-A');
        const status = await git.status();
        if (status.staged.length > 0 || status.created.length > 0) {
          await git.commit(opts.initialCommitMessage);
          result.committed = true;
        }
      }
    } catch (err) {
      result.warnings.push(`Git setup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
