#import "style.typ": *
#show: apply-style

#text(size: 30pt, weight: "bold")[Portfolio]
#v(0.2em)
#text(size: 1.1em, fill: style-colors.muted)[Selected work — replace with your own projects.]
#v(1.5em)

== Project One

#figure(image("assets/work-1.png", width: 100%), caption: [A placeholder project image.])

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

#grid(columns: 3, column-gutter: 1em,
  [#text(weight: "bold", fill: style-colors.accent)[Role] \ Design],
  [#text(weight: "bold", fill: style-colors.accent)[Year] \ 2026],
  [#text(weight: "bold", fill: style-colors.accent)[Client] \ Lorem Inc.],
)

#pagebreak()

== Project Two

#figure(image("assets/work-2.png", width: 100%), caption: [A placeholder project image.])

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.

#grid(columns: 3, column-gutter: 1em,
  [#text(weight: "bold", fill: style-colors.accent)[Role] \ Design],
  [#text(weight: "bold", fill: style-colors.accent)[Year] \ 2026],
  [#text(weight: "bold", fill: style-colors.accent)[Client] \ Lorem Inc.],
)

