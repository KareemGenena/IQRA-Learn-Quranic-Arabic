# Brand

The IQRA mark, wordmark and app icons. Everything here is generated:

```bash
node Brand/build.mjs
```

`art.html` is the artwork; `build.mjs` renders it to `out/` with headless
Chrome and downsamples with sharp. `font.css` is generated from the shipped
`.otf` on every run and is not committed.

## Why it is rendered rather than drawn

The three lines in the mark are the hadith «ٱقۡرَأۡ وَٱرۡتَقِ وَرَتِّلۡ», and they are
set in **the app's own KFGQPC Uthmanic Hafs** — literally the file
`app/public/fonts/UthmanicHafs1-Ver09.otf` that `index.css` serves to a
learner. Headless Chrome shapes it with HarfBuzz, so the mark positioning in
the logo is the mark positioning in a lesson.

A logo drawn as outlines would be a picture of the text, and would drift from
it the first time either changed. This one cannot: rebuild and it is correct.

The font is embedded as a **byte-identical base64 copy**. It is never subset
and never converted — the licence permits use and redistribution but not
modification, and this project has already learned once that this font's mark
positioning, not the Unicode chart, is the authority (see `CLAUDE.md`).

## The text

Read **bottom to top**, which is both the order of the hadith and the direction
of ٱرۡتَقِ, "ascend".

| line | text | codepoints |
|---|---|---|
| bottom | ٱقۡرَأۡ | `0671 0642 06E1 0631 064E 0623 06E1` |
| middle | وَٱرۡتَقِ | `0648 064E 0671 0631 06E1 062A 064E 0642 0650` |
| top | وَرَتِّلۡ | `0648 064E 0631 064E 062A 0651 0650 0644 06E1` |

Same conventions as every `words.json`: **U+0671** alif wasla (so the صـ
appears), **U+06E1** sukoon (the head of khah, not U+0652), shadda before its
vowel.

## Files

| file | use |
|---|---|
| `sheet.png` | the whole system on one page |
| `lockup.png` | mark + wordmark, horizontal |
| `mark-1024.png` | the mark alone, transparent |
| `proof.png` | the three lines at reading size, for checking marks |
| `pwa-512.png`, `pwa-192.png` | manifest icons, `purpose: any` |
| `maskable-512.png` | manifest icon, `purpose: maskable` — mark inside the 80% safe circle |
| `apple-touch-icon.png` | 180×180, **full bleed and opaque**: iOS rounds the corners itself and composites transparency onto black |
| `favicon.png` | 256×256, the ٱ alone — three lines are mush below 96px |

## Colours

| | |
|---|---|
| green | `#14513A` |
| gold | `#C1A054` |
| gold, deep | `#9A7B33` |
| cream | `#F6F3E9` |
| paper | `#FBFAF6` |

On a dark plate the arch's outline and the book's outer band move to gold —
a green outline on a green icon is invisible, which is what the first cut of
the app icon looked like.
