# IQRA — project context

A PWA that teaches Quranic Arabic pronunciation to English speakers. Tap a word,
hear the teacher's own voice, and watch each letter light up exactly as it is
pronounced. Live at **https://iqra---learn-quranic-arabic.web.app**

This file is loaded automatically at the start of every session. Keep it
current — the "Where we are" section at the bottom is the handover note.

> **If the session touches IQRA Kids — the Baghdadi-qaida curriculum for
> children, lessons 20–30 — read `Design/iqra-kids.md` before doing anything.**
> It is the design record for that work the way this file is for the app: the
> 11-lesson plan, what was decided, what is still open, and why. Only that file
> is loaded on its own; this one is. So: qaida, alphabet, kids, Maktab lessons,
> letter mnemonics, the kids skin → open it first. This file stays the
> authority on everything the two share.
>
> **If the session touches the Grammar track — nahw and sarf for adults who
> already read the mushaf — read `Grammar/IQRA_GRAMMAR_TRACK_SPEC.md` first,
> then `Grammar/M0-recon.md`.** The spec is the pedagogy and the build order
> (milestones M0–M6); the recon report maps its data model onto this app and
> lists the decisions that block M1. Only M0 is done (2026-09-19). So: grammar,
> nahw, sarf, parsing, فاعل, corpus, Quran text, sessions → open both first.

---

## 1. Architecture

| | |
|---|---|
| App | React + TypeScript + Vite, PWA via `vite-plugin-pwa` |
| Hosting | Firebase Hosting (project `iqra---learn-quranic-arabic`), Blaze plan |
| Data | Firestore for calibrations + publish config; everything else is static JSON |
| Auth | Firebase Auth, email/password. Admin = `kintegracion@gmail.com` |
| Repo | `1447 H/` → GitHub `KareemGenena/IQRA-Learn-Quranic-Arabic` (public) |

```
1447 H/
  Word Tables/      the author's .docx tables — SOURCE OF TRUTH for lesson text
  Audio/            the author's raw recordings, one folder per lesson
  app/
    scripts/        generators: docx + audio  →  words.json + split clips
      lib/          wav.mjs (audio), zip.mjs (docx), arabic.mjs (text rules)
    public/
      lessons/lessonNN/words.json    generated — never hand-edit
      audio/lessonNN/                generated clips
      fonts/                         KFGQPC Uthmanic Hafs + its licence
    src/
      lib/          timing, graphemes, playback, appConfig, notesStore, auth
      components/   ArabicWord, ItemCard, LaserPointer, LessonManager…
      pages/        HomePage, WordsLesson, SectionedLesson, NotesPage, AdminPage
```

**The pipeline.** The author writes a Word table and records audio; a generator
script turns both into `words.json` plus per-word clips. The app only ever reads
generated JSON. To change lesson content, change the docx or the generator and
re-run — never edit `words.json` by hand.

```bash
node scripts/make-lesson3.mjs     # rebuild one lesson
npm run build                     # tsc + vite
firebase deploy --only hosting:app   # from 1447 H/ (hosting:home = the landing page)
```

Routes are hash-based (works offline): `#/`, `#/lesson/N`, `#/notes/N`, `#/admin`,
`#/admin/N`.

---

## 2. What exists

- **Lesson 1** — 33 five-letter words, plain grid.
- **Lesson 2** — 46 words, each bare and with ال (sun/moon lam), paged with a
  mixed-review quiz.
- **Lesson 3** — throat letters ء ه ح ع غ خ: 45 words + 6 pair drills + 8
  contrast drills, in 8 sections. The taught letter is coloured inside the word.
- **Lesson 4** — hamzat wasl: each word alone, after وَ, after ثُمَّ (three forms
  per card), plus a "two sukoons meeting" section of three ayah phrases.
- **Accounts and roles** — sign up or sign in at `#/account`; a `users/{uid}`
  profile carries a name and a role of learner or teacher, self-declared.
  Admin is an email match, never a role. Deleting your own account is there
  too, behind a password.
- **Letter-by-letter highlighting** driven by per-letter timings.
- **Admin**: publish/take-down/delete lessons and toggle features at runtime;
  tap-to-calibrate timings that sync to every device.
- **Laser pointer** for teaching over a shared screen.
- **Notes** — endless per-lesson canvas: stylus draws, finger scrolls, typing in
  Uthmanic Hafs with a Quranic-mark palette. Local-only so far.
- **Lesson 5** — madd muttasil and munfasil, both held four harakat.
- **Lesson 6** — madd lāzim (kalimī and ḥarfī), madd ṣilah (ṣughrā and
  kubrā), badal / ʿiwaḍ / līn, and madd ʿāriḍ. Six sections, one per table in
  the sheet, all four columns filled (Word | Type of Madd | Length | Meaning
  or Location). The ʿāriḍ table's Word cells read `<word> وقف`: the tag names
  the take, the generator strips it for the card and shows each word three
  times, held 2, 4 and 6 at the stop with the final vowel greyed. 52 cards.
  Meanings are Sahih International's, and the (i) says so under each quotation.
- **Lesson 7** — nūn sākinah, tanwīn and mīm sākinah: five headed tables
  (mīm sākinah first — iqlāb turns a nūn into one), 176 cards in six sections
  (iẕhār · idghām with ghunna · idghām without · ikhfāʾ · iqlāb · mīm). Every
  nūn-table row has TWO example columns, Nūn Sākinah and Tanwīn, so it makes
  two cards; ids belong to cells. The tanwīn is written the way the Mushaf
  writes it — stacked, staggered or small-mīm, from the letter that follows,
  read from the Mushaf itself for a card's last word and greyed there — by
  rule in the generator (section 3). Badges: the rule, the letter, the form,
  the tanwīn shape, Ghunna where the rule has one. Draft, text only,
  unrecorded.
- **Class recordings** (`#/recordings`) — the teacher posts the link to a
  recorded session (Zoom or anything else) and the class finds it there instead
  of scrolling back through a chat thread. A pointer, never a copy: nothing is
  uploaded and the app never holds the video.
- **Audio intake** (`#/intake`, admin, reached from the admin bar) — open a
  Word sheet, get a recording slot per row, record in the browser, and write
  correctly named 16-bit WAVs straight into the folder a generator reads.

---

## 3. Conventions and hard-won decisions

Things that cost real debugging. Do not undo them without reading why.

**Arabic text**
- Uthmani encoding is not optional: sukoon is **U+06E1** (Mushaf head-of-khah),
  *not* U+0652; the article's alif is **U+0671** (alif wasla) so the ص appears.
  When something "looks like the wrong font", check the characters first.
- `graphemes.ts` `MARK_RE` is written in `\u` escapes and **enumerated, not
  spanned**: the annotation range U+06D6–U+06ED also holds the end-of-āyah and
  sajdah *symbols* (U+06DD, U+06DE, U+06E9), which stand alone and must not be
  glued to a letter. Anything left out of it is counted as a letter — its own
  highlight step, its own slice of the clip.
- The **small waw and small yeh (U+06E5, U+06E6) are marks here** even though
  Unicode classes them as letters (Lm): the Mushaf uses them as the ṣilah vowel
  on the pronoun's هـ (هُۥ، هِۦ). Left out, the tiny ۥ was a highlighted "letter"
  and the هـ never learned it had a madd. Any "combining mark" test misses them
  — hence the explicit listing.
- A **hamza seated on a tatweel (ـٔ) is a cluster in its own right** — a real
  consonant (ءَآلۡـٔـٰنَ, خَطِيٓـَٔةً, أَفۡـِٔدَةِ). Its base letter is empty, and
  the check that drops spaces used to test the *base*, which threw the hamza
  away as if it were a space. It tests the segment now. Spaces are dropped so
  multi-word phrases don't gain a phantom step.
- The madd sign is applied by rule (`scripts/lib/arabic.mjs`), not by hand.
- **Do NOT "normalise" the silent-letter circles.** In this font the three
  marks sit where the author's Word already puts them:
  - **U+0652** = the round zero (صفر مستدير), a silent letter.
  - **U+06E0** = the rectangular zero (صفر مستطيل), conditional silence.
  - **U+06E1** = sukoon (the small head of khah).
  Advice online says canon puts the round zero at U+06DF and sukoon at U+0652,
  so a Word file using U+0652 for the zero looks mis-encoded. That is true of
  Unicode and **false of this app**: KFGQPC Uthmanic Hafs carries the round
  zero's shape *and its mark positioning* on U+0652 — which is the same reason
  sukoon lives at U+06E1 here. U+06DF is in the font's cmap but is not
  positioned as an attached mark, so swapping to it renders a detached
  full-size circle beside the letter. This was learned by shipping the swap:
  row 3 of lesson 5 came back as جِا◉ىٓءَ. `normaliseZeros()` is kept as a
  named no-op so the swap is not reintroduced by the next person to read that
  advice. **The font is the authority, not the codepoint chart.**
- Both zeros sit inside `MARK_RE`, so they count as marks.
- **Silence is derived from the text, never declared per lesson.**
  `derivedSilent()` in `graphemes.ts` is the single rule, and every lesson goes
  through it. A letter is silent if it carries the round zero; if it carries
  the rectangular zero **and something follows** (أَنَا۠ sounds when you stop on
  it, vanishes in مَآ أَنَا۠ بِبَاسِطٍ); if it is a hamzat wasl **with a letter
  before it** (so ٱلنِّسَآءِ alone keeps its ٱ, مِنَ ٱلنِّسَآءِ drops it); or if it is
  the lam of a sun lam. Silent letters are greyed by `ArabicWord` and given no
  time by `timing.ts`, so the highlight steps straight over them. Lesson 4's
  `waslSilentIn` field and lesson 2's hardcoded cluster 1 are both subsumed —
  do not reintroduce either.
- **The tanwīn has three shapes, and the generator writes them from the
  Mushaf.** Stacked (مُتَرَاكِب, U+064B–064D) before a throat letter; staggered
  (مُتَتَابِع, U+08F0–08F2) before a letter of idghām or ikhfāʾ, where the nūn
  merges or hides; a vowel plus small mīm before ب (iqlāb). The shape is
  decided by the word that FOLLOWS — inside a card by the text, and for the
  card's last word by the Mushaf itself: `scripts/lib/mushaf.mjs` reads the
  Quranic Arabic Corpus (`Grammar/Corpus/…zip`, verbatim, Tanzil text; credit
  corpus.quran.com and tanzil.info) and `letterAfter(phrase, sura, aya)`
  returns the next word's first letter — the next āyah's first word at an
  āyah end, the basmalah's ب at a sūrah end, exactly as the Mushaf assumes
  (مِن مَّسَدٍ ends sūrah 111 and is written مَّسَدِۢ). **The whole phrase must
  stand in the cited āyah, word after word** — matching on the last word
  alone put عَلَيۡهِم مُّؤۡصَدَةٌ at 90:20 (which reads عَلَيۡهِمۡ نَارٞ مُّؤۡصَدَةٌ) and
  gave it a small mīm. When the cited āyah does not hold the phrase the whole
  Qurʾān is searched: one occurrence is used and reported as a sheet
  correction (that card is 104:8); several or none are reported and the
  tanwīn left stacked for the author to decide. `shapeTanween()` prints every
  final decision on every run. The sheets hold plain stacked marks
  throughout: the author's Word font cannot draw the other shapes.
