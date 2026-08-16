# Should the Maktab assessment live inside IQRA?

A design note, written before any code. The short answer is **yes, and not yet,
and the gap between those two is smaller and more specific than it looks.**

---

## 1. The finding that decides this

`app/src/lib/classes.ts:10`

```
classes/{classId}/members/{uid}      one per learner
```

That `{uid}` is a Firebase Auth uid. Every seat on every roster in this app
today **is** an account. There is no document that can represent a child who
has no phone, no email and no password.

So the honest state of things is not "the assessment would be awkward to add".
It is: **the app cannot currently represent a Maktab student at all.** The
brief said "some students don't have phones" almost in passing; it is in fact
the whole architectural question.

Everything else — the items, the scoring, the storage, the reports — is easy by
comparison and mostly already solved.

## 2. What that change actually is

A roster **seat** that exists whether or not anyone ever signs in:

```
classes/{classId}/roster/{seatId}
    displayName   "Yusuf A."
    uid           ""        ← empty until (if ever) an account is linked
    active        true
    createdAt     …
```

The teacher creates seats by typing names. A seat can later be linked to a uid
when a child gets a device; the seat id **never changes when that happens**.

> This is the same rule this project already paid for twice — a word's id
> belongs to its table row and is spent whether or not the row was recorded; a
> lesson's number is its identity, never its position. A seat id belongs to the
> child, not to their account status. Get this wrong and every assessment
> record silently points at a different child the day someone signs up.

This is worth doing regardless of the assessment, because **every Masjid class
on earth has children without devices.** The current model quietly assumes a
1:1-device school. If the LMS vision is real, this is a blocker with or without
Maktab, and the assessment is simply the thing that surfaced it.

## 3. The part that is nearly free

Your requirement — *"the assessment is authored by me exclusively; teachers
administer and view results but cannot edit it"* — sounds like the hard part.
It is the cheapest part, and only if you resist the obvious design.

**Do not put the instrument in Firestore.** Put it in the repo:

```
app/public/assessments/maktab-v1.json
```

read exactly the way `public/lessons/lessonNN/words.json` already is. Then:

- A teacher cannot edit it because **there is no code path that writes it.**
  That is stronger than any security rule, and it costs zero rules, zero
  authoring UI, zero permission model, zero admin screens.
- It versions in git, diffs in review, and ships with the build.
- Freezing the instrument mid-pilot — which you *want* — is automatic. Changing
  a comma is a deploy, which is exactly the friction a standardized instrument
  should have.
- It matches the pipeline philosophy already in this repo: the author writes a
  source of truth, a generator produces static JSON, the app only reads.

The moment a second person needs to author assessments, that changes. That
moment is years away and will arrive with requirements you cannot guess now.

## 4. So what is expensive?

Only two things, and they are separable — which is the useful insight:

| | Cost | Gives you |
|---|---|---|
| **A. Roster seats + results storage** | a weekend | *everything you actually asked for*: stored, retrievable, queryable, progress over time |
| **B. A grading UI** | weeks, and it must work offline | convenience at the station |

**Your stated requirement is satisfied entirely by A.** "I want the assessments
storable, retrievable, query-able in a cloud where we can track student
progress at any time" is A. B is a nicer way to *enter* the data, and you could
grade on paper forever and still have the whole cloud record.

Separating them matters because B is where the real difficulty hides:

- Grading happens in a room with 25 kids and probably bad wifi. This app talks
  to Firestore over **raw REST** (`fetch` against
  `firestore.googleapis.com/v1/...`), not the Firebase SDK — so there is **no
  offline write queue**. A grading screen that loses a child's scores when the
  signal drops is worse than paper, and building that queue is real work.
- A Qari with a child in front of him should be listening, not tapping. Even in
  the finished app, entry-after-the-fact should be a **first-class path**, not
  a fallback. Design for it now: the results model must accept a whole
  administration typed in an hour later, from paper.

## 5. Pros and cons, straight

**For building it in:**

- Roughly 60% is already there — auth, roles, classes, teacher approval, a
  disciplined rules posture, and an author who writes decisions down.
- **Assessment records are the stickiest thing an LMS has.** Lessons are a
  commodity — every Masjid can find a tajwīd video. A four-year longitudinal
  record of a child's recitation is not something they can get anywhere else,
  and it is not something they will migrate away from. If IQRA ever becomes a
  product, this is the wedge, not the lessons.
- The screening tasks are *already* what this app is best at. Play a clip, match
  it to text, score it — that is one component away from what `ItemCard` does.
- It forces the roster fix, which the LMS needs anyway.

**Against, for now:**

- **The pilot session is the wrong moment.** If a result comes out strange, you
  must be able to say whether the *instrument* or the *software* was wrong. Run
  both new at once and you can say neither.
- First administrations always change the instrument substantially — items
  everyone gets right (measuring nothing), items that turn out ambiguous. UI
  built around content that is about to change is the classic waste.
- **Children's data raises the stakes of every bug.** A wrong paper sheet is
  one child. A wrong security rule is the whole roster, and they are minors.
