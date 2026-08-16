# IQRA — project context

A PWA that teaches Quranic Arabic pronunciation to English speakers. Tap a word,
hear the teacher's own voice, and watch each letter light up exactly as it is
pronounced. Live at **https://iqra---learn-quranic-arabic.web.app**

This file is loaded automatically at the start of every session. Keep it
current — the "Where we are" section at the bottom is the handover note.

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
firebase deploy --only hosting    # from 1447 H/
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
- `graphemes.ts` `MARK_RE` must cover **U+06D6–U+06ED** or those marks count as
  letters. Spaces are dropped so multi-word phrases don't gain a phantom step.
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
- A saakin letter was 0.7 — *less* than a plain letter. It carries no vowel but
  it is still held, and at a word end before the next it is held longer still.
- **A madd is paid for once.** A dagger alif on a consonant is consonant + madd
  (رَٰ = 1 + 2). On a letter that *is* already the long vowel it is the same
  vowel spelled twice, not a second one — and adding it twice gave the ىٰٓ of
  نَجۡوَىٰٓ eight harakat, a third of that whole phrase, which starved every letter
  before it. `clusterWeight` carries a `maddCounted` flag for exactly this.
  Five phrases in lesson 5 were affected, and يَنۡهَىٰ / يَخۡشَىٰ in lesson 3.
- The cheap check for this class of fault: run `clusterWeight` over every text
  in every `words.json` and print any cluster over 6 harakat. Nothing legitimate
  exceeds madd lazim, so anything that does is two rules firing at once.
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
  has no way to learn of a new one. **Bump `AUDIO_CACHE` in `vite.config.ts`
  when clips are re-cut** — the same moment the calibrations need re-checking.
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
them. This surfaced while designing the Maktab assessment (see `Assessment/`),
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

**Working style the author prefers**
- Verify behaviour, don't assert it. Mechanical checks over spot-checks.
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

**The Maktab assessment is finished and print-ready — v1.0, 2026-08-16.**
The author sits on a local Masjid's education committee and is piloting a
standardized recitation assessment for its Maktab programme, taught by a
Qari. It is a separate project from this app, on paper, on purpose — the
decision (2026-08-15) is argued in `Assessment/should-this-live-in-the-app.md`
and stands: pilot the instrument first, encode only a version that has been
used. Do not start integrating without re-reading that note.

`Assessment/Print Ready - Aug 2026/` holds the four session files: **Student
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
- Everything is merged into main and pushed — the repo is the backup. (A
  local-only branch was tried and reverted the same day: a folder git
  half-watches is an error risk, not a boundary.)

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

## 5. Next task

**Maktab, before the first session (not code).** Print the Student Packet ×
students and one each of the Teacher and Helper Sheets; import
`Maktab Results.xlsx` into a Google Sheet — ideally one a Masjid-controlled
account owns, since these become children's records (ownership, retention and
export should be agreed with the committee before the data exists); write the
roster IDs. After the pilot: revisit the 10/18 thresholds against the
teacher-agreement rate, mine the per-item columns for which rules the class
actually fails — that is the lesson roadmap this app lacks — and only then
consider encoding the used instrument, per the design note.

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
