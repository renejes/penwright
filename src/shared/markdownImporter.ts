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

  // Bold + italic: ***text*** or ___text___
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '*_$1_*');
  text = text.replace(/___(.+?)___/g, '*_$1_*');

  // Bold: **text** or __text__ → *text*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  text = text.replace(/__(.+?)__/g, '*$1*');

  // Italic: *text* or _text_ → _text_ (already Typst syntax)
  // *text* needs to stay as-is if it's single asterisks (Typst uses * for bold)
  // Actually in Typst: *text* = bold, _text_ = italic
  // In Markdown: *text* = italic, **text** = bold
  // So single * in Markdown (italic) needs to become _ in Typst
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Inline code: `code` stays the same in Typst
  // (already correct syntax)

  // Strikethrough: ~~text~~ → #strike[text]
  text = text.replace(/~~(.+?)~~/g, '#strike[$1]');

  // Math inline: $..$ stays the same
  // (already correct syntax for Typst)

  return text;
}
