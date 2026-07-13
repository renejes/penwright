/**
 * Converts Markdown to Typst markup.
 * Handles the most common Markdown constructs.
 * Not a full CommonMark parser — covers practical use cases.
 */

export function markdownToTypst(md: string): string {
  const lines = md.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // YAML frontmatter (skip)
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') {
        inFrontmatter = false;
        frontmatterDone = true;
      }
      continue;
    }

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        // Close code block
        const langLabel = codeBlockLang ? `\`\`\`${codeBlockLang}` : '```';
        output.push(langLabel);
        output.push(...codeBlockLines);
        output.push('```');
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings: # → =, ## → ==, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = '='.repeat(headingMatch[1].length);
      const text = convertInline(headingMatch[2]);
      output.push(`${level} ${text}`);
      continue;
    }

    // Horizontal rules
    if (line.match(/^(---|\*\*\*|___)\s*$/)) {
      output.push('#line(length: 100%)');
      continue;
    }

    // Unordered lists: - or * → -
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      const indent = ulMatch[1];
      const text = convertInline(ulMatch[2]);
      output.push(`${indent}- ${text}`);
      continue;
    }

    // Ordered lists: 1. → +
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      const indent = olMatch[1];
      const text = convertInline(olMatch[2]);
      output.push(`${indent}+ ${text}`);
      continue;
    }

    // Blockquotes: > → #quote[...]
    const bqMatch = line.match(/^>\s*(.*)$/);
    if (bqMatch) {
      const text = convertInline(bqMatch[1]);
      if (text) {
        output.push(`#quote[${text}]`);
      }
      continue;
    }

    // Images: ![alt](src) → #image("src")
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const src = imgMatch[2];
      if (alt) {
        output.push(`#image("${src}", alt: "${alt}")`);
      } else {
        output.push(`#image("${src}")`);
      }
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      output.push('');
      continue;
    }

    // Regular paragraph text
    output.push(convertInline(line));
  }

  return output.join('\n');
}

/**
 * Converts inline Markdown formatting to Typst equivalents.
 */
function convertInline(text: string): string {
  // Images inline: ![alt](src)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    return alt ? `#image("${src}", alt: "${alt}")` : `#image("${src}")`;
  });

  // Links: [text](url) → #link("url")[text]
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '#link("$2")[$1]');

  // Bold must go through a placeholder: emitting Typst `*text*` directly would
  // be re-matched by the single-asterisk italic pass below (Markdown italic and
  // Typst bold share the `*` delimiter), which used to turn every bold span
  // into italic. The NUL-delimited token cannot occur in Markdown input.
  const BOLD_OPEN = '\u0000B\u0000';
  const BOLD_CLOSE = '\u0000/B\u0000';

  // Bold + italic: ***text*** or ___text___ → bold-wrapped italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, `${BOLD_OPEN}_$1_${BOLD_CLOSE}`);
  text = text.replace(/___(.+?)___/g, `${BOLD_OPEN}_$1_${BOLD_CLOSE}`);

  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  text = text.replace(/__(.+?)__/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);

  // Italic: Markdown single *text* → Typst _text_ (Typst uses * for bold).
  // Runs on the ORIGINAL single asterisks only — bold is already tokenised.
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Restore bold placeholders as Typst bold markers
  text = text.split(BOLD_OPEN).join('*').split(BOLD_CLOSE).join('*');

  // Inline code: `code` stays the same in Typst
  // (already correct syntax)

  // Strikethrough: ~~text~~ → #strike[text]
  text = text.replace(/~~(.+?)~~/g, '#strike[$1]');

  // Math inline: $..$ stays the same
  // (already correct syntax for Typst)

  return text;
}
