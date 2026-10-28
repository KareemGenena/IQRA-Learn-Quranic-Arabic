# IQRA — project context

A PWA that teaches Quranic Arabic pronunciation to English speakers. Tap a word,
hear the teacher's own voice, and watch each letter light up exactly as it is
pronounced. Live at **https://iqra---learn-quranic-arabic.web.app**

This file is loaded automatically at the start of every session. Keep it
current — the "Where we are" section at the bottom is the handover note.

> **If the session touches the Level 1 letter lessons — the Baghdadi qaida,
> lessons 20–33, once "IQRA Kids" — read `Design/iqra-kids.md` before doing
> anything.** It is the design record for that work the way this file is for
> the app: the lesson plan, what was decided, what is still open, and why.
> Only that file is loaded on its own; this one is. So: qaida, alphabet,
> Level 1, Maktab lessons, letter mnemonics, letter cards, the songs → open
> it first. This file stays the authority on everything the two share.
>
> **If the session touches the Grammar track — nahw and sarf for adults who
> already read the mushaf — read `Grammar/IQRA_GRAMMAR_TRACK_SPEC.md` first,
> then `Grammar/M0-recon.md`.** The spec is the pedagogy and the build order
> (milestones M0–M6); the recon report maps its data model onto this app and
> lists the decisions that block M1. Only M0 is done (2026-09-19). So: grammar,
> nahw, sarf, parsing, فاعل, corpus, Quran text, sessions → open both first.
>
> **If the session touches Quiz me — the question book, drills, `#/quiz`, the
> lightbulb, student or parent accounts, a Masjid account, reports — read
> `Design/drills.md` first.** Stage 1 (guest-mode drills, Levels 1 and 2) is
> built; stage 2 (accounts holding learner profiles, a shared Masjid account,
> saving and reports) is designed there and not built.

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
- **Laser pointer** for teaching over a shared screen: a red dot under the
  pointer and a trail that fades a second after the last mark; on a phone
  the finger is the laser and two fingers scroll (2026-10-25).
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
- **Levels** — one curriculum under three Level headings on the home page,
  the same Levels as the practice workbooks. `LessonMeta.level` places a
  lesson; `lessonsByLevel()` in `lessons.ts` groups them. The letter lessons
  (20, 31–33) are Level 1 and were the separate "IQRA Kids" door until
  2026-10-11; `#/kids` and `#/kids/lesson/N` redirect to `#/` and
  `#/lesson/N`. A lesson is drawn as letter cards wherever it is opened
  (`LettersLesson`) when `drawsLetterCards()` says so — a song, a `place`, or
  the bare `letter` on its words; never by `kind`, which lessons 3–7 share.
- **Lessons 21–29, cut from the workbooks** (draft, unrecorded, 2026-10-11):
  Tanween 21, Natural Madd 22, Shadda 23 in Level 1 after the letters;
  Letter Pairs 24, Three-Letter Words 25, Timing 26, Four-Letter Words 27,
  Hamza 28, Qalqala 29 in Level 2 around lessons 1, 5 and 6 — the WORKBOOK'S
  order. `Workbooks/lessons.map.json` says which section each is cut from;
  `node scripts/make-workbook-lessons.mjs` writes each lesson's sheet in
  `Word Tables/` once and its `words.json` from that sheet every run. A
  lesson section is one workbook page (a sitting); a card is a letter with
  its forms (بَ بًا بُ بٌ بِ بٍ, labelled) or a lone word with its caption as
  a badge. 1,098 forms to record across the nine, both readings. **Lessons
  34–37** do the same for Workbook Level 3's uncovered sections — Stopping
  34, Makharij & Sifat 35, Idghām of Two Letters 36, Silent Alif 37 — placed
  in the workbook's order among lessons 2, 4, 3 and 7 (118 forms).
- **Lesson 30 — Tracing the Letters** (Level 1 · Lesson 4, draft,
  2026-10-24): the 29 letters of lesson 20, one a screen. The card plays
  the letter's name, the letter draws itself stroke by stroke in its
  family color over the gray glyph, and Manāra asks the learner to trace it
  with a finger or a pen; a stroke done clicks, the letter done chimes,
  leaving the line knocks and restarts the stroke — never a slow or lifted
  finger. Strokes derived from the font (`scripts/tracing/`), the rule in
  `src/lib/tracing.ts` (section 3, "Tracing"). Names recorded from the
  sheet's table 9.
- **The Level checks** (lessons 41, 42, 43; draft) — one at the end of each
  Level, built by `node scripts/make-assessments.mjs` from the Level's own
  clips, never recorded or authored: 14 hear-and-point items (a clip plays,
  four words from the same lesson, point to the one heard) and, from lessons
  whose cards each carry one rule (`RULE_OF`: 2 sun/moon, 7), 6 which-rule
  items. Seeded by Level, so a re-run is the same check until the recordings
  change — **re-run it after any lesson is recorded**. `AssessmentPage`: P
  plays, 1–4 choose, N goes on; the result is advice ("Ready for Level 2" at
  70 %, else the lessons with the most slips), saved as `score` in
  `iqra-progress`, and never a gate. Level 1's check is empty until its
  lessons are recorded, and the page says so. The paper Maktab instrument
  (§4) stays separate; this does not pretend to be it.
