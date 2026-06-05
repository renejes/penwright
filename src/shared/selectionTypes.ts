/**
 * Selection-pin types — shared by main (persistence + IPC), renderer
 * (DesignPanel hub card) and the MCP server (`penwright_get_selection`).
 *
 * The "Design after writing" feature pins a selected passage plus a snapshot
 * of the current look to `<project>/.penwright/selection.json`, so Claude can
 * read both the *what* (the text + a fuzzy anchor) and the *how* (theme /
 * palette / fonts / layout / section style / already-used elements) in one
 * pull and design that spot in harmony with the document.
 */

export const SELECTION_PIN_VERSION = 1;

/**
 * The design snapshot captured at pin time — what the document currently
 * looks like, so Claude decides in harmony with the existing style.
 */
export interface SelectionContext {
  /** Best-effort match against a built-in theme id, or null if customised. */
  theme: string | null;
  /** The five semantic color slots from `style.json`. */
  palette: {
    primary: string;
    accent: string;
    text: string;
    background: string;
    muted: string;
  };
  /** Body / heading / code font families. */
  fonts: {
    body: string;
    heading: string;
    code: string;
  };
  /** The layout knobs that matter for a localized treatment. */
  layout: {
    paper: string;
    orientation: 'portrait' | 'landscape';
    columns: number;
  };
  /** The per-chapter section-style id applied to this file, or null. */
  sectionStyle: string | null;
  /**
   * Coarse, best-effort tags for design constructs already present in the
   * pinned file (e.g. "columns", "pull-quote", "callout", "divider"). Lets
   * Claude avoid introducing a clashing third variant of something.
   */
  usedElements: string[];
}

export interface SelectionPin {
  version: number;
  /** Epoch ms when the user pinned the selection. */
  pinnedAt: number;
  /** Project-relative path of the file the selection lives in (forward slashes). */
  file: string;
  /** The full selected text (may be long — shown as a preview). */
  selectionText: string;
  /**
   * Whitespace-exact anchor (≤200 chars) the existing anchor-based MCP tools
   * consume (`insert_design_element`, `insert_reference`, …) so Claude acts
   * with zero offset math.
   */
  anchorText: string;
  /** 1-based occurrence index of `anchorText` within the file. */
  occurrence: number;
  /** The ProseMirror node type the selection started in (e.g. "paragraph"). */
  nodeType: string;
  /** The design snapshot captured at pin time. */
  context: SelectionContext;
}

/** The part of the pin the renderer captures from the editor selection. */
export interface SelectionAnchorInput {
  file: string;
  selectionText: string;
  anchorText: string;
  occurrence: number;
  nodeType: string;
}
