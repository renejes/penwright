/**
 * Pure TypeScript BibTeX parser.
 * Parses .bib files into structured BibEntry objects.
 * No external dependencies.
 */

export interface BibEntry {
  type: string;       // article, book, inproceedings, etc.
  citekey: string;    // einstein1905
  fields: Record<string, string>;
  // Convenience fields for display:
  author: string;
  title: string;
  year: string;
}

/**
 * Parses a BibTeX file string into an array of BibEntry objects.
 * Handles nested braces in field values, quoted strings, and @string macros.
 */
export function parseBibFile(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const strings: Record<string, string> = {};
  let i = 0;

  while (i < content.length) {
    // Find next @
    const atIdx = content.indexOf('@', i);
    if (atIdx === -1) break;
    i = atIdx + 1;

    // Read entry type
    let type = '';
    while (i < content.length && /[a-zA-Z]/.test(content[i])) {
      type += content[i];
      i++;
    }
    type = type.toLowerCase();

    // Skip whitespace
    while (i < content.length && /\s/.test(content[i])) i++;

    // Expect opening brace or paren
    const openChar = content[i];
    if (openChar !== '{' && openChar !== '(') continue;
    const closeChar = openChar === '{' ? '}' : ')';
    i++;

    // Extract body with balanced braces
    const bodyStart = i;
    let depth = 1;
    while (i < content.length && depth > 0) {
      if (content[i] === openChar) depth++;
      if (content[i] === closeChar) depth--;
      if (depth > 0) i++;
    }
    if (depth !== 0) break;

    const body = content.slice(bodyStart, i);
    i++; // skip closing brace

    // Handle @string
    if (type === 'string') {
      const strMatch = body.match(/^\s*(\w+)\s*=\s*([\s\S]+)$/);
      if (strMatch) {
        strings[strMatch[1].toLowerCase()] = extractFieldValue(strMatch[2].trim(), strings);
      }
      continue;
    }

    // Skip @preamble, @comment
    if (type === 'preamble' || type === 'comment') continue;

    // Parse entry: citekey, fields
    const commaIdx = body.indexOf(',');
    if (commaIdx === -1) continue;

    const citekey = body.slice(0, commaIdx).trim();
    const fieldsStr = body.slice(commaIdx + 1);
    const fields = parseFields(fieldsStr, strings);

    entries.push({
      type,
      citekey,
      fields,
      author: cleanLatex(fields.author || ''),
      title: cleanLatex(fields.title || ''),
      year: fields.year || fields.date?.slice(0, 4) || '',
    });
  }

  return entries;
}

/**
 * Parses the field section of a BibTeX entry into key-value pairs.
 */
function parseFields(text: string, strings: Record<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;

  while (i < text.length) {
    // Skip whitespace and commas
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length) break;

    // Read field name
    let name = '';
    while (i < text.length && /[a-zA-Z0-9_-]/.test(text[i])) {
      name += text[i];
      i++;
    }
    if (!name) { i++; continue; }
    name = name.toLowerCase();

    // Skip whitespace and =
    while (i < text.length && /[\s]/.test(text[i])) i++;
    if (i >= text.length || text[i] !== '=') continue;
    i++; // skip =
    while (i < text.length && /[\s]/.test(text[i])) i++;

    // Read field value
    const value = readFieldValue(text, i, strings);
    if (value) {
      fields[name] = value.value;
      i = value.end;
    }
  }

  return fields;
}

function readFieldValue(
  text: string,
  start: number,
  strings: Record<string, string>,
): { value: string; end: number } | null {
  let i = start;
  if (i >= text.length) return null;

  let result = '';

  while (i < text.length) {
    // Skip whitespace
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;

    if (text[i] === '{') {
      // Braced value
      let depth = 1;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        if (text[j] === '}') depth--;
        j++;
      }
      result += text.slice(i + 1, j - 1);
      i = j;
    } else if (text[i] === '"') {
      // Quoted value
      let j = i + 1;
      let depth = 0;
      while (j < text.length) {
        if (text[j] === '{') depth++;
        if (text[j] === '}') depth = Math.max(0, depth - 1);
        if (text[j] === '"' && depth === 0) break;
        j++;
      }
      result += text.slice(i + 1, j);
      i = j + 1;
    } else if (/[0-9]/.test(text[i])) {
      // Numeric value
      let num = '';
      while (i < text.length && /[0-9]/.test(text[i])) {
        num += text[i];
        i++;
      }
      result += num;
    } else if (/[a-zA-Z]/.test(text[i])) {
      // String reference
      let ref = '';
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        ref += text[i];
        i++;
      }
      result += strings[ref.toLowerCase()] || ref;
    } else {
      break;
    }

    // Check for # concatenation
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i < text.length && text[i] === '#') {
      i++; // skip # and continue reading
    } else {
      break;
    }
  }

  return { value: result, end: i };
}

function extractFieldValue(text: string, strings: Record<string, string>): string {
  const result = readFieldValue(text, 0, strings);
  return result?.value || text;
}

/**
 * Cleans basic LaTeX commands from field values for display.
 */
function cleanLatex(text: string): string {
  return text
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\\\/g, '')
    .replace(/\\[a-zA-Z]+\s*/g, '')
    .replace(/~/g, ' ')
    .replace(/--/g, '\u2013')
    .trim();
}

/**
 * Serializes an array of BibEntry objects back into a .bib file string.
 */
export function serializeBibFile(entries: BibEntry[]): string {
  return entries
    .map((e) => {
      const fields = Object.entries(e.fields)
        .map(([k, v]) => `  ${k} = {${v}},`)
        .join('\n');
      return `@${e.type}{${e.citekey},\n${fields}\n}`;
    })
    .join('\n\n') + '\n';
}