- **Quiz me** (`#/quiz`, 2026-10-27; `Design/drills.md`) — the question
  book: its own door (a lightbulb in the header, a card under Continue, a
  line in the drawer), never a lesson. Choose topics — seven, the Level 1
  workbook's sections with §3 split into letter sounds and harakat — and 15,
  30 or 45 questions, behind a grown-ups multiplication; the choice is
  remembered, so the next quiz is one tap. A clip plays, the choices wake when
  it ends, tap what you heard; misses come back at the end, round after round,
  until each is right once; an end screen by topic with "Practice my
  mistakes". Guest mode: nothing about the learner is kept, and the quiz
  under way survives a reload (`iqra-quiz-run`). The bank is
  `public/quiz/quiz.json` from `node scripts/make-quiz.mjs`, which reads the
  lesson 21/22/23/30 clips and two sheets of the author's (`Word Tables/Quiz
  Prompts.docx`, `Quiz Sound-alikes.docx`, both RECORDED 2026-10-27 into
  `Audio/Audio - Quiz Prompts/` and `Audio/Audio - Quiz Sound-alikes/`).
  Feature `quiz`, admin-only until switched on in Manage lessons; a topic
  shows only where its lessons may be opened. **Since the evening of
  2026-10-27**: nine topics — memory pairs (a game, never scored) and
  tracing (lesson 30's own `TraceCard` in a `quiz` mode, a slip off the line
  sending the letter back) joined; a mix-up between sound-alikes plays the
  teacher's recording of the two ("hear the difference"); the end screen is a
  ring meter, a dot per question and bars by topic in a green and gold
  validated for colour-blind separation (`Design/drills.md` §2). **Since late
  2026-10-27**: every heading is the plainest words that say what to do
  (`ASK` in `quiz.ts` — "Which letter?", "Tap what you hear."), a recorded
  instruction plays only where it says the same thing and only when it is
  not the one just heard; memory pairs is the classic game, the cards face
  up until "Turn them over"; the chooser has "Select all" and groups topics
  by Level, a greyed topic saying "Not published yet" or "Not recorded yet";
  and **Level 2 is built** (`Design/drills.md` §10): letter shapes from the
  alphabet's text, "Tap what you hear" over the recorded words of lessons 1,
  5 and 6 with a look-alike found by rule, and "find the one" for qalqala,
  each word played once, lit, before the tap. Lessons 25–29 light up their
  topics when recorded and `make-quiz.mjs` is re-run. `visibleBank` drops
  every clip of a lesson the person cannot open before a quiz is made.
- **Continue** — the way through, never a gate. The home page opens with one
  card: the lesson last left unfinished, else the first not done ("Start
  here" / "Next up" / "Continue"), with every lesson listed beneath it, ✓ on
  the done ones. Under every lesson a "Next lesson: …" link; reaching a
  lesson's last page, or moving on from it, marks it done; `N` walks off the
  last page into the next lesson. Progress lives in `localStorage`
  (`src/lib/progress.ts`, key `iqra-progress`) — on the device only so far;
  an account will sync it additively.
- **Two readings per word** — continuing (the word with its final vowel, how
  every clip before 2026-10-11 reads) and at a stop. A form with a stop take
  carries `stop: { audio, timings }` in `words.json`; `stopPlayable()` in
  `lessons.ts` turns it into a Playable keyed `<key>-waqf`, timed `waqf:
  true`, final vowel greyed. The lesson header shows a Continuing / At a
  stop switch (`iqra-reading`, default continuing) only where the lesson
  has one; it sets what the big button, Play all and `N` mean, and each form
  with two readings gets a small button under the word that plays the other
  once. Every word lesson, 1 included, draws the same `ItemCard` (lesson 1's
  own `WordCard` went on 2026-10-11 — it was why lesson 1 had no switch and
  no chip); lesson 1 still has no generator, so a stop take for it has
  nowhere to be attached yet. **Since 2026-10-20: ONE play button per word**
  (the word itself) **and a pair of tabs under it**, "read on" and "at a
  stop", that says which reading it plays — the page's switch sets every
  card, a tab sets that card alone until the page is switched, and tapping
  the other tab plays it at once (the second play button read as a
  duplication). A reading with no take is a disabled tab, "not yet
  recorded". The page switch (`ReadingSwitch`) is labelled "Hear each word"
  with a one-line tip of what each reading is. Keys: **S** flips the page,
  **W** plays the current word the other way (`register(key, play,
  playOther)`). Both readings of every card on a page are fetched as the
  page opens (`warmPlayable`), so the first tap plays at once; a tap that
  still waits on a download shows a dotted ring and a second tap is ignored
  rather than cancelling the first (`loading` in `usePlayable`) — the
  "first click plays nothing, the second plays" of 2026-10-20, which was
  the download plus the cancel. The word is drawn the same in both
  readings.
- **Workbook companion** (`#/workbook`, `#/workbook/L/<printed page>`,
  `#/workbook/L/section/N`) — the electronic side of the paper: one app page
  per workbook page, every item on it in the book's order with Play where a
  clip exists, a Back / page-picker / Next pager, the PDF opened at that
  page, and the two-readings switch. Addresses carry the PRINTED page number
  (the footer a learner sees); the PDF link uses the physical page. A section
  address resolves to the section's first page — that is where `/go/<section
  id>` on the landing site sends a QR reader (`site/public/go.html`, rewrite
  `/go/**`; `companion` in `crosswalk.json`) while the app is switched on,
  and to the PDF page while it is off. Listed under "Practice workbooks" on
  the home page. **Published like a lesson (2026-10-25)**: the feature
  `workbooks` in `config/app` (Manage lessons → "Workbook pages") — while
  it is `admin` the home page's section (marked draft), the drawer's link
  and the `#/workbook` routes show to the admin only; a learner who
  follows a link gets "not published yet". The lesson tool row's workbook
  icon is the printed PDF on the landing site, which is public, and stays.
- **Install as an app** (`InstallPrompt.tsx`, 2026-10-25): on the first
  visit, a small card rises from the bottom 2.5 s after the page opens —
  no backdrop, nothing blocked — asking to install. Install calls the
  browser's own prompt (`beforeinstallprompt`, kept from the moment the
  browser offers it, before React mounts) and, once accepted, says where
  the app is now (home screen or app list on a phone; Start menu, Dock or
  Applications on a computer). An iPhone or iPad has no prompt in any
  browser, so the card shows Share → Add to Home Screen → Add. Elsewhere
  it says where the browser keeps its install command. "Not now" is
  remembered (`iqra-install`) and the card never comes back by itself;
  "Install as an app" in the drawer reopens it — the entry shows only
  where installing is possible (`canOfferInstall`: a phone or tablet, or
  a computer whose browser offered its prompt). Nothing shows when the
  app already runs installed. Chrome hands the page its prompt only after
  a tap and some time on it, so a card already showing the menu steps
  turns back to the one-tap offer when the prompt arrives. On iOS 26
  Safari's default layout Share hides behind "···", and step 1 says so.
- **Two readings are a Level 3 matter (2026-10-24).** The switch, the
  per-card tabs and the S / W keys show only on a Level 3 word lesson
  (`twoReadings` in `App.tsx`: `meta.level === 3`, not letter cards, not a
  check) and on Level 3 companion pages; everywhere else a card has its one
  reading and no tabs. The stop changes the ending of a WORD, and Levels 1
  and 2 are letters, syllables and first words. A card's `reading` prop is
  `undefined` there, which is what hides the tabs — never a second flag.
- **The lesson page's head is one small line and a row of icons
  (2026-10-25).** "Level 1 · Lesson 4 · Tracing the Letters" in 13 px
  (`lesson-where`), then `LessonTools`: notes, the workbook page(s), the
  laser and, for the admin, a gear whose popover holds the status pill
  and Calibrate / Audio intake / Manage lessons — each icon grows its
  label on hover. The section box is the page's ONE heading. Gone: the
  breadcrumb's bold title, the standalone grey Arabic title, the
  1×–2× **speed buttons (everywhere; `RATE` is 1, the engine still takes
  a rate for the calibration page)**, the workbook bars, the notes bar,
  the admin bar, and the floating Laser pill that covered the pager on a
  phone. The author's screenshot showed a song's name three times before
  its first card (2026-10-25). **The contents drawer** (`ContentsMenu`)
  lists every Level and its lessons, the workbooks and the account from
  any page, and a link opens the lesson itself. **Its ☰ is the RIGHTMOST
  thing at the top** (`.menu-btn`, last in `header-actions`, after the
  theme toggle). For one round it was a tab on the page's right edge; the
  author meant "on the top, to the right" (2026-10-25). **On a phone a
  tool that leaves the page opens its label first**: Notes and the
  Workbook take one tap to grow their label (`.tool.expanded`) and a
  second to go; a tap anywhere else folds it and shuts an open gear menu.
  The laser and the gear act on the first tap. Every hover rule of the row
  sits under `@media (hover: hover)`: on a touch screen `:hover` stays
  stuck after a tap, which left the laser's and the gear's labels open
  after they were turned off. **The header's Admin link is hidden on a lesson page**: the
  gear's "Manage lessons" is the same page. **The laser** (`LaserPointer`,
  rewritten the same evening): the overlay hides the system cursor and
  draws a red dot wherever the pointer is — mouse, pen or finger — and a
  trail while pressing, which fades a second after the last mark; on a
  phone ONE finger is the laser and TWO fingers scroll (the component pans
  the scrollable under them; a mouse wheel scrolls as ever). The way out:
  the tool button (the `.lesson-crumb` row sits above the overlay, z-index
  905 over 900), the "Laser on · tap to turn off" chip fixed at the top,
  or Escape. Before this the overlay showed a crosshair, a red frame and
  no dot, the button under it could not be reached, and on a phone —
  where a finger only scrolled — the frame was the whole feature. The icon
  is a slanted pointer with a red dot and rays at its tip, white once the
  button itself is red (`--laser`).
- **A lesson is named by its place, never its number** — `lessonLabel(id)`
  in `lessons.ts`: "Level 3 · Lesson 4", the Level and the position the
  home page counts in it. Shown in the lesson header and the recordings
  page; the id stays what it always was, a key.
- **One pill, two halves** under every lesson (2026-10-24): "‹ Previous"
  and "Next lesson ›" in the space the Next pill took (`lessonBefore` in
  `lessons.ts`, `.lesson-pill` in the CSS). Going back marks nothing; going
  on marks the lesson done.
- **A section can switch the reading tabs off**: `readings: false` on a
  `LessonSection` (lesson 3's pair and contrast drills — two words said
  together, where "at a stop" means nothing) gives its cards one reading
  and no tabs, on a Level 3 lesson too.
- **The workbook's teaching lines are the app's hints** (2026-10-24,
  revised twice the same day). The parser (`scripts/lib/workbook.mjs`)
  gives each page its "★ Tip" lines (`tips`) and each item the `rule` line
  printed above its table ("Heavy (1): ر has a fatha: رَ", "Round zero:
  قَالُواْ: …"). A workbook lesson's page is HEADED by its part of the
  section ("Raa", "Hams (whisper)", carried over the pages a part spans)
  or by the lesson's title — never "Page 54": the author struck the page
  numbers — and its hint is the teaching alone, one line per tip and per
  rule; the "Workbook Level 2, page 54 …" line is gone, the workbook button
  above the lesson says where the paper is. **The (i) is for meanings
  only** — a rule is never a tooltip, and never the same text on every
  card. Where a table's rule is numbered ("Heavy (4)") the card's chips are
  the caption without the number and the rule's reason as its own chip
  ("Heavy · ر has a damma" — ONE chip, the rule, never the caption's
  excerpt of the word beside it, and the rule's own example "رَ" stripped:
  the learner can see the ر in the word). A caption part that only repeats
  a piece of the word ("· مَرۡ", "· لُواْ", "· م مَّ") is dropped from every
  workbook lesson by the same rule (`chipOf`); a decomposition (أ + كۡ + ث
  + ر) or a change (دٌ ← دۡ) stays. A chip of Arabic alone is set in the
  Mushaf face at 20 px (`badge-ar`); a chip that is a sentence takes a row
  of its own and wraps (`badge-rule`) instead of running out of the card.
  `Workbooks/lessons.map.json` may give a page its own `tips` — keyed by
  the printed page ("54") or by a RUN of the sheet's card numbers on it
  ("56:39-44"), which becomes its own section and so its own screen:
  lesson 29's page 56 is three screens, the sukoon line, the stop line and
  the shadda line, because a tip must fit the words in front of the
  learner (the author, 2026-10-24) — and a word its own chip (`notes`:
  خُسۡرٍ is heavy at a stop only). The companion shows the same tips and
  rules over its page. Where the master has no tip (Level 1's pages) the
  hint is "Tap a form to hear it."

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
- **RETRACTED 2026-10-20: the nasal mark the Mushaf wrote for the NEXT word
  is no longer greyed.** `unreadFinalNasal()` in `graphemes.ts` still names
  it (a staggered tanwīn, or a vowel + small mīm, on the last word), and
  `ArabicWord` still draws the staggered pair and the small mīm — but never
  dimmed: the author found the grey "too complicated"; the mark is black as
  in the Mushaf and the teacher explains why it looks as it does. The grey
  final vowel of a stop reading went the same day (`stopPlayable` no longer
  sets `dimFinalMark`; the layers it added read as a third ḍamma on
  مُّؤۡصَدَةࣱ). `unreadFinalMaddah` (one card, lesson 6 #7) is untouched —
  the author has not ruled on it.
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
- **The Mushaf face is `'Uthmanic Hafs'` in CSS** — the family the
  `@font-face` declares — never `'KFGQPC Uthmanic Script HAFS'`, the
  file's INTERNAL name, which matches only a font installed on the device.
  Every rule that said "the Mushaf face" in a comment (Arabic in hints and
  chips, the Arabic-only chip, a letter card's big letter and small sound
  cards, the songs, the places, the letter name) named the internal one
  and drew in Noto Naskh on every device until 2026-10-25 — measured in
  the pane: identical metrics to Noto. The Mushaf face draws the same
  size or a little larger at the same font-size, so no size changed.
- **The ٱل prefix is black** (2026-10-24; `withAlPlayable` passes
  `prefixClusters: 0`). It was painted in the lesson's accent colour; the
  author wants it like the rest of the word. The sun lam is still greyed by
  `derivedSilent()` and the badge still names the rule.
- Never split an Arabic word into per-letter spans — it breaks cursive joining.
  Colouring part of a word is done by stacking **clipped copies of the same full
  string**, measured with the Range API (`ArabicWord.tsx`).
- The font (KFGQPC Uthmanic Hafs) may be used and redistributed but **not
  modified** — never subset it or convert to WOFF2. Serve the original `.otf`.

**Audio**
- **THE CLOCK IS THE SOUND CARD'S (`playback.ts`, 2026-10-24).** A clip is
  fetched once as a Blob, decoded once into an `AudioBuffer`
  (`prepareClip`, LRU of 48), and started through Web Audio
  (`AudioBufferSourceNode.start(when)`, `when` = now + 30 ms so the start
  is known to the sample); the highlight reads WHERE THE SOUND IS NOW from
  `AudioContext.getOutputTimestamp()` — the frame the output device is
  putting out at this instant, extrapolated by `performance.now()` — and
  takes the SMALLER of that and `currentTime − outputLatency` (the render
  clock less the latency the device reports): WebKit's timestamp is the
  render position, not the output's, so on iOS and on any Bluetooth route
  the corrected render clock is the one that counts, while in Chrome the
  timestamp is output-side and wins. The extrapolation from the last
  output callback is capped at 0.1 s and switched off while the context is
  not running, and an inaudible `ConstantSourceNode` (offset 1e-7) keeps
  the sink awake from the first gesture — Chrome parks the output after
  30 s of silence and restarts it on the next sound, a quarter second in
  which no frame renders, so the first word after a pause came out late
  with the highlight running ahead of it. A clip ENDS on the heard clock
  too: the source's `ended` fires on the render clock, so `finish` waits
  until that much sound has been heard (the old rule cut the last letter
  short by the latency on Android and Bluetooth). A pause is stamped at the
  render position, because the frames already rendered play out. Measured
  in the pane with a mutation observer on the box (2026-10-24): lesson 5
  #1 (speech 0.09–2.47 s) walked its three letters in 2.36 s at 1× and
  1.60 s at 1.5× through the Worker's stretch, both within 20 ms of the
  clip; the first clip of the session appeared 0.63 s after the tap, the
  parked sink's restart, and the highlight WAITED for it instead of
  leading — the keep-alive begins on the page's first gesture, so only a
  session whose very first tap is a Play pays that once. The
  media element it replaces opened the device's output on its own schedule
  (tens to hundreds of ms, different every time, worst on phones) and its
  `currentTime` ran ahead of the speaker by that much; the warm element
  (2026-10-12) and the loop started on `playing` (2026-10-20) narrowed the
  gap and could not close it, and the author still heard an erratic lag on
  phone and laptop. Speeds 1.25 / 1.5 / 2 (and the calibration page's
  0.75) are a WSOLA time-stretch of the decoded clip (`wsola.ts`, 40 ms
  frames, ±8 ms search, pitch unchanged — the browsers' own `playbackRate`
  algorithm), run in a Worker (`stretch.worker.ts`; on the main thread
  only where module workers do not exist), computed once per clip and
  speed, cached, and done as the card appears at the page's speed
  (`warmPlayable(lesson, playable, rate)`) rather than at the tap; media
  time = offset + heard × rate. `warmAudio()` is called synchronously at
  the top of every play — iOS resumes a suspended or `interrupted` context,
  and unlocks the session-key element, only from a gesture — and the
  context is woken again on `visibilitychange`; a page going HIDDEN stops
  whatever is playing, because iOS interrupts Web Audio in the background
  but lets the media element loop on. `usePlayable` numbers its plays
  (`genRef`): a second play on the same card, or a stop, before the first
  has its clip supersedes it, so a superseded play neither sounds nor
  resets the state the newer one set (two in flight once left a card dark
  while its clip played; a stop during the download once let the clip play
  after the page was left). **The calibration page captures on the same
  clock** — `startCapture` plays through `playWithHighlights` and stamps
  each tap with `handle.now()`; it used to read a fresh media element's
  clock, which runs ahead of the speaker until its output is open, so every
  saved tap was early by that much.
  The media element remains for two things only: the fallback when there
  is no AudioContext or a clip will not decode (`elementEngine`, the old
  code), and on iOS the audio-session key — a silent WAV looped on the
  warm element WHILE a clip sounds (`holdSession`) puts the page's session
  in the "playback" category so the silent switch does not mute Web Audio,
  which it otherwise does. Verified in the pane: the box appears at the
  tap, walks the word, clears at the end, no console errors; the ear is
  the author's. **The per-letter boundaries are still the weight model's
  estimates** (±0.45 s, see "The highlight engine's remaining error") —
  this fixes the clip starting late or the highlight leading the voice,
  not where each letter's boundary falls; only calibration does that.
- **Every clip is played at the same level** (`gainFor` in `playback.ts`,
  2026-10-24). Recording levels vary by 30 dB across the corpus; lesson 4
  peaks at −29.6 dBFS and the author found it barely audible. The files
  stay as recorded; the player lifts each decoded clip so its 99.9th-
  percentile sample sits at 0.9 of full scale (the percentile so that a
  lone click cannot hold a clip down), within +30 dB, through a GainNode.
  Lesson 4 gets about +28 dB, lesson 7 about +15 dB. The media-element
  fallback cannot boost (volume caps at 1). Peak-equal, not loudness-equal:
  enough that no lesson is quiet; a LUFS pass is the next step if two
  lessons still sit apart.
- Play via **blob: URLs** (`audioSource.ts`), never raw file URLs — media range
  requests through the service-worker cache truncate first playback.
- **Superseded 2026-10-24 by the Web Audio engine above; kept as history.**
  ONE audio element, kept warm (`playback.ts`, 2026-10-12). The first
  clip of a session came out late and short and the second click put it
  right: a fresh `Audio` element opens the device's output, and until it is
  open the element's clock runs ahead of the sound leaving the speaker — the
  highlight led the voice, and the tick, which ends a clip a quarter second
  after its last boundary BY THAT CLOCK, cut the tail off. So the element is
  reused across clips (the output stays open), opened with a sliver of
  silence on the page's first pointerdown or keydown (`installAudioWarmup`,
  from `App`), the highlight loop starts on the `playing` event rather than
  the play() promise, and the clock is read back by the device's reported
  `outputLatency`. Never go back to `new Audio()` per clip. Verified in the
  pane by timing only (first play reached `playing` in 26 ms); the ear is
  the author's.
- Clips are stored **mono** (halves the offline payload).
- Recording levels vary hugely between sessions, so silence detection derives its
  threshold from each take's own noise floor — never a fixed value.
- `splitIntoN(wav, count)` is the splitter. Its rules, each learned the hard way:
  a click is short in **absolute** terms (~0.08s) and must never be judged
  relative to the other pieces — that threw away the quarter-second وَ of
  وَٱلتَّكَاثُرُ; breaths are trimmed at the **edges only**, which is what stops that
  rule eating a word's opening; word boundaries are then the `count-1` longest
  silences.
- **Three edge rules, in absolute terms (2026-10-20).** Lesson 7's stop
  session showed the stray-edge rule's flaw: it judges an edge run against
  the MEDIAN kept run, and a stop reading's closures break a word into short
  runs, so the median collapses and (A) the **record click** — a thump in
  the first tenths of nearly every take, up to as loud as the voice — passed
  as a word and was kept with a second of silence (22 stop clips; the sound
  began a second after its highlight), (B) a loud final syllable parted by a
  closure (نَٰكَ, 0.72 of peak) was popped as a stray tail and a third of
  ثَبَّتۡنَٰكَ went, and (C) the 50–70 ms **release** of a final sākin ك or ت
  was a sub-tick, past the pad's reach, and cut off (سِرَاعࣰا ذَٰلِكَ, طَيِّبَٰتِ;
  lesson 5's سِيٓءَتۡ had the same). So: (A) a group of runs starting inside
  the first 0.30 s, spanning ≤ 0.50 s (pieces chained when parted ≤ 0.25 s)
  and parted from the voice by > 0.25 s is dropped whatever its level, as
  long as `count` runs remain — a thump is known by where it is, not how
  loud; (B) a tail is a stray only when under 0.5 of peak (the loudest noise
  the old rule ever trimmed there was 0.38, a breath; the head is not gated,
  (A) owns it); (C) a sub-tick burst within 0.25 s after a piece is put back
  when ≥ 0.15 of peak, NOISY (≥ 0.4 zero crossings per ms — a release
  crosses 10+, a thump or lip noise under 0.4) and not touching the take's
  last 0.10 s, where the stop-recording click lives. `takeCheck.ts` carries
  the identical three parts and `check-take-parity.mjs` proves it (702
  recordings). Every edge decision is printed with the take's name, the way
  a sheet correction is. Replayed over lessons 3–7 before the re-cut:
  lessons 4 and 6 byte-identical (the three lesson-4 calibrations stand),
  lesson 3 moved its five shipped head clicks (إله, الحمد, بلغ, مغفرة,
  نهار), lesson 5 two (سيت's تۡ back, a 10 ms blip on أمرى إلى), lesson 7
  35 — and after it the voice begins 0.12 s into every clip of both sets
  except two stop takes whose click is below the app's own floor (مِن
  وَاقٍ #68 0.43 s, وَكَأۡسٗا دِهَاقٗا #133 0.33 s: a `<name> 2.wav` retake
  in `وقف/` is the only cure). The app's `speechBounds` was right all along:
  it reported the silence that was in the file. **The speaker should wait a
  beat after pressing record**: (A) needs a quarter second of silence
  between the click and the voice, and no take in the corpus has a real
  word inside the first 0.3 s. Investigated by a six-agent workflow
  (`wf_240cf5b1-d8d`, 1.4 M tokens), two skeptics' amendments folded in.
- **The highlight engine's remaining error is not the edges.** With clean
  edges the per-letter boundary error against closure landmarks is a
  dispersion of ±0.45 s at the 10th/90th percentile in BOTH readings with
  no offset: the proportional weight model against the reciter's tempo.
  That is calibration or weight work. By the landmarks the STOP reading of
  خَلۡقࣲ جَدِيدٍ is the better-timed of its pair, the reverse of what the
  author heard (2026-10-20) — most likely the first-play delay of the day,
  now gone; not verified by listening.
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
- **A stop reading is the same filename in a `وقف/` subfolder** of the
  lesson's audio folder (`scripts/lib/stop.mjs`, `STOP_DIR`). The mode is
  the folder, never the name: the filename stays derived from the cell, and
  lesson 6's `<word> وقف` tag in the main folder (one take said three ways)
  keeps its own meaning. Every generator 2–7 calls `attachStops(lesson,
  AUDIO_SRC, AUDIO_OUT, key)` once, after its cards are assembled and before
  `words.json` is written: each form whose text matches a stop take gains
  `stop`, the clip cut as `<clip>-waqf.wav`, and the run reports what was
  attached and what matched no row. The intake page records one reading per
  session (a Reading selector beside the utterance count, kept in the
  session and in `intake.json`) and writes a stop session into `وقف/`
  itself. A stop reading cannot be cut from a continuing clip: the stop
  changes the length and quality of the ending. Proven end to end with one
  planted take on lesson 4 and removed again (2026-10-11).
- **The workbook companion is generated from the masters themselves** —
  `node scripts/make-workbook.mjs [levels]` reads `Workbooks/Practice
  Workbook Level N.docx` page by page (a running-head paragraph opens a
  physical page, physical = index + 3, checked against the PDFs' 33 / 59 /
  34 content pages; "Section N · Title — instruction" names the section;
  a drill table's FIRST row is the items and its second their captions, the
  grey tracing rows are never read) and writes `public/workbook/levelN.json`,
  never hand-edited and never precached (runtime-cached like the clips). An
  item's id is `L1S4:<filename key>`, its section and its text — stable
  across editions as long as the word stays in the section. Audio, in order:
  a continuing clip from lessons 1–7 whose text is EXACTLY the item's,
  marks and all, AND is on disk (a word recorded once serves the lesson it
  is taught in and the page it is traced on — its own clip, calibration and
  stop reading; lesson 7 named clips it did not have and the page offered a
  Play that failed, so the check is for the file, not the entry); else a
  take in `Audio/Audio - Workbook Level N/` (with `وقف/`), cut into
  `public/audio/workbook0N/` and calibrated under lesson id 90 + N; else
  nothing, and the card says "Not yet recorded". Letter lessons (20+) are
  never reused: their clips are whole teacher lines. **Never match on the
  filename key here.** The key strips the marks so a hand-typed filename
  finds its row, and inside one lesson's folder that is unambiguous; across
  the corpus it is not — the first version keyed صَبَرَ to lesson 4's صَبۡرِ,
  and the author heard the wrong word on the first card he tried
  (2026-10-11). The same holds for workbook takes: بَ بُ بِ all strip to ب,
  so a workbook take must be named with its marks (`بَ.wav`) and is matched
  exactly; a take named without them is used only where that key belongs to
  one item in the level, and is otherwise reported as ambiguous and left
  alone. The intake page still derives names WITHOUT marks — it must learn
  to keep them for workbook items before any workbook recording (not
  built). `node scripts/make-workbook.mjs` prints every reuse count; the
  mechanical check is to compare each reused item's text with the lesson
  form's text — zero mismatches over all 48 reuses. **Run it after any
  workbook edition and after any lesson is recorded** — reuse changes.
- **A workbook lesson's sheet is written once and then belongs to the
  author.** `make-workbook-lessons.mjs` reads `Workbooks/lessons.map.json`
  (lesson number → workbook section, title, blurb, sheet name) and, when the
  sheet does not exist, writes `Word Tables/<sheet>.docx` from the master —
  one row per item: Page (the workbook's printed page) · Card · Word · Note,
  the Word column the only Arabic one so the intake tool records it row by
  row and names the files with their marks kept. From then on the sheet is
  the source: a deleted row drops a word, a moved row moves it, and the
  script never overwrites it (delete the sheet to have it written afresh).
  The lesson's `words.json` is read from the sheet on every run; captions
  come from the master by exact text. **The card rule**: a column group of
  the master is one card only when every caption is a form label (Fat-ha,
  Tanween Damm, Madd Alif, Shadda — a letter and its forms); where captions
  are decompositions (و + ر + د) or timing dots (●● ●) the group is two words
  sharing a column, and each is its own card. Form labels are per CARD
  (`formLabels` on the word; `ItemCard` reads the card's before the
  lesson's): the "Shadda with Kasra" rows read Kasra · Shadda. Takes go in
  `Audio/Audio - Lesson NN/` (with `وقف/`) — or the folder the map names
  (`audio`: the author recorded 21–23 into "Audio - Tanween", "Audio -
  Natural Madd", "Audio - Shadda", 2026-10-25) — matched by `takes.mjs` (exact
  text, else an unambiguous key); clips `wordNN{a..f}.wav` or `wordNN.wav`;
  a card's id is its ordinal in the sheet and is spent whether recorded or
  not (deleting a row DOES shift the ids after it: the عَفِ / عَفِّ rows of
  lesson 23 went on 2026-10-25, before any calibration existed there).
  The map may also give a lesson its title-box line (`hint`, for pages
  whose master has no tip — 21's "Tanween means to add the sound of a nun
  sakinah after the haraka") and a card a chip by any of its forms' text
  (`badges` — "Ghunna" on بَمَّ and بَنَّ, keys NFC). The shared parser is `scripts/lib/workbook.mjs` (`readWorkbook`,
  items with `row` and `group`); the companion uses it too. Word opens the
  generated sheets (checked with `word-pages.ps1`: Lesson 23 is 5 pages).
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
  them, every time. **And a room is "speech" only when what stands out of
  it also peaks above −40 dBFS** (2026-10-25): the author's Yeti GX has a
  floor of −85 dBFS, where a tick nobody hears — a mouse settling at
  0.6 s, −51 dBFS — was 34 dB above the floor and failed the take; no word
  in the corpus peaks under −33 dBFS. The ratio alone was the rule, and a
  quieter microphone than the rule had ever met broke it.
- The **speaker profile** — room tone, بَا/بِي/بُو, and one carrier phrase —
  is recorded once per session. It is worthless to the lessons and
  indispensable to the pronunciation work: vowel formants scale with the vocal
  tract, so a learner can only be compared to a native distribution after
  normalising against their own vowel space. It cannot be collected after the
  fact, which is why it is in the first version.
- `intake.json` is written beside the audio: sheet, row, text, speaker,
  consent, levels, take count. The generators ignore it; the corpus cannot be
  built without it. **Since 2026-10-25 it holds EVERY session written into
  the folder** — `{ sessions: [...] }`, oldest first, a re-save of a
  session replacing its own entry, a file from before (one bare manifest)
  becoming the first entry. It used to be the LAST session's manifest
  alone: the alphabet's three sessions into one folder overwrote each
  other, and the first two are gone from disk (the browser's intake store
  still has them). The Save panel says what it wrote BY KIND — the takes,
  and the five speaker-profile files, which every session rewrites into
  the same folder ("5 over a file that was already there" read as an
  error) — and names a take that would not survive the split with the
  check's own words, instead of counting them.

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
- **The merged or hidden letter gets NO time (2026-10-24).** `GHUNNA_ONSET`
  is 0: a nūn or mīm sākin whose hum carries into the next letter (idghām,
  ikhfāʾ, iqlāb, ikhfāʾ shafawī, idghām shafawī) hands over its whole
  weight, so the highlight steps from the letter before it straight onto
  the letter that carries the hum — كَم مِّن lights كـ, then the second مـ
  in violet. At 0.3 the first م held the box for a beat; the author saw
  that in the continuing reading of lesson 7 #1 and not in its stop
  reading and asked for the skip to be the rule everywhere. A tanwīn's
  letter still keeps its vowel and hands over only the nasal tail; a
  zero-weight letter is still AUDIBLE for the calibration page (a tap per
  letter), and its two boundaries coincide.
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
- The place (page + step) is remembered per lesson in `localStorage`. **A
  lesson always opens on its first page** (2026-10-11: landing part-way
  through read as a fault); the remembered place is offered in a "Pick up
  where you left off? Screen N of M" bubble for six seconds (`RESUME_MS`),
  gone on any tap or key elsewhere, and tapping it turns to that screen and
  restores the step. An ignored bubble does not cost the bookmark — the place
  is rewritten only once the learner moves. A page reached any other way
  restarts the walk at the top. `-1` means "not started", so the first Next
  plays the first word rather than the second.
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
  **v5 (2026-10-25), and two guards.** Lessons 20–23 and 30–32 listed
  their clips in `words.json` BEFORE the clips existed; a device that
  opened one was answered with index.html for every clip URL, and the
  browser kept that answer for a day under the `/audio/**` max-age — the
  author's phone played no letter while the laptop, which had not asked
  early, did. v5 is new URLs; and every clip fetch now REVALIDATES
  (`cache: 'no-cache'` in `getAudioBlob`, `fetchOptions` on the worker's
  audio and picture rules), so a stale answer is never handed back again
  (a real clip costs a 304). **A clip may carry its own hash** (`audioRev`
  in words.json → `Playable.rev` → `?v=v5.<rev>`): `make-alphabet.mjs`
  writes the first 8 hex of each clip's SHA-1, so a single retake (ت) is a
  new URL by itself — no global bump making every learner re-fetch every
  clip. The other generators do not write it yet; for their clips the
  global bump stands.
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
- **A learner never sees the number.** `lessonLabel(id)` prints "Level 3 ·
  Lesson 4" from `lessonsByLevel()`; the header used to print the id, and
  "Lesson 1" after lesson 25 read as a broken order (2026-10-24).
- Reading order is therefore a separate thing: `LessonMeta.order`, read through
  `orderedLessons()` in `lessons.ts`, which is the one place order is decided.
  Only the Level 1 lessons set `order` (31, 20, 32, 33); the rest sort by id
  within their level. It exists so the day one moves, the move is a number
  rather than a renaming of folders, clips and calibration documents.
- The grouping is `LessonMeta.level` (1–3, the workbook Levels), read through
  `lessonsByLevel()` in the same file: `orderedLessons()` sorts by level, then
  by `order` where set, else by id. Same rule: a lesson changing level must
  not change its number. Lessons 1, 5, 6 sit in Level 2 and 2, 3, 4, 7 in
  Level 3, placed by the workbook sections the crosswalk maps them to (lesson
  1 by hand — five-letter words follow Level 2's four-letter words); each is
  one number to change.

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
- **The Firebase web API key is public by design and RESTRICTED (2026-10-12).**
  It sits in `app/src/lib/firebaseConfig.ts` and `site/public/admin.js`, ships
  in every page load, and is what every Firebase web app uses from the
  browser; the data is guarded by Auth and the Firestore rules, never by the
  key. GitGuardian flagged it on a push, and the console then showed usage of
  the Geocoding API — which nothing here calls — so the key had been scraped
  and used on a billable API. It is now restricted in the Google Cloud
  console (APIs & Services → Credentials → "Browser key (auto created by
  Firebase)") to **websites**: the app at `iqra---learn-quranic-arabic.web.app`
  and `.firebaseapp.com`, the landing page at `iqra1447.web.app`,
  `iqra1447.firebaseapp.com` and `iqra.muslimbynature.org`, and localhost on
  5173, 5174 and 4173; and to **three APIs**: Identity Toolkit, Token Service,
  Cloud Firestore — the only Google endpoints the code calls (`auth.ts`,
  `appConfig.ts`, `classes.ts`, `admin.js`). **A new host must be added to
  that list in the console** (five minutes to apply, nothing to redeploy); a
  blocked request is a 403 naming the key. Never rotate the key to "hide" it:
  the new one would ship in the bundle just the same. Never rewrite history
  to remove it: same reason.
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
- **A tooltip opens on the button, never near it.** `.meaning-tip` and
  `.image-pop` show on `.info-btn:hover + …`, on `:focus-visible` or on
  the tap's `.open` — the old `.pair-head:hover` rule popped the meaning
  up with the pointer anywhere on the card's head (2026-10-24).
- **A song is sung along line by line — karaoke, never a moving strip
  (2026-10-25).** The strip that glided under the sung letter (a glide
  per letter, a third of a second for a single) made the author dizzy.
  `SongCards` now shows ONE line, large and still: a sung line of seven
  names (ا…خ · د…ص · ض…ق · ك…ى — the song's own breaths), two letters'
  sounds in the sounds song (`song.lines` in words.json, the step each
  line starts at). The sung letter wears the green box, with no CSS fade
  (a 0.15 s fade on it read as the box lagging the voice); the line on
  screen gives way to the next `LEAD_S` (0.3 s) before that line's first
  note, by a short fade, never a slide. Below, the whole song small, one
  row per line, the current one marked; a tap on a row goes there. Which
  line shows is a function of the MEDIA TIME read every frame from the
  engine's clock (`now`), so a pause holds it and a seek jumps it. Play /
  Pause and Space; a tap on a letter starts from that letter, by CLUSTER
  (the hook's boundaries are empty until a first play resolves). The song
  goes back to its first line only when it REACHED ITS END — playback
  also stops when the page is hidden, and a teacher who paused on ق must
  find ق's line on coming back. **The songs are timed from their own
  recordings** (`scripts/lib/align.mjs`): the lines are cut at the
  longest pauses near an even split (`linePauses`), and each line is
  divided among its notes (`divide`) by a dynamic programme over every
  place a sung note can begin — where the loudness JUMPS back up (a vowel
  after its consonant, the voice after a breath; a rise that stays below
  the speech level is the room inside a breath and does not count), a
  clear dip (a legato da-du-di), and the plain even beat as a worthless
  fallback so a line always splits — choosing the deepest set whose note
  lengths stay near the expected ones, no note under 30 % of its expected
  length. alif is sung a-lif, TWO notes, and the cut inside it is dropped.
  Three wrong turns cost a round each and are worth not repeating: one cut
  at a time near the even beat (alif is long, and ب's window lay inside
  it); the lowest point as the only candidate (a consonant is a low
  STRETCH — the j of jiim is 0.2 s at −18 dB — not a point); and a
  consonant's burst counted as a note (دَ came out 0.14 s long). The sounds
  song reads fat-ha ≈ 0.5–0.7 s, damma ≈ 0.5 s, kasra to the next breath
  for all 28 letters. A tap calibration still wins over these — and now
  reaches every device: the cloud took at most 12 boundaries per word
  (`validBoundaries` in `cloudCalibration.ts` and the `calibrations` rule
  in `firestore.rules`), a song needs 29 or 85, so a song calibrated on
  the laptop stayed on the laptop. The cap is 300 (2026-10-25).
- **`columns: 4` on a section draws it four across** (`.pair-grid.cols-4`,
  two by two under 760 px); `make-workbook-lessons.mjs` writes it on every
  section of a lesson whose cards hold several forms (21, 22, 23 — the
  paper's four letters a page), and `perPage` is 4 there. Keyed on the
  SECTION, never on `perPage === 4`: lessons 2, 3 and 5 page by four as
  well and were drawn four across at tablet widths for an hour.
- **The card's number is keyed on the lesson's `perPage`, not on the
  screen's count**: a lone last card of a four-a-screen section is still
  "1", the key that starts it.
- **A letter card is right-to-left on purpose; its English lines are not.**
  `.letter-card { direction: rtl }` (number top right, picture right,
  letter left — how the author sees it, inherited from `.pair-grid` since
  cards flow from the right) and `.letter-tip`, the figcaption and the flip
  prompt are `ltr`: a trailing full stop in an RTL paragraph was drawn at
  the START of the line (2026-10-24).
- **A letter card may have a back** (`flip` on the word — ى turns to يـ,
  the duck jumping into the boat) and **one teaching line** (`tip` — alif's
  "makes the fat-ha longer"). Both are app wording kept in
  `make-alphabet.mjs` (`TIP`, `FLIP`), keyed by the letter AS THE SHEET
  WRITES IT, never its key: ىٰ keys to ى and must not inherit the duck's
  back. The flip is two faces in one box (`.letter-flip`,
  `backface-visibility: hidden`, the back pre-turned), the front face gives
  the box its height, and a card always opens on its front.
- **A letter card lights by PHRASE (2026-10-25).** One take per card, the
  teacher's whole line: the picture glows while he talks about the
  picture; each sound card is lit through its own phrase ("With a fat-ha
  it sounds like baa", "with a damma boo", …, "With a sukoon after نَ it
  is nab"); from "Now your turn, say baa boo bee nab" on nothing is lit
  and the clip plays to its END (`playToEnd` on the Playable — the engine
  otherwise stops a quarter second after the last boundary). The times
  are found in the recording by `make-alphabet.mjs`
  (`scripts/lib/align.mjs`, `alignTokens`): the script's words are matched
  to the stretches of sound between pauses by a dynamic programme — each
  stretch takes a run of words whose predicted length fits it; a stretch
  may be noise and take none; a break where the script has no
  punctuation costs more; two demonstrated sounds in one stretch cost
  more (he always pauses between them); stretches under 80 ms are clicks.
  The script is tried as written and with "Say baa, boo, bee, nab." after
  "Now your turn", and the better fit kept — every card but the alif
  repeats the sounds. `phrases` in words.json is when each sound card's
  phrase begins plus when "Now your turn" begins; `phraseBoundaries` in
  `timing.ts` spreads a phrase evenly over its letters, so the timing
  keeps the usual per-letter shape and resolves below a calibration.
  Every card's fit is printed on each run. **Its
  calibration is one tap as each sound card's phrase begins and one at
  "Now your turn"** (`segments` on the Playable; the admin page says so),
  never a tap per letter. Before this, the automatic estimate spread the
  whole 25 s over five letters and the picture never glowed. **What the
  review of the aligner taught (2026-10-25, `wf_670d41b6-da5`)**, each
  checked against the loudness and, for ت, the zero-crossing rate (an
  aspirated t opens at 9–11 crossings/ms, a w at under 1): an Arabic
  token in the script ("after نَ") is demonstrated, set apart by pauses
  like baa — without that, ى's sukoon card went dark as "nay" began; a
  sentence end with NO pause costs 3 — without it, "nab. Now your turn"
  was read as one stretch; a stretch under 0.1 s is a click — five cards
  had "With" placed on a 0.06–0.08 s blip, their fat-ha a second early;
  a word may be left out at a cost, never one the caller anchors on. And
  this speaker pauses before the word that matters ("With a … fat-ha"),
  so a long pause where the script runs on is NOT evidence of a
  misreading (a rule saying so moved ت wrongly and was dropped). **ء's
  take does not say "sitting up on an alif"** (two reviewers, from the
  loudness): the generator flags it — "the end of the take does not match
  the script", when the stretch holding the first closing sound is far
  too short for its words — and its sound card stays lit through "Now
  your turn" until it is calibrated (last tap ≈ 19.3 s) or the sheet's
  line is made to match the take.
- **Tracing (lesson 30, 2026-10-24): the strokes are the font's, the rule
  is geometry, and only leaving the line is wrong.** Each letter's strokes
  are DERIVED from the glyph — `scripts/tracing/render-glyphs.mjs` renders
  the 29 letters in headless Chrome, `derive-strokes.mjs` thins each to its
  centerline (Zhang–Suen) and walks it through the letter's authored
  waypoints (`waypoints.json`: the only authored thing — ORDER and
  DIRECTION; the shape is the font's), splitting touching dots to the
  count the letter carries; `strokes.json` holds every stroke as 48 points
  in the frame of the glyph's INK BOX (0–1, dots included; a one-point
  stroke is a tap) and `make-alphabet.mjs` folds it into lesson 30. Read
  the proof montage the script writes before trusting a change: a waypoint
  that snaps to the wrong arm walks the wrong way (د did). At runtime
  `TraceCard` draws the letter as SVG text in the Mushaf face, measures its
  ink box with canvas `measureText` (`actualBoundingBox*`, the same frame)
  and lays the strokes on it; the font is never parsed or modified. The
  rule (`src/lib/tracing.ts`, pure): a touch starts only near the dot (the
  stroke's start, or where the finger last reached); while it moves, the
  nearest point on the stroke is looked for in a window of ONE BAND ahead
  (and a band and a half behind) and progress only advances; farther from
  the line than the band (0.11 of the board, a finger's width) is the one
  mistake — knock, "Try again", the stroke restarts; slow, stopped or
  lifted is never wrong — the dot waits where the finger left; reaching
  0.94 of the length completes the stroke, lifted or not. The lookahead is
  short ON PURPOSE: at 0.22 of the stroke a 130 px hop across the mouth of
  a bowl was accepted as progress. Note that a straight line across a
  SHALLOW bowl (ت) stays within a finger's width of it and does count —
  the band, not the shape, decides — which is why (2026-10-25) a stroke's
  TURNING POINTS are checkpoints: the window does not pass the bottom of
  a bowl or the tip of a tooth until the finger has come within 0.45 band
  of it, so the chord across ت's mouth and the flat swipe along س's teeth
  stall and then wander off the stalled window. A dot's radius is half
  the way to its nearest neighbor (`tapRadius`), so the two dots of ت are
  told apart. **The letter is painted PIXEL BY PIXEL, never stroked
  beside** (`tracePaint.ts`, 2026-10-25, the second painter in a day): the
  glyph is drawn on a canvas and every pixel of its ink is given a MOMENT
  — which stroke lights it, and how far along that stroke — so a pixel is
  colored when its stroke is done, or is the one being traced and the
  finger has passed its share. The start of ط's loop lights the start of
  the loop and nothing else, not the lower loop, not the stem, and a dot
  never lights its neighbor. The first painter was an SVG mask of the
  strokes drawn with a wide brush (1.15× the glyph's thickest stroke,
  `trace.brush`), and a brush cannot know which pixels are "the
  corresponding segment" — it spilled onto every part within its width.
  **The moment is found by two rules (the same evening, after the
  author's "teeth" and "holes"):** (1) the pixel's place along a stroke
  is its projection onto the nearest SEGMENT of the polyline, never its
  nearest sample point — where two parts run close (the head of ع along
  the top of its body, the two sides of هـ's loop) the nearest point
  flipped from pixel to pixel with the 48-point sampling and the front
  came out as a sawtooth; (2) the pixel lights at the EARLIEST moment
  among every segment whose ink it is: within the stroke's own half-width
  there (a chord through the glyph at the segment's midpoint, capped at
  2.5 medians so a junction's chord does not run up ط's stem), times
  1.15 plus 1.5 device px, with a clear line of ink between pixel and
  segment so the reach never leaps a gap (the teeth of س, a dot and its
  letter, the hamza inside ك). So where a stroke crosses itself (هـ) or a
  later stroke stands on an earlier one (ط's stem on its loop) the first
  pass inks the overlap as a pen does on paper and the later pass finds it
  inked — no hole waits for the second pass, nothing is painted twice,
  and the creep at a junction is one stroke width, the ink's own. A pixel
  no segment reaches falls to the nearest segment it can see; a dot's
  reach is its own radius exactly. The author asked for ideas on the
  overlaps ("the later part can appear half opacified") — with opaque
  color there is no half: the overlap is simply inked by whoever passes
  first. The raster is built once per card and size (~100 k ink pixels
  against a few hundred segments behind a bounding-box test: 5–44 ms per
  board at 440 px and device ratio 1 in the pane, read from
  `performance.getEntriesByName('trace-raster')`; four times that at a
  phone's scale of 2) and
  repainted in one pass on each change; the SVG above it keeps the guide,
  the dot, the ARROW — a small open chevron on the dotted line a little
  way from the dot, never a solid head — the dot rings (the dot's own
  size, `trace.dotRadius`) and the teacher's drawing. The demonstration keeps
  every stroke it has painted while it paints the next. On a phone the
  board is `touch-action: pan-y`: the page scrolls under a finger that
  lands away from the dot, and the card's own non-passive touch listeners
  take only the touch that begins a stroke (or lands on the letter during
  the demonstration) and every move while one is under way — a board that
  took every touch left a phone with nowhere to scroll from. A new card
  scrolls its board into view on a phone. "Watch all" plays each letter's
  name and demonstration and turns the card itself (a synthetic
  ArrowRight), for a learner who cannot write; D replays the
  demonstration. A stroke's first and last waypoints are
  pulled to the skeleton's END where one lies within a tenth of the box
  along a line (`toEnd`, never across a junction), then pushed to the
  ink's edge, so the pen reaches the tail of ت and the tip of ش — the
  thinning retracts every end by half a stroke, and the tips stayed grey
  (the author, 2026-10-25). **The writing orders are the author's**
  (`waypoints.json`, 2026-10-25): ج ح خ from the LEFT end of the head
  bar, right along it, then down the curve; ص ض from the loop's
  bottom-left up and round the loop to the tooth, then down the bowl, one
  stroke; ط ظ the loop from its left end, then the stem top to bottom;
  ع غ from the head's right tip, one stroke; ف ق from the loop's
  bottom-right round the loop and on; ك the body, then its sign traced
  from its top (`strokeAll`: the sign is a stroke, not a dot); م from the
  head's top-left; هـ from the loop's top, round and back down its left
  side to the bar, one stroke; و from the loop's right, under, up and
  over, then the tail; ى hook, tooth, bowl to the right tip, never back;
  ء the head then the whole base. **The teacher's hand wins**: the admin's
  "Teach the strokes" records his strokes on the board (smoothed,
  resampled to 48 points, normalized to the ink box; a touch shorter than
  0.8 band is a dot) into Firestore `tracing/{letter}` (`tracingStore.ts`,
  REST like the calibrations; the strokes flattened to `{p: [x0,y0,…]}`
  because Firestore holds no array in an array), fetched once a session
  and kept in localStorage; `cloudTrace(letter)` beats the baked strokes
  on every card, and `scripts/tracing/pull-cloud.mjs` → `authored.json`
  bakes them in on the next derive. No clock anywhere. Card flow: the name
  (table 9's recording; a missing clip fails quietly) → the letter draws
  itself (rAF, a pen along each stroke; a touch cuts it short) → Manāra
  asks (`manara-beam.png` points at the board) → traced: chime,
  `manara-well-done.png`. Sounds are synthesized (`sounds.ts`), not
  recorded. Verified in the pane with synthesized PointerEvents: a touch
  off the dot ignored, a walk away from the line knocked and reset, a
  half-trace kept with the dot at the midpoint, the dots tapped in order,
  "Well done!".
- **A hash navigation does not reload the app.** The module caches —
  `audioSource`'s blobs, `audioAnalysis`'s speech bounds — live on across
  `#/` changes, so a clip replaced on disk is still the old one in the page
  until a FULL reload (`http://localhost:5173/?fresh=1#/lesson/31`). Cost
  twenty minutes of "the song's timing is collapsed" (2026-10-24).
- **Arabic inside English is wrapped** (`Mixed.tsx`, `.ar-run`): every
  Arabic run in a hint or a chip gets the Mushaf face at 2× the text
  around it, isolated for bidi — 1.4× was still unreadable to the author;
  the Mushaf face is small on the body for its point size, so 2× reads as
  one size with the Latin, not as a mismatch. **An arrow between two
  Arabic pieces stays inside the run**: دٌ ← دۡ and ذ←ظ are written for
  right-to-left reading, and split into two isolated runs with the arrow
  between them they came out in left-to-right order with the arrow
  pointing the wrong way (lessons 34 and 36, 2026-10-24). Use `Mixed` for
  any English string shown to a learner that carries Arabic.
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
  `left` may not move. **Patch `cancelAnimationFrame = id => clearTimeout(id)`
  with it**: alone, the engine's cancel misses the timeout ids, a paused or
  stopped clip's loop runs on, and the highlight seems to walk during a pause
  or flicker against a newer clip (2026-10-27, a round spent on a fault that
  was the test's). Reload the page between runs.
- **Drafts in the pane without the admin's sign-in**:
  `localStorage.setItem('iqra-dev-drafts', '1')` on localhost shows every
  draft lesson and feature as the admin sees them (`devDrafts` in
  `appConfig.ts`, `import.meta.env.DEV` only — absent from every build,
  checked by grepping `dist`). Remove the key afterwards.
- **Long recordings have Play, Pause and Stop** (`Transport.tsx`,
  2026-10-27): a letter card's whole line, the two songs, and every take in
  the audio intake. Play starts or carries on from a pause, Pause holds the
  place, Stop ends it and the next Play starts from the top; Space plays or
  pauses where it did. One button that turned into "Stop" read as a pause
  and started the line over. A short word keeps its single tap. And
  `PlayIcon` inside a `.btn` is static (`.btn .play-icon`): absolute, as on a
  word card, it floated to the page's edge from the letter card's button —
  the author's screenshot showed it by the laser dot.

**Wording the learner reads**
- **A section hint is the app's, never the workbook's tracing line.** The
  masters' section lines ("Trace the grey pair 2 times, then write it 1
  time on your own") describe the paper; on screen there is no tracing. The
  companion page says "Tap any word to hear it. The tracing is on the page."
  and a workbook lesson's page hint reads "Workbook Level 1, page 13 —
  Tanween. Tap a form to hear it, then trace it on the page." (2026-10-12).
  The workbook's "★ Tip" lines are different: they teach the rule, and
  they lead the hint (section 2, "The workbook's ★ Tip lines").
- **Timing dots read right to left.** A caption of counts (●  ●  ● / ●●  ●)
  sits under the word on the page, two dots under the madd; the chip is
  `dir="rtl"` (`badge-dots`) so the two dots are on the right for قَالَ. The
  dots are not aligned letter by letter under the word in the app.
- **Say "ghunna", never "hum"**, in every hint, badge and blurb — the author
  teaches the term itself. And **never give the ghunna a length** ("two
  harakat"): the author does not teach it as a count. (2026-09-26.)
- **"Fat-ha", hyphenated, everywhere the learner reads** — the practice
  workbooks spell it so (their Level 1 §3 is "Harakat: Fat-ha, Damma, Kasra,
  Sukoon") and the app and the paper must say the same thing; the author
  chose the workbook's spelling for both (2026-10-10). Code comments may say
  what they like. Likewise never "a, u, i" for the harakat on anything a child
  sees: fat-ha, damma, kasra.
- **Never say "vowel" at all — a short one is a *haraka*, a long one a
  *madd*** (the author, 2026-10-24; the earlier rule reserved "vowel" for
  the short one and he struck that too). "Haraka", plural "harakat": the
  fat-ha, damma or kasra, the thing a stop drops from the last letter
  ("the last haraka dropped"). "Madd", "natural madd" where the length
  matters (ṣilah *grows a natural madd*, badal is *a hamza followed by a
  natural madd*); where the Arabic name is wanted, spell it as the app and
  the workbooks already do — look before coining a transliteration. Never
  "long vowel", never "short vowel". Applies to blurbs, section hints,
  badges, switch labels, tooltips and anything else a learner sees; code
  comments may say what they like.

**Working style the author prefers**
- Verify behaviour, don't assert it. Mechanical checks over spot-checks.
- `npx tsc --noEmit -p .` checks NOTHING here — `tsconfig.json` is a solution
  file (`files: []`, references). Use `npm run build` (`tsc -b`) or
  `npx tsc --noEmit -p tsconfig.app.json`. A "TSC-OK" from the former let a
  missing definition reach the dev server on 2026-09-26.
- Say plainly what was not verified and why.
- Never silently "fix" Quranic text — report and confirm.
- **Two chats can share this folder.** If `preview_start` says port 5173 is
  held by another chat's `iqra-dev`, use **`iqra-dev-b`** in
  `.claude/launch.json` — the same `npm run dev` on 5174, `--strictPort` —
  rather than touching the other session's server. Added 2026-10-10 when the
  author had a second session open.

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

**Quiz me — Levels 1 and 2, committed and deployed 2026-10-27 as a draft:
only the admin sees the lightbulb until it is switched on in Manage
lessons.** The two rounds of that evening went out together: the prompts and
sound-alike recordings cut (the generator reads the author's folders, `Audio
- Quiz Prompts` and `Audio - Quiz Sound-alikes`); tracing and memory pairs in
the quiz; "hear the difference"; the end screen as a chart; Play / Pause /
Stop for long audio (letter cards, songs, intake); ب ت ر retaken and re-cut
(no calibration existed on them) and the author's two script edits (ت
"tiger", ر "lying on the sand"); the pictures of د ↔ ر and ذ ↔ ز swapped back
(`IMAGE_VERSION` v3); the places lesson as mouth space, throat, lips,
tongue, nose (ids kept); "teacher's strokes" off the tracing card; then the
plain headings, the classic memory game, "Select all", the choice by Level
and Level 2's drills (section 2). **Waiting on the author**
(`Design/drills.md` §9):
- Try Quiz me on the iPad: a Level 2 quiz (letter shapes, longer words, the
  madd words) and memory pairs.
- Record lessons 25–29 when their turn comes, then `make-quiz.mjs`: Short
  words, Timing, Hamza and Qalqala light up by themselves.
- Correct `Word Tables/Quiz Sound-alikes.docx` if wanted; a changed row's
  contrast take is re-recorded.
- Publish Quiz me from Manage lessons once Level 1 is published.
- Stage 2 (accounts) waits until the author asks for it (2026-10-27).
- Remind the author when the time comes: register the Masjid account with a
  Masjid email when teacher accounts are about to be made; turn on two-step
  verification on the Google account that owns Firebase once the quiz is
  published; and the first-tablet checklist (drills.md §9) when the author
  says the tablet has arrived.

**The continuum — decided 2026-10-11; levels and the door built the same
day.** The author set the workbooks and the app side by side and decided,
all five points agreed, in the order they will be built:
1. **One curriculum under the workbook's Levels** — DONE. The IQRA Kids door
   is gone, `level` replaces `tracks`/`kidsLevel`, Manāra greets from the
   Level 1 heading, the old addresses redirect, and the playback-speed
   buttons now show on letter lessons too (the one thing the old skin hid).
   Nothing recorded, calibrated or numbered moved.
2. **A "Continue" card** — DONE on the device (2026-10-11): the card, the
   ✓ marks, "Next lesson" under every lesson, done on reaching the last page
   or moving on, `N` running off the end into the next lesson
   (`src/lib/progress.ts`). Not yet: sync to the account (additively, like
   notes — `users/{uid}/progress` and a rule), the assessment's own mark, and
   the song strip marking itself done at its last group (its "Next lesson"
   link does it). No locks, ever.
3. **Two readings per word — continuing and at a stop.** BUILT 2026-10-11
   (section 2 "Two readings", section 3 "Audio"): the switch, the small
   second button, `stopPlayable`, the `وقف/` folder, `attachStops` in
   generators 2–7, the intake Reading selector, the admin page calibrating
   both. The stop button appears wherever a stop take exists — a letter or
   a mock syllable simply never gets one recorded. Not built: lesson 1 (no
   generator; `WordCard` ignores the switch), the derived one-line hint ("ة
   is read as ه here"), and the recordings themselves — the existing clips
   are the continuing reading, and a stop reading cannot be cut from one.
   Record new material in both modes from day one (two intake sessions per
   sheet, one per reading); retrofit lessons 2–7 after, about 500 takes.
4. **A workbook companion page** — BUILT 2026-10-11 (section 2 "Workbook
   companion", section 3 "The workbook companion is generated"): one page
   per paper page rather than per section, `/go/<id>` on the site, the
   "Practice workbooks" entry on the home page. Today 48 of the 1,536 items
   play a lesson's clip (exact text; the first version's 87 included wrong
   words); the rest wait for `Audio/Audio - Workbook Level N/`. Not built:
   the intake page keeping the marks in a workbook take's filename (without
   that, the workbook cannot be recorded — see section 3), keyboard walking
   on the companion (N / P), and the QR itself on the paper, still gated on
   the app being complete.
5. **Level 1 and 2 lessons cut from the workbook** — BUILT 2026-10-11 as
   lessons 21–29 (section 2, section 3 "A workbook lesson's sheet"): the
   map, the generated sheets, the lessons as drafts in the registry, the
   crosswalk mapped (20 sections now point at a lesson). The qaida's own
   L4–L11 sequence in `Design/iqra-kids.md` §2 is retired; 30 is spare.
   **To record them** (the author): open `Word Tables/Lesson 21 -
   Tanween.docx` in the intake tool — it ticks the Word column, names keep
   their marks — Reading "Continuing", expect 1, 168 takes into
   `Audio/Audio - Lesson 21/`; then the same sheet with Reading "At a stop"
   into its `وقف/`; `node scripts/make-workbook-lessons.mjs 21`; then
   `node scripts/make-workbook.mjs` so the companion pages pick the clips up
   by exact text. Forms per lesson: 168 · 168 · 70 · 324 · 128 · 48 · 96 ·
   48 · 48. The author may prune any sheet first — Letter Pairs is 324
   voweled pairs over 27 pages and is writing drill on paper.
6. **Assessments** — BUILT 2026-10-12 as the Level checks, lessons 41–43
   (section 2 "The Level checks"). Not built: self-marked read-aloud, the
   teacher marking a roster, account sync of the score.

**The author's late round of 2026-10-24.** Built: the lesson number
stays on the home page and a done lesson wears a small gold tick on the
circle's corner (`.lesson-tick`); a plus or a dash between Arabic pieces
stays inside one right-to-left run, so a decomposition chip reads ع + د
+ ن from the right (`Mixed.tsx`). **Cards flow from the right** (the
author's yes, 2026-10-24): `.pair-grid` is `direction: rtl` and
`.pair-card` is `direction: ltr`, so card 1 sits at the top right and
the next to its left in every lesson and on the companion, while each
card's own layout is unchanged; forms inside a card are stacked top to
bottom as before (`.pair-forms` is one column), so lesson 4's alone / وَ
/ ثُمَّ did not move. **The paper's right and left boxes**: a section may
carry `columns: 2` (`LessonSection`, from `columns` in
`Workbooks/lessons.map.json` keyed by printed page — lesson 34's ة page,
right box keep going, left box stop) and is then drawn in two columns
(`.pair-grid.cols-2`) at any width over 520 px and in one column on a
phone, in that order; the companion page gets the same `columns`. **A
screen never splits a pair**: a card may carry `pair` (the generator
sets it on the two boxes of one row of a two-column page, else on the
two words of one column group of the master, matched to the master's
items in order), and `chunk()` in `SectionedLesson` packs runs of
paired cards whole — a screen of five rather than half a pair alone at
the top of the next screen on a phone. Checked by a mirror of the
chunker over every workbook lesson: 0 pairs split; lesson 24's 324 cards
are all paired and every screen is six.

**The author's nine points of 2026-10-24, the evening round, built,
deployed and pushed.** Level 3 reads, by `lessonLabel`, 34 · 2 · 4 · 35 ·
3 · 7 · 36 · 37, so "Level 3 lesson 3" is lesson 4 (hamzat waṣl), lesson
4 is 35 and lesson 5 is 3. 1 pushed and deployed; 2 the previous/next
pill (section 2); 3 lesson 29: no "Page 54" headings, no (i) rule, the
three qalqala tips by page (54 and 55 the sukoon line, 56 the two stop
lines), tooltips only on the button (section 3, App); 4 lesson 34: the
same, plus Arabic legible in hints and chips (`Mixed`); 5 lesson 4's
volume — the player's gain normalisation (section 3, Audio), no
re-recording; 6 lesson 35's hams page keeps only its first tip; 7 the Raa
pages: rules in the title box, the reason as a chip without the number,
خُسۡرٍ told it is heavy at a stop only; 8 lesson 3's drills without tabs.
**To listen to**: lesson 4 at its new level, and any lesson beside it for
balance (every clip now peaks the same; if two lessons still sit apart in
loudness, say which).

**The author's eleven points of 2026-10-24, built the same day.** First,
what he was hearing: the re-cut clips of 2026-10-20 (commit ee211b8) were
NEVER DEPLOYED — the live build was 20 Oct 20:33 UTC, before the edge
rules — so the phone and the web app still played the 22 stop clips that
begin with a second of click and silence. Deployed now, with everything
below. 1 the merged letter gets no time (section 3, "The merged or hidden
letter"); 2 the Web Audio engine (section 3, "THE CLOCK IS THE SOUND
CARD'S") — the clip starts to the sample and the highlight follows the
speaker's own clock; what remains is the weight model's ±0.45 s per
boundary, which only calibration fixes; 3 "haraka", never "vowel" (section
3, "Wording"), everywhere a learner reads; 4 the switch, tabs and S / W
keys on Level 3 only (section 2); 5 `lessonLabel` — "Level 2 · Lesson 5 —
Five-Letter Words" in the header; 6 ٱل black in lesson 2; 7–9 lessons 35,
36 and 37 carry the workbook's own tip lines over each page and each
card's table rule as its (i) — and so does every other workbook lesson and
companion page where the master has a tip; 10 deployed. **To listen to**:
any card of lesson 7 for the lag (both readings; the stop clips of #22,
#26, #88, #93, #98, #140 begin clean now); lesson 7 #1 كَم مِّن for the
skip over the first م; a word at 1.5× for the stretch's quality (WSOLA —
if it sounds rough, say so: the frame and search sizes are two constants);
and, on an iPad with the side switch on silent, whether the clips sound
(the `holdSession` element is what should make them). A three-reviewer
workflow (`wf_5429010c-017`) read the engine for iOS, clock-math and
state-machine defects before deploy; its findings are folded in above.

**The author's fourteen points of 2026-10-20, all built the same day
(commits 6843908 and after):** 1 and 2 no greying at a stop and no greyed
nasal mark (section 3); 3 عَلَيۡهِم مُّؤۡصَدَةࣱ's continuing clip is 3.57 s of
ordinary speech in the file — three agents checked — so "audio only for the
stop" was the first-play path, try it again; 4 the first tap (section 2,
"Two readings"); 5 the switch labelled and explained; 6 one play button and
the tabs; 7, 10, 11, 12 the edge rules (section 3, "Three edge rules");
8 and 13 the highlight engine (section 3, "The highlight engine's remaining
error"); 9 the S and W keys; 14 the Next-lesson pill at the right, the
laser above it. `AUDIO_VERSION` is v4. **To listen to**, in this order:
lesson 7 at a stop #26 يَنۡعِقُ, #93 سِرَاعࣰا ذَٰلِكَ, #98 أَن ثَبَّتۡنَٰكَ, #140
مِن طَيِّبَٰتِ, #22, #88 (the click gone); #68 and #133 (retake at a stop);
#142 وَأَنزَلَ at a stop (an 80 ms voiced piece 0.26 s before the word was
dropped as a stray head — the وَ or a mouth noise?); lesson 3's إله, الحمد,
بلغ, مغفرة, نهار (start clean now); lesson 5's سِيٓءَتۡ (its تۡ audible).
Then deploy — the re-cut clips carry a new audio version — and re-run
nothing: the companion and the Level 3 check were regenerated.

**Waiting on the author (2026-10-12):**
- **PRUNE Lesson 24 — Letter Pairs** (`Word Tables/Lesson 24 - Letter
  Pairs.docx`, 324 rows over 27 pages) before recording it: it is tracing
  drill on paper. The author asked to be reminded. Delete rows in the sheet;
  the generator reads what is left.
- **The section headings**, proposal awaiting approval: keep every
  workbook section TITLE as the heading (Letter Pairs, Tanween…) and drop
  the workbook's instruction line everywhere in the app, replaced by the
  app's own line (built as proposed; adjust the two sentences in
  `WorkbookPage.tsx` and `make-workbook-lessons.mjs` if wanted).
- **Hear the first clip of a cold session** (the playback fix) and say
  whether it is whole now.
- **Try the Level 3 check** (`#/lesson/43`, draft) and the two readings'
  switch; then Publish from `#/admin` whatever is approved.
- The generated sheets: written once from the master, then yours. The
  generator reads the sheet on every run and never writes it again; delete
  a sheet to have it written afresh.

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

**The evening round, 2026-10-24 (iteration 7, continued; `Design/iqra-kids.md`
§13).** Built and verified in the pane, `npm run build` clean, NOT committed
or deployed: (1) lesson 20's last letters are **و ى ا ء** — the hamza row
moved after the alif in the sheet, and ىٰ، لا، ة left (their rows deleted;
their text is in `Design/iqra-kids.md` §13 as the seed of a lesson to be
designed later). 29 cards. (2) **Recording, all from one sheet** —
`Word Tables/الحروف الهجائية.docx` now has NINE tables: 7 the spoken line
per letter (29), **8 the two songs** (slots `song-names`, `song-sounds`,
the sung names/sounds beside them), **9 the letter NAMES** (slot = the
name, بَاء → `باء.wav`, for the tracing lesson). The intake tool reads a
sheet TABLE BY TABLE (a picker when there are several; "All" keeps lesson
7's five tables as one list), takes a column headed **Slot** as the one
that names the files — whatever Arabic the other columns carry — keeps
every row below the header (Latin slots too) and shows the rest of the row
as the PROMPT while recording (`Slot.prompt`). Everything goes into
`Audio/Audio - Kids Alphabet/`: **29 letter lines + 2 songs + 29 names =
60 takes, every one a single piece**, then `node scripts/make-alphabet.mjs`.
(3) **Lesson 30, "Tracing the Letters"** — Level 1 · Lesson 4, between the
sounds song and the places (33 → Lesson 5; 21–23 → 6–8): section 3,
"Tracing". **Tracing, the second round (2026-10-25).** The author checked the
letters: *"This is not how Arabic letters are written… the tracing guide
has to cover the whole grey area… several critical errors."* Built: the
letter is PAINTED, not stroked beside — the colored glyph clipped by a
mask of the strokes traced so far, drawn with a brush wider than the
glyph's thickest part, so the color fills exactly the grey (section 3,
"Tracing"); every stroke's ends are pushed to the ink's edge; the writing
orders were rewritten (ج ح خ right → left along the head then down the
left side, no return; س from the first tooth's top; ف an open loop; ق the
loop closed then the bowl; م an open head then the tail; هـ loop then bar;
ء crescent then base; ى one pass ending at the right) and the proof now
arrows every third point so a retrace shows; CHECKPOINTS at a stroke's
turning points stop the shortcut across ت's mouth and along س's teeth; a
dot's radius is half the way to its neighbor; a turned iPad restarts the
demonstration; the sounds' context is opened on the touch; the
generator's advice line and the sheet's intro say tables 7, 8, 9. And
**the teacher's hand is the source**: the admin's "Teach the strokes" on
a card records his own strokes (a short touch is a dot) and saves them to
Firestore `tracing/{letter}` (section 3; `tracingStore.ts`;
`firestore.rules` has the block, DEPLOYED 2026-10-25); every device
then traces his strokes; `node scripts/tracing/pull-cloud.mjs` bakes them
into `authored.json` → `strokes.json`. The sixteen findings of the
2026-10-24 review are all closed. **The author's eighteen points of
2026-10-25** (the painting left tips and thick parts grey; every looped
letter's order; the ك sign; ى back-and-forth; the save refused): built —
brush from the glyph's own thickness, ends pulled to the skeleton's tips,
the orders exactly as he gave them (section 3, "Tracing"), the rules
deployed, his edited script read from the sheet — verified in the pane
(ت د ع ك ء paint fully; every order on the proof sheet), built,
committed, pushed and deployed. **Waiting on the author:** trace on the
iPad and, for any letter that still reads wrong, "Teach the strokes" →
Save (then `node scripts/tracing/pull-cloud.mjs` and a re-derive bakes
it in); record tables 7, 8, 9; hear the names.

**The author's eleven points of 2026-10-25 (the second round), built,
committed and deployed:** the intake tool opens the alphabet sheet on its
first Slot table (the merged list had guessed four wrong columns and
offered 233 "words"); the tracing is painted pixel by pixel with no spill
(section 3, "Tracing"), the demonstration's strokes stick, an arrow shows
the way from the dot, a dot's ring is the dot's size, the page scrolls
under the board, a new card scrolls into view, "Watch all" and D for a
learner who cannot write; the lesson head is one line and a tool row, the
speed buttons are gone everywhere, the laser lives in the tool row, the
contents drawer opens from ☰ (section 3, "The lesson page's head"). He has
taught his own strokes for several letters in the cloud (ت ط among them —
the card says "teacher's strokes"); `node scripts/tracing/pull-cloud.mjs`
bakes them in.

**The author's ten points of 2026-10-25 (the third round, the evening),
built, committed and deployed.** First, **Level 1 is RECORDED**: all 60
takes are in `Audio/Audio - Kids Alphabet/` (29 lines, 2 songs, 29
names, three intake sessions from one sheet) and `make-alphabet.mjs` cut
60 clips into `public/audio/lesson20|30|31|32`. **The generator now cuts
each take to one piece through `splitIntoN(wav, 1)`** instead of copying
it whole: every take had the record click in its first 0.02–0.35 s (up to
as loud as the voice) and a beat of silence before the voice at ~1 s,
which the whole copy kept and the splitter's edge rules drop, printing
each decision (57 lines; one stray tail on ى, 0.09 of peak). No
`AUDIO_VERSION` bump: no alphabet clip had ever been deployed. Then: the
laser is a red dot with a trail, the finger is the laser on a phone, two
fingers scroll, and the tool button, a chip at the top or Escape turn it
off (section 3, "The lesson page's head"); a new laser icon; the Admin
link off the lesson page; the contents tab on the page's right edge; the
arrow a small chevron; the painting's two new rules — segments, not
points, and the earliest covering pass — which took the teeth and the
holes out of ع, هـ and ط (section 3, "Tracing"; verified frame by frame
in the pane, the demonstration and a finger's trace paint through the
same function); the room-tone check no longer calls a −51 dBFS tick in
a −85 dBFS room "speech" (section 3, "Audio intake"); the Save panel
names what it wrote by kind and which take would fail, and `intake.json`
keeps every session (same section). **Next, the author:** tap-calibrate
the 29 lines and the 2 songs (`#/admin/20`, `#/admin/31`, `#/admin/32`;
the names are one word each and can wait), hear a few name clips on the
tracing cards and a line on a letter card, then Publish Level 1 from
`#/admin`. Not verified by me: the two-finger scroll and the finger
laser on a real phone (synthesized touches in the pane only); the sound
of the trimmed clips. (The "contents tab on the page's right edge" of
this round was a misreading, undone the next round: the ☰ is the
rightmost thing in the header.)

**The author's nineteen points of 2026-10-25 (the fourth round, late
evening), built, reviewed, committed and deployed.** 1 the ☰ back at the
top right; 2–3 the tool row on a phone (section 2, "The lesson page's
head"); 4 the letter cards lit by phrase and the calibration by phrase
(section 3, "A letter card lights by PHRASE"); 5 the phone that played no
letter — the clips were listed before they existed and a day-long cached
HTML answer stood in for them (section 3, "Updates reaching people", v5);
6 the ت retake made cheap: a clip's own hash in its URL (same place);
7–8 the songs as karaoke lines, timed from their recordings (section 3,
"A song is sung along line by line"); 9 the workbook companion behind a
publish switch (section 2); 10–13 the places lesson — English lines left
to right, no full stops, one amber color (the lit spot in the pictures),
no Play all, the hint without "as in the workbook"; 14–16 the title-box
lines of 21–23, from the map's `hint`; **lessons 21, 22 and 23 are
RECORDED and cut** (168 + 168 + 68 forms from the author's folders; one
stray head dropped on ظُنَ, 0.21 of peak — listen); 17 the install card
(section 2); 18 "Ghunna" on بَمَّ and بَنَّ; 19 عَفِ / عَفِّ out of the
shadda sheet (Word opens it, 5 pages) and so out of the app — the two
takes stay in "Audio - Shadda", reported as matching no row, and the
workbook companion still shows the printed page's pair. Found on the
way: the Mushaf face was named by its internal family name everywhere
in CSS and drew in Noto (section 3, "Rendering"). **Next, the author:**
re-record ت (intake → the alphabet sheet → table 7 → tap the ت slot in
the list → record → Save into "Audio - Kids Alphabet"; then
`node scripts/make-alphabet.mjs`, build, deploy — its new hash reaches
every device, no version bump); calibrate card ء (#/admin/20, card 29:
its take leaves out "sitting up on an alif", so its last tap goes at
"Now your turn", ≈ 19.3 s) or make its line in table 7 match the take;
listen to both songs and the letter cards, and calibrate only what
lights at the wrong moment; listen to lessons 21–23 and Publish them;
publish the workbook pages when ready. **The review** (`wf_670d41b6-da5`,
6 agents, 1.23 M subagent tokens) confirmed ten defects, all fixed: the
song calibrations capped at 12 boundaries in the cloud, the ☰ under the
laser's overlay, iOS 26's hidden Share button, the drawer's install
entry on computers that cannot install, the Android prompt arriving
after the card, a keyboard Enter swallowed on a touch screen, the places
page's keyboard line, lesson 33's home-page "as in the workbook", and
the aligner's misreadings of ى and ء (ء flagged, see above).

**Waiting on the author:** a home for ىٰ، لا، ة (once he decides
the content); hearing the tracing card's name clip once table 9 is
recorded; trying the tracing on the iPad with a finger and a pencil (the
band and the lookahead are two numbers in `tolerances()`); whether a
"Trace it again" after "Well done!" should also count the letter traced in
the progress store (nothing per letter is stored today).

**The author's review of lesson 20 and the song, 2026-10-24 (iteration 7;
`Design/iqra-kids.md` §13).** Built, verified in the pane, built with
`npm run build`, NOT committed or deployed: the card number is the card's
place in its section (every letter card read "1"); ك ل م ن ه ة ء و ى ي ا لا
re-cut inside their frames (`IMAGE_VERSION` v2); the hamza card is the
plain ء with the workbook's own ءَ ءُ ءِ نَأۡ and the three seat cards ؤ ئ ء
are gone; و lost نُو; ى and يـ are ONE card — ىَ ىُ ىِ نَىۡ, dotless as the
workbook writes them, a tip line, and the flip to يـ — and ىٰ is still its
own card; ا has بَا تَا ثَا and the madd tip; lesson 21 pages by the
workbook's four letters in four columns (lessons 22 and 23 regenerated with
it); the names song opens on the plain ا and its strip flows by itself.
**All of it is in the sheet** — `Word Tables/الحروف الهجائية.docx` was
edited in place (tables 4, 5 and 7; every change printed; the script is
not kept — git holds the before and after), so the intake tool's slots and
the generator agree: **32 letter cards + 2 songs = 34 takes.** The new
teacher lines for ء، و، ى and ا in table 7 are mine to be reworded by the
author in Word. **Waiting on the author:** (1) a home for ىٰ, ة and لا — the
proposal is a Level 2 lesson 30, "Different Letter Forms", right after
Hamza (28), cut from the workbook like 21–29 where its sections exist and
authored as a short sheet where they do not; nothing is built; (2) whether
the dimmed neighbors on the song strip (opacity 0.22) should be hidden
outright; (3) whether a tap on a strip letter should stay (it is the only
way to start mid-song now that Next is gone).

**Level 1, the letters — lessons 31, 20, 32, 33 exist as drafts (iteration
6, 2026-10-10; once "IQRA Kids", folded into the one curriculum on
2026-10-11).** The Baghdadi qaida for the Masjid's Maktab, taught live by a
teacher, and now the start of the sequence for everyone. Everything
about it is in **`Design/iqra-kids.md`** — read it before touching any of
this. As built: song 31 (letter names) → **lesson 20, the letters, ONE lesson
in four sections** (21 and 22 were the same letters split in three and were
deleted unspent — nothing was ever recorded or calibrated against them) →
song 32 (sounds) → **lesson 33, "Where the Letters Come From"**, the
workbook's five places as five diagram cards. A `letters` lesson is drawn as
letter cards at `#/lesson/N` (`LettersLesson`). **One recording per letter card** — the teacher's whole
line, picture then fat-ha, damma, kasra, sukoon — so the sheet's seventh
table is one row per letter and **every take is a single piece: 36 letters
and 2 songs, intake tool set to 1, record the Slot column only.** Each song
is a **strip** of letters that glides to keep the sung one centered
(`SongCards`), not cards and not a video. Letters wear a **shape-family
color** everywhere in the skin (`fam-0..6`, seven colors over seventeen
families); the green box stays the only meaning of "being said now". Manāra
is off the letter cards (the ا card would have shown two lighthouses) and
greets from the Level 1 heading on the home page only. **The makhraj pictures are the author's own, made in
Canva (2026-10-11)** — six pencil-soft frames of a boy in profile facing right,
no features, the cutaway lit one place at a time; the 1264 px originals are
sources in `Design/kids-art/makhraj-canva/`, the app ships 480 px palette
copies, and the generator reports 37 pictures wanted, 37 present. (A set I
drew myself as SVG was withdrawn at the author's request the same day; it is
in history at `b7942c3`, not in the tree.) **The only thing left before
Level 1 can be used in a class is the recording: 60 takes** (29 letter
lines, 2 songs, 29 letter names — 38 before the 2026-10-24 rounds) — open
`Word Tables/الحروف الهجائية.docx` in the intake tool, pick **table 7**
(the picker; the Slot column is ticked by itself and each slot shows its
line), utterances 1, Reading "Continuing", and record 29 lines; then
**table 8** for the two songs (`song-names.wav`, `song-sounds.wav`, whole);
then **table 9** for the 29 names (`باء.wav` …) — all into
`Audio/Audio - Kids Alphabet/`; run
`node scripts/make-alphabet.mjs`, which cuts each take to ONE piece with
the edges trimmed (the record click dropped, as in every lesson; DONE
2026-10-25, all 60) and then lists what to **tap-calibrate** — the 29
lines and the 2 songs
(a name is one word and needs none), a tap per Arabic letter
(بَ بُ بِ نَبۡ is five; the first tap also ends the picture's glow), and the
songs cannot work at all without it. Then Publish from `#/admin`.

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
away). The `/go/` page is built (2026-10-11, `site/public/go.html`): it
sends the reader to the section's companion page while the app is switched
on, else to the PDF at the section's page; deploy with `--only hosting:home`.

Two conventions this added, both in the same spirit as their audio twins:
**pictures are runtime-cached, never precached** (32 of them took the shell from
1.6 MB to 6.7 MB and would have broken updates), and **`IMAGE_VERSION` is
appended to every image URL** because a redrawn picture keeps its filename.
The rule the whole design rests on: one set of content, two skins — **mode
never touches an id, a folder, a clip filename or a calibration key.**

**Lesson 7 is RECORDED in both readings (2026-10-20).** Two intake sessions
from the sheet into `Audio/Audio - Meem Noon Sakinah Tanween` — 176
continuing takes in the folder, 176 stop takes in its `وقف/` — and
`make-lesson7.mjs` cut 176 + 176 clips, every card with a stop reading;
the companion and the Level 3 check were regenerated (65 companion items
with audio; the check draws on lesson 7). The first continuing session was
written into the madd lāzim folder by mistake: its 176 takes were deleted
from there after a byte-for-byte match with the right folder's copies, and
the six files it had overwritten (the speaker profile and `intake.json`)
restored from git; the 44 lesson 6 takes were never touched. To finish:
listen through, calibrate any card whose automatic timing is off (both
readings are on the calibration page), `npm run build`, deploy the app,
then Publish from `#/admin`. A retake later is `<name> 2.wav` in the same
folder, a re-run of the generator, **a bump of `AUDIO_VERSION`** (the clip
keeps its filename) and a fresh calibration for that card only.

The build record, kept: **Lesson 7 — record it (2026-09-27; rendering
reviewed four times over, live as draft at 27f6192).** Built as text, draft,
176 cards; the generator is
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

**Chapters.** Built as Levels on 2026-10-11 (see "Lesson identity and order"
above). What is left of the design is the admin control that writes
`order`/`level` at runtime rather than requiring a redeploy — runtime state
belongs in `config/app` beside `lessons` and `features`, the same way
publishing does. The one rule that must survive it: **moving a lesson never
changes its number.**

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
