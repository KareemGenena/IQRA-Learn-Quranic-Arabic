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
- **Letter-by-letter highlighting** driven by per-letter timings.
- **Admin**: publish/take-down/delete lessons and toggle features at runtime;
  tap-to-calibrate timings that sync to every device.
- **Laser pointer** for teaching over a shared screen.
- **Notes** — endless per-lesson canvas: stylus draws, finger scrolls, typing in
  Uthmanic Hafs with a Quranic-mark palette. Local-only so far.

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

**Timing** (`timing.ts`, one unit = one harakah)
- Boundaries are in **media time**, so highlights stay correct at any playback
  speed. Priority: own calibration > cloud calibration > baked > automatic.
- Sukoon 0.7 · ghunna +0.9 · qalqalah +0.25 · madd 2 / muttasil 4 / lazim 6 ·
  hamzat wasl 0.9. Silent letters get zero time and are skipped by the highlight.
- Re-cutting a clip invalidates any calibration measured against it — check
  before regenerating audio for a calibrated word.

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

**Published:** lessons 1 and 2. **Draft (admin-only):** lessons 3 and 4.
**Features:** laser live for everyone; notes admin-only.

Open items:
- **Lesson 3** — ٱلرَّحِيمِ (row #21, ح section) has no recording. Everything else
  is complete and verified.
- **Lesson 4** — 24 qamariyya words are unrecorded; the author has decided not to
  record them for now. The generator skips and lists them, so it can simply be
  re-run if that changes.
- **وسواس** (lesson 4) — the quietest recording in the set (peak 0.010 vs ~0.02).
  Splits correctly now; if it still sounds wrong it is the source, not the cut.
- **Notes** are device-local. Cloud sync and the teacher/student layers are
  designed but not built.
- **Classes** (teacher accounts, join codes, rosters) are designed but not built.

Designed and agreed, not yet implemented:
- Notes as three stacked layers — reference (fixed) / teacher / student — so
  nobody edits the same layer and there is never a merge conflict.
- Teachers self-declare; students enrol with a class join code and are approved
  by the teacher; the teacher sees a roster.
- Tapping a word to see it in its ayah (needs a `ref` field per word; refs must
  come from a verified source, never guessed).

---

## 5. Next task

Ask the author. The likely order is:

1. Review lessons 3 and 4 in the app and publish them from `#/admin`.
2. Notes: cloud sync for a signed-in user, then the teacher/student layers.
3. Classes: teacher role, join codes, roster with approval.

---

## Handover ritual

At the end of a long session, update **section 4** (current state) and **section
5** (next task) and commit. Everything above them changes rarely.

This lives in `CLAUDE.md` rather than a `PROJECT_CONTEXT.md` because Claude Code
loads `CLAUDE.md` into context automatically at the start of every session — a
differently named file would have to be found and read first, which is exactly
the step that gets forgotten.
