---
name: vswrite
description: CLI tools for working with Typst documents in vswrite projects — document analysis, settings, styling, merge/split, bibliography, compilation
---

# vswrite CLI — Agent Instructions

You are working in a project that uses **vswrite**, a WYSIWYG editor for Typst (.typ) files.
The `vswrite-cli` command is available in your terminal for structural document operations.

## What is vswrite?

vswrite turns VS Code into a visual editor for Typst files. Users see a WYSIWYG editor (like Google Docs) instead of raw markup. The .typ files on disk are the source of truth — you can edit them directly and the WYSIWYG editor updates automatically.

## Quick Reference

### Understand the document
```bash
vswrite-cli info <file.typ>             # Word count, headings, images, citations, settings
vswrite-cli info <file.typ> --json      # Same but structured JSON output
vswrite-cli outline <file.typ>          # Heading hierarchy with line numbers
vswrite-cli outline <file.typ> --json   # Headings as JSON array
vswrite-cli validate <file.typ>         # Check for broken includes, missing images, unmatched braces
```

### Edit document settings
```bash
vswrite-cli get-settings <file.typ>                    # Show current font, paper, margins etc.
vswrite-cli set <file.typ> --font "Arial"              # Change font
vswrite-cli set <file.typ> --font-size "12pt" --lang "de" --paper "a4"  # Multiple settings at once
vswrite-cli apply-style <file.typ> --style modern      # Apply a complete style template
vswrite-cli list-styles                                 # Show available templates
```

Available settings flags: `--font`, `--font-size`, `--lang`, `--paper`, `--margin`, `--leading`, `--spacing`, `--first-line-indent`, `--heading-numbering`, `--bibliography-style`

Available styles: `classic` (academic serif), `modern` (sans-serif blue), `minimal` (ultra-clean), `vibrant` (colorful), `elegant` (warm tones), `professional` (corporate)

### Work with multi-file projects
```bash
vswrite-cli merge main.typ                          # Print merged output to stdout
vswrite-cli merge main.typ --output merged.typ      # Resolve all #include into one file
vswrite-cli split long-doc.typ                       # Split at H1 headings into chapters/
vswrite-cli split long-doc.typ --output-dir parts/   # Custom output directory
```

### Bibliography
```bash
vswrite-cli parse-bib references.bib                # List all citation entries
vswrite-cli parse-bib references.bib --json         # Entries as JSON array
vswrite-cli add-citation --bib references.bib --title "..." --author "..." --year "2024"
vswrite-cli add-citation --bib references.bib --title "..." --author "..." --year "2024" --type book
vswrite-cli import-sources                           # Auto-import DOIs from PDFs in sources/
```

### Compile & scaffold
```bash
vswrite-cli compile <file.typ>                      # Compile to PDF (requires typst CLI)
vswrite-cli compile <file.typ> --output paper.pdf   # Custom output path
vswrite-cli new-project my-thesis --template thesis  # Scaffold a new project
```

Templates: `document`, `thesis`, `paper`, `letter`, `book`

## Editing .typ files directly

You do NOT need the CLI to edit document content. Just edit the .typ file directly — vswrite detects changes and updates the WYSIWYG editor automatically. Here is the Typst syntax you need:

### Block elements (separated by blank lines)
```typst
= Heading 1
== Heading 2
=== Heading 3

Regular paragraph text.

- Bullet item
- Another bullet

+ Numbered item
+ Another numbered

#quote[Blockquote text]

#image("assets/photo.png")
#image("assets/photo.png", width: 80%)

#table(
  columns: 3,
  table.header([Header 1], [Header 2], [Header 3]),
  [Cell 1], [Cell 2], [Cell 3],
)

#line(length: 100%)

#pagebreak()
```

### Inline formatting
```typst
*bold text*
_italic text_
\`inline code\`
~strikethrough~
#link("https://example.com")[link text]
#footnote[Footnote content]
@citekey
```

### Configuration (at top of file)
```typst
#set text(font: "Arial", size: 12pt, lang: "de")
#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set par(justify: true, leading: 0.65em, spacing: 1.2em)
#set heading(numbering: "1.1")
```

### Multi-file projects
```typst
#include "chapters/01-introduction.typ"
#include "chapters/02-methods.typ"
```

### Citations
```typst
As shown by @einstein1905, the theory...
#bibliography("references.bib")
```

## Important rules for AI agents

1. **Edit .typ files directly** for content changes. The extension picks up changes automatically.
2. **Use `vswrite-cli set`** to change document settings — don't manually edit `#set` blocks unless you know Typst well.
3. **Use `vswrite-cli apply-style`** to change the visual appearance — it correctly replaces the preamble.
4. **Images go in `assets/`** next to the .typ file.
5. **Round-trip safety:** Unknown Typst constructs (math, custom functions, show rules) are preserved as "raw blocks" in the editor. They pass through unchanged. Never worry about data loss.
6. **Use `vswrite-cli validate`** after making structural changes to catch broken includes or missing files.
7. **`#set` and `#show` rules** at the top of the file control document styling. Use the CLI to modify these safely.
8. **Blank lines separate blocks.** Headings, paragraphs, lists, images are separated by blank lines.
9. **Do not put blank lines inside multi-line `#show` rules** — they use braces `{}` for grouping.