- **Neither KFGQPC Hafs font on this machine has a staggered-tanwīn glyph.**
  The app's `UthmanicHafs1-Ver09.otf` and the author's `UthmanicHafs1Ver18`
  both map only U+064B–064D (checked in the cmap and every GSUB rule; the
  earlier `document.fonts.check` "yes" was wrong — that API does not test
  glyph coverage). A browser that lacks the glyph falls back to another font
  for the WHOLE letter, which is what the author saw. So `ArabicWord` keeps
  U+08F0–08F2 in the data (the timing engine and the greying read them) but
  DISPLAYS the single vowel in their place, ERASES that vowel's pixels from
  the base text, and draws it twice — two copies of the same string, each
  masked to the vowel's pixels and shifted half a stroke right and left
  (`.layer-stroke`, `STAGGER = 0.7` of the stroke's width). Same font, same
  string, the pair centred where the font put the single mark, on one level.
  Each stroke's mask drops every pixel that would land on a LETTER once
  shifted (`offInk`): the moved stroke's anti-aliased edge fell on the tail
  of مُّسۡتَقِيمࣲ's mīm and lightened it, because a layer paints over the base
  and the base is only erased where the unshifted mark was. Over ط ظ the
  pair is also LIFTED (`dy`, `STEM_GAP` 0.04 em) until neither tail touches
  the stem's tip — set over the stem, the first ḍamma sat on it.
- **Every recoloured or redrawn mark is a MASK over the same string** — never
  a stripped copy. `ArabicWord` draws the word on a canvas at device
  resolution, exactly where the page draws it (right-aligned at the text's
  right edge, baseline from `fontBoundingBoxAscent`), with and without the
  mark; the pixels present only WITH it are the mark, wherever the font put
  it on that letter. That difference, grown by one device pixel, becomes a
  CSS `mask-image` (data-URL PNG) on a layer of the identical string, and
  its inverse is the mask on the base text. Three things forced this:
  bounding boxes cannot find a kasra inside a final ع's tail; a vowel drawn
  on a no-break space sits at a different height than on a letter (the
  author saw the ḍammas "one above the other"); and **stripping a mark out
  of a copy is not safe in this font** — it swaps letter glyphs for some
  letter-plus-mark pairs (the iqlāb composites, ة + ḍamma + mīm → `gly019`),
  the two copies no longer coincided, and زَكِيَّةَۢ blurred. Layers carry
  `padding: inherit` so their text starts exactly where the base text does.
  Three refinements the proof sheets forced: the mask's one-pixel growth
  never lands on ink that is there WITHOUT the mark (it notched the tail a
  kasra pair crossed under مُّسۡتَقِيمࣲ and fringed every letter a mark touched);
  over a shadda the vowel's mask is cut at the plain shadda's top, because
  the font composes shadda + vowel into one glyph whose shadda half differs a
  little and would be nicked out of the base; and over ط ظ the pair is set so
  its first stroke stands above the stem (`STEM_LEFT`, the stem found as the
  letter's topmost ink), since the font hangs a single mark over the loop.
  The pair's strokes sit 0.7 of a stroke apart (`STAGGER`) — the first's tail
  runs into the second's head, as in the Mushaf. **Layer order** is prefix,
  then the grey mask, then the strokes and clipped fallbacks, then the marked
  letter: the ٱل prefix painted last put lesson 2's silent sun lam back in
  orange with a grey sliver at its foot.
- **The alif of a lam-alif ligature after a tanwīn fatḥ is one arm of a
  glyph.** قَوۡلࣰا, عَمَلࣰا, ظِلࣰّا: the fused alif is the tanwīn alif, silent
  when a word follows, but it is never a cluster of its own.
  `isTanwinLigature()` names it; `timing.ts` gives that arm no time, and
  `ArabicWord` greys it by the ligature's GEOMETRY (`ligatureAlif`), because
  a straight cut at the box's middle greyed the alif's head and the lam's
  foot and left the alif's arm black. In this font the lam is the upright
  stroke on the right — one vertical run of pixels above and below the
  junction alike, from the top down to the base — and the alif is the arm
  that comes in from its rounded head at the top-left and touches the lam
  part-way down (قَوۡلࣰا, وَرَجُلࣰا) or near the base (عَمَلࣰا, ظِلࣰّا). What
  leaves the junction downwards to the left is the lam's foot. So the alif
  is, row by row from the arm's first row, the ink left of the right-hand
  run, down to where the arm's right edge stops advancing towards the lam.
  Two false readings cost a round each, so: the strokes do NOT cross (the
  8× zoom of a vertical-cut render made it look as if the alif carried on
  below the junction to the base — the run trace at 2× shows the right-hand
  run at the same x above and below), and the runs must be counted on the
  FULL drawing, never on the difference: the joiner's stub in the drawing
  without the ligature punches a hole through the lam's stroke, and the arms
  then never seemed to meet before the base (the same trace at device ratio
  1 in the Browser pane looked fine — verify at 2×, which is what
  `snap-proof` uses). Everything left of the right-hand run is the arm: a
  gap of anti-aliasing where the head's curl meets the stroke splits it into
  two runs in one row, which read as "drawing back" and stopped وَرَجُلࣰا's
  arm a third of the way down.
- **A silent letter's pixels come from a prefix pair, never from removing
  it.** Taking a letter out of the full string shifts every word after it
  into the picture (مُّهِينࣰا was erased when the alif of عَذَابࣰا was). So the
  letter is the difference between the text up to and including it and the
  text up to the letter before — each ending in a joiner where the cut letter
  joined — both drawn from the right edge, where a glyph's place depends only
  on what precedes it. The diff window is tight (±0.08 em around the Range
  box; a lam keeps to its box exactly, base stroke and all). And when the
  prefix drawing disagrees with the word itself inside that window
  (`countExtra` > 5 % of the mask) — the font formed a ligature with what
  FOLLOWS, as لله in بِٱللَّهِ — the letter falls back to the old clipped box.
  Rect-clipped layers otherwise remain only for the ٱل prefix colour and the
  taught letter; every silent letter, final vowel, maddah and nasal mark is
  masked.
- **Before a final alif every joining letter takes a raised form in this
  font** — ب ع م ك س ح ق ف all rise to meet it (`scratchpad` probe,
  2026-09-27) — and their vowels move with them. So the pair's difference
  holds, besides the alif, the neighbour's changed join, the underside of its
  bowl and a crescent of its moved fatḥa: عَذَابࣰا carried a grey ghost of its
  own fatḥa, سَمِيعَۢا a grey small mīm, and every join a grey fringe. A silent
  alif (ا ٱ) is therefore reduced to its STEM (`stemBand`): the ONE
  contiguous band of columns around the tallest vertical run whose own
  longest run is at least 0.35 of it — one band, because vertical pieces of
  the neighbour further along passed for a stem too (a stripe through the ع
  of سِرَاعࣰا, the kāf's arm of مَلِكࣰا, the mīm's stem over سَمِيعَۢا) — plus the
  ink of the full drawing inside that band from the stem's top down (the
  foot the joiner's stub had taken out of the difference; the lam of
  لِّلنَّاسِ gets the same), plus the letter's own marks and, for ٱ, the waṣl
  sign, each found as marks are, by the difference its removal makes — the
  sign kept to the columns over the stem, because ا is narrower than ٱ and
  every letter after it moves, which put a crescent of the nūn's tooth of
  فَٱنقَلَبُواْ into the difference. Never "whatever stands above the stem":
  that was the neighbour's fatḥa leaning over the same alif. Where the join
  meets the stem the boundary is a clean vertical edge, black to grey, and
  that is correct. The foot is taken from the WORD's own drawing, not from
  the prefix drawing (the prefix's medial lam has no base under its stem;
  the word's does), and `dilate` keeps every pixel of the mask it is handed
  whatever the "without" drawing has there — it used to write only where
  that drawing was empty, which silently dropped the foot put back over the
  joiner's stub and left the lam of لِّلنَّاسِ standing on a black base. Two more things
  the ligature كا taught: the plain medial kāf's arm crosses the whole alif,
  so the subtraction cut the alif into fragments — when the drawing without
  the alif has ink inside the alif's window that the drawing with it lacks
  (more than 5 %), the pair is taken one letter further back and the stem
  filter finds the alif in the ligature; and a leaning stroke's per-column
  runs are shorter than its height, which is why the share is 0.35 and not
  0.5.
- **A final mīm on a fatḥa or ḍamma is the difference against the BARE
  letter, with moved pieces dropped.** The font composes ة + fatḥa + mīm into
  one glyph that sets the dots a few pixels from where the bare ة has them;
  removing the mīm alone compared that composite with the plain ةَ and greyed
  the dots of زَكِيَّةَۢ (a dark pair and a grey pair, offset). Now the
  difference is taken against the letter with all its marks off, and any
  component of it that has a counterpart in the reverse difference — close,
  the same width and height, a similar pixel count — is a letter part that
  moved and is dropped (`dropMoved`); the mīm and the vowel have no
  counterpart and stay. Shape, not just proximity: the fatḥa sits right
  above the moved dots and is of a similar size.
- **A staggered pair slides away from a neighbour it would touch**: shifted
  out from under the single mark, the kasra pair of رَّسُولࣲ met the tail of
  the و. Both strokes move together, a device pixel at a time, up to 0.15
  em, away from the side that collides (`collisions`), keeping the shift
  with the fewest hits; `offInk` then still trims anything that lands on
  ink. And the shadda cut (`above`) leaves anti-aliased specks of the
  composite's shadda half behind — `dropSpecks` removes components under 8
  device pixels.
- **The display string must keep the data string's length.** Cluster offsets
  index both — the Range measurements the DOM one, the masks the other. The
  small mīm's place is held by a zero-width space (kasra + U+06E2 → kasra +
  U+200B); a card whose display came out shorter lost every layer, because
  its last cluster could not be measured. `ArabicWord` throws if the lengths
  differ.
- **The low iqlāb mīm is kasra + U+06E2 in this font**, not U+06ED — v09
  draws U+06ED as an unattached placeholder (the dotted circle the author saw
  under كِرَامِۭ) and forms a low mīm from kasra + the HIGH small mīm through
  its `liga`. Both KFGQPC builds give that glyph a vertical stem; the author
  wants the Mushaf's small مـ. So the pair is displayed as the kasra and
  `ArabicWord` draws a 0.42 em `م‍` (mīm + ZWJ, the initial form) directly
  under the kasra's pixel box (`.tanwin-meem`, grey when it is the unread
  final). The data keeps kasra + U+06E2: `lowMeem()` in the generator maps the
  sheet's U+06ED to it. Ver18 does it the other way round, which is why Word
  shows the sheet correctly.
- **The proof sheet.** `#/proof/N?from=&to=` (dev only, mounted in
  `main.tsx`) draws cards A–B of a lesson large, one per row, through the
  real `ArabicWord`; `node scripts/snap-proof.mjs N <dir> 12` photographs it
  with headless Chrome at 2× in chunks of twelve. Read the PNGs — this is how
  every mark on every card gets checked without paging through the lesson,
  and how a fan-out of reviewers can check them in parallel. The in-app
  Browser pane cannot do this: its rAF is asleep and its screenshots lag.
- **Vite can serve a stale module after a Write.** The dev server kept
  serving the previous `ArabicWord.tsx` (with classes the file no longer
  had) across an HMR update AND a restart, from `node_modules/.vite`. When a
  change does not appear, `curl` the module URL and grep for a new
  identifier; if it is missing, stop the server, delete `node_modules/.vite`,
  start again. Cost an hour of "why does the new code not run".
