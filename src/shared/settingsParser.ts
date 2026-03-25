/**
 * Parses and generates Typst #set blocks for document settings.
 */

export interface DocumentSettings {
  font: string;
  fontSize: string;
  lang: string;
  paper: string;
  margin: string;
  pageNumbering: string;
  pageHeader: string;
  pageFooter: string;
  columns: string;
  pageFill: string;
  leading: string;
  spacing: string;
  firstLineIndent: string;
  headingNumbering: string;
  bibliographyStyle: string;
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  font: '',
  fontSize: '',
  lang: '',
  paper: '',
  margin: '',
  pageNumbering: '',
  pageHeader: '',
  pageFooter: '',
  columns: '',
  pageFill: '',
  leading: '',
  spacing: '',
  firstLineIndent: '',
  headingNumbering: '',
  bibliographyStyle: '',
};

/**
 * Parse #set blocks from Typst source text and extract document settings.
 */
export function parseSettings(text: string): DocumentSettings {
  const settings: DocumentSettings = { ...DEFAULT_SETTINGS };

  // Match #set text(...) — may span multiple lines
  const textMatch = text.match(/#set\s+text\s*\(([^)]*)\)/);
  if (textMatch) {
    const args = textMatch[1];
    settings.font = extractStringArg(args, 'font') || '';
    settings.fontSize = extractValueArg(args, 'size') || '';
    settings.lang = extractStringArg(args, 'lang') || '';
  }

  // Match #set page(...) — uses balanced extraction to support bracket args like header: [...]
  const pageArgs = extractSetBlockArgs(text, 'page');
  if (pageArgs) {
    settings.paper = extractStringArg(pageArgs, 'paper') || '';
    settings.margin = extractBalancedValueArg(pageArgs, 'margin') || '';
    settings.pageNumbering = extractStringArg(pageArgs, 'numbering') || '';
    settings.pageHeader = extractBracketArg(pageArgs, 'header') || '';
    settings.pageFooter = extractBracketArg(pageArgs, 'footer') || '';
    settings.columns = extractValueArg(pageArgs, 'columns') || '';
    settings.pageFill = extractValueArg(pageArgs, 'fill') || '';
  }

  // Match #set par(...)
  const parMatch = text.match(/#set\s+par\s*\(([^)]*)\)/);
  if (parMatch) {
    const args = parMatch[1];
    settings.leading = extractValueArg(args, 'leading') || '';
    settings.spacing = extractValueArg(args, 'spacing') || '';
    settings.firstLineIndent = extractValueArg(args, 'first-line-indent') || '';
  }

  // Match #set heading(...)
  const headingMatch = text.match(/#set\s+heading\s*\(([^)]*)\)/);
  if (headingMatch) {
    const args = headingMatch[1];
    settings.headingNumbering =
      extractStringArg(args, 'numbering') || '';
  }

  // Match #bibliography(..., style: "...")
  const bibStyleMatch = text.match(/#bibliography\s*\([^)]*style\s*:\s*"([^"]*)"[^)]*\)/);
  if (bibStyleMatch) {
    settings.bibliographyStyle = bibStyleMatch[1];
  }

  return settings;
}

/**
 * Generate #set block lines from settings. Only non-empty values are included.
 */
export function generateSetBlocks(settings: DocumentSettings): string {
  const lines: string[] = [];

  // #set text(...)
  const textArgs: string[] = [];
  if (settings.font) textArgs.push(`font: "${settings.font}"`);
  if (settings.fontSize) textArgs.push(`size: ${settings.fontSize}`);
  if (settings.lang) textArgs.push(`lang: "${settings.lang}"`);
  if (textArgs.length > 0) {
    lines.push(`#set text(${textArgs.join(', ')})`);
  }

  // #set page(...)
  const pageArgs: string[] = [];
  if (settings.paper) pageArgs.push(`paper: "${settings.paper}"`);
  if (settings.margin) pageArgs.push(`margin: ${settings.margin}`);
  if (settings.pageNumbering) pageArgs.push(`numbering: "${settings.pageNumbering}"`);
  if (settings.pageHeader) pageArgs.push(`header: [${settings.pageHeader}]`);
  if (settings.pageFooter) pageArgs.push(`footer: [${settings.pageFooter}]`);
  if (settings.columns) pageArgs.push(`columns: ${settings.columns}`);
  if (settings.pageFill) pageArgs.push(`fill: ${settings.pageFill}`);
  if (pageArgs.length > 0) {
    lines.push(`#set page(${pageArgs.join(', ')})`);
  }

  // #set par(...)
  const parArgs: string[] = [];
  if (settings.leading) parArgs.push(`leading: ${settings.leading}`);
  if (settings.spacing) parArgs.push(`spacing: ${settings.spacing}`);
  if (settings.firstLineIndent)
    parArgs.push(`first-line-indent: ${settings.firstLineIndent}`);
  if (parArgs.length > 0) {
    lines.push(`#set par(${parArgs.join(', ')})`);
  }

  // #set heading(...)
  const headingArgs: string[] = [];
  if (settings.headingNumbering)
    headingArgs.push(`numbering: "${settings.headingNumbering}"`);
  if (headingArgs.length > 0) {
    lines.push(`#set heading(${headingArgs.join(', ')})`);
  }

  return lines.join('\n');
}

/**
 * Update #set blocks in an existing document. Replaces existing blocks and
 * inserts new ones at the top if needed.
 */
export function applySettings(
  text: string,
  settings: DocumentSettings,
): string {
  const newBlocks = generateSetBlocks(settings);

  // Remove existing #set blocks for text, page, par, heading
  let result = text;
  result = result.replace(/^#set\s+text\s*\([^)]*\)\s*\n?/gm, '');
  result = removeSetBlock(result, 'page'); // balanced removal for bracket args
  result = result.replace(/^#set\s+par\s*\([^)]*\)\s*\n?/gm, '');
  result = result.replace(/^#set\s+heading\s*\([^)]*\)\s*\n?/gm, '');

  // Clean up leading blank lines
  result = result.replace(/^\n+/, '');

  if (newBlocks) {
    result = newBlocks + '\n\n' + result;
  }

  // Update bibliography style if set
  if (settings.bibliographyStyle) {
    // Check if #bibliography exists in the result
    const bibRegex = /#bibliography\s*\(/;
    if (bibRegex.test(result)) {
      // Remove existing style parameter if present
      result = result.replace(
        /(#bibliography\s*\([^)]*?)(?:,\s*style\s*:\s*"[^"]*")([^)]*\))/,
        '$1$2',
      );
      // Add style parameter before closing paren
      result = result.replace(
        /(#bibliography\s*\()([^)]*?)(\s*\))/,
        (_, open, args, close) => {
          const trimmedArgs = args.trimEnd();
          const separator = trimmedArgs.endsWith(',') || !trimmedArgs ? '' : ',';
          return `${open}${trimmedArgs}${separator} style: "${settings.bibliographyStyle}"${close}`;
        },
      );
    }
  } else {
    // Remove style parameter if bibliographyStyle is empty
    result = result.replace(
      /(#bibliography\s*\([^)]*?),\s*style\s*:\s*"[^"]*"([^)]*\))/,
      '$1$2',
    );
  }

  return result;
}

// --- Helpers ---

/**
 * Extract the arguments string from a balanced #set block.
 * Handles nested brackets: #set page(header: [text], footer: [text])
 */
function extractSetBlockArgs(text: string, setName: string): string | null {
  const startRegex = new RegExp(`#set\\s+${setName}\\s*\\(`);
  const match = startRegex.exec(text);
  if (!match) return null;

  let parenDepth = 1;
  let bracketDepth = 0;
  let i = match.index + match[0].length;
  const start = i;
  while (i < text.length && parenDepth > 0) {
    const ch = text[i];
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    else if (bracketDepth === 0) {
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
    }
    i++;
  }
  if (parenDepth !== 0) return null;
  return text.substring(start, i - 1);
}

/**
 * Remove a balanced #set block from text, including trailing newline.
 * Safety: if parens are still unbalanced after a blank line, stop to avoid eating the document.
 */
function removeSetBlock(text: string, setName: string): string {
  const startRegex = new RegExp(`^#set\\s+${setName}\\s*\\(`, 'm');
  const match = startRegex.exec(text);
  if (!match) return text;

  let parenDepth = 1;
  let bracketDepth = 0;
  let i = match.index + match[0].length;
  let prevWasNewline = false;
  while (i < text.length && parenDepth > 0) {
    const ch = text[i];
    // Safety: stop at blank line (two consecutive newlines) if still unbalanced
    if (ch === '\n' && prevWasNewline) break;
    prevWasNewline = ch === '\n';
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    else if (bracketDepth === 0) {
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
    }
    i++;
  }
  if (i < text.length && text[i] === '\n') i++;
  return text.substring(0, match.index) + text.substring(i);
}

/**
 * Extract bracket-delimited argument value: key: [content]
 */
function extractBracketArg(args: string, key: string): string | null {
  const regex = new RegExp(`${key}\\s*:\\s*\\[`);
  const match = regex.exec(args);
  if (!match) return null;

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < args.length && depth > 0) {
    if (args[i] === '[') depth++;
    else if (args[i] === ']') depth--;
    i++;
  }
  return args.substring(start, i - 1);
}

function extractStringArg(args: string, key: string): string | null {
  const regex = new RegExp(`${key}\\s*:\\s*"([^"]*)"`, 'i');
  const match = args.match(regex);
  return match ? match[1] : null;
}

function extractValueArg(args: string, key: string): string | null {
  // Matches: key: value (until comma or end of string)
  const escapedKey = key.replace('-', '\\-');
  const regex = new RegExp(`${escapedKey}\\s*:\\s*([^,)]+)`, 'i');
  const match = args.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract a value arg that may contain balanced parentheses, e.g. margin: (top: 2.5cm).
 * Falls back to extractValueArg for simple values.
 */
function extractBalancedValueArg(args: string, key: string): string | null {
  const escapedKey = key.replace('-', '\\-');
  const regex = new RegExp(`${escapedKey}\\s*:\\s*`);
  const match = regex.exec(args);
  if (!match) return null;

  const start = match.index + match[0].length;
  if (start >= args.length) return null;

  // If value starts with '(', do balanced paren matching
  if (args[start] === '(') {
    let depth = 0;
    let i = start;
    while (i < args.length) {
      if (args[i] === '(') depth++;
      else if (args[i] === ')') {
        depth--;
        if (depth === 0) return args.substring(start, i + 1);
      }
      i++;
    }
    // Unbalanced — return what we have plus closing paren to fix it
    return args.substring(start, i) + ')';
  }

  // Simple value — use the standard extractor
  return extractValueArg(args, key);
}
