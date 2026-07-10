#import "style.typ": *
#show: apply-style

#align(center)[
  #text(size: 30pt, weight: "bold")[The Cookbook]
  #v(0.2em)
  #text(size: 1.1em, style: "italic", fill: style-colors.muted)[A sample of recipes — replace with your own.]
]
#pagebreak()

= Lorem Ipsum Soup

#grid(columns: (1fr, 1fr), column-gutter: 1.5em, align: top,
  [
    #figure(image("assets/dish-1.png", width: 100%), caption: [Serves 4 · 30 min])
  ],
  [
    #text(weight: "bold", fill: style-colors.accent)[#upper("Ingredients")]
    #v(0.3em)
    - 200 g lorem ipsum
    - 2 dolor sit amet
    - 1 tbsp consectetur
    - a pinch of adipiscing
  ],
)

#v(0.5em)
#text(weight: "bold", fill: style-colors.accent)[#upper("Method")]
#v(0.3em)
+ Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
+ Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
+ Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

#pagebreak()

= Dolor Sit Amet Salad

#grid(columns: (1fr, 1fr), column-gutter: 1.5em, align: top,
  [
    #figure(image("assets/dish-2.png", width: 100%), caption: [Serves 4 · 30 min])
  ],
  [
    #text(weight: "bold", fill: style-colors.accent)[#upper("Ingredients")]
    #v(0.3em)
    - 200 g lorem ipsum
    - 2 dolor sit amet
    - 1 tbsp consectetur
    - a pinch of adipiscing
  ],
)

#v(0.5em)
#text(weight: "bold", fill: style-colors.accent)[#upper("Method")]
#v(0.3em)
+ Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.
+ Qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
+ Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.

