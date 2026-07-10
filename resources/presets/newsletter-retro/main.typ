#import "style.typ": *
#show: apply-style
#import "blocks.typ": *

#align(center)[
  #text(size: 34pt, weight: "bold", fill: style-colors.accent)[THE NEWSLETTER]
  #v(0.15em)
  #text(size: 0.85em, tracking: 0.2em, fill: style-colors.muted)[ISSUE 01 · #datetime.today().display("[month repr:long] [year]")]
]
#band[#tag("News") #tag("Updates") #tag("Events") #h(1fr) In this issue — replace with your own topics.]

#columns(2, gutter: 1.4em)[
  == Lorem Ipsum
  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

  #callout[Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.]

  == Dolor Sit Amet
  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.

  #colbreak()

  == Consectetur
  Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.

  #pullquote[Qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.]

  == Adipiscing Elit
  At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate.
]
