// Palette-matched placeholder-image generator for preset assets.
//
// Render at 72 ppi so 1pt = 1px (presets-scaffold.mts passes the palette):
//   typst compile --input w=1600 --input h=1000 --input label=Feature \
//     --input accent=#8a6a3a --input muted=#7c847e placeholder.typ feature.png
//
// A soft two-tone gradient + a quiet geometric composition in the preset's own
// accent/muted colours + a faint label — reads as an intentional placeholder,
// not a broken grey box, and looks at home in that preset's palette.

#let w = float(sys.inputs.at("w", default: "1600"))
#let h = float(sys.inputs.at("h", default: "1000"))
#let lbl = sys.inputs.at("label", default: "IMAGE")
#let accent = rgb(sys.inputs.at("accent", default: "#8a8f9a"))
#let muted = rgb(sys.inputs.at("muted", default: "#9aa0aa"))
#let m = calc.min(w, h) * 1pt

#set page(
  width: w * 1pt, height: h * 1pt, margin: 0pt,
  fill: gradient.linear(muted.lighten(74%), accent.lighten(68%), angle: 130deg),
)

// Quiet geometric composition, palette-matched + low-key.
#place(top + left, dx: 0.07 * w * 1pt, dy: 0.11 * h * 1pt,
  circle(radius: 0.23 * m, fill: accent.transparentize(80%)))
#place(bottom + right, dx: -0.05 * w * 1pt, dy: -0.07 * h * 1pt,
  rect(width: 0.36 * m, height: 0.36 * m, radius: 16pt, fill: muted.transparentize(70%)))
#place(center + horizon,
  circle(radius: 0.10 * m, stroke: 2pt + accent.transparentize(42%)))
#place(center + horizon, dy: 0.17 * h * 1pt,
  text(size: 0.028 * m, tracking: 4pt, weight: "medium", fill: accent.transparentize(32%))[#upper(lbl)])
