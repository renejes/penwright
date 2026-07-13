#import "style.typ": *
#show: apply-style
#import "blocks.typ": *

#block(width: 100%, fill: style-colors.accent, inset: (x: 1.3em, y: 1.5em), radius: 12pt)[
  #text(size: 0.9em, weight: "bold", tracking: 0.22em, fill: style-colors.background)[#upper("Announcing")]
  #v(0.55em)
  #text(size: 46pt, weight: "bold", fill: style-colors.background, font: style-fonts.heading)[A Big Bold Poster]
]

#v(1.3em)
#text(size: 1.7em, fill: style-colors.text)[A short, punchy line that grabs attention — replace it.]

#v(1em)
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

#v(1.2em)
#grid(columns: (1fr, 1fr), gutter: 1.2em,
  callout(title: "When")[Saturday · 7:00 pm],
  callout(title: "Where")[The Big Venue · Downtown],
)

#v(1em)
Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.