- **Words sit at the bottom of their cards** (`.pair-card` is a flex column,
  `.pair-forms { margin-top: auto }`): with badges wrapping to one, two or
  three rows, three cards in a row still show their words on one level.
- **The nasal mark the Mushaf wrote for the NEXT word is greyed when the card
  stops before it** — `unreadFinalNasal()` in `graphemes.ts`: a staggered
  tanwīn, or a vowel + small mīm, on the last word (or on the letter before
  the tanwīn alif). Derived from the text, so no card carries a flag; 70 of
  lesson 7's 176 cards have one. A stacked final tanwīn is left black, as the
  author asked. Timing is unchanged — those cards are recorded at a stop like
  every single-word clip before them.
- Both tanwīn shapes are in `MARK_RE`, `TANWEEN`, `audioName.MARKS` and every
  generator's `MARKS`, so a filename derives the same from either.
- **The tanwīn alif is silent when the reading carries on** — rule 5 of
  `derivedSilent()` (`isTanwinAlif`): the ا or ى after a tanwīn fatḥ, or after
  a fatḥa + small mīm, is a spelling letter — عَذَابًا مُّهِينًا is read
  ʿadhāban-mmuhīnan — and sounds only at a stop, as the ʿiwaḍ alif. The nūn
  rules look straight past it: `readNeighbours()` in `timing.ts` hands
  `clusterParts` the next word's first letter as `next`, so the hum lands on
  the مّ and not on nothing. No text in lessons 1–6 is affected (checked). A
  letter carrying a vowel and a small mīm is a tanwīn for every timing rule
  (`isTanwin`): سَمِيعَۢا بَصِيرًا hums into the ب.
- **The article's lam after لِ is a sun or moon lam too** — rule 4b of
  `derivedSilent()`: a bare lam in second position of a word that opens with
  a lam, followed by a shadda (لِّلنَّاسِ), is silent and badged "Sun ل";
  لِّلۡمُتَّقِينَ is "Moon ل". `lamBadge` in the generator and the rule in the
  app make the same test. Fires on one text in the app (lesson 7 #75).
- **The lam-alif ligature merges only when the two letters touch.** It used
  to merge across a space — رَسُولٌ أَمِينٌ became one cluster لٌأَ — which
  handed the tanwīn's ruling to the wrong letter (a hum before a hamza). A
  cluster may never span a space; the all-lessons check asserts it.
- **A maddah on the last letter of a text is unread**, when that letter is a
  long vowel: it is a munfasil whose hamza opens the *next* word
  (تَأۡمُرُوٓنِّىٓ أَعۡبُدُ), and a clip of the word alone has no next word to
  reach. `unreadFinalMaddah()` in `graphemes.ts` derives it from the text;
  `ArabicWord` greys the sign and `timing.ts` gives the letter a natural 2,
  not the munfasil 4. Exactly one text in the app triggers it (lesson 6 #7,
  checked over every `words.json`). A letter *name* carrying the maddah
  (the صٓ of كٓهيعٓصٓ) is a consonant and is not this.

**Rendering**
- Never split an Arabic word into per-letter spans — it breaks cursive joining.
  Colouring part of a word is done by stacking **clipped copies of the same full
  string**, measured with the Range API (`ArabicWord.tsx`).
- The font (KFGQPC Uthmanic Hafs) may be used and redistributed but **not
  modified** — never subset it or convert to WOFF2. Serve the original `.otf`.

**Audio**
- Play via **blob: URLs** (`audioSource.ts`), never raw file URLs — media range
  requests through the service-worker cache truncate first playback.
- Clips are stored **mono** (halves the offline payload).
- Recording levels vary hugely between sessions, so silence detection derives its
  threshold from each take's own noise floor — never a fixed value.
- `splitIntoN(wav, count)` is the splitter. Its rules, each learned the hard way:
  a click is short in **absolute** terms (~0.08s) and must never be judged
  relative to the other pieces — that threw away the quarter-second وَ of
  وَٱلتَّكَاثُرُ; breaths are trimmed at the **edges only**, which is what stops that
  rule eating a word's opening; word boundaries are then the `count-1` longest
  silences.
- Audio files are matched to table rows **by the words in the filename**
  (de-diacritized), not by ordinal position. The author need not number them.
- A **trailing number is a take number**, not part of the word: `جئت 2.wav`
  replaces `جئت.wav`, and the highest take wins. Before this the new take was
  silently ignored and the row simply looked unrecorded.
- Every generator reports **recordings that match no row**. A misnamed file is
  otherwise invisible — it just quietly never plays.
- Lesson 4 records a word either as one take said three times
  (`<word> و ثم.wav`) or as **three separate takes** named for what is said in
  each. Keep the two kinds in separate maps: folding them together is what
  broke وسواس, whose bare-word file was cut into three.
- Lesson 6's ʿāriḍ words use the same device with a different tag: **one take,
  the word said at the stop three ways — 2, then 4, then 6 — named
  `<word> وقف.wav`** and split into three cards. The tag is what keeps it from
  colliding with the same word's single-reading clip in the badal section. The
  sheet's ʿāriḍ table writes the tag into the Word cell itself, so the intake
  tool's slot for that row already reads `<word> وقف` — set expect 3 and
  record; the filename is derived from the cell as always, nothing is typed.
  The generator takes the tag off before the word reaches a card.
- A sheet correction is applied in the generator and **reported on every
  run**, never written into the docx behind the author's back (`CORRECTIONS`
  in `make-lesson2.mjs`; lesson 6 carried one for a day). Spell the find-string
  out by codepoint from the document itself — the mark order it holds (shadda
  before damma on جُّ) is not what you would type, and a string typed by eye
  will silently never match. The exception is the author asking for the docx
  itself to be edited, as with lesson 6 on 2026-09-05: then the correction
  goes into the sheet, the generator's block is retired, and the edit is done
  on `word/document.xml` inside the zip with every change reported — never by
  retyping cells. Check tag balance (`w:tbl`, `w:tr`, `w:tc` open = close)
  before re-zipping: a row's last cell string carries its row's `</w:tr>`, and
  the last row the table's `</w:tbl>`, so a naive split-and-rejoin
  double-closes.

**Audio intake** (`src/lib/`, `pages/IntakePage.tsx`)
- The browser's audio processing is **switched off** — `echoCancellation`,
  `noiseSuppression` and `autoGainControl` all `false`. AGC hunts the gain
  between words, which destroys the one thing the splitter relies on: a take
  whose own noise floor is a stable reference. Noise suppression is a spectral
  gate over exactly the fricative energy the pronunciation work will measure.
  Neither can be undone afterwards.
- Capture is an **AudioWorklet**, not `MediaRecorder`. MediaRecorder yields
  WebM/Opus, which `readWav` rejects and which is lossy above 8 kHz — where ح
  and خ live. Raw floats → 16-bit PCM → a WAV header written by hand
  (`wavFile.ts`), matching `writeSegment` field for field.
- **Nothing is downsampled at intake.** The device rate is kept. Intake is the
  one irreversible step; downsampling later is always possible.
- The filename is **derived, never typed** (`audioName.ts`), with the same
  transformation the generators match on. Checked against `key()` on all 675
  Arabic strings in the sheets and the audio folders — zero disagreements.
