# Grammar track — M0 recon report

2026-09-19 · against `IQRA_GRAMMAR_TRACK_SPEC.md` v0.1 and the repo at commit `15b82ea`.

M0 is recon only (spec §12). Nothing in the app was changed. This report says
what the app has today, how the spec's §6 model maps onto it, where the two
collide, and which [DECIDE] items must be answered before M1 can start.

**Done when:** Kareem has read this and answered §5 below.

---

## 1. What the app has today

### 1.1 Lessons

- A lesson is one number, and the number is its identity, never its position
  (`LessonMeta.id` in `app/src/lib/lessons.ts`). It keys the folder, the
  audio folder, the route and the calibration documents. `order` decides the
  menu position; `tracks: ['adults' | 'kids']` decides which menu.
- Numbers used: 1–6 (adults), 20–32 reserved for IQRA Kids. Nothing else.
- Publish state is runtime data in Firestore `config/app` (draft / published
  / archived / deleted) keyed by lesson number, with `features` beside it
  (`laser`, `notes`). The same document would carry a `grammar` feature flag
  and the sessions' draft/published state with no new machinery.
- Routing is hash-based: `#/lesson/N`, `#/kids/lesson/N`. The kids skin is a
  route prefix that sets `data-mode="kids"` on `<html>`, and the rule is that
  a mode never touches an id, a folder, a clip name or a calibration key.

### 1.2 Content

- Source of truth is the author's Word tables; a generator script per lesson
  turns docx + audio into `public/lessons/lessonNN/words.json` plus clips.
  The app only reads generated JSON and never hand-edits it.
- The `Lesson` type (`app/src/types.ts`) is audio-centric: `kind` is
  `'words' | 'pairs' | 'letters'`, every word has `audio` and `timings`, and
  everything is normalised into a `Playable` (text + clip + boundaries). There
  is no notion of a sentence, a token, a segment, a role or a concept.
- Meanings on lesson 6 cards quote Sahih International with attribution
  (`meaningSource`). Ayah references there are typed by the author into the
  sheet and are not machine-checked against anything.

### 1.3 Quran text

**The app has no Quran text source.** Every piece of Arabic it shows was typed
by the author into a Word table. There is nothing to align corpus indices to
and nothing to verify a fragment against. T2 needs an asset the repo does not
have.

What the app does have, and which matters for T2:

- Quranic text is Uthmani, rendered in KFGQPC Uthmanic Hafs, under the
  codepoint conventions in `CLAUDE.md` §3: sukoon is U+06E1, the round zero is
  U+0652, alif wasla is U+0671, U+06DF must never be used because the font
  positions it wrongly. Any imported text is made to obey these conventions,
  not the other way round.
- A de-diacritizer already exists and is proven over 675 strings:
  `audioKey()` in `app/src/lib/audioName.ts` strips marks and folds ٱ to ا.
  It is the seed for T2's normaliser but it is not enough: it handles marks,
  not letter-level spelling differences between Uthmani and standard
  orthography (see risk R2).

### 1.4 Progress and learner state

- There is no learner record anywhere. The only per-learner state is the
  place in a paged lesson (page + step) in `localStorage`, and theme, rate and
  the active class id.
- `users/{uid}` holds a profile (name, self-declared role) and
  `users/{uid}/enrolments`. No subcollection for learning data exists, and
  the rules allow none.
- Firestore is reached over REST (`fetch` against the v1 endpoint), not the
  SDK. There is no Firebase dependency in `package.json`. Any new collection
  is read and written the same way, with rules in `firestore.rules` and a
  case in `scripts/test-rules.mjs`.
- Large local data uses IndexedDB (`notesStore.ts`, `intakeStore.ts`), local
  first, with cloud sync as a later background push. That is the pattern a
  concept-state store and an answer log should copy.
- The house rule "accounts are additive, never a mode" applies: the track must
  work fully signed out. Signing in adds sync.

### 1.5 Review and exercises

- No spaced-repetition scheduler exists. [DECIDE] 6 therefore resolves to
  "build the five-box Leitner".
