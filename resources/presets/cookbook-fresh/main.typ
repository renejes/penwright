#import "style.typ": *
#show: apply-style
#import "blocks.typ": *

#herohead("The Cookbook", kicker: "Recipes", subtitle: "A sample of recipes — replace with your own.", size: 2.9em)
#pagebreak()

= Lorem Ipsum Soup

#tag("Serves 4") #tag("30 min") #tag("Easy")

#v(0.7em)

#grid(columns: (1fr, 1fr), column-gutter: 1.5em, align: top,
  figure(image("assets/dish-1.png", width: 100%)),
  callout(title: "Ingredients")[
    - 200 g lorem ipsum
    - 2 dolor sit amet
    - 1 tbsp consectetur
    - a pinch of adipiscing
    - salt & pepper to taste
  ],
)

#v(0.5em)
#text(weight: "bold", tracking: 0.08em, fill: style-colors.accent)[#upper("Method")]
#steps(([Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.], [Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.], [Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.]))

#pagebreak()

= Dolor Sit Amet Salad

#tag("Serves 4") #tag("30 min") #tag("Easy")

#v(0.7em)

#grid(columns: (1fr, 1fr), column-gutter: 1.5em, align: top,
  figure(image("assets/dish-2.png", width: 100%)),
  callout(title: "Ingredients")[
    - 200 g lorem ipsum
    - 2 dolor sit amet
    - 1 tbsp consectetur
    - a pinch of adipiscing
    - salt & pepper to taste
  ],
)

#v(0.5em)
#text(weight: "bold", tracking: 0.08em, fill: style-colors.accent)[#upper("Method")]
#steps(([Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.], [Qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.], [Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.]))