- **A sheet may have several word columns.** `guessWordColumns()` picks every
  column whose Arabic cells are mostly words (two or more letters) and scores
  at least two fifths of the best — the nūn sākinah sheet records both its
  Nūn Sākinah and Tanwīn columns — and the page shows them as checkboxes.
  Slots come row by row, left to right within a row, so the list is in the
  generator's id order; with several columns ticked a lone letter is a label
  (the mīm table's Letter column) and is dropped, while a single-column sheet
  of letters (the alphabet) still records letter by letter. Checked: the
  replicated slot list for lesson 7 equals the 176 cards, in order.
- `takeCheck.ts` is a **port of `splitIntoN`**, not an approximation, so the
  intake gate and the generator cut identically —
  `node scripts/check-take-parity.mjs` proves it over every recording at 1, 2
  and 3 pieces. Two traps found by that check and worth remembering: the
  generator's threshold is a share of the peak **window RMS**, not the peak
  sample (confusing them moved every boundary by ~0.06 s), and *more* stretches
  of sound than words is normal — the closure inside خَلَقَكُمْ is a real silence,
  which is the whole reason the splitter ranks gaps instead of thresholding.
- Warning thresholds are measured against the existing 172 recordings (peaks
  −32.7…−0.3 dBFS, SNR never below 39 dB) so that none of them can fire on a
  take that has already proved itself.
- **Input gain is judged across the batch, never take by take.** One quiet word
  is a word; thirty is a setting. The advice appears by the end of the speaker
  profile — five takes in, before the sheet — because the failure it prevents
  is discovering after 33 words that the input was 14 dB low. Half the existing
  corpus sits below −20 dBFS, so a per-take threshold there would cry wolf.
  The meter is scaled in **dBFS, not amplitude**: linear puts every usable
  speaking level in the leftmost sliver, which is how a quiet input goes
  unnoticed.
- Room tone ignores the first and last **0.5 s**. The first take ever made
  reported speech at 0.21–0.32 s in a room whose floor was −86 dBFS: those were
  the mouse clicks starting and stopping the recording. Every speaker will make
  them, every time.
- The **speaker profile** — room tone, بَا/بِي/بُو, and one carrier phrase —
  is recorded once per session. It is worthless to the lessons and
  indispensable to the pronunciation work: vowel formants scale with the vocal
  tract, so a learner can only be compared to a native distribution after
  normalising against their own vowel space. It cannot be collected after the
  fact, which is why it is in the first version.
- `intake.json` is written beside the audio: sheet, row, text, speaker,
  consent, levels, take count. The generators ignore it; the corpus cannot be
  built without it.

**Word ids and calibrations**
- A word's id belongs to its **table row**, and is spent whether or not the row
  has been recorded. Both lesson 3 and lesson 4 work this way. Ids are
  therefore sparse wherever rows are unrecorded — that is correct and must stay
  so. They are keys, not positions.
- This was not always true. Lesson 4 used to number only the *recorded* rows,
  so recording one more word renumbered every word after it and silently
  pointed calibrations (`calibrations/lesson4/words/{id}{a|b|c}`) at the wrong
  words. Never reintroduce that: **the audio must not influence the id.**
- A generator run rewrites every clip, but an unchanged source cuts
  byte-identically — `git status` on the audio folder is the quick check for
  which words were really re-cut, and therefore whose calibration is stale.
- Generators list clips nothing references any more, so a renumbering leaves no
  dead weight in the offline precache. They report; the author deletes.

**Timing** (`timing.ts`, one unit = one harakah)
- Boundaries are in **media time**, so highlights stay correct at any playback
  speed. Priority: own calibration > cloud calibration > baked > automatic.
- Sukoon 1.2 (leen 1.3) · ghunna +0.9 · qalqalah +0.25 · shadda +0.8 ·
  tanween +0.5 · madd 2 / muttasil and munfasil 4 / lazim 6 · hamzat wasl 0.9.
  Silent letters get zero time and are skipped by the highlight.
- **The ghunna is paid to the SECOND letter — all of it.** The hum of
  ikhfāʾ, idghām and iqlāb is heard while the letter *after* the nūn sākin /
  tanween / mīm sākin is being formed, and a hidden or merged nūn is not
  articulated on its own. So `ghunnaInto(prev, cluster)` gives that letter the
  +0.9 **plus what the nūn hands over** (`handedOver`): a nūn/mīm sākin keeps
  only a 0.3 onset, a tanween's letter keeps its vowel and gives up the 0.5
  nasal tail. أَنتُمۡ is ن 0.3 · ت 2.6, of which 1.6 is hum. Giving the second
  letter only the +0.9 left the nūn holding a third of the hum — the author
  saw the highlight "half on each letter" and asked for all of it on the
  second. A doubled نّ / مّ hums on itself (its sākin half + hum, then the
  vowel). The hidden nūn/mīm ending a letter NAME follows the same rule with
  its own numbers: the hum between two names is a merged doubled letter
  (لَامْ مِيم) or a hidden nūn (عَيْنْ صَاد), so it is `NAME_HUM` 1.7, and the
  first name gives up `NAME_HANDED` 0.8 of its six because its closing
  consonant *is* the start of the hum — الٓمٓ is ا 2 · ل 5.2 · م 7.7 (hum
  1.7). At +0.9 with nothing handed over the author heard the violet start
  late and end early. It is the rule for the nūn sākin and tanween lesson
  that follows.
- **The hum has its own colour.** `clusterParts()` returns each letter's
  weight and the `ghunna` slice at its start; `ghunnaShares()` turns that into
  a per-letter fraction, `playWithHighlights` reports `'ghunna'` as the phase
  while the clip is inside that slice, and `ArabicWord` paints the same box
  in `--highlight-ghunna` (violet) before it turns green. Every ghunna —
  ikhfāʾ, idghām into ينمو, mutamāthilayn (ن ن, م م), iqlāb, ikhfāʾ shafawī,
  the doubled نّ / مّ, the hidden hum in letter names. A fraction, not a time,
  so it applies to a calibrated timing exactly as to the automatic one. The
  Ghunna / Ikhfaa badges wear the same colour so chip and moment read as one
  thing. The admin calibration preview does not show the phase.
- **Ṣilah** rides on the small waw/yeh mark: the هـ carrying one gets +2
  (ṣughrā), or +4 when the next word opens with a hamza or the mark carries a
  maddah (kubrā). Measured directly, not through `maddLength` — ṣilah exists
  only between vowels and can never be lāzim.
- **Reading at a stop is a per-word flag** (`waqf` on the word → `Playable` →
  `WeightOptions`), applied as a pass over the finished weights in
  `autoBoundaries`, because ʿāriḍ lengthens the *penultimate* letter and
  `clusterWeight` sees one cluster at a time. At waqf the last letter loses its
  vowel (1.2, shadda still +0.8), a final tanween fatḥ with no alif written
  earns ʿiwaḍ (+2), and a natural madd or a leen letter before the final one is
  held `MADD_AT_WAQF = 4` — the author recites 4; the recording is the
  authority. **Off by default**: every single-word clip in lessons 1–5 also
  ends at a stop and their estimates were tuned without it. Lesson 6 sets it
  on the four rows whose Length column says "at waqf only", not on badal.
- **Letter names** (`letterNames`, the surah openers الٓمٓ): the hamzat-wasl
  rule is skipped so the opening alif reads as its name, 2 harakat. The flag
  now survives the trip `words.json → LetterWord → Playable` — it used to be
  dropped in `letterPlayables`, so setting it in a sheet did nothing.
- **The hum hidden in the names.** Nothing in الٓمٓ is written with a nūn or
  mīm sākin, but "lām" ends in one and meets the "mīm" after it. The rules of
  nūn and mīm sākinah apply to the *names* as to written letters:
  `NAME_ENDS_IN` (ل→م, م→م, س→ن, ع→ن, ن→ن) plus the next letter decides —
  idghām/iqlāb keep the hum (+0.9, badge "Hidden Ghunna"), ikhfāʾ hides the
  nūn under one (+0.9, "Hidden Ikhfaa"), iẕhār has none. Gives exactly
  الم المص المر طسم / كهيعص حم‑عسق. The table lives in both `timing.ts` and
  the generator and must stay identical. Same idea for qalqalah: "ṣād" ends in
  a sākin د, so the ص of المص, كهيعص and ص bounces (+0.25, badge "Hidden
  Qalqala"); no other letter name ends in one of ق ط ب ج د.
- The "Conditional silent alif" badge is derived from the text (a rectangular
  zero present), never from a comment column — lesson 5 reads it off the
  sheet's Type column, lesson 6 off the word itself. `derivedSilent()` does
  the greying either way.
- `waqfMadd` (2 | 4 | 6, default 4) says how long the madd before the stop is
  held; `dimFinalMark` greys the final vowel. `ArabicWord` cannot clip a mark
  apart from its letter, so the grey is two layers over the last cluster: the
  whole string in the silent colour, then the same string minus that vowel in
  the text colour on top — removing a mark does not change shaping, so only
  the vowel shows through. A `Layer` may therefore carry its own `text`.
- A saakin letter was 0.7 — *less* than a plain letter. It carries no vowel but
  it is still held, and at a word end before the next it is held longer still.
- **A madd is paid for once.** A dagger alif on a consonant is consonant + madd
  (رَٰ = 1 + 2). On a letter that *is* already the long vowel it is the same
  vowel spelled twice, not a second one — and adding it twice gave the ىٰٓ of
  نَجۡوَىٰٓ eight harakat, a third of that whole phrase, which starved every letter
  before it. `clusterWeight` carries a `maddCounted` flag for exactly this.
  Five phrases in lesson 5 were affected, and يَنۡهَىٰ / يَخۡشَىٰ in lesson 3.
- The cheap check for this class of fault: run `clusterWeight` over every text
  in every `words.json` and print any cluster over 6 harakat, then read each
  one. A *madd* over 6 is two rules firing at once. A **consonant carrying a
  dagger alif before a shadda legitimately reads 7** — its own 1 plus a lāzim
  6 — which is exactly the حَـٰجّ of أَتُحَـٰجُّوٓنِّى, and not a fault.
- Re-cutting a clip invalidates any calibration measured against it — check
  before regenerating audio for a calibrated word.

**Keyboard** (`SectionedLesson`, lessons 2–4)
- Built for a learner who drives an iPad by voice. **Single keys only, never
  chords** — "press N" is one utterance; Shift+number cannot be spoken at all.
  That rules out modifier combinations as an interface here, permanently.
- `N` next · `P` previous · `1`–`9` start at that card · `←`/`→` change page.
  Next walks a flat sequence of *every form of every card* in reading order, so
  it means the same thing whether a card holds one form or three, and it runs
  off the end of a page into the next rather than stopping dead.
- The place (page + step) is remembered per lesson in `localStorage`, so
  returning to a lesson resumes it. A page reached any other way restarts the
  walk at the top. `-1` means "not started", so the first Next plays the first
  word rather than the second.
- Always read `e.code`, never `e.key`: Shift turns `1` into `!`, and on a
  numeric keypad it turns `4` into `ArrowLeft` — which used to turn the page.
  Digits are matched before arrows for exactly that reason.
- The hint line is written from the page in front of you, never hardcoded. A
  hint that describes a different lesson is worse than no hint: someone working
  by voice cannot see that it is lying.
- Lesson 1 (`WordsLesson`) is a plain unpaged grid and has **no** keyboard
  support at all — an open accessibility gap, not a decision.

**Updates reaching people**

Three separate things must hold, and this app has been bitten by all three.
When an update does not arrive, work down the list rather than guessing.

1. *The page must reload.* `skipWaiting` + `clientsClaim` swap the **worker**;
   the open page keeps the JavaScript it loaded with. `main.tsx` reloads once
   on `controllerchange`, guarded on there having been a controller at load, or
   a first visit would reload itself immediately after installing. Verified
   across three successive builds: first install does not reload, a later
   update does.
2. *The browser must look, and must not be answered from cache.* An installed
   app is reopened for weeks without a navigation the browser counts, so
   `main.tsx` owns the registration (rather than the one vite-plugin-pwa
   injects) in order to pass **`updateViaCache: 'none'`**, and asks at launch,
   on `visibilitychange`, on `focus`, and every 15 minutes. Hosting's default
   `max-age=3600` on `/`, `index.html`, `sw.js` and the manifest is overridden
   to `no-cache` in `firebase.json` — an hour of "nothing has changed" is an
   hour of a learner not getting the lesson.
3. *The new worker must be able to finish installing.* **This was the real
   cause.** The precache held all 337 clips, 67 MB, and a Workbox precache
   install is all-or-nothing: one failed fetch on a phone, or the learner
   closing the app mid-download, threw the entire update away. That is exactly
   "refresh a few times and eventually the new lesson appears", and it would
   have got worse with every lesson. The shell is now **1.6 MB / 34 entries**
   and audio is fetched on play.

- **Audio is not precached.** It is a runtime `CacheFirst` cache
  (`iqra-audio-v1`, 300 entries / 30 days, `purgeOnQuotaError`), so a learner
  holds the clips they have worked through and never the whole library — which
  matters, because the corpus is heading for thousands of files. Full offline
  was never asked for; reliable updates were. Dropping audio from the manifest
  also makes the new worker **delete the 65 MB the old one is holding** on
  every device.
- Clip filenames are stable across a re-cut, so a device that already holds one
  has no way to learn of a new one. **Bump `AUDIO_VERSION` in `vite.config.ts`
  when clips are re-cut** — the same moment the calibrations need re-checking.
  That one constant is appended to every clip URL as `?v=` (`audioUrl`), names
  the worker's runtime cache, and is baked into `sw-cleanup.js`, which deletes
  earlier versions' caches on activate. **There are FOUR caches between a
  re-cut clip and the ear**, and renaming the runtime cache alone (the old
  `AUDIO_CACHE` bump) reached only one: Hosting serves `/audio/**` with
  `max-age=86400`, so the browser's HTTP cache — which a hard refresh does not
  clear for fetches the app makes — handed the *new* worker the *old* clip,
  and the worker stored it under the new cache name for thirty days. The
  author heard the old كهيعص on the web app for that reason while localhost
  played the new one. A versioned URL is a different key in all four.
- **A missing file does not 404 here.** Hosting rewrites `**` to `index.html`,
  so `/audio/lesson05/typo.wav` answers *200 text/html*. Left alone, CacheFirst
  would keep that HTML page as the recording for a month. Both layers now check
  the content type: `cacheableResponse.headers` in the worker, and
  `getAudioBlob` in the app, which turns a misnamed clip from a player that
  silently says nothing into a real error. Verified against the live host.
- The home page carries a **build stamp** (`__BUILD_ID__`, stamped in by
  `vite.config.ts`). An installed app has no address bar and no way to tell a
  stale copy from a current one — this answers it by looking at the phone.

**Lesson identity and order**
- A lesson's **number is its identity, never its position**. It keys
  `public/lessons/lessonNN/`, `public/audio/lessonNN/`, `#/lesson/N` and
  `calibrations/lessonN/...`. Renumbering to reorder would silently point every
  calibration at the wrong word — the same fault lesson 4's word ids already
  cost this project once, one level up.
- Reading order is therefore a separate thing: `LessonMeta.order`, read through
  `orderedLessons()` in `lessons.ts`, which is the one place order is decided.
  Nothing sets `order` yet — the lessons were written in the order they are
  read. It exists so the day one moves, the move is a number rather than a
  renaming of folders, clips and calibration documents.
- Chapters will be a `chapter` field beside it and a grouping in the same
  function. Same rule: a lesson changing chapter must not change its number.

**A roster seat is not an account** *(designed, not built)*

Every roster seat today **is** a Firebase Auth account: membership is keyed
`classes/{classId}/members/{uid}`. That quietly assumes a one-device-per-learner
school. It is false of every Maktab and madrasah class — children without
phones cannot be represented at all, so a teacher cannot enter, mark or track
them. This surfaced while designing the Maktab assessment (section 4),
and it is a blocker for the LMS regardless of whether that assessment is ever
built in.

The shape when it is built:

```
classes/{classId}/roster/{seatId}    displayName, uid ("" until linked),
                                     active, createdAt
```

- A **seat** is a place on the roster — one child, created by the teacher
  typing a name. It exists whether or not anyone ever signs in.
- A **uid** is a Firebase Auth account id, minted at sign-up, and it is the
  only identity the app has today. `members/{uid}` therefore *cannot hold a
  child without an account.* A seat carries `uid` as an optional **field**, so
  an account can be attached later — or never.
- **The seat id never changes when an account is linked.** It belongs to the
  child, not to their account status, and it is spent whether or not it is ever
  claimed.

That last rule is this project's oldest lesson wearing a third hat: a word's id
belongs to its table row and is spent whether or not the row was recorded; a
lesson's number is its identity, never its position. Get it wrong here and
every assessment record silently points at a different child the day someone
signs up — the same fault as lesson 4's renumbering, one level up again, and
this time the corrupted records are children's.

**Names and privacy**
- `account.name` may fall back to the email so someone recognises their own
  account. **Anything another person sees uses `publicName`, which never
  does.** An empty display name once put the teacher's email in front of every
  student who joined a class.
- `safeName()` filters anything email-shaped on the way *out* as well, because
  classes created before the fix still hold one. Data written before a rule
  existed does not retroactively obey it.

**App**
- Accounts are **additive, never a mode**: no account = the full app. Signing in
  only adds sync and, for the admin, tools. There is no "choose your mode" screen.
- Publishing is runtime state in Firestore `config/app` — no redeploy needed.
  New lessons land as **draft** (admin-only) until the author presses Publish.
- Notes: stylus draws, finger scrolls. `touch-action` cannot express that —
  browsers apply it to pen input too — so the canvas uses `touch-action: none`
  and finger-scrolling is done in JS.
- **React**: never do side effects (like pushing an undo snapshot) inside a
  `setState` updater; StrictMode invokes them twice. Keep a ref.
- A fresh `[]` as a default prop re-triggers layout effects forever — use a
  module-level constant.
- **Badges wrap, never squeeze.** `.pair-head` is `flex-wrap: wrap` and a
  `.type-badge` is `white-space: nowrap; flex: none`. Before that, six chips
  on a phone broke inside their own text and the last one was pushed out of
  the card unseen (lesson 6's "Conditional silent alif"). Checked at 375 px
  with seven chips: three rows, nothing past the card edge.
- **The in-app Browser pane's `requestAnimationFrame` is asleep** (0 frames in
  400 ms even when `document.hidden` is false), so a playback highlight never
  appears when verifying there. `setInterval` runs. To watch the highlight
  through the pane, patch `requestAnimationFrame = cb => setTimeout(() =>
  cb(performance.now()), 16)` in the page first — that is how the ghunna
  phase was verified (مَنفُوشِ: plain 380 ms → ghunna 420 ms → plain 1140 ms,
  matching the weights). CSS transitions also freeze there, so a measured
  `left` may not move.

**Wording the learner reads**
- **Say "ghunna", never "hum"**, in every hint, badge and blurb — the author
  teaches the term itself. And **never give the ghunna a length** ("two
  harakat"): the author does not teach it as a count. (2026-09-26.)
- **"Fat-ha", hyphenated, everywhere the learner reads** — the practice
  workbooks spell it so (their Level 1 §3 is "Harakat: Fat-ha, Damma, Kasra,
  Sukoon") and the app and the paper must say the same thing; the author
  chose the workbook's spelling for both (2026-10-10). Code comments may say
  what they like. Likewise never "a, u, i" for the harakat on anything a child
  sees: fat-ha, damma, kasra.
- **Never say "vowel" for a madd.** A long vowel is a *madd* — "natural madd"
  where the length matters (ṣilah *grows a natural madd*, badal is *a hamza
  followed by a natural madd*). "Vowel" is reserved for the short one: a
  fatha, damma or kasra, the thing a stop drops from the last letter. This
  applies to blurbs, section hints, badges and anything else a learner sees;
  code comments may say what they like.

**Working style the author prefers**
- Verify behaviour, don't assert it. Mechanical checks over spot-checks.
- `npx tsc --noEmit -p .` checks NOTHING here — `tsconfig.json` is a solution
  file (`files: []`, references). Use `npm run build` (`tsc -b`) or
  `npx tsc --noEmit -p tsconfig.app.json`. A "TSC-OK" from the former let a
  missing definition reach the dev server on 2026-09-26.
- Say plainly what was not verified and why.
- Never silently "fix" Quranic text — report and confirm.

---

## 4. Current state

**Published:** lessons 1–5. **Features:** laser and notes both live for
everyone. (Read from `config/app` on 2026-08-11: the document names 1–4;
lesson 5 is published by `DEFAULT_CONFIG` in `appConfig.ts`, which the fetched
map is merged *over*. Pressing Publish on it would make that explicit.)

Lessons 3 and 4 are complete: every clip their `words.json` references is
present on disk (67 and 69 respectively, checked mechanically). ٱلرَّحِيمِ is
recorded — an earlier note here claiming otherwise was wrong.

**Lesson 6 is recorded, cut and deployed as draft (2026-09-05).** 44 takes
in **`Audio/Audio - Madd Lazim Silah +`** (the author's folder name — the
generator points at it), 52 clips cut, every card has audio. One take to
listen to: `الرحيم وقف.wav` splits 2.78 / 2.68 / 3.69 — at four pieces the
first is 1.96 + a 0.37 s fragment after a gap, so the "2 ḥarakāt" card
probably carries a stray sound; a `الرحيم وقف 2.wav` retake replaces it. The
author's review the same day added: the maddah on the final ىٓ of
تَأۡمُرُوٓنِّىٓ greyed and unread (see section 3), "Hidden Qalqala" on المص /
كهيعص / ص, and the rectangular zero on the alif of إِنَّهُۥٓ أَنَا۠ ٱللَّهُ with
its "Conditional silent alif" badge (the zero is in the sheet — landed once
Word released the file), "Madd Muttasil" on شَآءَ / أَوۡلِيَآءَ read off the word
itself, and the ghunna moved to the second letter (section 3). Everything
else below stands.

`make-lesson6.mjs`
reads `Word Tables/مد لازم صلة عوض +.docx` — six headed tables, read by their
header rows — into 52 cards, draft, registered. The sheet is the whole source
now: at the author's request it was edited in place so that every table has
the same four columns, the Mushaf's maddah sits on حَـٰٓ in أَتُحَـٰٓجُّوٓنِّى (6:80),
the fifth heading reads "Madd Badal, ʿIwaḍ and Līn" with ٱلرَّحِيمِ moved out of
it and the two līn rows at "2 ḥarakāt (recitation continues)", and a sixth
heading "Madd ʿĀriḍ li-s-Sukūn" carries a four-row table whose Word cells
read `<word> وقف`. The generator's `CORRECTIONS` block is retired and the
ʿāriḍ section is read from that table, not derived. Content decisions made in
that edit and not yet reviewed by the author: the ḥarfī Type column
(Muthaqqal where a letter name's final nūn/mīm merges into the next letter —
الٓمٓ, الٓمٓصٓ, طسٓمٓ; Mukhaffaf otherwise) and Length column ("6 ḥarakāt
each" when every letter is from نقص عسلكم, else per letter, e.g. "ا 2 · ل 6
· م 6"; alif is "no madd" — أَلِف has no long vowel). Recording was 40
single takes plus 4 ʿāriḍ takes — the sheet's own `<word> وقف` rows, each
said at the stop three ways, 2 then 4 then 6, expect 3.
Still assumed, not confirmed: that ʿāriḍ's *automatic* default of 4 is the
recitation for the badal/līn section's own "at waqf" rows (ʿiwaḍ and the two
līn words). Side effects of the same day's work: the hamza-on-tatweel words
in lessons 2 (#19) and 5 (#10–13) get their hamza step back, and lesson 5
#40's ṣilah yeh is no longer a separate step. No calibration exists on any of
those.

Open items:
- **Class recordings**: built and rules-tested, but only the signed-out path
  was exercised in a browser — the teacher's form and the class's list need a
  real account and a real class, which this session had no credentials for.
  Worth ten minutes with your own account before telling students about it.
- A **deactivated learner** can read the recordings by the rules, and cannot
  reach them in the app: `useClasses` only offers classes you are *approved*
  in. Class notes behave the same way. That is narrower than the written
  decision ("keeps the notes written up to that point"), and it is one filter
  in `useClasses.ts` if you want it changed.
- **Notes stack for a learner**: the teacher's marks are painted first and the
  learner draws on top, both on the same canvas, with a toggle to hide the
  layer beneath. Drawing stacks in depth; **typing stacks in reading order**
  (the teacher's typed text above the learner's own) because two overlapping
  contenteditable layers render on top of each other and are unreadable.
  The teacher's strokes live in a separate `base` state that the eraser and
  undo never touch, so they cannot be rubbed out — by construction, not by a
  guard. A teacher has no layer beneath, so for them it stays two sheets.
- Both layers count towards the canvas height, or a teacher's mark further
  down the page is silently cut off.
- **Notes** have two sheets. *Class notes* live at
  `classes/{classId}/notes/{lessonId}` — the teacher writes, everyone on the
  roster reads, one sheet per class per lesson. *My notes* stay on the device
  in IndexedDB and are never uploaded. The notes page always shows which class
  and whose sheet, and a teacher with several classes switches between them
  there. The reference layer and student submit-to-teacher are not built.
- A class sheet is one JSON string in one document, so **Firestore's 1 MiB
  limit is the ceiling on a sheet**. Coordinates are rounded to a tenth of a
  pixel and the teacher is told plainly at ~900 KB. Firebase Storage is the
  way out if that becomes a real limit.
- **Classes** work: a teacher creates a class at `#/classes`, gets a six-character
  join code, and approves, declines, deactivates or readmits each learner. A
  learner enters the code and waits. Many-to-many throughout — every
  relationship is a document, never a field.
- **Account deletion** works for what exists today: profile document, then the
  Firebase Auth account, in that order and never the reverse. Enrolments and
  cloud notes must be added to the front of that sequence when they exist —
  `deleteAccount` in `useAccount.ts` is the single place that ordering lives.

Calibrations live only on lesson 4 — words 12 (فَلَق), 16 (حَطَب), 21 (يَتِيم).
Everything else uses the automatic estimate.

**Branding (2026-08-16).** The app's icons, favicon and manifest now carry the
author's mihrab-and-book mark — the hadith «ٱقۡرَأۡ وَٱرۡتَقِ وَرَتِّلۡ» read bottom-up,
green `#14513A`, gold `#C1A054`, on a white plate. Two generations exist:
- `New Logo/` — the author's Canva exports, which are what **ships**. All
  five icons carry the FAVICON file's mark (the mihrab with a single ٱ): the
  three-line mark is unreadable at icon sizes, so it serves only as the full
  logo. `make-icons.mjs` cuts everything (white-point clip, trim, re-margin;
  regions are measured against these exact pixels, so re-measure if the PNGs
  change). The favicon is transparent outside the mark — knocked out by flood
  fill from the border with a morphological seal, never by "remove white",
  because the mihrab interior is the same white as the background and an
  unsealed flood travels the channel between the arch's outline strokes and
  hollows out the whole mark. The interior staying opaque is what makes the
  favicon read as a light silhouette on dark browser tabs.
- `Brand/` — a font-true rebuild: `art.html` + `build.mjs` render the same
  design through headless Chrome with the app's own Uthmanic Hafs embedded
  byte-identically, so every mark is the font's own (the wasl's attached صـ,
  U+06E1 sukoon). Kept as the vector source of truth if the raster ever needs
  to change; its favicon differs from the shipped one (the Canva favicon's صـ
  is a stylised detached ص — the author saw the difference and chose it).
`theme_color` is the brand green; **the in-app accent palette in `index.css`
is still the old blue** (`--moon` is a lesson colour — never touch it in a
rebrand). iOS home-screen icons only update on delete-and-re-add; Android
re-mints WebAPKs on its own within days.

**Practice workbooks and licensing (2026-10-04).** The author's Maktab
practice workbooks (Levels 1–3, built in Word with Claude in Word) now live in
`Workbooks/` as **generic IQRA 1447 masters** — the only files anyone edits.
`Workbooks/ICNBM/` holds the ICN Bellevue editions, **generated** from the
masters by `node Workbooks/build/make-editions.mjs icnbm`; never edit them.
An edition differs only in its cover. The cover is one full-page 300 dpi image
(`Workbooks/cover/`, rendered by `render.mjs`: line art on white so greyscale
printing has nothing to smudge) with a "PRINTED BY" box — an empty Word text
box in the master that a masjid types its name into; the ICNBM edition has
their logo and name in the image instead. Page 2 is a native-Word copyright
page (CC BY 4.0, edition line, `iqra.muslimbynature.org` — live since
2026-10-06, so the workbooks may be printed). Page tops read "IQRA 1447 · Quranic Arabic
Practice Workbook · Level N"; section openers carry the IQRA mark. The footer
field is `IF PAGE > 2 … = PAGE - 2`, so the typed Table of Contents numbers
are physical page − 2 (all 24 section starts checked in Word). The builder
Claude in Word stores in each file (`iqraBuilder5–7`, `iqraLogo`,
`iqraHandover`) was rewritten to match; **the `iqra-workbook-v4` skill outside
this repo still writes ICN Bellevue headers** — have Claude in Word make a v5
before it builds new pages. PDFs for printing: *Microsoft Print to PDF*, as
before (the skill records that Word's own PDF export garbles the Arabic).
`Workbooks/build/word-pages.ps1` opens a .docx in a private, invisible Word,
reports its page count and draws chosen pages to PNG — the way to verify an
edit to these files (it kills only the Word it started).

**The landing page — `iqra.muslimbynature.org` (2026-10-05).** A second
Hosting site in the same Firebase project: site `iqra1447` (also served at
`iqra1447.web.app`), deploy target `home`, source in `site/`. The app stays at
`iqra---learn-quranic-arabic.web.app` (target `app`) and the page links to it.
- `site/public/` — one static page: logo, the three workbook PDFs, a link to the
  app, a contact form. Same palette and star geometry as the cover.
- `site/build.mjs` runs as the `home` predeploy: copies the generic PDFs from
  `Workbooks/IQRA 1447 Practice Workbook - Level N.pdf` to `/workbooks/…` and
  writes `meta.json` (pages, size) that the page shows. Never a masjid's edition.
- `site/functions/` (codebase `site`, Node 22) — `contact`, reached through
  the rewrite `/api/contact`: a message becomes a row in the author's Notion
  database (Message as the title · Email · Category multi-select · Name text
  · Created time — the author's own columns) and an email to the IQRA mailbox
  with Reply-To set to the sender. Secrets `NOTION_TOKEN`, `NOTION_DATABASE_ID`,
  `GMAIL_APP_PASSWORD` are in Secret Manager, set by the author — never in the
  repo, never typed by Claude. Spam: a hidden trap field and a minimum time on
  the page; Turnstile if that stops being enough.
- **The app is hidden on the page unless the author switches it on** at
  `/admin` (not linked; signs in with the IQRA admin account over the same
  REST APIs the app uses). The switch is Firestore `config/site`
  `{ appVisible, updatedAt }` with its own rule — public read, admin-only
  boolean write — because the app's admin PATCHes `config/app` whole and would
  erase a field kept there. Off is the default: no document, or an error, keeps
  the App link, the hero button and the app section hidden. Hiding is not
  restricting: the app's own address still works.
- Deploy: `firebase deploy --only hosting:app` (the app),
  `--only hosting:home` (the page), `--only functions:site` (the form).
  A bare `--only hosting` now deploys both sites.
- The domain is connected (2026-10-06): a CNAME `iqra` → `iqra1447.web.app` at
  Namecheap, the certificate issued by Firebase. The root `muslimbynature.org`
  is not built and needs nothing for the subdomain to work.
- The form was tested live the same day: a message reached both Notion and
  Gmail; a missing email is refused (400); the trap field and a sub-2.5 s
  submit are answered "sent" and dropped. Artifact Registry in us-central1
  deletes old function images after 1 day (`functions:artifacts:setpolicy`).

Licensing (`LICENSE`): the author's content — lessons, sheets, recordings,
pictures, workbooks — is **CC BY 4.0**; the code is **MIT**; versions published
19 Sep – 4 Oct 2026 were CC0 and stay so. Names and logos (IQRA 1447's and any
printer's) are licensed under neither. The author's wish behind it: use or
change anything, credit IQRA 1447, never present a changed version as ours.

**The Maktab assessment is finished and print-ready — v1.0, 2026-08-16.**
The author sits on a local Masjid's education committee and is piloting a
standardized recitation assessment for its Maktab programme, taught by a
Qari. It is a separate project from this app, on paper, on purpose — the
decision (2026-08-15) is argued in `should-this-live-in-the-app.md` and
stands: pilot the instrument first, encode only a version that has been used.
Do not start integrating without re-reading that note.

**The assessment is no longer in this repo.** At the author's request
(2026-10-04) it lives at
`D:\ICN-BM Islamic Center of Nashville Bellevue Mosque\Maktab Program\Assessment\`,
beside the workbooks; earlier versions remain in git history. Do not copy it
back in — a folder git half-watches is an error risk. There,
`Print Ready - Aug 2026/` holds the four session files: **Student
Packet** (Part A hear-and-match ×14 · Part B read-aloud ×13 scored 0/1/2 ·
Part C ×5 MCQ), **Teacher Sheet** (recitation script — say the *sound*, never
the letter's name — plus a landscape grid ending in a blind "Your level"
column), **Helper Sheet**, and **Maktab Results.xlsx**, which imported into
Google Sheets marks answers, totals, and places automatically. The assessment
content is the author's, verbatim; the final version carries no āyah
references or ḥadīth, so the verification warnings on the earlier drafts (in
git history) no longer apply.

The pieces that took real thought, so they are not undone casually:
- **Placement is gated, never averaged.** A < 10/14 → Level 1; A ≥ 10 and
  B < 18/26 → Level 2; both → Level 3. **Part C never gates** — it keeps the
  room busy during the one-to-one queue, separates "can't apply" from "never
  heard of it", and informs the teacher's judgment. "I don't know" scores 0
  but stays distinguishable from a wrong guess in the data.
- **The override is a workflow, not a column.** The teacher writes a blind
  1/2/3 as each student walks away; the sheet flags REVIEW where he and the
  formula disagree; the last ten minutes are spent only on REVIEW rows, and
  his override wins. The teacher–formula agreement rate is the pilot's
  validation data for the 10/18 thresholds.
- **No student audio** — they are minors; the Qari grades live. Student IDs
  are seat ids (M-01 style): assigned once, never reused, same next year.
- The repo is no longer its backup (see above): the D: folder is, so that
  folder must be backed up on its own.

Also learned: the author's installed Word font is **"KFGQPC HAFS Uthmanic
Script"** — a different build from this repo's `UthmanicHafs1-Ver09.otf`,
whose internal family name is "KFGQPC Uthmanic Script HAFS". Same letterforms,
different family name; never assume the two are interchangeable. And twice in
one session a fresh draft reached for U+06DF for the round zero — the
assessment build scripts now fail on it; the font convention in section 3 is
the law here too.

Designed and agreed, not yet implemented:
- Notes as three stacked layers — reference (fixed) / teacher / student — so
  nobody edits the same layer and there is never a merge conflict.
- Teachers self-declare; students enrol with a class join code and are approved
  by the teacher; the teacher sees a roster.
- Tapping a word to see it in its ayah (needs a `ref` field per word; refs must
  come from a verified source, never guessed).

---

**Classes, as built**
```
classes/{classId}                 name, teacherUid, teacherName, joinCode, createdAt, active
joinCodes/{code}                  classId, teacherUid   — get-able, never listable
classes/{classId}/members/{uid}   displayName, status, requestedAt, decidedAt
users/{uid}/enrolments/{classId}  the learner's own signpost to a class
classes/{classId}/notes/{lesson}  the teacher's sheet for one lesson
classes/{classId}/recordings/{id} title, url, passcode, note, recordedAt,
                                  createdAt, lessonId
```
- Recordings read is **narrower than notes**: the note sheet opens to any
  membership document, a recording only to `approved` or `removed`. A link to
  a recording is a way *in* to something, and being on the waiting list is not
  being in the class.
- That rule deliberately never mentions `resource`. Firestore re-evaluates a
  read rule per document on a **list**, and a condition that looked at the
  document would fail the whole query the moment one row failed it — which is
  why "only recordings from before you were deactivated" is not expressed here.
- `https:` only, enforced in the rules as well as in `tidyUrl`. A link posted
  to a class is a link other people tap, and `javascript:` must not be able to
  reach that position through a stale client.
- `createdAt` is immutable; everything else can be corrected in place, because
  a mistyped passcode is the normal case.
- `enrolments` looks redundant and is not. Membership must live under the class
  so a teacher can read a whole roster; but a learner cannot ask "which classes
  am I in?" without querying every class in the app. The membership document
  stays the authority on **status** — the signpost only says where to look.
- A join code only reaches the **pending** queue, so a leaked one costs a
  decline, not access. That is why it never needs rotating.
- A class is written **before** its join code: the rules refuse a code whose
  class does not already exist and belong to you.
- Joining goes **membership first, then read the class**. A class is readable
  only by its teacher and by those who have asked to join, so reading it before
  knocking is refused — the membership document is what earns the read. Getting
  this backwards made joining fail with "check your connection".
- `teacherUid`, `joinCode` and `createdAt` are immutable after creation. A class
  that could change hands silently would take its roster with it.


**Lesson 7 rendering, third pass (2026-09-27).** The second parallel review
(`wf_46fa3e12-f56`, 22 of 44 agents finished before a usage limit) confirmed
one root cause behind most of its findings — the raised joining form every
letter takes before a final alif — and four smaller ones; all are fixed and
recorded in section 3 (`stemBand`, the kāf fallback, `ligatureAlif`,
`offInk` for the strokes, the ط ظ lift, the layer order).
The third review (`wf_40c0c8ae-116`, 28 agents, all finished) confirmed 14
more, all fixed: a second stem band inside the neighbour (57, 93, 123, 173),
the neighbour's fatḥa kept above a marked alif (122), the lam-alif split
below the junction (129, 167 — the "crossed form" was a misreading), the
ة composite's dots (147), the lam's foot under the stub (75), the kasra pair
touching a tail (78), shadda specks (167). Lessons 2, 4, 5, 6 and 20 were
re-photographed and pixel-compared against their previous renders after each
round: the sun lam's grey base now stops at the lam's own box edge and
covers the foot under its stem; nothing else moved. The fourth review
(`wf_55242162-50c`) confirmed two more — the lam's foot black under its
stem (75) and the nūn's tooth greyed after ٱ (122), both from the same
cause: `dilate` dropped every pixel the "without" drawing had ink under —
fixed, verified by zoom, and deployed as 27f6192. A fifth review of the
final render was started twice and lost both times to the usage limit; it
is not needed to ship, but it is the cheap way to be sure — the script is
`workflows/scripts/proof-lesson7-cards-v5-wf_48080c44-296.js` under the
session's directory, and it costs about 1.5 M subagent tokens a run.

## 5. Next task

**Grammar track — M0 recon done and its decisions answered; nothing built
(2026-09-19).** A third track: Arabic grammar for adults who already read the
Quran, taught through a growing verbal sentence (سَجَدَ → سَجَدَ مُسْلِمٌ → …).
Claude chat produced the spec at `Grammar/IQRA_GRAMMAR_TRACK_SPEC.md` (29
sessions, concept registry, data model, Session 1 fully authored);
`Grammar/M0-recon.md` is this app's answer to it, and its §5 records the
author's decisions. Parked until the author picks it up. What was decided:
sessions are ids 101–129 in `LESSONS` with `tracks: ['grammar']`; **a
session is authored as a Word file like every other lesson**, and a generator
turns its tables into the session JSON (the spec's §11.3 shape is the
generated form, not the authored one); the morphology corpus is committed
verbatim at `Grammar/Corpus/` as a build-time tool and is never modified —
the app ships only approved fragment tokens and precomputed coverage numbers,
with an attribution screen crediting corpus.quran.com and tanzil.info; the
author reviews every teaching text and every guessed role. Next is M1: read
the corpus (Buckwalter, one line per segment), align the Tanzil text it
carries, and verify every fragment in the spec against it, reporting failures
and never correcting them. The three traps the recon found, so they are not
rediscovered: standard-spelling sukoon is U+0652, which this app treats as
the silent round zero — constructed sentences must never go through
`derivedSilent()`; the app has **no Quran text source** of its own, so the
Tanzil text is stored verbatim and its codepoints mapped for the font in
memory, never written back; and grammar data must be runtime-cached like
audio, never precached.

**IQRA Kids — lessons 31, 20, 32, 33 exist as drafts (iteration 6,
2026-10-10).** A second curriculum in the same app: the Baghdadi qaida for the
Masjid's Maktab, taught live by a teacher rather than self-paced. Everything
about it is in **`Design/iqra-kids.md`** — read it before touching any of
this. As built: song 31 (letter names) → **lesson 20, the letters, ONE lesson
in four sections** (21 and 22 were the same letters split in three and were
deleted unspent — nothing was ever recorded or calibrated against them) →
song 32 (sounds) → **lesson 33, "Where the Letters Come From"**, the
workbook's five places as five diagram cards. `#/kids/lesson/N` switches
`data-mode="kids"`. **One recording per letter card** — the teacher's whole
line, picture then fat-ha, damma, kasra, sukoon — so the sheet's seventh
table is one row per letter and **every take is a single piece: 36 letters
and 2 songs, intake tool set to 1, record the Slot column only.** Each song
is a **strip** of letters that glides to keep the sung one centered
(`SongCards`), not cards and not a video. Letters wear a **shape-family
color** everywhere in the skin (`fam-0..6`, seven colors over seventeen
families); the green box stays the only meaning of "being said now". Manāra
is off the letter cards (the ا card would have shown two lighthouses) and
greets on `#/kids` only. **Nothing is recorded**; `make-alphabet.mjs` prints
what to record and, once recorded, what to tap. Outstanding: the five makhraj
pictures (prompt in the design doc §9c) and the author's recordings.

**The workbook ↔ app crosswalk (2026-10-10).** `Workbooks/crosswalk.map.json`
declares which app lessons a workbook section matches (ids `L1S3`, as in each
master's Table of Contents); `node Workbooks/build/make-crosswalk.mjs`
generates `Workbooks/crosswalk.json` + `app/src/generated/crosswalk.ts` with
every section's printed and physical page read from the masters' own TOC
tables (physical = printed + 2). The app shows *"See workbook Level 1, page 6
for writing practice"* under a lesson (`WorkbookLinks`, linking to the PDF at
that page on the landing site); the landing page shows *"for listening
practice, see the app"* under each workbook section (`app-only`, hidden until
the app is visible). **Run the generator after any workbook edition or
mapping change, then redeploy both sites** — nothing stores a page number.
**GATED, do not forget: when the app is complete, add an "In the app" line
and a QR per section opener to the next workbook edition**, resolving through
`/go/<section id>` on the landing site fed by the same JSON — the paper
carries the section id, never a lesson number, so no reprint can go wrong.
The author asked for this to wait until the app is finished (several lessons
away); the `/go/` redirect page is not built yet either.

Two conventions this added, both in the same spirit as their audio twins:
**pictures are runtime-cached, never precached** (32 of them took the shell from
1.6 MB to 6.7 MB and would have broken updates), and **`IMAGE_VERSION` is
appended to every image URL** because a redrawn picture keeps its filename.
The rule the whole design rests on: one set of content, two skins — **mode
never touches an id, a folder, a clip filename or a calibration key.**

**Lesson 7 — record it (2026-09-27; rendering reviewed four times over,
live as draft at 27f6192).** Built as text, draft, 176 cards; the generator is
`make-lesson7.mjs` and reads `Word Tables/ميم نون ساكنة وتنوين.docx` — the
sheet Claude-for-Word rebuilt for the author, whose locations all check out
against the corpus (the five wrong ones are gone; مِن مَّنَاصٍ became مِن
مَّحِيصٍ). Every card was photographed through the proof sheet and read; the
nūn sections are titled "Nūn Sākinah and Tanwīn — …" and the idghām badges
read "with Ghunna / without Ghunna". Open that sheet in the intake tool — it ticks columns 2 and 3
(Nūn Sākinah, Tanwīn) by itself, 176 slots in card order, one utterance each
— and record into **`Audio/Audio - Meem Noon Sakinah Tanween`** (the folder
the generator reads; name it exactly so, or change `AUDIO_SRC`). Then
`node scripts/make-lesson7.mjs` cuts 176 clips. The em-dash cell (tanwīn + ظ,
id 171) is a spent id with no card, by design. Every final-tanwīn shape is
printed on each run under "FINAL TANWĪN" — with the rebuilt sheet every
phrase is found where its meaning cell says. To see any card as the app
draws it: `node scripts/snap-proof.mjs 7 <dir>` with the dev server up, then
read the PNGs (section 3, "The proof sheet"). Publish from `#/admin`
when reviewed.

**Awaiting the author's approval (2026-10-04).** The author reviewed
lesson 7 against the Mushaf twice (screenshots, Mushaf first, app second);
everything asked for is built and deployed. **The rules behind it are NOT
yet written into section 3 — the author asked for that only once the result
is approved.** When it is, record there:
- The staggered fatḥa pair: upper stroke to the RIGHT of the lower, strokes
  at (+0.3w, −0.75w) and (−0.3w, 0) of the single mark, w its width — the
  Mushaf's own offsets (36/37). The kasra pair: lower stroke to the LEFT,
  (+0.175w, 0) and (−0.175w, +0.45w), the strokes overlapping — the first
  pass had 0.55w between them and the author saw the pair reach under the
  letter before (لِقَوۡمࣲ). Ḍamma pair level.
- The small iqlāb mīm is the font's isolated م, placed by its INK
  (`placeMini`), never by its advance. Under a kasra: 0.5 em, 0.35 kasra to
  the kasra's left, head level with it, tail cut at 0.7 of the glyph
  (`MINI_KEEP`, a `clip-path`) — the Mushaf's short tail. Beside a ḍamma:
  0.45 em, head level with the ḍamma's top, 0.15 ḍamma-widths to its left,
  full tail hanging beside the shadda (صُمُّۢ; the first pass sat it higher,
  further left and larger and the author sent it back). The font's own flat
  mīm is erased: it is the LEFTMOST mark of the cluster, the topmost being
  the ḍamma — removing the mīm alone moved the ḍamma into its place and
  `dropMoved` dropped it as "moved".
- **A final mīm under a kasra pair or a low mīm is written joined on, مـ**
  (لِقَوۡمࣲ, مُّسۡتَقِيمࣲ, كِرَامِۭ), as the Mushaf's older style writes it,
  with the marks under its loop. The font's final mīm hangs a long straight
  descender there, which pushed the pair out from under the loop and the
  small mīm away from its kasra; cutting that descender short (the first
  try, 2026-10-04) read to the author as "a partially amputated stick" and
  once took a dot of the ي before it. So `toDisplay` puts a ZWJ in the
  mark's place in the DISPLAY string (`finalMeemAt`: a word-final م before
  U+08F2 or kasra + U+06E2) — the length is unchanged, and a ZWJ after a
  letter gives it its joined form whatever precedes it — and `tailCut`
  erases the joined form's long connecting stroke beyond `MEEM_STUB`
  (0.16 em) past the loop, grown by a pixel and reaching 0.12 em past the
  glyph's own box, where the stroke's end overhangs. Three traps, each a
  round: (1) **the font lengthens the joined mīm's stroke when a mark sits
  under it**, so a difference between "مِ"+ZWJ and "م"+ZWJ holds the stroke
  as well as the kasra — the kasra's pixels are taken from the font's FINAL
  mīm instead (the ZWJ put back to a kasra, `from`/`fin`), whose loop and
  anchor are the same, and the stroke layers draw that string (`Layer.text`)
  with its descender outside the mask; (2) the collision and `offInk` tests
  must see the display's letter without the cut stroke (`tailless`), not the
  final form; (3) the page's rasterizer leaves faint edge pixels the canvas
  has none of, so an un-dilated cut outlined the stroke as a ghost; (4) **the
  loop is found by its HEIGHT — the rightmost run of columns with ink well
  above the baseline — never by walking in from the glyph's right edge**:
  the joined form begins there with a thin connector from the letter
  before, and on the author's phone, whose rounding put the box edge on
  that connector, the walk saw no loop and erased the whole mīm (checked
  afterwards at device ratios 1, 1.5, 2, 2.625 and 3 and at 30–64 px). A
  stacked kasratān (أَثِيمٍ) leaves the mīm alone. Under a kasra the small mīm now
  sits a tenth of the kasra to its left, its head below the kasra's middle
  (مِّن مَّسَدِۭ).
- **A card's forms never grow past the card.** `.pair-forms` is
  `minmax(0, 1fr)` with `min-width: 0`, `.form-btn` and the word inside it
  are capped at 100 %, and `.arabic-word` is `white-space: nowrap`; the
  word's own `--fit` then shrinks the type to the card. Before, a wide
  phrase (صَٰلِحࣰا فَلِأَنفُسِهِمۡ) widened the grid column and put the play
  button outside the card — and `--fit` had never fired: it measured
  `scrollWidth` of an inline span, which is 0, and the wrap, uncapped, was
  always as wide as its text. It measures the span's rect now, refits on
  `document.fonts.ready` AND on each `loadingdone` (ready can resolve before
  the face is requested), and the text must not wrap or the measurement is
  of a wrapped line. `#/proof/N?from=&to=&card=343` renders the real
  `ItemCard` at that width — outside the `.proof` class, whose own 64 px
  text rule overrode the fit and sent one round chasing a bug the app did
  not have.
- **Masks are `mask-clip: no-clip`.** A mask clips to the border box by
  default, and the waṣl sign over an initial ٱ overhangs the span's box: it
  was cut flush at that edge on the author's phone (ٱنطَلِقُواْ) and in
  headless Chrome at 38 px, and not at the proof page's 64 px.
- `dropMoved` also drops a piece whose box overlaps a counterpart's by 40 %
  of the smaller — the two dots of ة merge into one component at phone
  sizes and failed the same-shape test, so they were greyed beside the
  black ones (نَفۡسࣰا زَكِيَّةَۢ on the phone, never at 64 px).
- **A silent alif's foot is CONTIGUOUS ink, and its head bevels left.**
  `bandInk` used to take every pixel of the drawing in the stem band's
  columns from the stem's top down, which greyed the tip of a neighbour's
  tail sweeping under the alif (the و of وَٱنۡحَرۡ, the ر of نَارًا and
  غَفُورࣰا — five cards, found only at phone scale by the review
  `wf_96410d8e-63f`). It now stops at the first blank row. And in the top
  quarter of the stem it takes the ink running LEFT out of the band — the
  final alif's head bevel, too short a run for the band, which stayed black
  on the grey letter (سِرَاعࣰا and eight more).
- **Verify at phone scale, not only at 2×.** `#/proof/N?from=&to=&px=38`
  sets the proof page's font size; headless Chrome at
  `--force-device-scale-factor=3 --window-size=420,190` is a phone. Three
  of this round's defects existed only there.
- Badges (`make-lesson7.mjs`): no Ghunna chip in the idghām-with-ghunna
  section; Heavy / Light Ghunna by the ikhfāʾ letter (ص ض ط ق ظ heavy), and
  the hint says so plainly; no bare Tanwīn beside Tanwīn Mutatābiʿ; "Iqlāb",
  never "Iqlāb inside". The mīm sākinah hint no longer explains why its
  table comes first (2026-10-10).
- **US spelling everywhere the learner reads, and in the code too** (color,
  gray, center, neighbor…); the author asked for it systematically.
- **`version.json`** is written at build, left out of the precache and
  served `no-store`; `main.tsx` polls it at launch, on focus and every 15
  minutes and, if the server is ahead of the page, asks the worker to update
  and reloads once per build after 12 s. The author's phone sat on the 27
  September build through several refreshes.
- Where the Word skill (`quranic-word-tables-v3`) and this file disagree,
  THIS FILE wins — the skill describes what Word can draw, not what the app
  draws.

The phone-scale review of all 176 cards (`wf_96410d8e-63f`, 8 reviewers,
3.2 M tokens) confirmed six findings, all of them the stem-band foot above,
fixed and re-photographed. Its verify stage died on the usage limit with
nineteen findings unverified; by class they are the same foot (122, 123,
127, 138 — re-rendered, fine), the same head bevel (1, 2, 133, 141, 147,
151, 153, 161, 173 — re-rendered, fine), and four not looked at: 129 (the
grey lam-alif arm a few rows into the lam's upright at the junction), 147
(a one-pixel grey line along the ة's lower-left edge), 167 (faint specks by
the lam-alif's marks), 177 (the small mīm said to overlap the cut
descender — it does not in the zoom). Cards 29, 39, 43, 97 and 153 came out
half-size or overflowing ON THE PROOF PAGE at 420 px: that is `--fit` and
the proof row's fixed id column, not the card. Not re-run: the author asked
for economy. The third round's review (`wf_dade2834-b07`, 2026-10-10, four
reviewers over 176 cards at a true 38 px / 3×, 0.95 M tokens) confirmed
nothing; its one finding was a 3 %-grey speck above the small mīm of
أَلِيمُۢ, invisible without stretching the levels. Lessons 2, 4, 5, 6 and 20
were re-photographed and pixel-compared: 2, 6 and 20 identical, 4 and 5
changed only where a neighbour's tail tip under a grey alif is now black.

**Lesson 6, to finish.** (1) Listen to the ٱلرَّحِيمِ ʿāriḍ triple (cards
44–46) and retake `الرحيم وقف 2.wav` if the first piece carries a stray sound.
(2) Listen to row 11 (`ءَآلۡـٔـٰنَ`), the ṣilah kubrā rows, #7 (its final ىٓ
now a natural 2), المص (the hum on the مٓ, the bounce at the end of ṣād).
(3) Review the ḥarfī Type/Length columns — the one part of the sheet not in
the author's words — and the ع held 6 in كهيعص / حم‑عسق (many hold it 4).
(4) Publish from `#/admin`; it is live as draft.

**Maktab, before the first session (not code).** Print the Student Packet ×
students and one each of the Teacher and Helper Sheets; import
`Maktab Results.xlsx` into a Google Sheet — ideally one a Masjid-controlled
account owns, since these become children's records (ownership, retention and
export should be agreed with the committee before the data exists); write the
roster IDs. After the pilot: revisit the 10/18 thresholds against the
teacher-agreement rate, mine the per-item columns for which rules the class
actually fails — that is the lesson roadmap this app lacks — and only then
consider encoding the used instrument, per the design note.

**A cheap device to house the content — researched, nothing committed
(2026-09-21).** The author asked whether the app could ship on a basic
touchscreen-and-speaker device a parent buys for **$25**, not for profit, so a
family that cannot buy an iPad still has the lessons in the house. The
feasibility work is `Device/feasibility-charter.md` — read it before costing
any of this again. The finding: **$25 is reachable as a BOM at 5,000 units
($20–31) and not as a price to a parent** — freight, a 12.5–37.5% 2026 tariff
on Chinese electronics, $10–20k of fixed certification (CPSIA, FCC, UN38.3,
CE/UKCA, liability) and fulfilment put every route at **$33–52 delivered with
zero margin**. So the question is not whether it can be built for $25 but
**who pays the other $15**: a waqf, a sponsor, or the Masjid buying a class
set. Recommended first step is no hardware at all — a Kids Mode kiosk lock
plus per-lesson offline download plus a printed "use the phone in your drawer"
card, which is also the demand test; then ~30 tablets for the Maktab with the
Masjid paying. Two things from it worth knowing even if no device is ever
built: the **Grammar track can never run on an MCU** (runtime layout and
parsing — it decides the cheap-Android route by itself), and **the port is far
cheaper than it looks** because this app never uses a text shaper. LVGL's
Arabic joining is documented-broken, but `ArabicWord` already renders the full
string and stacks clipped copies measured with the Range API — so a generator
can pre-render each word in headless Chrome (as `Brand/build.mjs` already
does) and emit bitmaps plus per-letter pixel offsets, leaving the firmware to
blit a bitmap and a coloured strip. Pixel-identical to the web app, no font
modification, and storage is free (84 MB of bitmaps beside the 85 MB of audio
already on disk). The risk the charter puts first: **a firmware port would
consume the content work**, and there is one author of every lesson, sheet and
recording.

**Chapters.** Agreed but not built, and the groundwork is in (see "Lesson
identity and order" above). What is left is the visible part: a `chapter` field
on `LessonMeta`, grouping in `orderedLessons()`, headings on the home page, and
— because the author wants to move lessons about — an admin control that writes
`order`/`chapter` rather than requiring a redeploy. Runtime state belongs in
`config/app` beside `lessons` and `features`, the same way publishing does.
The one rule that must survive it: **moving a lesson never changes its number.**

**Audio intake, next steps.** The tool works locally: sheet → slots → record →
named WAVs in the folder. What it does not yet do, in the order it will be
wanted:
- **Cloud collection.** Storage is deliberately separate from the lesson audio:
  a volunteer's corpus recording and a published lesson clip have different
  consent, retention and lifecycles, and merging them would make the strictest
  rule apply to both. Two buckets, one tool, chosen by the session.
- **Content creators other than the author** — the same page, but signed in as
  a teacher rather than the admin, writing to the cloud rather than a folder,
  with the author reviewing before a lesson is generated.
- Per-slot `expect` is settable but the sheet cannot yet say "this row is the
  وَ / ثُمَّ pattern" on its own.

Then classes: what remains of that design, unbuilt — **teacher succession** — handing a class to a successor by code, or leaving the seat
vacant while the class carries on self-paced. Nothing blocks it; it simply
wasn't needed before a class existed to hand over.

Then notes: cloud sync, then the three layers — student layer private with an
explicit submit-to-teacher, teacher layer per class per lesson.

The decisions these were built to (2026-08-08), kept for reference:
- **Many-to-many.** A teacher may run several classes; a student may belong to
  several. Model enrolment as documents (`classes/{classId}/members/{uid}`),
  never as a field on the profile.
- **The teacher approves their own students. The admin approves nobody** — not
  teachers, not students. Anyone may declare themselves a teacher and use this
  material with their own class.
- **One join code per class**, shown plainly on the class page and easy to copy.
  It only gets someone into the *pending* queue, so a leaked code costs nothing
  but a decline. The teacher deactivates individual students rather than
  rotating the code.
- **A deactivated student keeps everything self-paced**: all lessons, their own
  notes, and the teacher notes written up to that point. They simply stop
  receiving new ones.
- **A teacher who deletes their account** keeps their notes alive for their
  students, read-only. They may hand the class to a successor (a handover code
  the new teacher accepts) or leave the seat vacant. A vacant class keeps
  working self-paced. Finding a new teacher later = start a new class.

A student must find a class **by its code before they are a member**, so the
lookup goes in `joinCodes/{code}` → classId — a document readable by any signed
in user who knows the exact code, but not listable. That keeps the class
document itself private rather than world-readable.

Then: notes cloud sync and the teacher/student layers — student layer private
with an explicit submit-to-teacher, teacher layer per class per lesson. Fold
enrolments and notes into `deleteAccount` as each lands.

Further out, and the reason the intake system stores what it stores:
**pronunciation feedback** — a learner records a throat letter and is shown how
their production differs from a native distribution. Acoustic measurement first,
a trained speech model second, an LLM only at the end to put the measurement
into words. Not started; it is gated on the corpus, not on code.

---

## Handover ritual

At the end of a long session, update **section 4** (current state) and **section
5** (next task) and commit. Everything above them changes rarely.

This lives in `CLAUDE.md` rather than a `PROJECT_CONTEXT.md` because Claude Code
loads `CLAUDE.md` into context automatically at the start of every session — a
differently named file would have to be found and read first, which is exactly
the step that gets forgotten.

**How the rendering was verified (2026-09-26/27).** Every card of lesson 7,
and of lessons 2, 4, 5 and 6, was photographed through the proof sheet and
read; then fifteen parallel reviewers each read one 12-card sheet against
the rules above and a skeptic re-read the sheet for every finding
(`workflows/wf_b41b63fc-f70`, then `wf_46fa3e12-f56` on the corrected
render; each `journal.jsonl` holds the findings). The first round found
the notched tail, the ligature alif, the shadda nick and the ط ظ placement
recorded in section 3. Not yet confirmed by the author: the ط ظ pair
placement, the 0.7 stroke spacing, and the small مـ's exact drop below the
kasra.
