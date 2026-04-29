# Sources

This folder is where PDFs of cited works live. vswrite's citation hover-card
matches PDFs by filename: a file whose basename starts with the citekey is
treated as the source for that citation.

## Shipped with this sample (all five)

All five citations have a matching PDF in this folder. Hover over any
`@citekey` in the document and an *Open PDF* button will appear —
clicking it opens the source as a regular tab in vswrite's PDF viewer.

| Citekey | File | Source |
|---|---|---|
| `chen2021codex` | `chen2021codex.pdf` | https://arxiv.org/abs/2107.03374 |
| `bender2021parrots` | `bender2021parrots.pdf` | https://dl.acm.org/doi/10.1145/3442188.3445922 |
| `weidinger2021risks` | `weidinger2021risks.pdf` | https://arxiv.org/abs/2112.04359 |
| `ji2022hallucination` | `ji2022hallucination.pdf` | https://arxiv.org/abs/2202.03629 |
| `liu2023chatgpt` | `liu2023chatgpt.pdf` | https://arxiv.org/abs/2304.05335 |

Bender et al. is the ACM FAccT proceedings paper (CC-BY); the other four
are arXiv preprints (perpetual non-exclusive arXiv license).

## Naming variants

If you have multiple PDFs per source — supplements, alternate copies —
suffix the citekey with `_`, `-`, space, or `.`:

- `chen2021codex.pdf` — exact match (preferred)
- `chen2021codex_supplement.pdf` — accepted as fallback
- `chen2021codex-arxiv.pdf` — accepted as fallback
- `Chen et al. - Evaluating LLMs.pdf` — **not** matched (no citekey prefix)

The MCP tool `vswrite_find_source_for_citation` uses the same matching
logic as the in-app hover-card.
