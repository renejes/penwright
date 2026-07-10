#import "style.typ": *
#show: apply-style

// ── Cover ──
#block(breakable: false)[
  #v(4cm)
  #text(size: 0.85em, weight: "bold", tracking: 0.2em, fill: style-colors.accent)[#upper("Report")]
  #v(0.6em)
  #text(size: 32pt, weight: "bold")[Report Title]
  #v(0.4em)
  #text(size: 1.2em, fill: style-colors.muted)[A subtitle for this report — replace with your own.]
  #v(1fr)
  #text(size: 0.9em, fill: style-colors.muted)[Prepared by · Author Name #h(1fr) #datetime.today().display("[month repr:long] [year]")]
]

#pagebreak()

= Executive Summary
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

= Findings
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

#figure(
  table(
    columns: 3,
    [*Metric*], [*Q1*], [*Q2*],
    [Lorem], [42], [58],
    [Ipsum], [31], [47],
    [Dolor], [76], [69],
  ),
  caption: [A placeholder data table.],
)

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.

= Recommendations
Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.

+ Lorem ipsum dolor sit amet
+ Consectetur adipiscing elit
+ Sed do eiusmod tempor incididunt