- The nearest thing to an exercise is lesson 2's Mixed Review page: badges
  hidden, listen and decide. It records nothing and scores nothing.
- No answer logging, no per-concept results.

### 1.6 Rendering machinery worth reusing

- `ArabicWord` colours part of a word by stacking clipped copies of the full
  string, measured with the Range API, never per-letter spans. That is
  exactly the tool for "highlight only the changed segment" (§3.4 step 2)
  and for E3/E4. But its silent-letter derivation is Uthmani-only (risk R1).
- Noto Naskh Arabic is already a dependency and already used for standard
  spelling (`.lesson-sub`). Constructed sentences in Noto Naskh and Quranic
  text in Uthmanic Hafs gives P11's visual distinction for free.
- Paged sections with a per-lesson remembered place, single-key voice-driven
  keyboard navigation, and the admin bar are all in `SectionedLesson`.

### 1.7 Delivery constraints learned the hard way

- The precache is 1.6 MB / 34 entries and must stay small: a large precache
  is what broke updates for months. Audio and pictures are runtime-cached
  with a version constant appended to every URL (`AUDIO_VERSION`,
  `IMAGE_VERSION` in `vite.config.ts`). Any grammar data of size — Quran
  text, per-token tags — must follow the same rule.
- Hosting rewrites every missing path to `index.html` with status 200, so a
  fetch of a missing JSON file gets a web page. The audio layer checks the
  content type for this reason; a grammar data loader must too.

---

## 2. Mapping §6 onto the app

| Spec (§6) | Proposed home | Notes |
|---|---|---|
| `Session` | `public/grammar/sessionNN/session.json`, one file per session, authored in the §11.3 JSON shape | Not a `Lesson`. Do not add a fourth `kind`: the `Lesson`/`Playable` model is built around clips and timings and none of §6 has any. A `Session` type lives beside `Lesson` in `types.ts`. |
| Session identity | `LessonMeta` entries with `tracks: ['grammar']`, ids **101–129** (S1 = 101), `order` = session number | Reuses the registry, the menu filter, `config/app` publish state and the admin manager unchanged. The id range is reserved the way 20–32 is for Kids. See D-A below. |
| `Concept` registry | `public/grammar/concepts.json`, generated from the §5 table by a script that fails on an unknown prereq | One file, small, shared by every session. IDs are the spec's. |
| `Fragment` | `public/grammar/fragments.json` (or per-session files if it grows) | Holds `ref`, tokens, meaning, approval. Never holds Quranic text. |
| Quranic text | `public/quran/NNN.json`, one file per surah, Uthmani, verbatim; codepoints mapped to the app's conventions in memory at render time | Runtime-cached with a `DATA_VERSION` constant, never precached. Only referenced surahs need shipping at first. |
| `Token.requires` for the whole Quran (T4 output) | Not shipped in v1 | The app only needs tags for the fragments it shows. Whole-Quran tags are a build-time input to T5/T6 and to the coverage figure, which can be precomputed per session and shipped as one small table. Also sidesteps risk R4 until [DECIDE] 9 is answered. |
| `LearnerConceptState`, answer log | IndexedDB store `grammarStore.ts`, local first; sync to `users/{uid}/grammar/{docId}` when signed in | Same shape as notes: the device is the authority, cloud is a copy. Rules and `test-rules.mjs` cases come with it. Needed before M6's pilot, not before M3. |
| `Exercise` | Inside `session.json` under `exitCheck`; review items reference them by session + index | Concept ids on every item, per §9. |
| `Source: constructed / quran / liturgy` | Drives the font and the frame | Constructed = Noto Naskh, standard spelling. Quran = Uthmanic Hafs, pulled by ref. |
| Route | `#/grammar` (door), `#/grammar/session/N` | Mirrors `#/kids`. Whether it also sets a `data-mode` is a skin question, not a data one. |
| Track door on the home page | Feature flag `features.grammar` in `config/app`, admin-only until published | Same lever as laser and notes. |

