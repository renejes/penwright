= AI as a Writing Assistant <sec:ai-assistant>

The premise of this chapter is narrow: that AI is most useful in
academic writing when it is treated as a competent assistant on
mechanical tasks, and is kept out of the seat where original analysis
belongs.

== Where AI helps

Three kinds of work benefit immediately:

- *Search and triage.* "Find me five recent peer-reviewed papers on X
  with at least 20 citations, summarise each in one sentence." The AI
  is faster than manual search and the results are easy to verify
  against the abstracts.
- *Paraphrase and tighten.* Drafts have a tendency to drift into
  repetition and hedging. A model is good at the
  third-pass rewrite where the goal is to keep the meaning and lose
  the words.
- *Format conversion.* Turning a list of bullet points into a paragraph,
  a table into prose, BibTeX into APA — the kind of work that takes a
  human five minutes and a model five seconds.

== Where AI does not (yet) help

A model cannot tell you whether your contribution is novel; it cannot
evaluate whether your method is sound for the question you are asking;
it cannot choose between two competing interpretations of an
ambiguous result. These are the parts that the writer is paid to do
and that no LLM has shown reliable competence at @liu2023chatgpt.

== A workflow that respects both

@fig:workflow shows a workflow we have found practical for thesis-style
work. The shape is: keep a tight loop where the writer drafts and the
AI shortens, never the reverse.

#figure(
  image("../assets/workflow-diagram.svg", width: 85%),
  caption: [A conservative AI-assisted workflow for academic writing.
    The writer owns the structural decisions (left); the assistant
    accelerates the mechanical loops (right). Bibliography extraction
    and formatting are good handovers; argument construction is not.],
) <fig:workflow>

The workflow generalises poorly to settings where the writer is unsure
what they want to argue. In that situation, asking the model to
"suggest an argument" tends to produce plausible-sounding text that
does not survive contact with a careful reader.

== A note on the underlying mechanics

Modern language models are autoregressive: given a prefix, they predict
the next token from a probability distribution conditioned on the
context window. The training objective is a maximum-likelihood
estimate of natural-language continuations:

$ cal(L)(theta) = -sum_(i=1)^N log P_theta (x_i | x_(<i)) $ <eq:mle>

@eq:mle is, in some sense, the reason the output reads fluently and
also the reason it is unreliable for factual claims. The model is
optimising for plausibility of continuation given the training corpus,
not for truth of the resulting statement @bender2021parrots.
