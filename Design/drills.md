# Quiz me — the question book

The design record for the app's drills, the way `Design/iqra-kids.md` is for
the Level 1 letter lessons. Read it before touching anything under `#/quiz`,
`src/lib/quiz.ts`, `src/pages/QuizPage.tsx` or `scripts/make-quiz.mjs`.

**Status (2026-10-27, late).** Stage 1 is built and deployed as a draft
feature: `quiz` in `config/app`, visible to the admin only until it is
switched on in Manage lessons. The author recorded the thirteen spoken
instructions and the eight sound-alike rows the same day; tracing and memory
pairs joined the quiz, a mix-up between sound-alikes plays the teacher's
"hear the difference", and the end screen became a chart (§2). The author's
next round, built the same night: every heading cut to its plainest words,
with a recording only where one says the same thing, heard once per run of
questions (§2, §6); memory pairs remade as the classic game (§4); "Select
all" and the choice by Level (§10); and **Level 2's drills, built** (§10) —
letter shapes work now, the words of lessons 1, 5 and 6 are in, and the
other topics light up as lessons 25–29 are recorded. Stage 2 (accounts) is
designed in §8 and waits until the author asks for it.

---

## 1. What it is, and why

The Maktab children finish the workbook's writing practice faster than
expected (the author, 2026-10-26). They need more to do, and the time should
teach: listening and reading drills, questions and answers, guided by the app.

**An electronic question book, beside the lessons — never one of them.** It
has no number, sits in no Level, and marks no lesson done. Its door is a
**lightbulb** in the header on every page ("Quiz me" grows beside it on
hover), a card under "Continue" on the home page, and a line in the contents
drawer.

**Guest mode is the whole of stage 1.** Nothing about who is answering is
stored: a sign-up wall keeps people from starting at all (the author). A
quiz's answers live on the device until the next quiz begins. Encouraging
people to register so their progress is kept is a later step.

**Not an assessment.** The Level checks (lessons 41–43) and the paper Maktab
instrument place a learner; the quiz only practises. It never gates anything.

## 2. How a quiz goes

1. **Choose** (behind the grown-ups question, §3): tick topics (§4), pick 15,
   30 or 45 questions. The choice is remembered on the device.
2. **Start.** From then on the quiz page opens on the remembered choice with
   one Start button, so a teacher at the Masjid hands the tablet over with one
   tap. "Change" reopens the chooser when the class moves on. The author asked
   how a saved quiz lets a child progress; the answer was to remember the last
   choice rather than save named quizzes (2026-10-27).
3. **Getting ready.** Every sound the quiz needs is downloaded before the
   first question, so a slow or dropped connection never stalls it midway.
4. **The questions.** The heading is the plainest words that say what to do
   — "Which letter?", "Which haraka?", "Tap what you hear." (the author,
   2026-10-27: "a simple click what you hear is enough"; `ASK` in
   `quiz.ts`). Where the author's recording says the same thing it plays
   first, and only when it is not the one just heard: questions come grouped
   by kind, so a run of "Which haraka?" hears it once. Then the clip. The
   choices wake when the clip ends (a tap before that is no answer). P plays
   it again; 1–3 answers (1–9 on the letter hunt, 1–8 on memory pairs); N
   goes on. A right answer chimes and moves on. A wrong one knocks, shows the
   right answer, plays the clip again, and moves on.
5. **Misses come back at the end**, in a review round, and keep coming back
   round after round until every one is answered right. **One right answer
   fixes a mistake** (the author, 2026-10-27: twice is overkill — a gap in a
   whole topic shows up again in its other questions anyway).
6. **The end screen** (redesigned the same evening, "more visual and
   colorful"): Manāra beaming at 70 % or more and standing still below it —
   never a frown; a RING meter of right the first time out of the number
   asked (one ratio, so a meter, never a two-slice pie); a DOT per question,
   a filled green dot for right the first time and a gold ring for put right
   later; tiles for the time, the rounds, the letters traced and the memory
   games; a bar per topic on a lighter track of the same green; and each
   question missed, playable, with what was tapped and — after a sound-alike
   mix-up — "Hear the difference". The green and the gold were checked with
   the dataviz skill's validator in both themes (light: ΔE 12.1 under
   protanopia; dark: 9.0), and they differ in SHAPE too, so color is never
   the only thing that tells them apart. "Practice my mistakes" makes a quiz
   of exactly those; "Again" makes a new quiz on the same choice.
7. **Hear the difference.** When the wrong choice was a letter the teacher
   recorded beside the right one (the sound-alikes sheet, §6) — حَ heard,
   هَـ tapped — the right clip plays again and then the teacher's ح … ه.
   Same or different works the same way when "Same" was said of two
   different letters.