**Authoring pipeline.** The house convention is docx → generator → JSON. A
grammar session is not a table, and the spec already fixes a JSON shape, so
the recommendation is: sessions are authored as JSON in `Grammar/sessions/`
(author-editable), and `scripts/make-grammar.mjs` validates them (every
concept id resolves, prereqs are met by session order, ≤ 4 new concepts,
every fragment has a ref and passes T2, every exit item carries concepts) and
copies them into `public/grammar/`. It reports on every run the way the
lesson generators report corrections and unmatched recordings.

---

## 3. Risks

**R1 · The sukoon codepoint is a trap.** In this app U+0652 is the *round
zero*, a silent letter, and `derivedSilent()` greys any letter carrying it.
Standard-spelling Arabic writes sukoon as U+0652. A constructed sentence such
as مُسْلِمٌ pushed through `ArabicWord` today would grey the س. Constructed
text must therefore never pass through the Uthmani silent-letter derivation:
either a `source`-aware rendering path or an explicit encoding flag on the
component. This is the first thing M3 will hit.

**R2 · Uthmani and standard spelling differ at the letter level, not only in
marks.** The spec's fragments are typed in standard spelling; the display
text will be Uthmani. Beyond `audioKey()`'s mark-stripping, T2's normaliser
must bridge cases such as الصَّلَاة / ٱلصَّلَوٰة, dagger-alif spellings
(الرَّحْمَن / ٱلرَّحۡمَٰن), hamza seats on tatweel (ـٔ), and small letters. This is
a known finite list, but it must be written and tested, and the spec's rule
stands: report failures, never auto-correct.

**R3 · Tanzil's Uthmani codepoints are not this app's.** [VERIFY, not from
recall] Tanzil's Uthmani edition is expected to use U+06DF for the round zero
and may differ on sukoon and other small marks. The conversion into the
app's conventions is a build step, and the codepoint audit in `CLAUDE.md` §3
must run over the imported text before any of it is rendered. The direction
of the swap is the opposite of the one that bit lesson 5; the mechanism is
the same.

**R4 · Licence.** The morphology corpus is GPL with its own terms; per-token
tags derived from it and shipped inside the app are a derived work. The
mapping above keeps whole-Quran tags out of the shipped bundle in v1, but the
fragment tokens and coverage numbers still descend from it. [DECIDE] 9 needs
a real answer; the repo is public.

**R5 · The corpus download asks for an email address.** That is a form I will
not fill on your behalf. T1 cannot start until you download the file yourself
and place it (verbatim, header intact) at `Grammar/Corpus/`.

**R6 · The corpus is in Buckwalter transliteration.** A transliterator to
Arabic script is needed for matching and display. Small, but it must be
tested against the Tanzil text word by word before anything trusts it. The
Arabic-script fork is not a substitute (its verb person tags were removed).

**R7 · No Quran text in the repo means no verification of existing lesson
refs either.** Once T2's asset exists, lesson 6's typed ayah references can
be checked for free. Not in scope for M1, but worth a line.

**R8 · Precache growth.** 114 surah files plus fragments plus concepts must
be runtime-cached. Follow the audio and image pattern exactly, including the
content-type check.

**R9 · A pilot needs data collection, which needs sync, which needs rules.**
M4's local log is enough for one device. M6's five to ten learners are only
useful if their logs reach you: `users/{uid}/grammar` with rules and tests,
or an export button. Decide before M6, not before M3.

**R10 · Two numberings.** The spec numbers sessions 1–29; the app will key
them 101–129. Every document, route and log line must use exactly one of
these. Proposal: the app id is the key everywhere, and "S1" is a display
label computed as id − 100.

---

## 4. What the spec asks for that the app already answers

- [DECIDE] 6 scheduler: nothing to reuse; build Leitner.
- [DECIDE] 7 script: yes, Uthmani for Quran, standard for constructed, and the
  fonts for each are already shipped. Subject to R1.
- [DECIDE] 12 interface language: the app is English-only already.
- [DECIDE] 1 delivery: the kids track was built for a teacher on a shared
  screen and the adult track for self-paced use, so both modes have a
  precedent; nothing in the app forces one.

---

## 5. Decisions that block M1

