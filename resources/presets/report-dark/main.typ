#import "style.typ": *
#show: apply-style
#import "blocks.typ": *

#v(2.6cm)
#herohead("Report Title", kicker: "Report", subtitle: "A subtitle for this report — replace with your own.", size: 2.9em)
#v(0.5em)
#text(size: 0.9em, fill: style-colors.muted)[Prepared by · Author Name #h(1fr) #datetime.today().display("[month repr:long] [year]")]

#v(1.3em)
#statrow((("128", "Data points"), ("+42%", "Growth"), ("7", "Regions"), ("A+", "Rating")))

#pagebreak()

= Executive Summary
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

#callout(title: "Key takeaway")[Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.]

= Findings
Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.

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

#pullquote[At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate.]

= Recommendations
#steps(([Qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.], [Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur autem vel eum iure reprehenderit qui in ea voluptate velit.], [Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.]))
