#import "../style.typ": *
#import "../macros.typ": *

// Interview as a two-column spread with its own symmetric type area. The
// opener runs full width; below it a "profile" box + first questions on the
// left, the portrait on the right; the rest of the conversation in two columns.
#set page(margin: (x: 2.6cm, top: 3cm, bottom: 3.2cm))

#opener(
  kicker: "Interview",
  title: "Lorem Ipsum Dolor Sit",
  standfirst: "Consectetur adipiscing elit — sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim.",
  byline: "Interview by A. Writer",
)

#grid(
  columns: (1fr, 0.78fr), column-gutter: 1.4em, align: top,
  {
    block(inset: (x: 1em, y: 0.85em), below: 0.5em, stroke: 0.6pt + style-colors.muted.lighten(25%))[
      #set par(justify: false, first-line-indent: 0pt, leading: 0.74em)
      #text(size: 0.74em, weight: "bold", tracking: 0.1em, fill: style-colors.accent, hyphenate: true)[#upper("About")]
      #v(0.5em)
      #set text(size: 0.88em)
      Lorem Ipsum, 00, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    ]

    frage[Lorem ipsum dolor sit amet, consectetur adipiscing elit?]

    [Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.]

    frage[Ex ea commodo consequat, duis aute irure dolor?]

    [In reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident sunt in culpa.]
  },
  {
    image("../assets/portrait.png", width: 100%)
    v(0.45em)
    text(size: 0.8em, style: "italic", fill: style-colors.muted)[Lorem ipsum dolor — a placeholder caption for the portrait.]
    v(0.7em)
    frage[Qui officia deserunt mollit anim id est laborum?]
    [Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam.]
  },
)

#v(0.4em)

#columns(2, gutter: 1.5em)[
  #frage[Rem aperiam, eaque ipsa quae ab illo inventore veritatis?]

  Et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos.

  #frage[Qui ratione voluptatem sequi nesciunt?]

  Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam.

  #frage[Aliquam quaerat voluptatem, ut enim ad minima?]

  Veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate.

  #frage[Velit esse quam nihil molestiae consequatur?]

  Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti.
]
