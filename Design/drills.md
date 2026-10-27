# Quiz me — the question book

The design record for the app's drills, the way `Design/iqra-kids.md` is for
the Level 1 letter lessons. Read it before touching anything under `#/quiz`,
`src/lib/quiz.ts`, `src/pages/QuizPage.tsx` or `scripts/make-quiz.mjs`.

**Status (2026-10-27).** Stage 1 is built and lands as a draft feature: `quiz`
in `config/app`, visible to the admin only until it is switched on in Manage
lessons. Its spoken instructions are not recorded yet; the quiz shows them as
text until they are. Stage 2 (accounts) is designed below and not built.

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
4. **The questions.** The spoken instruction plays when the kind of question
   changes, then the clip. The choices wake when the clip ends (a tap before
   that is no answer). P plays it again; 1–3 answers (1–9 on the letter
   hunt); N goes on. A right answer chimes and moves on. A wrong one knocks,
   shows the right answer, plays the clip again, and moves on.
5. **Misses come back at the end**, in a review round, and keep coming back
   round after round until every one is answered right. **One right answer
   fixes a mistake** (the author, 2026-10-27: twice is overkill — a gap in a
   whole topic shows up again in its other questions anyway).
6. **The end screen**: right the first time out of the number asked, the same
   by topic, the time taken, and each question missed (playable, with what was
   tapped). "Practice my mistakes" makes a quiz of exactly those; "Again"
   makes a new quiz on the same choice.

**No breaks** inside a quiz (the author). Questions are grouped by kind in
the workbook's order, so a five-year-old is not switching rules every
question; the choices are reshuffled each time a question returns.

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
| Tanween | §4 | **With tanween or without?** — بُ or بٌ · **Which tanween?** — بًا · بٌ · بٍ | 168 (lesson 21) |
| Madd | §5 | **Short or long?** — بَدَ or بَادَ · **Which madd?** — بَادَ · بُودَ · بِيدَ | 168 (lesson 22) |
| Shadda | §6 | **With shadda or without?** — بَبَ or بَبَّ | 68 (lesson 23) |

**Every wrong choice differs from the answer in ONE thing** — the letter or
the mark, never both — so a mistake says something. The Level 1 check's
صَ among ظًا طٍ صَ طُ changes both and is not the model here.

**At most three choices** (two where the question is with/without), so the
screen stays simple for a five-year-old. "Which letter?" offers the answer,
one letter that sounds like it (from the sound-alikes sheet, §6) and one
other. Look-alike families are lesson 20's shape families with two or more
letters (ب ت ث, ج ح خ, د ذ, ر ز, س ش, ص ض, ط ظ, ع غ, ف ق).

**A topic is offered only where the person can open its lessons** (published,
or the admin), so a draft never reaches a learner through the quiz.

Left out on purpose: tracing, memory pairs and the songs. They were breaks or
warm-ups and a quiz has none; each has its own lesson (30, 31, 32). Levels 2
and 3 get topics later (the author, 2026-10-26).

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
  the shell; small) and the prompt clips in `app/public/audio/quiz/`. Re-run
  after any Level 1 lesson is re-cut or re-recorded: the bank carries each
  clip's `rev` (lesson 30's names have one).
- `Word Tables/Quiz Prompts.docx` — **Slot · Say this**, thirteen spoken
  instructions. The intake tool reads the Slot column; record one take each
  into `Audio/Audio - Quiz/`, then run the generator. The on-screen
  instruction is the sheet's line, so the two never disagree.
- `Word Tables/Quiz Sound-alikes.docx` — one group of letters a learner
  confuses by ear per row. **Not recorded**: the clips are lesson 21's. The
  defaults are a starting point for the author to correct: ح ه · ع ء · س ص ·
  ت ط · ذ ز ظ · ث س · ق ك · د ض.
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

- **Record the thirteen spoken instructions**: `Word Tables/Quiz
  Prompts.docx` in the intake tool, one take each, into `Audio/Audio -
  Quiz/`; then `node scripts/make-quiz.mjs`, build, deploy.
- **Correct the sound-alikes sheet**, then re-run the generator.
- **The ت retake and the other Level 1 retakes**, then
  `node scripts/make-alphabet.mjs` and `node scripts/make-quiz.mjs` (the
  bank picks up each name clip's new hash).
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
