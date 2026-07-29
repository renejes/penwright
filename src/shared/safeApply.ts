/**
 * "Every design change is a safe experiment" — for both processes.
 *
 * The app has staged design mutations, test-compiled them, and rolled back on
 * failure since Session 23 (`ipcHandlers.safeApplyDesign`). The MCP server
 * wrote the very same files unverified: one `penwright_apply_layout` could
 * leave the document uncompilable with no way back, and the agent would report
 * success because the write itself had succeeded.
 *
 * This is that engine, lifted out and made process-agnostic. Everything the
 * two sides do differently is injected:
 *
 *   - `verify`   how a test compile is run (app: `TypstCompiler.verify`,
 *                MCP: its own `typst` invocation)
 *   - `io`       how bytes reach the disk (the app records write provenance so
 *                its watcher doesn't treat its own write as foreign; the MCP
 *                side snapshots the previous version and honours file locks)
 *   - `baseline` whether the document was already broken before this change
 *
 * What stays identical — and is the whole point — is the ORDER: capture the
 * previous state of every file, stage them all, verify once, and on failure
 * restore every one of them. A partial application is the failure mode this
 * exists to prevent (it is exactly what `561c22e` fixed for `section:apply`,
 * where the style files were written outside the staged set and survived a
 * rollback that claimed to have undone everything).
 *
 * Side-effects that are *not* file writes stay with the caller: syncing the
 * open editor buffer, pushing an undo entry, emitting a fresh preview. The
 * caller gets `prior` back for exactly that — on success to know what it may
 * undo later, on failure to know which buffers to revert.
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './fileWrite';

export interface PlannedWrite {
  abs: string;
  content: string;
}

/** What a file looked like before the change. `null` → it did not exist. */
export interface PriorState {
  abs: string;
  old: string | null;
}

export type VerifyOutcome =
  | { ok: true; pdf?: Buffer }
  | { ok: false; errors: string[] };

export interface SafeApplyIO {
  read(abs: string): string | null;
  write(abs: string, content: string): void;
  remove(abs: string): void;
}

/**
 * Plain filesystem access — correct on its own, but neither process uses it
 * unadorned: the app wraps `write` to record provenance, the MCP server wraps
 * it to snapshot and lock-check.
 */
export const fsIO: SafeApplyIO = {
  /**
   * Throws when the file exists but cannot be read.
   *
   * The distinction is load-bearing: `null` means "did not exist", and a
   * rollback DELETES anything that reported null. Mapping an unreadable file
   * to null would turn a permissions hiccup into "your style.typ is gone".
   */
  read(abs) {
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf-8');
  },
  /**
   * Atomic, because the verify compile reads these files the moment they are
   * staged — a truncate-then-fill would hand Typst a half-written style.typ
   * and fail the very check this engine exists to run.
   */
  write(abs, content) {
    writeFileAtomic(abs, content);
  },
  remove(abs) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* already gone */
    }
  },
};

/**
 * Was the document already failing to compile before this change?
 *
 * A design action must not be blamed for a pre-existing content error — the
 * user typed a broken `#figure` and then picked a palette; refusing the
 * palette teaches them the wrong lesson and leaves them stuck.
 *
 *   `false`   verify normally (the app knows, from its live compiler)
 *   `true`    skip the verify and commit
 *   `'probe'` unknown. Only measured when the verify fails, by re-verifying
 *             the *rolled-back* state. If that fails too the document was
 *             already broken, and the change is re-applied rather than
 *             discarded. Costs two extra compiles, and only in the failure
 *             path — which is what lets the MCP side have the same semantics
 *             without keeping a second copy of the app's compile state.
 */
export type Baseline = boolean | 'probe';

export type SafeApplyOutcome =
  | {
      ok: true;
      /** False when the change was committed without a test compile. */
      verified: boolean;
      /** True when the document was already broken and this went in anyway. */
      baselineBroken: boolean;
      prior: PriorState[];
      pdf?: Buffer;
    }
  | {
      ok: false;
      /** Already rolled back — the files are back to `prior`. */
      error: string;
      errors: string[];
      prior: PriorState[];
      /** False when restoring one of the files itself failed. */
      restored: boolean;
    };

export interface SafeApplyOptions {
  writes: PlannedWrite[];
  /** `null` → no verifier available; commit unverified. */
  verify: (() => Promise<VerifyOutcome>) | null;
  baseline?: Baseline;
  io?: SafeApplyIO;
}

export async function safeApply(opts: SafeApplyOptions): Promise<SafeApplyOutcome> {
  const io = opts.io ?? fsIO;
  const baseline: Baseline = opts.baseline ?? false;

  // Capture before touching anything. Reading every file up front (rather than
  // lazily during rollback) is deliberate: by the time a rollback runs, the
  // originals are gone.
  const prior: PriorState[] = opts.writes.map((w) => ({ abs: w.abs, old: io.read(w.abs) }));

  const stage = (): void => {
    for (const w of opts.writes) io.write(w.abs, w.content);
  };

  const rollback = (): boolean => {
    let restored = true;
    for (const p of prior) {
      try {
        if (p.old === null) io.remove(p.abs);
        else io.write(p.abs, p.old);
      } catch {
        restored = false;
      }
    }
    return restored;
  };

  stage();

  if (!opts.verify || baseline === true) {
    return { ok: true, verified: false, baselineBroken: baseline === true, prior };
  }

  const result = await opts.verify();
  if (result.ok) {
    return { ok: true, verified: true, baselineBroken: false, prior, pdf: result.pdf };
  }

  const restored = rollback();

  // The change broke it — or it was already broken. `probe` settles that by
  // asking the same question of the state we just restored.
  if (baseline === 'probe' && restored) {
    const before = await opts.verify();
    if (!before.ok) {
      stage();
      return { ok: true, verified: false, baselineBroken: true, prior };
    }
  }

  return {
    ok: false,
    error: result.errors.join('\n') || 'Compilation failed.',
    errors: result.errors,
    prior,
    restored,
  };
}
