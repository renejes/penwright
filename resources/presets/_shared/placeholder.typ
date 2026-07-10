// Neutral placeholder-image generator for preset assets.
//
// Render with the bundled Typst at 72 ppi so 1pt = 1px:
//   typst compile --input w=1600 --input h=1067 --input label=FEATURE \
//     --format png --ppi 72 placeholder.typ feature.png
//
// A calm duotone card with a subtle frame mark + a faint label — reads as an
// intentional placeholder, not a broken image. Colours sit in the cream/ink
// family so it looks at home in an editorial layout.

#let w = float(sys.inputs.at("w", default: "1600"))
#let h = float(sys.inputs.at("h", default: "1067"))
#let lbl = sys.inputs.at("label", default: "IMAGE")

#set page(width: w * 1pt, height: h * 1pt, margin: 0pt, fill: rgb("#d9d6cd"))

#place(center + horizon, dy: -0.04 * h * 1pt,
  text(size: 0.14 * calc.min(w, h) * 1pt, fill: rgb("#bab6aa"))[▧])

#place(center + horizon, dy: 0.11 * h * 1pt,
  text(size: 0.022 * calc.min(w, h) * 1pt, tracking: 4pt, weight: "medium", fill: rgb("#a8a498"))[#upper(lbl)])
