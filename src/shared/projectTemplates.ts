/**
 * Templates for the "New Project" command.
 */

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  files: Record<string, string>;
}

export const templates: ProjectTemplate[] = [
  {
    id: 'document',
    label: 'Document',
    description: 'Simple document with basic setup',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em)

= My Document

Start writing here...
`,
    },
  },
  {
    id: 'thesis',
    label: 'Thesis',
    description: 'Academic thesis with chapters and bibliography',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.1")

#align(center)[
  #text(size: 24pt, weight: "bold")[Thesis Title]

  #v(1em)

  Author Name

  #v(0.5em)

  #datetime.today().display("[month repr:long] [day], [year]")
]

#pagebreak()

#outline()

#pagebreak()

#include "chapters/01-introduction.typ"
`,
      'chapters/01-introduction.typ': `= Introduction

Start writing your introduction here...
`,
      'bibliography.bib': `// Add your bibliography entries here
`,
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Academic paper with abstract and references',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 10pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.")

#align(center)[
  #text(size: 16pt, weight: "bold")[Paper Title]

  #v(0.5em)

  Author Name

  _Institution_
]

#v(1em)

*Abstract.* Write your abstract here...

#v(1em)

= Introduction

Start writing here...

= Related Work

= Method

= Results

= Conclusion
`,
      'bibliography.bib': `// Add your bibliography entries here
`,
    },
  },
  {
    id: 'letter',
    label: 'Letter',
    description: 'Formal letter',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a4", margin: 2.5cm)

#align(right)[
  #datetime.today().display("[month repr:long] [day], [year]")
]

#v(2em)

Recipient Name \\
Street Address \\
City, ZIP

#v(2em)

*Subject: Your Subject*

#v(1em)

Dear Recipient,

Start writing here...

#v(2em)

Sincerely,

Your Name
`,
    },
  },
  {
    id: 'book',
    label: 'Book',
    description: 'Book with chapters, table of contents',
    files: {
      'main.typ': `#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set page(paper: "a5", margin: 2cm)
#set par(leading: 0.65em, spacing: 1.2em, first-line-indent: 1em)
#set heading(numbering: "1.")

#align(center + horizon)[
  #text(size: 28pt, weight: "bold")[Book Title]

  #v(1em)

  #text(size: 16pt)[Author Name]
]

#pagebreak()

#outline()

#pagebreak()

#include "chapters/01-chapter.typ"
`,
      'chapters/01-chapter.typ': `= Chapter One

Start writing here...
`,
    },
  },
];
