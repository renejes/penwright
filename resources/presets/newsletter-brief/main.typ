#import "style.typ": *
#show: apply-style

#align(center)[
  #text(size: 34pt, weight: "bold")[THE NEWSLETTER]
  #v(0.2em)
  #text(size: 0.85em, tracking: 0.2em, fill: style-colors.muted)[ISSUE 01 · #datetime.today().display("[month repr:long] [year]")]
]
#line(length: 100%, stroke: 1pt + style-colors.accent)
#v(1em)

#columns(2, gutter: 1.4em)[
  == Lorem Ipsum
  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

  == Dolor Sit Amet
  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

  #colbreak()

  == Consectetur
  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.

  == Adipiscing Elit
  Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.
]