M1 is corpus ingest (T1), text alignment and fragment verification (T2), the
concept registry, and auto-tagging (T4). These are the answers it needs. A
default is given for each so a one-word reply is enough.

| # | Decision | Recommended default |
|---|---|---|
| D-A | Session id range in `LessonMeta`. | 101–129, S1 = 101; 100–199 reserved for grammar. |
| D-B | Quran text source and edition. The app has none. | Tanzil Uthmani, converted at build time to the app's codepoints; one file per surah, runtime-cached. |
| D-C | [DECIDE] 9, licence. Is shipping corpus-derived data acceptable, and is committing the verbatim corpus file to the public repo acceptable? | Keep whole-Quran tags out of the bundle in v1; commit the file verbatim with its header; get advice before M5 ships coverage numbers. |
| D-D | [DECIDE] 4, meanings. Lesson 6 already quotes Sahih International with attribution. | Team-authored literal meanings for the grammar track, as the spec says; the two tracks need different things from a meaning. |
| D-E | Authoring format. Sessions as hand-authored JSON validated by a script, or a docx table per session read by a generator? | JSON, validated on every run. The spec's shape is already JSON and a ladder is not a table. |
| D-F | [DECIDE] 10, the reviewer. T2 outputs a failure list for human review and T4 outputs role candidates for human confirmation; both need a named person. | You, until someone else is named. |
| D-G | R5: download the corpus file yourself. | Place it at `Grammar/Corpus/` with its header intact. Nothing in T1 can run before this. |

**Answered 2026-09-19.**

| # | Answer |
|---|---|
| D-A | Default: 101–129. |
| D-B | Default: Tanzil Uthmani, stored verbatim, codepoints mapped for the font in memory at render time, never written back. |
| D-C | **Option B**: the corpus zip is committed verbatim with its notices inside; the app ships only approved fragment tokens and precomputed coverage numbers; whole-Quran tags stay out of the bundle until M5, when advice is taken with the artefact in hand. Attribution screen with links to corpus.quran.com and tanzil.info from M3. The file is never modified; our annotations live in separate files keyed by location. |
| D-D | Default: team-authored literal meanings. |
| D-E | **Not the default.** Sessions are authored the way every other lesson is: a Word file per session, given to Claude, and a generator (`scripts/make-grammar.mjs`) reads its tables into the session JSON, validates concept ids and prerequisites, and runs the T2 check on every Quranic fragment in it. The §11.3 JSON is the *generated* shape, not the authored one. Designing the sheet's tables (ladder, fragments, exit check) is the first task of M3, done with the author from the Session 1 text in the spec. |
| D-F | The author reviews every text used to teach and every guessed role. |
| D-G | Done. `Grammar/Corpus/quranic-corpus-morphology-0.4.zip`, 128,219 segment lines, format as the spec described (T1 [VERIFY] closed). It also carries the Tanzil Uthmani text in Buckwalter, so the corpus alone is enough for T2's alignment; a separate Tanzil download is only for Arabic-script display. |

The repo's own licence, raised in this report as a side finding: the author's
answer is that the work is public, no rights reserved, ṣadaqah jāriyah. A
`LICENSE` file at the root dedicates the author's work to the public domain
(CC0) and lists the third-party items that keep their own terms: the font,
the corpus, the Tanzil text, and the Sahih International quotations.

Not blocking M1 but worth answering with the above, because they shape M3:
[DECIDE] 2 unit length, 3 handle-first or term-first, 11 no audio in v1. On
11: the author records everything in this app already and the intake tool
exists, and P11 forbids only *synthesised* Quranic audio. A human wasl
recording of each fragment and each constructed line is cheap here in a way
it is not elsewhere. The `LadderItem` and `Fragment` shapes should carry an
optional `audio` field from the start so that this can be filled in later
without a schema change.

---

## 6. What was not verified

- Tanzil's actual codepoints (R3) and the corpus file format (spec T1
  [VERIFY]): neither file is in the repo and neither was downloaded.
- Whether the syntactic treebank is downloadable under the same terms (spec
  [VERIFY] 8).
- No spec fragment was checked against any Quran text, because there is none
  to check against. That is M1.