- **This is your private project and the Maktab is an institution.** Admin is a
  single personal Gmail address. That is completely fine for a pilot and not
  fine for a Masjid's permanent student records. Before the committee's data
  lives in your Firebase project, settle in writing: who owns the records, what
  happens if you leave the committee, how they get an export. Do that *before*,
  not after — it is a five-minute conversation now and a bad one later.
- The diagnosis currently points nowhere. The assessment will tell the Qari
  "eighteen students fail iqlāb" and IQRA has no iqlāb lesson. Five lessons is
  not yet a curriculum to place people into.

That last point cuts both ways, and the other edge is sharper:

> **The most valuable output of this pilot, for IQRA, is not software. It is
> knowing which lesson to write next.** You are about to get item-level data on
> exactly which tajwīd rules a real class of American students fails. That is a
> curriculum roadmap you currently do not have, and it is worth more than any
> feature you could ship the same month.

## 6. Am I getting ahead of myself?

Not on complexity. Assessment is a *smaller* feature than classes or notes, and
you have already built both. The instrument-as-a-static-file design makes it
smaller still.

You are getting ahead of yourself on **ordering**, in one specific way: you are
considering building the container before the contents have been used once.
Give the instrument on paper, revise it, *then* encode the revised version.
Encoding v0.1 means encoding a draft.

## 7. Recommendation

**Run the pilot on paper. Do not write app code for it. Spend the saved time
deciding the schema, which I have done below — so that nothing is thrown away.**

Then, after the pilot and in this order:

1. **Roster seats** (§2) — the identity fix. Needed by the LMS regardless.
2. **Results storage + a CSV import script** — this is where the pilot's paper
   results land, and it completes your actual requirement.
3. *(optional, later)* the grading UI, with an offline write queue.
4. *(much later)* student-facing theory on their own devices.

Stop after 2 if you like. It is a genuine, queryable, longitudinal record.

## 8. What to use for the pilot

**Google Sheets — not Google Forms.**

Forms is one response at a time and cannot express a 12-item grid or a
two-column matching key without becoming painful. Sheets is a data table, which
is what this is.

- **At the station: paper.** A single-sided grid per student. Fastest thing a
  human with a pen can use with a child in front of them, works with no signal,
  and does not put a screen between the Qari and the recitation.
- **After: one person types each sheet into Google Sheets.** ~2 minutes per
  student. Queryable with `QUERY()`, shareable with the committee, works offline
  in the mobile app, and exports CSV.
- **CSV is the import format for step 2 above.** Nothing gets re-keyed.

**Do not record student audio in the pilot.** They are minors; recording them
brings parental consent, retention and storage into a session that does not
need any of it. The Qari grades live. If you want recordings later, that is a
consent form and a separate decision — and this repo already has the right
precedent for it in the intake system's consent field.

## 9. The schema — decide it now, use it in both places

Design the spreadsheet with the field names the app will eventually use.

**Later, in Firestore:**

```
app/public/assessments/maktab-v1.json           ← the instrument. Static. In the repo.

classes/{classId}/roster/{seatId}
      displayName, uid, active, createdAt

classes/{classId}/administrations/{adminId}
      assessmentId          "maktab"
      assessmentVersion     "0.1"
      administeredBy        uid of the teacher
      administeredAt        epoch ms
      note

classes/{classId}/administrations/{adminId}/results/{seatId}
      seatId
      assessmentVersion     stamped again, on the result itself
      screening   { a: 6, b: 5, c: 4, pass: true }
      theory      { d1: 4, d2: 5, … d7: 6, total: 30 }
      practical   { p1: 5, p2: 6, p3: 8, total: 19 }
      items       { "T3.6a": 1, "P7": 2, "P11": null, … }
      level       3
      tags        ["SHORT", "NO-GHUNNAH"]
      notes
```

**Three rules that are free now and impossible to retrofit:**

1. **Store per-item responses, not just totals.** You cannot recover item
   analysis from a total, and item analysis is the entire point of a pilot. If
   every student gets `T2.4` right, that item is measuring nothing and should
   be replaced — and you can only know that from the raw responses.
2. **`NR` (not reached) must be distinguishable from `0`.** The adaptive stop
   creates skipped items. A skipped item scored as zero makes every average
   wrong and makes a weak student look weaker than he is. Store `null` for NR.
3. **Stamp `assessmentVersion` on the result, not only on the administration.**
   The version is what makes two scores comparable; it must travel with the
   score it explains.

**Spreadsheet columns**, in order — one row per student per administration:

```
seat_id · student_name · class · administered_at · administered_by · assessment_version
screen_a_1 … screen_a_7 · screen_b_1 … screen_b_7 · screen_c_1 … screen_c_3
screen_total · gate_pass
T1_1 … T7_6                                    (one column per item, blank = NR)
theory_d1 … theory_d7 · theory_total
P1 … P12                                       (0 / 1 / 2, blank = NR)
prac_p1 · prac_p2 · prac_p3 · prac_total
level · tags · notes
```

Wide, and correct. It is a data table, not a form.

`seat_id` is a short stable code you assign once (`M-001`, `M-002`) and never
reuse — not the child's name, which changes spelling, and not the row number,
which changes when you sort. It becomes `{seatId}` on the day this moves into
the app, and that is what makes the move an import rather than a re-keying.
