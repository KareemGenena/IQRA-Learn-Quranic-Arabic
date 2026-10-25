# Tracing templates — how a letter's strokes are made

Lesson 30 ("Tracing the Letters") draws each letter stroke by stroke and
checks a finger against the same strokes. The strokes come from the font's
own glyph, never from a drawing of our own:

1. `node scripts/tracing/render-glyphs.mjs <workdir>` — headless Chrome
   renders the 29 letters of lesson 20 at 400 px in `UthmanicHafs1-Ver09.otf`
   into `<workdir>/sheet.png` (a 6 × 5 grid of 600 px cells) and writes
   `letters.json` beside it. The dev server is not needed.
2. `node scripts/tracing/derive-strokes.mjs <workdir>` — thins each glyph to
   its centerline (Zhang–Suen), snaps the letter's **waypoints** from
   `waypoints.json` to that centerline, walks the shortest way along it from
   waypoint to waypoint, smooths and resamples the walk to 48 points, and
   writes `strokes.json` — every stroke in the frame of the glyph's ink box
   (0–1 across, 0–1 down). A stroke of one point is a dot to tap. Dots are
   the glyph's small separate pieces, split to the count the letter carries
   (`taps` in `waypoints.json`: at 400 px two dots touch and render as one),
   ordered lower-first, right-first. It also writes `<workdir>/proof.png`:
   every letter with its strokes numbered and arrowed. **Read it** before
   trusting a change — the waypoints decide the order and the direction, and
   a waypoint that snaps to the wrong arm walks the wrong way (د did, once).
3. `node scripts/make-alphabet.mjs` folds `strokes.json` into
   `public/lessons/lesson30/words.json` (`trace` on each card).

Only `waypoints.json` is authored. The geometry is the font's, so a retake of
the font (a new version of the face) is a re-run, not a redraw. The font is
never modified or parsed — a raster of the letter as the app draws it is all
this reads.

At runtime (`src/components/TraceCard.tsx`) the letter is SVG text in the
same face; its ink box is measured on a canvas (`measureText`'s actual
bounding box) and the strokes are laid onto it. The rule of what counts as
tracing is `src/lib/tracing.ts`.

## The teacher's own strokes (2026-10-25)

The font-derived strokes are defaults. On a tracing card the admin's
**Teach the strokes** button records his own hand — each touch a stroke, a
short touch a dot — and **Save** writes them to Firestore `tracing/{letter}`
(`src/lib/tracingStore.ts`; the rule is in `firestore.rules`). Every device
prefers them. `node scripts/tracing/pull-cloud.mjs` writes them to
`authored.json`, and the next `derive-strokes.mjs` run bakes them into
`strokes.json` over the defaults, letter by letter, so a build carries them
without the cloud. "Use the font's strokes" on the card deletes a letter's
cloud template.

Also in this round: strokes are pushed to the ink's edge (`extend`), the
proof arrows every third point so a pass back along the same line shows,
and the letter is painted through a mask at runtime (TraceCard.tsx), so the
exact line matters less than its order and direction.

## 2026-10-25 — the author's orders, the brush, the tips

`waypoints.json` now holds the author's own writing order for every letter
(see `CLAUDE.md` §3, "Tracing"); `strokeAll` names letters whose small piece
is a stroke, not a dot (ك's sign). The deriver pulls a stroke's first and
last waypoint to the skeleton's end where one lies within a tenth of the
box along a line (`toEnd`), so a stroke reaches the glyph's tips, and
measures each glyph's thickest stroke by a chamfer distance transform
(`maxInscribed`) → `brush` in strokes.json, the width the card paints with.

## 2026-10-25, later — pixel painting

`src/lib/tracePaint.ts` replaces the SVG mask: the glyph's pixels are each
given to the nearest stroke point (stroke, share along it), and the canvas
shows a pixel's color when its stroke is done or the finger has passed its
share. `dotRadius` in strokes.json is a dot's size for the ring the card
draws on it.

## 2026-10-25, evening — segments and the earliest pass

Two rules replaced "nearest point" (teeth where two parts of a letter run
close; holes where a stroke crosses itself or a later stroke stands on an
earlier one): a pixel's share is its projection onto the nearest SEGMENT,
and it lights at the earliest pass whose ink it is — any segment within
the stroke's own half-width there (a chord through the glyph, capped at
2.5 medians) with a clear line of ink between. `brush` in strokes.json is
no longer read by the card; it stays as a measurement.
