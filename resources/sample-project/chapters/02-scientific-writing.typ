= Scientific Writing Fundamentals <sec:fundamentals>

Before we discuss AI assistance, a brief refresher on what scientific
writing actually requires. The mechanics — citation, structure, the
voice — predate any AI tool and remain the substrate on which the rest
of this document depends.

== Structure

Most academic genres follow a near-identical macro-shape:

+ *Introduction* — what is the question, why does it matter, how does
  this work fit in.
+ *Related work / background* — what others have said, summarised
  fairly and cited explicitly.
+ *Method* — what you did, in enough detail that someone else could do
  it again.
+ *Results* — what you found, separated from interpretation.
+ *Discussion* — what it means, what limits the conclusion, what comes
  next.
+ *Conclusion* — a short re-statement of the contribution.

Subgenres differ in proportion (a thesis spends more on background; a
short paper compresses it) but not in kind.

== Citation ethics

Citations are not decorative. Every claim that does not originate with
the author must point to a source that the reader can independently
verify. The minimum bar across most communities is summarised in
@tbl:citation-styles, which compares three of the most common citation
styles you will encounter.

#figure(
  table(
    columns: (auto, 1fr, 1fr, 1fr),
    inset: 8pt,
    align: left,
    [*Style*],         [*Used in*],                    [*In-text*],            [*Reference list*],
    [APA (7th)],       [Psychology, social sciences],  [(Bender et al., 2021)], [Author–date, alphabetical],
    [Chicago],         [Humanities, history],          [#sym.dagger note or footnote], [Notes-and-bibliography],
    [IEEE],            [Engineering, computer science], [\[1\]],                [Numbered, by appearance],
  ),
  caption: [Three citation styles you are likely to encounter, with
    the conventions each uses for in-text references and the
    reference list. The choice is usually dictated by the venue,
    not the author.],
) <tbl:citation-styles>

The ethical bar is not the format but the practice: paraphrase
faithfully, attribute precisely, and never make a citation say more
than the source actually claims. Misuse of citation is corrosive in a
way that bad style is not — every fabricated reference is a small
instance of the same problem the AI-hallucination literature
documents at length @ji2022hallucination.

== Voice

A useful distinction when revising is between three voices that
academic prose mixes:

- *Descriptive* — recounting what is known or what was observed.
  Carries the reader through the facts.
- *Analytic* — taking those facts apart, comparing them, identifying
  patterns. Carries the argument.
- *Evaluative* — judging the work, suggesting where it falls short.
  Carries the contribution.

Readers can tell when a paragraph stays in only one voice for too
long. A clean introduction usually moves through all three within the
first page#footnote[A useful self-test during revision: highlight each
sentence in a different colour by voice. If a paragraph is one solid
block, it probably needs work.].
