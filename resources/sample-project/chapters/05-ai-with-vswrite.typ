= AI with vswrite <sec:ai-with-vswrite>

The previous chapters argued, abstractly, that a writer should keep
control of the argument while delegating mechanics to an assistant.
This chapter is concrete: how do you actually do that with vswrite?

The unique part of vswrite, compared to a generic editor with a
chatbot bolted on, is that the app ships with a *Model Context
Protocol* (MCP) server built in. External AI tools — Claude Desktop,
Claude Cowork, Codex Desktop — connect to vswrite through this server
and gain 43 typed tools to work with the project. No copy-pasting
chunks of text into a chat window.

== Three integration paths

There are three practical ways to put AI on your project, summarised
in @tbl:integration:

#figure(
  table(
    columns: (1fr, 1fr, 1fr),
    inset: 8pt,
    align: left,
    [*Path*],                          [*How it sees the project*],            [*Best for*],
    [Terminal Claude Code],            [Filesystem (full read/write)],         [Long-running edits, refactors, batch ops],
    [Claude Cowork or similar],        [Filesystem (with explicit permission)], [Conversational drafting next to the editor],
    [Claude Desktop / Codex Desktop],  [vswrite MCP server (43 tools)],        [Structured operations: comments, references, exports],
  ),
  caption: [Three ways AI tools see a vswrite project. All three can
    coexist; they read the same files on disk.],
) <tbl:integration>

The third path is the one most worth highlighting, because the MCP
server is what removes the cognitive overhead from the integration.
The agent does not need to know vswrite's file conventions — it
calls #raw("vswrite_add_comment") and the YAML frontmatter is
generated for it; it calls #raw("vswrite_insert_reference") and the
label is validated against the project before insertion.

== Concrete workflows

Three patterns we use ourselves:

=== Extract bibliography from a PDF

You drop a PDF into `sources/`. You ask the assistant — through the
MCP — to read it, extract author / title / venue / year, write a
clean BibTeX entry to `references.bib`, and ensure a `#bibliography`
block exists in the document.

```ts
vswrite_add_citation({
  bibtex: "@article{newson2024example, author={Newson, M.}, ...}"
})

vswrite_get_citations()
  → [{ citekey: "newson2024example", ... }, ...]
```

The handover: you, the writer, decide whether the source is good. The
mechanical work — turning a PDF into a citekey-indexed BibTeX entry —
is the AI's.

=== Suggest a structure for a chapter

You have rough notes for a chapter. Instead of staring at the blank
page, ask the assistant to propose three or four section headings
and a one-sentence purpose for each. You accept some, reject some,
re-write some. You then start drafting against the structure.

The same as @sec:fundamentals warned about: you do not let the
assistant write the chapter. You let it propose a skeleton against
which you write.

=== Find every citation of a source across chapters

You change a citekey from `chen2021codex` to `chen2021evaluating`
because the venue prefers the latter form. You have nine chapters.

```ts
vswrite_save_version({ message: "Before citekey rename" })

vswrite_replace_in_project({
  query: "chen2021codex",
  replacement: "chen2021evaluating",
  wholeWord: true
})

vswrite_compile()
```

Three calls, the project recompiles cleanly, and the version-save
gives you a one-click rollback if anything went sideways. The
equivalent operation by hand would be: open each chapter, search,
replace, save, repeat. Easy to get wrong.

== Skill prompts

When a vswrite project is opened, three skill files are deployed to
`.claude/skills/`:

- `typst` — Typst language reference (math, cross-refs, footnotes,
  bibliography)
- `vswrite` — vswrite-specific conventions (folder structure,
  persistence layers, comments format, citation vs reference
  disambiguation)
- `research` — research workflow (4-phase pattern, backlinks,
  pre-submission checklist)

Any AI tool with filesystem access automatically reads these when its
skill-matching kicks in. For MCP clients, the same content is
available as MCP prompts (see @sec:introduction for the link to the
handbook section that explains this in detail).

== When *not* to invoke AI

A short list, because it bears restating:

+ When you are unsure what you want to say. Asking the model "what
  should I say" produces text; it does not produce thinking.
+ When the next paragraph is the actual contribution of the chapter.
  That is your job and yours alone.
+ When you have not yet read the sources you are about to cite. Read
  them first; ask the AI for help with formatting after.

The pattern is consistent: the AI is excellent at #emph[after] —
after you know what you mean, after you have read the sources, after
you have a structure. It is bad at #emph[before].
