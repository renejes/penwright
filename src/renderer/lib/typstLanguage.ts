/**
 * Basic Typst syntax highlighting for CodeMirror 6.
 * Covers keywords, comments, strings, headings, emphasis, labels, and math.
 */

import { StreamLanguage } from '@codemirror/language';

export const typstLanguage = StreamLanguage.define({
  startState() {
    return { inBlockComment: false, inMath: false, inString: false };
  },

  token(stream, state) {
    // Block comment
    if (state.inBlockComment) {
      if (stream.match('*/')) {
        state.inBlockComment = false;
      } else {
        stream.next();
      }
      return 'comment';
    }

    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'comment';
    }

    // Line comment
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // String
    if (stream.match('"')) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '\\') {
          stream.next(); // skip escaped char
        } else if (ch === '"') {
          break;
        }
      }
      return 'string';
    }

    // Headings (= at start of line)
    if (stream.sol() && stream.match(/^=+\s/)) {
      stream.skipToEnd();
      return 'heading';
    }

    // Keywords: #set, #show, #let, #import, #include, #if, #else, #for, #while, #return, #bibliography
    if (stream.match(/#(?:set|show|let|import|include|if|else|for|while|return|bibliography|figure|table|align|grid|stack|block|page|text|par|heading|list|enum|terms|footnote|cite|ref|link|image|line|rect|circle|ellipse|polygon|path|place|move|rotate|scale|measure|context|numbering)\b/)) {
      return 'keyword';
    }

    // Labels <label>
    if (stream.match(/<[a-zA-Z0-9_-]+>/)) {
      return 'labelName';
    }

    // References @label
    if (stream.match(/@[a-zA-Z0-9_-]+/)) {
      return 'variableName.special';
    }

    // Math mode $...$
    if (stream.match('$')) {
      while (!stream.eol()) {
        if (stream.next() === '$') break;
      }
      return 'number';
    }

    // Bold *...*
    if (stream.match(/\*[^*]+\*/)) {
      return 'strong';
    }

    // Italic _..._
    if (stream.match(/_[^_]+_/)) {
      return 'emphasis';
    }

    // Raw inline `...`
    if (stream.match(/`[^`]+`/)) {
      return 'monospace';
    }

    // Numbers
    if (stream.match(/\b\d+(\.\d+)?(em|pt|mm|cm|in|%|fr|deg|rad)?\b/)) {
      return 'number';
    }

    // Advance
    stream.next();
    return null;
  },
});
