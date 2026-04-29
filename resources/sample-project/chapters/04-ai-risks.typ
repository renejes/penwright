= Risks and Mitigation <sec:risks>

Any tool capable of saving an hour can also be capable of producing an
hour's worth of damage to a manuscript or a career. This chapter
catalogues the failure modes and what you can do about each of them.

== Hallucinated citations

The most embarrassing failure mode: a model produces a citation that
looks plausible — correct authors, plausible journal, real-sounding
title — but that does not exist. The model is doing what it always
does, sampling from plausible token continuations; it has no separate
mechanism that says "but does this paper exist".

#quote(block: true)[
  Stochastic parrots are good at sounding right and bad at being
  right; the gap between the two is what makes language models such
  a brittle source for factual claims.
] @bender2021parrots

*Mitigation.* Never use a citation a model gave you without resolving
the DOI yourself. If the DOI does not resolve, the citation is wrong.
The empirical study of this exact failure mode now has its own survey
literature @ji2022hallucination.

== Plagiarism by indirection

A second failure mode is more subtle. A model paraphrases another
author's distinctive phrasing without attribution because no one told
it to attribute. The output is technically your text — the model is
not the author — but the underlying ideas are someone else's.

*Mitigation.* When asking a model to paraphrase, give it the source
text *and* require that the citation be preserved in the output. If
the source is missing, do not let the paraphrase go in.

== Bias inherited from training data

Models reproduce the biases of their training corpora — geographic,
linguistic, demographic. For a thesis on, say, healthcare equity in
Sub-Saharan Africa, an off-the-shelf model trained on
English-dominant sources will under-represent the relevant
literature.

*Mitigation.* Treat the AI as a starting point for your own search,
not a substitute. The Liu et al. summary @liu2023chatgpt walks through
this concern across application domains.

== Disclosure

The norm across major journals is now converging on a simple rule: if
a model contributed substantively to the manuscript, you must say so,
where, and how. The exact wording varies by venue, but the
expectation is that the AI's role is documented in the methods
section or in a dedicated AI-use statement.

#figure(
  table(
    columns: (1fr, 2fr),
    inset: 8pt,
    align: left,
    [*Used for*],                               [*Disclose?*],
    [Spell-checking, grammar fixes],            [No (treated like Word's grammar checker)],
    [Paraphrasing single sentences],            [Usually no, but check the venue],
    [Drafting paragraphs from your bullet points], [Yes — say which sections],
    [Generating analysis or interpretation],    [Yes, prominently — and reconsider whether you should],
    [Translating between languages],            [Yes, briefly],
  ),
  caption: [Rough disclosure thresholds. The right column is a
    starting point; check the venue's specific policy before
    submission.],
) <tbl:disclosure>

The Weidinger et al. risk catalogue @weidinger2021risks is a good
broader primer if you want to understand which categories of harm
your specific use case might fall into before deciding how to
disclose it.

== The bigger pattern

The mitigations above are individually obvious. The reason they are
worth listing anyway is that they are easy to forget under deadline
pressure. The way to keep yourself honest is to build the verification
step into your workflow #emph[before] you need it, not after the
draft has gone to your supervisor.