**No breaks** inside a quiz (the author). Memory pairs and tracing are
questions like the rest, not pauses between them (the author, 2026-10-27,
correcting this record's first reading). Questions are grouped by kind in the
workbook's order, so a five-year-old is not switching rules every question;
the choices are reshuffled each time a question returns.

**A quiz survives a reload.** It is written to the device after every answer
(`iqra-quiz-run`); reopening the page offers Continue or Start over. Online
only otherwise: there is no offline-first design (the author, 2026-10-26).

## 3. The grown-ups question

A multiplication (3–9 × 3–9) stands in front of choosing topics. It keeps a
small child from building a 45-question quiz of letters they have not met.
Older children and adults pass it — on purpose: they choose their own
content (the author). Start, Again and Practice my mistakes need no gate.

On a shared tablet signed in to a Masjid account (stage 2) it is not enough —
see the teacher PIN in §8.

## 4. Topics and questions — Level 1

Every question carries ONE topic, never a lesson: lesson 21's clips alone
feed letter sounds, harakat and tanween, and a child who confuses ح and ه
must not read as weak in tanween. Seven topics — the workbook's six Level 1
sections with Section 3 split, because "can't tell ح from ه" and "can't read
a damma" need different help. The topic is what is ticked, what is tagged and
what the end screen reports: one list.

| Topic | Workbook | Kinds of question | Clips |
|---|---|---|---|
| Letter names | §1 | **Name it** — hear بَاء, tap ب among letters of other shapes | 29 names (lesson 30) |
| Look-alike letters | §2 | **Look-alike** — hear the name, tap it among its own shape family (ب ت ث) · **Letter hunt** — tap every ث in a 3 × 3 grid of ب ت ث | the names |
| Letter sounds | §3 | **Which letter?** — hear حَ, tap حَ / هَ / … · **Same or different?** — hear two sounds | 84 (lesson 21) |
| Harakat | §3 | **Which haraka?** — hear بُ, tap بَ · بُ · بِ | 84 (lesson 21) |
| Tanween | §4 | **Tap what you hear** — بُ or بٌ · **Which tanween?** — بًا · بٌ · بٍ | 168 (lesson 21) |
| Madd | §5 | **Tap what you hear** — بَدَ or بَادَ · **Which madd?** — بَادَ · بُودَ · بِيدَ | 168 (lesson 22) |
| Shadda | §6 | **Tap what you hear** — بَبَ or بَبَّ | 68 (lesson 23) |
| Memory pairs | §1–2 | **Memory pairs** — the classic game: four letters, each on two cards. All eight lie FACE UP first, for as long as the child likes, and a tap says the letter's name; "Turn them over" hides them. Then turn two: the same letter twice stays up with its name under it, anything else is seen for a moment and turns back. Every card says its letter's name as it turns. A game: never right or wrong, the end screen counts the turns | 29 names (lesson 30) |
| Tracing | every page | **Trace it** — lesson 30's own card: the name, the letter drawing itself, then the learner's turn, on the teacher's strokes where he drew them. Leaving the line is the one mistake, as in lesson 30: traced without a slip is right, a slip sends the letter back at the end | lesson 30 |

**Every wrong choice differs from the answer in ONE thing** — the letter or
the mark, never both — so a mistake says something. The Level 1 check's
صَ among ظًا طٍ صَ طُ changes both and is not the model here.

**At most three choices**: no question puts more than three answers in front
of a child, so the screen stays simple for a five-year-old. Some questions
have only two answers by their nature — tanween or not offers بُ and بٌ,
nothing else, and so do short or long, shadda or not, and "Same or
different?". "Which letter?" offers the answer, one
letter that sounds like it (from the sound-alikes sheet, §6) and one other.
Look-alike families are lesson 20's shape families with two or more letters
(ب ت ث, ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق). (The letter hunt is a
grid of nine; memory pairs is eight cards.)

**A topic is offered only where the person can open its lessons** (published,
or the admin), so a draft never reaches a learner through the quiz.

Left out on purpose: the songs (the author, 2026-10-27: "No songs"). They
have their own lessons, 31 and 32.

## 5. What one answer records

```
{ topic: "sounds", kind: "whichLetter", asked: "حَ", picked: "هَ", ok: false, seconds: 3.2 }
```

`asked` is the TEXT that was asked, never a card number: a workbook lesson's
card numbers shift when a sheet row is deleted (lesson 23's عَفِ rows,
2026-10-25), and a saved mistake must not come back as a different word.
Everything the reports want is a count over these records: right and wrong
overall and by topic, time, the topics most missed, progress by week, and
"hears ح as ه" (asked beside picked). Stage 1 keeps them for the end screen
only; stage 2 saves the same records to the learner.

## 6. Files

- `app/scripts/make-quiz.mjs` → `app/public/quiz/quiz.json` (precached with
  the shell; 56 KB with Level 2's words) and the prompt clips in
  `app/public/audio/quiz/`. Re-run after any lesson it draws on is recorded,
  re-cut or re-recorded — Level 1's (21, 22, 23, 30) and Level 2's word
  lessons (1, 5, 6, 25–29): the bank carries each clip's `rev` where the
  lesson has one, and a word joins only once its clip is on disk.
- `Word Tables/Quiz Prompts.docx` — **Slot · Say this**, the spoken
  instructions, recorded one take each into `Audio/Audio - Quiz Prompts/`
  (the author's folder, 2026-10-27; all thirteen recorded). **The heading on
  screen is the app's, not the sheet's** (`ASK` in `quiz.ts`), cut to the
  plainest words the same night, and a recording plays only where it says
  the same thing as its heading: `quiz-which-letter`, `-which-haraka`,
  `-which-tanween`, `-which-madd`, and the review and "all done" lines. The
  other seven ("Did you hear tanween, or not?", "Was it short, or long?",
  "Listen to two sounds. Are they the same, or different?" …) stay in the
  sheet and on disk, unplayed, for later use. No new rows: the instructions
  once planned for tracing and memory pairs were dropped as redundant (the
  author) — the card itself shows what to do.
- `Word Tables/Quiz Sound-alikes.docx` — one group of letters a learner
  confuses by ear per row: the wrong choice of "Which letter?". The defaults
  are a starting point for the author to correct: ح ه · ع ء · س ص · ت ط ·
  ذ ز ظ · ث س · ق ك · د ض. **The author also recorded each row** into
  `Audio/Audio - Quiz Sound-alikes/` — the letters' sounds, right to left,
  a second apart, one take a row. That take is the row's CONTRAST, "hear the
  difference" (§2). It is cut into as many pieces as the row has letters, so
  the record click is never taken for a sound, then kept whole from the first
  sound to the last (`public/audio/quiz/alike-<codepoints>.wav`). No need to
  record it as two utterances: the generator decides the pieces, not the
  intake setting. A changed row needs its take re-recorded under the row's
  new text.
- Both sheets are written once by the generator when missing and never
  overwritten; delete one to have it written afresh.
- `app/src/lib/quiz.ts` — the bank's types, the topics, question making, the
  run and its scoring. Pure; no React.
- `app/src/pages/QuizPage.tsx` — the start screen, the chooser, the gate, the
  questions, the review rounds and the end screen.

## 7. Decided along the way (2026-10-26/27)

- Drills first, with no accounts; accounts are the next step and need no
  rewrite because the answer record (§5) is fixed now.
- No API, MCP or AI in any of it for now. Everything is the author's checked
  sheets and recordings.
- Fifteen, thirty or forty-five questions. A child answers perhaps four to
  eight a minute, so 120 was never sensible (to be measured on the first
  tablet).
- The name "Quiz me" and the lightbulb (Claude's pick when the author asked
  for one; the author's options were "Interactive Session", "Test your
  knowledge" and "Test your skills"). "Test" reads as a grade, and the Level
  checks are the tests; "interactive session" says nothing about what
  happens. One string to change.
- **Plain headings, and no counting** (the author, late 2026-10-27): "We are
  over engineering it." A heading says what to do and nothing else; a
  recording that says more than its heading is not played. Timing is never
  asked as "one count or two" — "we don't teach it like that" — but as a
  word heard and tapped, بد or بيد; and "how long is the madd" is gone.
- **Memory pairs was broken as first built** — eight cards face down from the
  start, so a child could only turn cards blind. The classic game shows them
  first (§4).

## 8. Stage 2 — accounts (designed, not built)

- **An account holds learner profiles.** Sign-up asks whether you are
  registering yourself or your children; either way you can add more later,
  with no limit. A parent sees every child in one place. Children never sign
  in; a child is a profile. Results belong to a profile, never to an account.
  This is what Arabee and Khan Academy Kids do.
- **A teacher or Masjid account**, one per program at first, shared by its
  teachers on any number of devices at once (Firebase allows it). Registered
  with an email the Masjid owns, never a teacher's own.
- **The Masjid chooses its code** — `ICNBM-TN` — and is told "code taken" if
  another has it (one Firestore document per code, created only if absent;
  compared without case). A parent or a learner enters a code at sign-up or
  any time. Entering it shares that one profile with the Masjid; it shows
  nothing of anyone else. Like the class join codes already built.
- **What the Masjid may do**: see the shared child's results, run quizzes for
  the child and save them. The parent alone renames or deletes the profile;
  either side can end the sharing.
- **The Masjid can register its own students** and later hand each profile
  to the parent with a code — the profile keeps its id and its history when
  its owner changes (a seat id never changes when an account is linked,
  CLAUDE.md §3).
- **On a shared tablet the teacher picks the child**, and leaving that
  child's quiz asks for a **teacher PIN**: four digits the teachers choose in
  the Masjid account's settings and share like the password. A forgotten PIN
  is replaced by signing in with the Masjid password on that tablet. A
  math question cannot do this job: older children solve it.
- **Saving**: every answer is saved online the moment it is given. With no
  connection the answers wait on the device and go up when it returns, and
  the end screen says which.
- **Mistakes across quizzes**: up to a quarter of a new quiz is the child's
  open mistakes in the chosen topics; one right answer closes one. The start
  screen remembers each child's own last choice, so children progress apart.
- **Reports**: one page per child, shown to the parent and to the Masjids the
  child is shared with, plus a class list for a Masjid (each child's share
  right and weakest topic this week). Time, right and wrong overall and by
  topic, the most-missed topics, progress by week, the child's top
  confusions. Nothing generated or emailed by hand.
- **Sign-in gaps to close first** (`app/src/lib/auth.ts`): no "forgot
  password" (Firebase sends that email itself, no server); no "change
  password"; and a device cut off by a password change does not sign out —
  a refused refresh (`auth.ts:174`) is treated like being offline, so a lost
  tablet works for up to an hour and then quietly fails to save while still
  looking signed in.
- **Privacy**: a one-page policy — what is kept (a first name or nickname and
  the results; no birthday), who sees it (the parent, the Masjids it is
  shared with, and the author only to fix a problem), how long, how to
  delete, and no selling, ads or tracking. Arabee's own policy says its staff
  can reach the data; that is normal for any app with a progress view.

## 9. Waiting on the author

- ~~Record the thirteen spoken instructions~~ — done 2026-10-27.
- **Record lessons 25–29** (Level 2's workbook lessons) when their turn
  comes, then `node scripts/make-quiz.mjs`: Short words, Timing, Hamza and
  Qalqala light up by themselves, and Longer words gains lesson 27's words.
- **Correct the sound-alikes sheet**, then re-run the generator; a changed
  row's contrast take must be re-recorded.
- ~~The ت retake~~ — ب ت ر retaken and cut 2026-10-27 (no calibration
  existed on them).
- **Publish** Quiz me from Manage lessons once Level 1 is published.
- **When teacher accounts are about to be made**: register the Masjid account
  with a Masjid email.
- **After the quiz is published**: two-step verification on the Google account
  that owns the Firebase project.
- **When the first tablet arrives**, test before buying five: update Chrome
  and install IQRA from it (an Amazon Fire has no Chrome — test in Silk);
  with wired headphones play cards in lessons 21–23 (the sound starts on the
  tap, the box follows); open a lesson 7 card and trace a lesson 30 letter
  with a finger (fast enough?); pin IQRA with Android's app pinning and check
  a child cannot leave without the device PIN; a full session on battery;
  sign in, restart, still signed in. Then a quiz of 30, timed, for the real
  pace.

## 10. Levels 2 and 3 — choosing by Level, and Level 2's drills *(built 2026-10-27)*

### Choosing by Level

The author's proposal is the design, with four refinements:

- **"Select all"** at the top ticks every topic there is to practice, in
  every Level, in one tap (the author asked for it: nine topics were nine
  taps). Half-ticked when some are.
- The chooser lists the three Levels. Each has one box for the whole Level
  and opens to its topics, each with its own box. Any mix: one Level, two,
  all three, or a few topics from each. A Level 3 learner ticks Level 3 and
  is asked nothing of Level 1. Level 3 reads "Coming later" until it has
  topics.
- A Level's box is ticked when all its topics are and half-ticked when some
  are; ticking it ticks every topic there is to practice.
- It opens on the Levels the remembered choice uses — the first time, all
  closed — and a topic with nothing to practice yet stays listed, greyed,
  with the reason: "Not published yet" (its lesson is a draft and this is
  not the admin) or "Not recorded yet" (`topicStatus` in `quiz.ts`).
- **More topics than questions.** Fifteen questions over the twenty-odd
  topics of three Levels cannot visit every topic. Each quiz then draws its
  topics at random, so over a few quizzes every one gets its turn; the end
  screen reports only what was asked. Refusing the choice would be a dead end
  for a child.

**What a learner may hear is decided once**: `visibleBank` drops every clip
of a lesson the person cannot open before a quiz is made, so a draft never
reaches a learner through the quiz, Level 2's word lessons included.

### Level 2's topics

In the workbook's order (Level 2, sections 1–8). A topic whose lesson is not
recorded yet waits, greyed, and lights up when the lesson is recorded and
`node scripts/make-quiz.mjs` is run — nothing else to change.

| Topic | Workbook | Heading and question | Today |
|---|---|---|---|
| Letter shapes | §1 Letter Pairs, §8 Letter Shapes | **Which letter?** — a letter at the start, middle or end (ـك) → tap it whole (ك) among three, one of its own family · **Which shape?** — "ع in the middle" → tap the form among its three · **Which one never joins?** — one of ا د ذ ر ز و beside two that join | works: text only, built from the alphabet with a tatweel, no recordings |
| Short words | §2 Three-Letter Words | **Tap what you hear** — three written words: the answer, its look-alike (below) and one other | waits for lesson 25 |
| Timing | §3 Timing | **Tap what you hear** — بد or بيد: a madd letter put in or left out is a word's nearest look-alike. Never "one count or two" (§7) | waits for lesson 26 |
| Longer words | §4 Four-Letter Words, and lesson 1's five | **Tap what you hear** | works on lesson 1's 33 words; lesson 27 joins when recorded |
| Hamza | §5 Hamza | **Tap what you hear** | waits for lesson 28 |
| Madd Muttasil and Munfasil | §6.1–6.2 | **Tap what you hear** — words, and two-word phrases asked among phrases | works: lesson 5, 76 texts |
| Madd Lazim and more | §6.3–6.6 Lāzim, opening letters, ṣilah, ʿiwaḍ, līn | **Tap what you hear** | works: lesson 6, 41 texts — a draft, so the admin only until it is published |
| Qalqala | §7 Qalqala | **Find the one** (below): "Which one has qalqala?" | waits for lesson 29 |

Dropped from the first design at the author's word: "One count or two?" and
"2 or 4?" for timing and madd 4, and "How long?" for madd 6 — the author does
not teach a madd as a count to tap. Not built: "Find the one" for the hamza
("which has the hamza in the middle?") — the same component would do it,
from lesson 28's words.

**Look-alike words are found by rule, never listed by hand**
(`wordDistance`): an edit distance over the letters, where the same letter
with other marks costs 0.4, a letter of the same SKELETON (its dots off: ب ت
ث ن ي one shape, ج ح خ another, …) 0.5, a madd letter put in or left out 0.5
(بد / بيد), and anything else 1. The nearest word of the same length (one
word or a phrase of as many words) is the look-alike; the third choice is a
word at least a whole letter away. A word is asked only where its lesson has
two others of its length. Before a lesson is recorded none of this can be
judged by ear: read the first quizzes of each new lesson.

**Find the one** — the author's mechanism: the cards are PLAYED, not tapped.
Each lights while its word sounds, once, in order ("Listen to each word."),
then the heading turns to the question and the learner taps. Hearing and
choosing are different gestures, so a tap never plays, and there is no
"Listen again": each is heard once. A miss marks the right card and plays it
again, lit. A qalqala word is one with ق ط ب ج د on a sukoon; the two beside
it come from lessons 25, 27 and 1 with no qalqala however they are read — no
sukoon on one of those letters and none of them last, where a stop would
give it one — never from lesson 29, whose stop lines have qalqala with no
sukoon written. The same kind can later ask "which has a madd muttasil?",
"which has a shadda?", and in Level 3 "which has a ghunna?".

**Built before the recordings — yes.** The generator keeps only words whose
clips are on disk (`words` in `quiz.json`, lessons 1, 5, 6, 25–29). Letter
shapes need none; lessons 1, 5 and 6 are recorded already; the rest light up
as 25–29 are recorded. Verified in the browser pane with a question built
from recorded words, since lesson 29 has none yet: the three lit in turn,
the taps woke after the third, a miss replayed the answer lit, and the
review round brought it back with the clips moved with their cards.

### Level 3, later

The same chooser takes Level 3's topics when they are designed: stop or carry
on (lesson 7's two readings, 34), sun or moon lam (2), hamzat waṣl (4), the
throat letters (3), nūn and mīm sākinah (7), idghām of two letters (36), the
silent alif (37). The Level 3 check already asks "which rule?".
