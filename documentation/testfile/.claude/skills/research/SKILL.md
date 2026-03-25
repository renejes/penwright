---
name: research
description: Deep web research with structured output — search for academic sources, synthesize findings, save results and citations to the project
---

# Deep Research — Agent Instructions

When the user asks you to research a topic ("recherchiere", "suche nach", "find sources about"), follow this workflow.

## Workflow

### Step 1: Understand the Request
- Identify the research question and scope
- Check the document's language (`vswrite-cli get-settings <file>` or read the .typ file)
- Note specific requirements: academic level, field, time period, number of sources

### Step 2: Search
Use WebSearch to find relevant sources. Run multiple searches:
- In the document's language for local/regional sources
- In English for international coverage
- Academic queries: `{topic} research paper`, `{topic} systematic review`
- Institutional queries: `{topic} site:edu`, `{topic} site:gov`

### Step 3: Gather & Evaluate
For each promising result, use WebFetch to retrieve full content. Collect:
- Title, author(s), publication year, URL
- Key findings, methodology, conclusions
- Source quality: peer-reviewed > books > institutional > news > blogs

### Step 3b: Download PDFs
When a freely accessible PDF is found (open access, arXiv, institutional repos):
```bash
# Download PDF to sources/
curl -L -o sources/author2024-title.pdf "https://arxiv.org/pdf/2401.12345.pdf"

# Verify it's a valid PDF
file sources/author2024-title.pdf

# Read the PDF to extract key information
# (Use the Read tool — it supports PDF files natively)
```

**Important:**
- Only download freely accessible PDFs — never bypass paywalls or login walls
- Use descriptive filenames: `sources/{author}{year}-{short-title}.pdf`
- After downloading, read the PDF with the Read tool to extract findings for the research document
- For large PDFs, use the `pages` parameter: `Read(file_path, pages: "1-10")`

### Step 4: Save Results

#### Research Document
Save as `sources/research-{topic-slug}.md` (create `sources/` if it doesn't exist):

```markdown
# Research: {Topic Title}

**Date:** {YYYY-MM-DD}
**Query:** {original user query}
**Sources found:** {number}

## Summary
{3-5 sentence overview of key findings}

## Key Findings

### {Subtopic 1}
{Findings with inline citations}
- Source: {Author} ({Year}), "{Title}"

### {Subtopic 2}
{Findings with inline citations}

## Debates & Contradictions
{Where sources disagree, if applicable}

## Gaps & Open Questions
{What couldn't be answered with available sources}

## Source Table
| # | Author | Title | Year | Type | URL |
|---|--------|-------|------|------|-----|
| 1 | ... | ... | ... | article | ... |
```

#### Add Citations
Check existing citations first, then add new ones:
```bash
vswrite-cli parse-bib references.bib            # Check for duplicates
vswrite-cli add-citation --bib references.bib \
  --title "Source Title" \
  --author "Last, First" \
  --year "2024" \
  --type article
```

### Step 5: Report to User
Summarize concisely:
- Number of sources found and saved
- Top 3-5 key findings (bullet points)
- File location of full research document
- Citation keys added (`@author2024`) ready for use in the document
- Suggestions for where to integrate findings in the document

## Quality Standards

1. **Quality over quantity** — 5 excellent sources beat 20 mediocre ones
2. **Source hierarchy:** peer-reviewed > books > institutional reports > news > blogs
3. **Recency matters** — prefer recent sources unless historical context is needed
4. **Attribute all claims** — every statement must reference a specific source
5. **Multiple perspectives** — note where experts disagree
6. **Match document language** — write the research document in the same language as the .typ document
7. **Check for bias** — note funding sources or conflicts of interest when apparent

## Directory Structure

```
project/
├── main.typ
├── references.bib          <- citations added here
├── sources/
│   ├── research-topic-a.md  <- structured research results
│   ├── research-topic-b.md
│   └── paper-title.pdf      <- if freely available (open access)
```

## Tips

- Create `sources/` and `references.bib` if they don't exist
- Download freely available PDFs (open access) to `sources/` using `curl -L -o`
- After downloading a PDF, read it with the Read tool to extract content for the research summary
- For German academic work, also search on Google Scholar with German queries
- After research, suggest specific sections in the document where findings could be cited
- Use `vswrite-cli check <file> --json` after adding citations to verify the document still compiles
- Common open access sources: arXiv, PubMed Central, SSRN, institutional repositories, government publications
