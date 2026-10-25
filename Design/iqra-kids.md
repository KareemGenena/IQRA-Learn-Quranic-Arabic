# IQRA Kids — design record

A second curriculum inside the same app: the Arabic alphabet and the reading
rules, from the ground up, following the Baghdadi qaida. Built for the Masjid's
Maktab programme, where a teacher drives it live on a shared screen and the
children are not self-paced. **The youngest are five and reading Arabic for the
first time.** Challenging enough to learn from, never enough to discourage.

`CLAUDE.md` is the authority on the app. This file is the authority on the kids
curriculum: what was decided, what is still open, and why. Read both.

Status (2026-10-11): **iteration 6 is built and deployed as drafts, and every picture is in** — song 31, lesson 20 (one lesson, four sections), song 32, lesson 33 (the five places, with the author's own Canva pictures: sources in `Design/kids-art/makhraj-canva/`, 480 px copies shipped, 37 wanted / 37 present). One recording per letter: **38 takes, every one a single piece, is all that remains** — then tap calibration, which the generator lists once something is recorded, then Publish. See §11; the recording and calibration steps are spelled out in `CLAUDE.md` §5.

---

## 1. The decision the rest hangs on

**Content and presentation are separate things.**

There is one qaida — one lesson number each, one folder, one set of clips, one
set of calibrations. "Kids" is a *skin and a menu*, chosen by the viewer, not a
copy of the content. The adult alphabet lessons, when they come, are these same
lessons with the pictures not rendered.

This is the project's oldest law wearing a third hat:

| already true | this instance |
|---|---|
| a word's **id** belongs to its table row, not to whether it was recorded | a letter's **id** belongs to its row, not to which audience is looking |
| a lesson's **number** is its identity, never its position (`order` handles position) | a lesson's **content** is its identity, never its audience (`mode` handles audience) |

The rule that keeps it honest: **mode never touches an id, a folder, a clip
filename or a calibration key.** `calibrations/lesson20/words/{id}{a|b|c}` is the
same document whichever skin is on screen. Calibrate once, both audiences get it.

Building `lessons/kids/` beside `lessons/` would give two alphabets that drift
apart, two sets of clips, and calibrations that exist on only one of them.

---

## 2. The curriculum — 11 lessons

The author's plan, from the sessions of 2026-09-05/06. Numbered here by their
place in the qaida (L1…L11), **not** by their lesson number in the app (§4).

**The unit of design is the sitting, not the card count.** The author's
constraint: *a lesson done in under 30 minutes, one teacher sitting with about
five children, playing, saying, repeating.* Allowing ~5 minutes to settle, that
is roughly 25 minutes of drill, and a card takes 45–120 seconds depending on how
much is on it — so **8 to 15 cards, by weight**.

A lesson longer than that is not split into two lessons; it is given **two
sections**, and *a section is a sitting*. `SectionedLesson` already pages by
section and already remembers the teacher's place per lesson in `localStorage`,
so resuming next week is a feature that exists rather than one to build.

A card is a *teaching unit*, not a recording: in L4–L5 a card is one letter shown
in three words; in L1–L3 it is one letter with all its forms.

| | Lesson | A card is | cards | sittings |
|---|---|---|---|---|
| L1 | **The letters** ب ت ث ج ح خ د ذ ر ز | a letter, 4 forms | 10 | 1 |
| L2 | **The letters** س ش ص ض ط ظ ع غ ف ق | a letter, 4 forms | 10 | 1 |
| L3 | **The letters** ك ل م ن ه · ء and its seats · و ى/ي ا · لا · ة | a letter, 4 forms | ~13 | 1–2 |
| L4 | **Position** — beginning, middle, end, in real words | a letter, 3 words | 15 | 2 |
| L5 | **Position**, continued | a letter, 3 words | 14 | 2 |
| L6 | **Tarqeeq and tafkheem** — minimal pairs (أَسَدَ / أَصَدَ) | a pair | 15 | 1 |
| L7 | **Mixed harakat in one word** (أُسِرَ، بُسِطَ، ثُلِبَ) | a word | 15 | 1 |
| L8 | **Haraka vs madd** — the timing (عَلَ / عَالَ), all three madd letters | a pair | 15 | 1 |
| L9 | **Tanween** — the letter with all three, then in a short word | a letter, 4 forms | 28 | 2 |
| L10 | **Shadda** — two- and three-letter words, mostly mock | a word | 15 | 1 |
| L11 | **Free practice** — everything, in real Quranic words | a word | 15 | 1 |

About fourteen sittings across eleven lessons — a term.

### Decided

- **Haraka order is fatha, damma, kasra** (بَ بُ بِ). The author's call, and it
  fixes every card, clip filename and calibration key in L1–L3 and L9.
- **Letter order** is the table above: pedagogical, not alphabetical, because
  hamza and the madd letters are held back.
- **لا and ة close L3.**
- **L9 gives every letter its tanween.** Alif takes none, and ى is held back
  because a tanween on it (هُدًى) is ʿiwaḍ territory — so 27 letters, plus ة,
  whose tanween is everywhere in the Quran (رَحۡمَةً). 28 cards, two sittings.
- **L9 does not teach madd ʿiwaḍ** — the reading continues, so `waqf` stays off.
- **L11 is all real Quranic words, 3–4 letters, and contains no rule the child
  has not already met.** That is a hard constraint on word choice, and the
  generator should be able to check it.

### Rules for L1–L3

- **29 letters**, because ء and ا are two different letters.
- The sukoon form needs a consonant before it, and that consonant is **ن**:
  نَبْ، نَتْ، نَثْ… The ن is voweled here so it is always clean — no ikhfāʾ, no
  idghām, nothing that would colour the letter being taught.
- **Hamza comes late**, shown on its four seats — أ / إ, ؤ, ئ, and ء alone.
  Lesson 3 (throat letters) is the guide for *which* seats, not for the words:
  its أَنۡعَمۡتَ، يُؤۡمِنُونَ، شَيۡئًا، ٱلسَّمَآءِ are far too long here.
- **The madd letters come last**, because a madd is a held vowel and the letter
  before it has to be lengthened for it to be heard. For ا و ي the sukoon slot
  becomes the madd slot: نَا، نُو، نِي — and و and ي also appear as ordinary
  consonants (وَ، يَ) and as līn (نَوْ، نَيْ).
- Uthmanic Hafs throughout, with the Mushaf's own diacritics. No teaching font.

### The two songs, and where the makharij live

Added 2026-09-06. The author records both; the app highlights along.

- **Song 1 — the letter NAMES** (أَلِف بَاء تَاء…), 28 letters in the usual
  order, **before** lessons 1–3. Large colourful letters in Uthmanic Hafs, each
  lighting up as it is sung. The seaside picture belongs to the **shape group**,
  so it stays on screen while ب ت ث are all sung.
- **Song 2 — the letter SOUNDS ×3** (أَ أُ إِ، بَ بُ بِ…), same 28 in the same
  order, **after** lessons 1–3. **No seaside pictures here.** This song carries
  the makhraj head instead.
- **Both have a pause button**, so a child can stop and learn and a teacher can
  stop and teach.

**The makhraj problem, and why it dissolves.** Shape families and makhraj
families are two different groupings of the same 28 letters and they do not line
up: ب ت ث look alike and come from three different places; ء ه ع ح غ خ share a
place and look nothing alike. Trying to make one card teach both is what breaks.

So **song 2 is not grouped by makhraj at all.** It stays alphabetical — it is a
song, the order is the tune — and the makhraj is a **live readout beside the
letter**: the lit zone *moves* as the song travels the alphabet. Lips at بَ,
tongue tip at تَ, throat at حَ. A grouped chart states a fact to memorise; a
moving readout says *that is where this sound is made*, twenty-eight times,
while the child is making it.

The grouping is given **once, at the end**, as a review screen: the head with all
five zones and their letters. Grouping belongs in a summary, never in the
structure.

**Five places, and only five**: الجوف · الحلق · اللسان · الشفتان · الخيشوم.
Eighteen letters land on the tongue, which is the right grain at this age — the
seventeen sub-makharij are a later lesson, and adding them is adding a column.

**The diagram is one SVG with named zones**, not six PNGs: one small file, any
zone lit at runtime, theme-aware, animatable. A **faceless child's profile** —
no eye, no features, just the outline and the interior — which keeps the art
rule and still teaches.

### What the songs need from the engine

Nothing structural. A song is a `Playable` — one clip, one `timings` array — and
the admin calibration page already builds that array by tapping along. Song 2 is
**the first thing in the app that requires calibration** rather than merely
benefiting from it, because a sung rhythm has nothing to do with harakat weights.

The one real change: **`PlaybackHandle` has only `stop`**, and `toggle` restarts
from the beginning, so pause/resume is new. The `<audio>` element pauses
natively; it is a matter of cancelling the rAF loop without calling `finish()`.

Neither song is ever cut. `splitIntoN` must not touch them — the first
recordings in this project that are not meant to be split.

### The sheet — drafted 2026-09-06

`Word Tables/الحروف الهجائية.docx`, **six** headed tables, 97 rows: 35 letter
rows carrying **155 clips** (124 forms + 31 names — the names are recorded, for
song 1 and so a card can say its own letter), plus the two song track-lists of
28 letters each. Landscape, and the Arabic runs carry the author's own Word
font ("KFGQPC HAFS Uthmanic Script" — a different build from the repo's `.otf`,
see `CLAUDE.md`).

Built by a script rather than typed, so the conventions cannot be broken by
hand: every haraka and every **U+06E1 sukoon** is assembled from an explicit
codepoint. Verified by parsing the result with the generators' own regex —
`w:tbl`/`w:tr`/`w:tc` balanced, all four tables read.

| table | rows | columns |
|---|---|---|
| Lesson 1 · ب ت ث ج ح خ د ذ ر ز | 10 | Letter · Name · +Fatha · +Damma · +Kasra · +Sukoon · Makhraj · Mnemonic |
| Lesson 2 · س ش ص ض ط ظ ع غ ف ق | 10 | same |
| Lesson 3 · ك ل م ن ه | 5 | same |
| Lesson 3 continued · ء أ ؤ ئ · و يـ ى ا · لا ة | 10 | Letter · Name · Form 1–5 · Makhraj · Mnemonic · Note |
| Song 1 · the alphabet as names | 28 | # · Letter · Name (sung) · Shape group |
| Song 2 · the alphabet as sounds ×3 | 28 | # · Letter · +Fatha · +Damma · +Kasra · Makhraj |

**Nine cells are marked CHECK.** They hold real Quranic words — مُؤۡمِن، سُئِلَ،
جُزۡء، فِى، مُوسَىٰ، لَا، وَلَا، رَحۡمَةَ، نِعۡمَةَ — proposed from memory, which
this project's rules do not allow to stand. Read against the Mushaf before
recording. Lessons 1–3 need nothing more, being mock syllables; lessons 4, 5, 7
and 11 are real words throughout and will want a **verified Uthmani text in the
repo** so the generator can check every word and reference mechanically. Deferred
until lesson 4.

**It is a draft for the author to correct in Word.** The content decisions
inside it are the generator's to inherit, not to invent, so they are listed
where the author can see them: §7.

### The yaa has dots only when it joins forward

**A yaa at the end of a word is never dotted in the Mushaf, and never dotted in
this app.** The dots belong to the initial and medial forms — يـ، ـيـ — where the
letter joins to what follows.

The mechanism is the **font**, not the codepoint, and this is where it is easy to
go wrong. Two characters reach a final yaa here:

- **U+0649 (ى)** — used for the alif written as a yaa (مُوسَىٰ) and for the final
  madd yaa in most words (بَرِىٓءٌ، فِىٓ، تَأۡمُرُوٓنِّىٓ).
- **U+064A (ي)** — used everywhere a yaa joins forward, and also in a handful of
  word-final positions (بِعَهۡدِي، يَهۡدِي، نِعۡمَتِيَ، غَنِيٌّ). **KFGQPC
  Uthmanic Hafs renders those final forms without dots**, so they are correct as
  written and display correctly in the app.

A mechanical scan on 2026-09-06 flagged بِعَهۡدِي and يَهۡدِي as suspect,
reasoning from the codepoint. **That reasoning was wrong** — the author confirmed
the font drops the dots in final position, and that the dots seen were an
artefact of reading the text in a non-Uthmanic font. Nothing was changed, and
nothing needs changing. *The font is the authority, not the codepoint chart* —
the same lesson the silent-letter circles already taught this project.

So the ى card carries both of its jobs, which is what the author asked for in the
first place: **a yaa at the end of a word** (فِى) and **an alif written as a yaa**
(مُوسَىٰ) — one shape, told apart by the dagger alif above it.

And **the dotted yaa is only ever shown joined forward** — يـ, a yaa followed by a
tatweel — because a duck with two dots under it exists nowhere in the Quran.
`graphemes.ts` already absorbs a tatweel into the cluster before it, so يـ is one
cluster and one highlight step; nothing new is needed to render it. The same
device is there for any other letter whose teaching form should be connected.

---

## 3. What the app already does, and what is actually new

Almost all of it is `kind: 'letters'` — the shape lesson 3 already uses.

| the qaida needs | already exists |
|---|---|
| a card holding several forms of one thing, each playable | `LetterWord.forms[]` + `Lesson.formLabels` |
| a target letter lit up inside a word, chosen by Beginning/Middle/End | `target: {letter, position}` → `findTargetCluster()` |
| two words one letter apart on one card | lesson 3's contrast-drill section |
| letter-by-letter highlight and per-letter timing | `timing.ts`, `usePlayable`, `ArabicWord` |
| a picture beside a card | `LetterWord.image` + `Lesson.imagePath` |
| play-all, and a single-key walk for a teacher across the room | `SectionedLesson` (`N`/`P`/`1`–`9`) |
| cutting one take into N clips, matched by filename | `splitIntoN`, the generator idiom |
| recording a sheet into correctly named WAVs | the intake tool |

Genuinely new, and the whole build list:

1. **The kids skin** — `data-mode="kids"` on `<html>`, the same mechanism
   `data-theme` already uses, plus a scoped block in `index.css`. One card per
   screen, bigger type, tap targets ≥64 px, the mnemonic picture card-sized
   rather than hidden behind an (i).
2. **`#/kids`** — a second menu, grouped under Level 1/2/3 headings. Reached
   from a card on the home page, never a mode-choice splash (the app is never a
   mode). `#/kids/lesson/20` and `#/lesson/20` are the same lesson, two skins.
3. **`tracks`, `kidsLevel`, `chapter` on `LessonMeta`**, beside the `order`
   groundwork that already exists. A lesson can be in both tracks.
4. **Per-card form labels.** `formLabels` is per-lesson today; L1–L3 need it per
   card, because the madd letters' fourth form is not a sukoon.
5. **The spell-out line** — see below.
6. **The mnemonic block on a row** — `kid?: { image, mnemonic }` and, for the
   adult track later, `adult?: { makhraj }`. Optional fields on the same row,
   exactly as `image` and `meaning` already are.

### The spell-out line (L4–L5)

The book prints each word twice: its letters apart above, joined below. The
author wants it **differently from the book**: the letters above are shown in
their **standalone forms** — ل م س, not لَ مَ سَ — because seeing the standalone
shape beside the joined one is what makes the connection.

- **Derived, never typed.** `splitClusters` + `baseChar` already give the base
  letter of each cluster; rendering them space-separated produces standalone
  shaping for free. The sheet only carries a flag.
- **Used sparingly**, mostly on the early cards. It is a demonstration, not a
  fixture.
- **No extra recording.** The highlight engine runs off the joined word, as it
  always has.

Open: whether the standalone letters light up in sync with the joined word (free
— same cluster index, same moment), or stay static. §7 Q1.

### Not built

**No per-child progress, stars or scores.** That needs a roster seat per child,
and `CLAUDE.md` already records that a seat is not an account and that a child
without a phone cannot be represented today. Kids mode as a teacher's aid with
zero per-child state ships without touching that blocker.

**No colouring the dots apart from the letter body.** `ArabicWord` colours by
stacking clipped copies of the whole string measured with the Range API — it can
isolate a cluster, never a dot inside a glyph. Dots are taught by the picture
and by the chip beside the letter.

Debt to clear on the way: `ItemCard` renders `item.image` with a **hardcoded**
caption about ه and ح. That caption must become a field before pictures
generalise past lesson 3.

---

## 3b. Built, 2026-09-06

Everything below exists and builds. Nothing is recorded yet.

- **`app/scripts/make-alphabet.mjs`** — reads the sheet's six tables, writes
  five lessons: **20, 21, 22** (the letters) and **31, 32** (the songs).
  Reports every take not yet recorded, every recording matching no row, and
  every picture a card asks for that is not on disk.
- **`public/lessons/lesson{20,21,22,31,32}/words.json`** — 35 letter cards and
  two song cards.
- **32 pictures** in `public/images/kids/`, one per letter, sliced from the
  three ChatGPT contact sheets and checked panel by panel against the letters
  in each sheet's filename. The sheets themselves moved to `Design/kids-art/`:
  they are 4 MB of source material and must not ship.
- **Registered** in `lessons.ts` with `order` 1–5 (song, letters, letters,
  letters, song) and `tracks: ['kids']`, and **draft** in `DEFAULT_CONFIG`.
- **`#/kids`** — the menu, grouped under Level 1–3 headings, reached by a door
  at the foot of the home page. The door only appears when there is something
  behind it, so a learner is never sent to an empty room. `orderedLessons()`
  takes a track; `HomePage` asks for `'adults'`. The `data-mode="kids"` skin is
  still to come — a kids lesson currently opens in the ordinary lesson page.

Verified in the browser: the door leads to `#/kids`, Level 1 lists all five in
reading order (song · letters · letters · letters · song), lesson 20 renders its
first card — بَاء · بَ · بُ · بِ · نَبۡ, badged *Lips* — and
`/images/kids/ب.png?v=v1` returns 200. No console errors.

**The gold stars stay.** The author looked at ج ح خ and decided the night sky
reads fine; the counting rule stands for anything new, but these are not
being redrawn.

**د/ذ and ر/ز were the wrong way round** in the first cut and the author
renamed the files. The principle in §5 was right — د stays up on the line, ر
dips below it — but the prompt described د as *resting on the sand*, which put
the low picture on the high letter. The mnemonic text now matches: د ذ are the
hooks hanging high on the line, ر ز the ones down on the sand.

### The recording unit is a take, not a form

`audioKey` strips every diacritic, so **بَ، بُ and بِ all reduce to `ب`** and
cannot be three files. They are **one take of three pieces**, exactly as lesson
3 records a row. Checked across the whole sheet: 98 distinct filename keys, 30
of them shared by more than one form, and every single one is a group that
*should* be one take. نَوۡ and نُو likewise become one two-piece take, which is
how you would say them anyway — leen, then madd.

So recording is **three passes over the sheet in the intake tool**, choosing a
different column each time:

| pass | column | expect | gives |
|---|---|---|---|
| 1 | Letter | 3 | `ب.wav` = بَ بُ بِ |
| 2 | Name (recorded) | 1 | `باء.wav` |
| 3 | + Sukoon | 1 | `نب.wav` |

plus the irregular rows in table 4 one at a time, and the two songs recorded
straight to `song-names.wav` and `song-sounds.wav`. **99 takes in all.**

`make-alphabet.mjs` prints the whole plan on every run, grouped by how many
pieces a take is cut into — because the intake system asks for that number and
getting it wrong is silent: the take is cut in the wrong places and the clips
are simply wrong. The shape of it:

| pieces | takes | which |
|---|---|---|
| **3** | 28 | the bare letters: `ب.wav` … `ي.wav` — each is بَ بُ بِ |
| **2** | 2 | `نو.wav` (نَوۡ نُو) and `ني.wav` (نَيۡ نِي) — leen, then madd |
| **1** | 67 | every name (`باء.wav`), every sukoon (`نب.wav`), and the ten words |
| whole | 2 | the two songs — never cut |

### The precache, again

Adding 32 pictures took the shell from 34 entries / 1.6 MB to **76 entries /
6.7 MB** — precisely the all-or-nothing install failure `CLAUDE.md` records.
Pictures now follow clips: out of `globPatterns`, into a runtime `CacheFirst`
cache (`iqra-images-v1`, 200 entries / 60 days), with **`IMAGE_VERSION`**
appended to every image URL for the same four-cache reason `AUDIO_VERSION`
exists — a redrawn picture keeps its filename. The shell came back to **40
entries / 1.07 MB**, smaller than before, because lesson 3's waveforms moved
out too.

## 4. Numbering

Lesson numbers 1–6 are spent on the adult lessons, and 7+ is where the adult
tajweed lessons continue (nūn sākin and tanween is next).

**The qaida takes the block 20–30**, with `order` 1–11 so it reads first in the
kids menu. Reserving a block keeps the two curricula legible in
`public/lessons/`, `public/audio/` and `calibrations/` at a glance.

Moving a lesson never changes its number. That is not negotiable here either.

---

## 5. Art direction

Decided by the author, 2026-09-06:

- **Objects and plants are the main figures.**
- **Animal silhouettes are fine, without faces.**
- **People appear seldom, and without faces.**

Generated outside this repo — the author uses ChatGPT's image model, which does
this better than anything available in-session. The prompt lives in §6 so every
letter comes out of one style.

Two constraints from the app itself:

- **The picture is art; the letter is type.** The real letter is always rendered
  beside the picture in Uthmanic Hafs. A generated shape must never be mistaken
  for the letter, and the font is never modified — the licence forbids it.
- **The precache shell is 1.6 MB / 34 entries on purpose** (see `CLAUDE.md`: a
  Workbox precache install is all-or-nothing, and a fat one is what made updates
  fail to arrive). Pictures must be small — target ≤40 KB each — and either kept
  out of the precache glob or counted deliberately into it.

### The object must BE the letter's shape

Learned by getting it wrong, 2026-09-06. Lessons 1 and 2 generated beautifully
and lesson 3 came back unusable, and the difference was not the model.

In lessons 1 and 2 every object *is* the letter's silhouette: the boat is ب's
bowl, the crescent is ج's curve, the hook is د's elbow, the snake's three humps
are س, the whale is ص's loop and tail, the net is ف's circle and handle. A child
looking at the picture is looking at the shape they have to recognise.

Lesson 3's mnemonics had drifted into **storytelling**. "A seagull perches on a
tadpole" says where the hamza sits and nothing about what ؤ looks like — so the
model drew a bird standing on a blob, and for ئ two birds on a duck, because the
instruction had no visual sense in it. "An oar leaning against a lighthouse" for
لا is two objects and no shape. The letter had gone missing from its own
mnemonic.

**The rule: if the sentence does not describe the letter's outline, it is not a
mnemonic.** A story about where a letter sits belongs in the card's words, where
the real font is already showing the answer.

That is why **أ، ؤ and ئ have no picture.** The hamza card carries one seagull
and the four seats are shown in Uthmanic Hafs — أ ؤ ئ ء — with the line doing the
work. The font draws a carrier better than any illustration, and a picture only
competed with it.

Two more repairs from the same review: **ن came back as a boat**, colliding with
ب — the one pair the picture had to keep apart, now an open clam shell; and
**لا is two oars crossed in a V**, one shape, of which the ل is one oar.

### Countable shapes are reserved for the dots

Also learned by shipping it: the first ج ح خ came back with six gold stars in the
night sky — above ح, whose whole instruction was *nothing above and nothing
below*. The seabed carried scattered gold pebbles under letters whose dot count
is the lesson. Anything small, round and repeated competes with the bubbles, and
the child cannot know which ones to count.

The style block therefore carries a **counting rule that overrides everything
else**: the only small repeated shapes in a picture are the bubbles the
instruction asks for, and they sit centred directly above or below the object,
never in a corner.

### One world: the seaside

Every base object belongs to one scene — a boat, a duck, a whale, a lighthouse,
a seagull. Two reasons, both practical. The set looks *designed* rather than
assembled, which is most of what makes children's material feel trustworthy; and
a shared world gives the dots somewhere natural to be, above or below.

### The dots are bubbles

**One object for every dot, above or below: a small bubble.** Bubbles rise
through water and float in air, so they sit naturally under a boat and over a
snake alike — which stars and seeds could not do. They are round, countable, and
they never become part of the scene's story.

Fallback if the images disagree: plain gold dots, drawn as dots.

### Shape families

Fifteen base drawings cover all 29 letters, because inside a family the dots are
the only difference. Cheaper art, and better teaching: the child learns the
family, then counts.

| family | letters | base object |
|---|---|---|
| boat | ب ت ث · ن | a small wooden boat on the water (ن a deeper bowl) |
| duck | ى / ي | a duck; the duck climbs **into** the boat for the joined form |
| crescent | ج ح خ | a crescent moon lying on its back over the sea |
| hook | د ذ · ر ز | a fishing hook — resting on the sand (د ذ), hanging below the line (ر ز) |
| snake | س ش | a sea snake with three humps |
| whale | ص ض | a whale: round body, long flat tail |
| whale + spout | ط ظ | the same whale, spouting water — the spout is the upright stroke |
| curl | ع غ | a curled frond in the shape of a backwards 3 |
| net | ف ق | a small fishing net: a round hoop with a handle (ق deeper) |
| deck chair | ك | a folding deck chair side on — a cushion sits in the angle, the letter's inner stroke |
| snorkel | ل | a tube curving at the bottom into a mouthpiece — the letter's hooked tail |
| crossed oars | لا | two oars crossed in a V. **Its own object on purpose**: لا is a mandatory ligature and one cluster in `graphemes.ts`, so it is a letter-shape, not two |
| buoy | م | a round buoy, one short rope straight down |
| half-shell | ن | a smooth round half-shell open like a bowl — a deep half-circle, never a fan |
| knot | ه · ة | a knot in a rope (ة the same knot, two bubbles above) |
| tadpole | و | a tadpole: round body, tail sweeping to the side |
| lighthouse | ا | a lighthouse, tall and straight |
| wave crest | ء | one curling wave crest — the hamza is a small curl that hooks over. **أ ؤ ئ get no picture** — the font shows the seats |

Choices that carry a confusion children actually make, and are chosen for it:

- **د rests on the sand, ر hangs below the line** — the same hook, two heights.
- **م's rope falls straight down, و's tail sweeps aside** — buoy against tadpole,
  two different objects so they can never be swapped.
- **ط is ص with a spout** — the upright stroke *is* the spout, so the shape
  difference is the picture difference.
- **ع is a backwards 3** — the author's own mnemonic, drawn rather than written.
  This is the one card where a numeral shape is deliberate; see §6.

---

## 6. The image prompt

Signed off 2026-09-06 and generated outside the repo. **35 images.** Paste the
style block once at the top of a chat, then the `IMAGE:` lines — best one lesson
at a time, so a family's variants are generated while its base is still in view.

Files are named by their Arabic letter, the way the audio folders already are,
and go in `app/public/images/kids/`.

### Style block

```
STYLE — keep this identical for every image in this set. All of them belong to
one picture book and must look like one artist drew them in one afternoon.

Flat vector illustration. Thick, even outlines. Simple childlike shapes. No
gradients, no shadows, no texture, no 3D, no photorealism.
Palette: deep green #14513A, gold #C1A054, warm off-white #FAF7F0, a soft sea
blue, and at most one further accent per picture.
Plain white background. One object, centred, generous margin around it.
Must stay readable when shrunk to 200x200 pixels — so few details, big shapes.

NO lettering, NO text, NO numerals, NO writing of any kind, in any language,
anywhere in the image.
NO faces — not on animals, not on people, not on objects.
Animals appear as plain silhouettes only. People appear rarely and faceless.
Objects and plants are preferred over living things.

The mood is warm, calm and respectful. These are for young children in a mosque
classroom.

Everything in this set lives by the sea. When bubbles are asked for, draw them
as small round pale-blue bubbles with a thin gold outline, clearly countable.

COUNTING RULE — this overrides everything else in the style:
The ONLY small round or repeated shapes anywhere in the picture are the bubbles
the instruction asks for. No stars, no scattered pebbles, no dots or speckles on
the sand, no clouds, no decorative marks of any kind. If the instruction asks
for no bubbles, the picture contains no small shapes at all.
Bubbles sit centred directly above or directly below the main object — never off
to one side, never in a corner.
Every picture is ONE object. Never two objects side by side.
```

### The images

**Lesson 1** — ب ت ث ج ح خ د ذ ر ز

```
ب.png   IMAGE: a small wooden boat with an upturned bow, floating on gentle
        water, with ONE bubble in the water directly below the boat.
ت.png   IMAGE: the same small wooden boat with an upturned bow on gentle water,
        with TWO bubbles floating in the air directly above the boat.
ث.png   IMAGE: the same small wooden boat with an upturned bow on gentle water,
        with THREE bubbles floating in the air directly above the boat.
ج.png   IMAGE: a crescent moon lying on its back above a calm night sea, with
        ONE bubble resting inside the curve of the crescent.
ح.png   IMAGE: the same crescent moon lying on its back above a calm night sea,
        completely plain — nothing above it and nothing below it.
خ.png   IMAGE: the same crescent moon lying on its back above a calm night sea,
        with ONE bubble floating above it.
د.png   IMAGE: a curved fishing hook resting on pale sand at the bottom of the
        sea.
ذ.png   IMAGE: the same curved fishing hook resting on pale sand at the bottom
        of the sea, with ONE bubble floating above it.
ر.png   IMAGE: the same curved fishing hook, but hanging from a thin fishing
        line high in open water, well above the sand.
ز.png   IMAGE: the same curved fishing hook hanging from a thin fishing line in
        open water, with ONE bubble floating above it.
```

**Lesson 2** — س ش ص ض ط ظ ع غ ف ق

```
س.png   IMAGE: a sea snake in plain silhouette, no face, its body making three
        rounded humps as it swims.
ش.png   IMAGE: the same three-humped sea snake in plain silhouette, no face,
        with THREE bubbles floating above it.
ص.png   IMAGE: a whale in plain silhouette, no face, with a round body and one
        long flat tail stretching out behind it.
ض.png   IMAGE: the same round-bodied whale in plain silhouette, no face, with
        ONE bubble floating above it.
ط.png   IMAGE: the same round-bodied whale in plain silhouette, no face, now
        spouting one straight jet of water upward from its back.
ظ.png   IMAGE: the same spouting whale in plain silhouette, no face, with ONE
        bubble floating above the spout.
ع.png   IMAGE: a curled green seaweed frond growing up from the seabed, coiled
        into the shape of a backwards number three. (Draw the curl as a plant —
        do not write a numeral.)
غ.png   IMAGE: the same backwards-three seaweed frond, with ONE bubble floating
        above it.
ف.png   IMAGE: a small fishing net — a round hoop with a short straight wooden
        handle — with ONE bubble floating above it.
ق.png   IMAGE: the same fishing net, but with a deeper hoop hanging lower, and
        TWO bubbles floating above it.
```

**Lesson 3** — ك ل م ن ه ة · ء · و ى ي ا لا · **twelve images, revised
2026-09-06** after the first attempt came back unusable (see §5).

Five of these were re-written a second time (2026-09-06). The first pass gave ك
a **symmetric** anchor for an asymmetric letter, ل a symmetric oar blade where
the letter hooks, ن a **fan-shaped** scallop where the letter is a round bowl,
and ء the leftover seagull from the perching story — a fine drawing with no
shape in it. م's idea was right and its picture was busy: the waterline cut the
buoy in half and a long twisted rope stood in for a short tail.

```
ك.png   IMAGE: one folding wooden deck chair seen from the side, its back
        leaning up and its seat reaching forward, with one small cushion resting
        in the angle where the back meets the seat. Plain background.
ل.png   IMAGE: one snorkel standing upright — a long straight tube that curves
        at the bottom into a mouthpiece pointing to one side. Plain background.
م.png   IMAGE: one round buoy alone, with a single short straight rope hanging
        directly beneath it. No water, no waterline, no other objects.
ن.png   IMAGE: one smooth round half-shell lying open on the sand like a little
        bowl — a deep half-circle, wide and rounded, with no ribs and no fan
        shape — with ONE bubble centred directly above it.
ه.png   IMAGE: one knot tied in a thick golden rope, lying flat.
ة.png   IMAGE: the same knot tied in a thick golden rope, with TWO bubbles
        centred directly above it.
ء.png   IMAGE: one single wave crest curling over at the top, drawn large and
        alone on a plain background. No sea behind it, no other waves.
و.png   IMAGE: one tadpole in plain dark silhouette, no face, with a round body
        and a single tail sweeping down and to one side.
ى.png   IMAGE: one duck in plain dark silhouette, no face, floating calmly on
        the water, seen from the side.
ي.png   IMAGE: the same duck in plain dark silhouette, no face, sitting inside a
        small wooden boat on calm water, with TWO bubbles in the water centred
        directly below the boat. Nothing else in the picture.
ا.png   IMAGE: a tall white lighthouse standing on rocks by the sea.
لا.png  IMAGE: two wooden oars crossed in a wide V, their blades at the bottom
        where they meet.
```

The seagull and the anchor are retired — good drawings attached to the wrong
letters. **Watch م against و** when the batch returns: both are now a round body
with one tail, which is honest, because the two letters differ only in where the
tail goes. If the buoy and the tadpole read as one creature, م moves object.

**Lesson 1, three re-does** — the first ج ح خ carried gold stars in the sky:

```
ج.png   IMAGE: a gold crescent moon lying on its back in a plain dark green
        night sky above a calm sea, with ONE bubble resting inside the curve of
        the crescent. The sky is completely empty — no stars, no clouds.
ح.png   IMAGE: the same gold crescent moon in a plain dark green night sky above
        a calm sea, entirely alone — no stars, no bubbles, nothing above it and
        nothing below it.
خ.png   IMAGE: the same gold crescent moon in a plain dark green night sky above
        a calm sea, with ONE bubble centred directly above it. No stars anywhere.
```

### If the art proves fiddly

Generate only the **15 base objects** and let the app draw the bubbles as SVG
overlays. Dot placement is then exactly right every time, and there are 15
images to art-direct instead of 35.

---

## 6b. The mascot — proposed 2026-09-06, not yet chosen

A character for IQRA Kids, with speech bubbles: asks the drill question, gives
the section hint in one line, celebrates the end of a sitting.

**One hard rule whichever is chosen: the mascot is silent and still while audio
plays.** The whole app is watching letters light up; a character animating over
that would wreck the one thing this does better than a book. It speaks between
words, never during one.

The author's own idea was the alif, since the app's mark is the hamzat wasl. Three
reasons to keep the shape but not the letter: the mark is a **silent** alif, an
odd spokesman for a reading app; the alif is taught **last** here, so children
would meet the mascot months before the letter; and the alif's mnemonic is
already the lighthouse, which would give the world two alif-things.

- **A — Manāra, the lighthouse.** Already the alif's picture, so it is in the
  seaside world; tall and vertical, so it echoes the brand silhouette without
  being a letter; and a lighthouse *guides*, which sits with «ٱقۡرَأۡ وَٱرۡتَقِ» in
  the logo. **It has a light instead of a face** — the lamp glows to encourage,
  dims while the child thinks, and its beam can point at the card, a laser
  pointer for children beside the one teachers already have. The no-faces problem
  disappears: a beacon does not need one.
- **B — Manāra with the wasl's ص as its lamp.** A and the author's idea fused:
  the logo standing up as a character. Strongest brand tie; a branding decision
  that is the author's, since the mark is his own design.
- **C — the seagull**, retired from ء. Birds perch and carry speech bubbles, and
  children bond with animals faster than with buildings. Against it: a faceless
  silhouette bird is hard to make expressive, and it says nothing about the app.

**Chosen 2026-09-06: A, the lighthouse.** Named **Manāra**. Its prompt, in the
same style block as the letters:

```
IMAGE: a tall friendly lighthouse standing on a small rock, drawn as one
character rather than a building — a white tower with three wide gold bands, a
gold lamp room at the top, and a warm gold glow coming from the lamp out to one
side. No face, no eyes, no mouth: the lamp is how it expresses itself. Rounded,
soft, slightly stout so it reads as friendly rather than grand. Centred, plain
white background.
```

Four more in the same wording, so the set matches — the states the app needs:

```
IMAGE: the same lighthouse, its lamp glowing bright and warm, a wide beam of
soft gold light sweeping out to one side.          → pointing at a card
IMAGE: the same lighthouse, its lamp dim and pale, no beam.
                                                   → waiting while a child thinks
IMAGE: the same lighthouse, its lamp glowing bright, with small gold sparkles
rising around the top of the tower.                → the end of a sitting
IMAGE: the same lighthouse seen from the waist up, closer, its lamp lit —
cropped so it can sit beside a speech bubble.      → asking a question
```

## 6c. Quizzes — flagged, not designed

One at the end of each level, eventually. **The machinery exists**: `quizSize`,
`quizHint` and the mixed-review pages `SectionedLesson` already builds for
lesson 2. The natural form is the Maktab assessment's Part A — hear it, point to
it — which would let the app rehearse the instrument being piloted on paper.

## 7. Open questions

The mnemonics are signed off and the images are being generated. What is open is
in the drafted sheet, and all of it is the author's call:

1. **Which mascot** — A, B or C in §6b. The prompt follows the choice.
2. **How is the yaa written in the two songs?** The canonical alphabet ends with
   ي, conventionally shown isolated — the one shape the author has ruled out as
   not existing in the Mushaf. The sheet writes it **يـ**, joined forward,
   consistent with that rule. Confirm.
3. **The names are written with the madd sign** — بَآء, not بَاء — because an
   alif running into a hamza inside one word is madd muttasil, held four. Correct,
   and possibly more than a five-year-old needs on the card.
3. **نَنۡ for ن.** Every other letter's sukoon form is نَ + letter, so ن's is two
   nuns. It is a real syllable and the pattern stays regular; the alternative is
   breaking the pattern for one row (بَنۡ).
4. **نَرۡ is heavy** — a sākin ر after fatha is mufakhkham. Nothing is being
   taught there, the child simply copies the teacher, but tafkheem is not met
   properly until L6.
5. **The hamza's four rows.** Seat one is أَ أُ إِ نَأۡ; the other three seats are
   shown inside one short real word each — مُؤۡمِن، سُئِلَ، جُزۡء — because which
   seat a hamza takes is a vowel rule, not something to drill in isolation. Are
   those the right three words for this age?
6. **ة's words** — رَحۡمَةَ، نِعۡمَةَ. Both real and short; both stop on a fatha
   so the ة is heard as a t.
7. **Which cards carry the spell-out line** in L4–L5 — the author said sparingly,
   mostly early.

**Resolved, iteration 4 (2026-09-06)** — the letter names *are* recorded, so the
Name column is a form; the three-Quranic-words-per-letter section is **dropped**,
and with it the word pictures; two songs rather than one, names first and sounds
after lessons 1–3, both with a pause button; the makhraj is a moving readout in
song 2, never a grouping, drawn as one SVG of a faceless child's profile; the
verified Quran text is deferred to lesson 4.

**Resolved, iteration 2** — haraka order (fatha, damma, kasra); letter order; لا
and ة closing L3; L11 as free practice in real Quranic words; the spell-out line
in standalone forms, used sparingly; the seaside world; bubbles for dots; snakes
for س ش; the backwards 3 for ع غ; the duck for ى.

**Resolved, iteration 3** — the anchor for ك; the spell-out letters light up in
sync with the joined word; they are written **bare** (ل م س), since the joined
word below already carries the harakat; ي is only ever shown connected (يـ);
every letter gets its tanween in L9 except ا and ى; the sitting, not the card
count, is the unit of design.

**Dropped after the author's review** — the oil lamp (ص ض), the ladle (و),
stars-above-and-seeds-below, the key (ك).

---

## 8. Recording load, roughly

Using the intake tool, and keeping every take to **three pieces or fewer** —
that is the only split depth `check-take-parity.mjs` proves.

| | clips | takes |
|---|---|---|
| L1–L3 | 29 × 4 = 116 | ~58 (three harakat as one take, the sukoon as another) |
| L4–L5 | 29 × 3 = 87 | ~29 |
| L6 | 30 | 15 pairs |
| L7 | 15 | ~5 |
| L8 | 30 | 15 pairs |
| L9 | 15 × 4 = 60 | ~30 |
| L10 | 15 | ~5 |
| L11 | 15 | ~5 |
| | | **≈160 takes** |

Spread over a few sessions. `AUDIO_VERSION` in `vite.config.ts` is bumped each
time clips are re-cut — see `CLAUDE.md` on the four caches between a re-cut clip
and the ear.

---

## 9. Source

The author's guide is *معلم القراءة العربية مع القاعدة البغدادية* (PDF, 202
pages, on the author's D: drive — a scan with no text layer, and no PDF renderer
is installed on the build machine, so it can only be read as screenshots the
author sends).

**It is a guide, not a source to copy.** Every word, pair and mock word in these
lessons is written fresh. The book's own examples also run long — its tanween
page uses قَرِيبٌ، مُقِيتٌ، نَصِيرٌ, which are too much for a five-year-old
meeting tanween for the first time. Build on what the child has already learned;
do not pile it on.

---

## 9b. Iteration 5 — the author's review of the first drafts, 2026-09-06

Seven corrections after seeing lessons 20, 22 and 31 on screen. Each is a
design decision, not a bug, so they are recorded here before the build.

**The door goes to the top of the home page** — large, Manāra on the left,
"IQRA Kids" as a title, nothing about it shaped like a lesson card. Kids
lessons open at **`#/kids/lesson/N`**, not `#/lesson/N`: the breadcrumb then
reads *← IQRA Kids* and goes to `#/kids`, the brand logo still goes to the main
home, and the route is what switches the skin on. Same number, same clips.

**A song is a succession of cards, never a line.** `playWithHighlights`
already reports the active letter every frame; a `SongCards` component takes
that one number and derives the rest — the card is the *shape family* holding
the active letter (17 cards for song 1), the sung letter is green as in every
other lesson, and the family's picture stays beside it. Song 2 is the same
component grouped by *letter* — 28 cards of three forms, the makhraj head
beside them with that letter's place lit.

- Colouring one sister apart from the others is safe: the letters on a song
  card are **standalone** and do not join, so the never-split-a-word rule —
  which protects joining — is not touched. Each letter is its own span.
- Animation is two CSS transitions: the sung letter's colour (150 ms), and a
  crossfade when the card changes (250 ms). No library, no keyframes.
- **Pause is the one engine change** — `pause()`/`resume()` on the handle —
  and `seek()` goes in with it so Back/Next on a song jump to a family.
- **Automatic timings are meaningless for a song.** The cards turn at the right
  moments only after the song is calibrated by tapping along. For words,
  calibration is a refinement; for the songs it is the whole timing.

**The letter card is picture left, big bare letter right, four small cards
below, the name small in a corner** — a new `LetterCard` for the kids skin.
`ItemCard` and its waveform button stay with the adult lessons and never
appear here. The special rows of lesson 22 degrade on their own: one word,
one small card; و and يـ, five.

**No makhraj badges on a letter card.** The field stays in the data for song
2; nothing renders it here.

**Two spoken recordings per letter**, in the teacher's voice: an English
*intro* ("This is the letter baa. It looks like a boat…") and a *forms line*
("With a fatha it's بَ…") recorded whole and played whole, its Arabic lighting
as each form is said. The script for all 35 rows is the sheet's **seventh
table**. The slot cell names the file the way lesson 6's `<word> وقف` does —
**`ب مقدمة`**, **`ب حركات`** — so nothing is typed. 70 more takes.

- The forms line's highlight text is just its Arabic (`بَ بُ بِ نَبۡ`, four
  steps), calibrated at the four moments they are said; the English between is
  time. A letter therefore stays lit until the next begins. If that reads
  wrongly, the ghunna-phase mechanism — a per-letter *fraction* — gives a
  "lit, then dark" phase in ten lines. Try the simple version first.

**Manāra does not speak.** The author felt a talking minaret would look odd,
and she was designed not to. The voice is the teacher's; **Manāra points** —
her beam swings to the picture at "it looks like a boat" and to the letter at
"baa has one dot". That is what `manara-beam` was drawn for.

**Build order, agreed:** all of the above in one pass — the door and the
route, `LetterCard`, `SongCards` with pause and seek, badges off, the generator
reading the script table — and then the author calibrates the two songs.

### Built — iteration 5, 2026-09-06

All of it, verified in the browser with the lessons temporarily published:

- **The door** is the first thing on the home page: Manāra, "IQRA Kids", a
  subtitle, nothing card-shaped. `#/kids/lesson/N` opens the kids skin
  (`data-mode="kids"` on `<html>`), the breadcrumb reads *← IQRA Kids* and
  leads to `#/kids`; the brand logo still leads home.
- **`LetterCard`** — picture · Manāra · big bare letter in brand gold, the
  sounds as small cards beneath (right-to-left: a, u, i, sukoon), the name
  small in the corner, two buttons: *About this letter*, *Say it*. No
  badges. The adult `ItemCard` and its waveform button are untouched and
  never appear here. `SectionedLesson` takes a `Card` prop, so paging, the
  remembered place and the single-key walk are not written twice; the walk
  now runs intro → forms line → each sound.
- **`SongCards`** — one family per card in song 1 (17 cards), one letter's
  three harakat per card in song 2 (28 cards, the makhraj picture beside),
  the sung letter green, each letter its own span. Back · Play/Pause · Next;
  Space and the arrow keys. Next mid-song seeks the audio to that card.
- **The engine** grew `pause()`, `resume()` and `seek()` on
  `PlaybackHandle`, and `play(startAt)`. Nothing else in it changed.
- **Manāra points.** During the intro her beam is mirrored to point left at
  the picture; during the forms line it points right at the sounds. The
  tower is symmetrical enough that the mirror is invisible — so the beam
  moves and she stays, which is what a lighthouse does.
- **The forms line lights whole sound-cards.** It highlights *letters*
  (نَبۡ is two clusters), so `LetterCard` maps each cluster to the form it
  belongs to by counting clusters form by form.

**The generating script is retired.** `make-sheet.mjs` bootstrapped the
docx; the author now edits it in Word, and it is the source of truth the way
every other sheet is. It was regenerated one last time with the author's two
edits folded in (meem's rope, the nabra) after a cell-by-cell diff showed
those were the only changes.

**Corrections from the author's review, in the sheet now:** no pictures in
either song (song 1 is the letters themselves grouped by shape; song 2 is
the makhraj head); the name is displayed, not recorded — the intro says it,
song 1 sings it, and 31 takes went away; the yaa runs **ى (the duck) → يـ
(the duck jumps into the boat) → ىٰ (an alif in disguise, مُوسَىٰ)**, a third
row with its own slot `ى ألف`; ة opens with ءَاخِرَةِ, the standalone
shape, then رَحۡمَةَ as "sometimes looks like this".

### What still needs the author — and when the generator will say so

`make-alphabet.mjs` now prints two things on every run, so nothing here has
to be remembered:

1. **The recording plan** — every take grouped by how many pieces the intake
   system must cut it into. 140 takes: **28 of three** (the bare letters),
   **2 of two** (`نو`, `ني`), **38 whole** (the 36 spoken lines and the 2
   songs — set the intake tool to 1 and it only trims the silence), and **72
   of one** (every sukoon and every word).
2. **What needs tap calibration**, listed only once it is recorded: the two
   songs and the 36 forms lines. A forms line's taps are per *letter* of its
   Arabic — `بَ بُ بِ نَبۡ` is five taps, not four.

The makhraj pictures are the one asset outstanding: `makhraj-lips.png`,
`makhraj-tongue.png`, `makhraj-throat.png` are what song 2 asks for (jawf and
nose never occur in it).

## 9c. The makhraj pictures — prompt

The author chose ChatGPT images over a hand-traced SVG. Six pictures of **one
identical head**: a base with nothing lit, then one per place. The whole
difficulty is consistency, so the prompt insists on it, and the counting rule
applies — nothing coloured except the one region.

```
STYLE — identical for all six images. They are six frames of ONE drawing:
the head must not change in any way between them; only the coloured region
does.

A young child's head in side profile, facing left, drawn as a simple flat
vector cutaway — thick even outlines, no gradients, no shadows, no texture.
NO face: no eye, no eyebrow, no ear detail, no hair detail — just the smooth
outline of the head and neck, in warm off-white #FAF7F0 with a deep green
#14513A outline. Inside the head, the mouth and throat are shown as a simple
cutaway: the lips at the front, the tongue as one soft shape, the teeth as a
plain row, the throat as a passage going down into the neck, the nasal
passage above the mouth, and the open space of the mouth and throat together.
Everything inside is drawn in thin deep-green outline only, uncoloured, so it
reads as a diagram a five-year-old can look at without being alarmed.
Plain white background. Centred, generous margin, readable at 200x200 px.
NO lettering, NO text, NO arrows, NO labels, NO numerals of any kind.

IMAGE 1  makhraj.png            nothing coloured — the plain cutaway.
IMAGE 2  makhraj-lips.png       the same drawing, with ONLY the lips filled in
                                soft gold #C1A054.
IMAGE 3  makhraj-tongue.png     the same drawing, with ONLY the tongue filled
                                in soft gold #C1A054.
IMAGE 4  makhraj-throat.png     the same drawing, with ONLY the throat passage
                                filled in soft gold #C1A054.
IMAGE 5  makhraj-jawf.png       the same drawing, with ONLY the open space of
                                the mouth and throat together filled in a very
                                pale gold, so it reads as empty air.
IMAGE 6  makhraj-nose.png       the same drawing, with ONLY the nasal passage
                                filled in soft gold #C1A054.
```

Ask for all six in one conversation, and ask for image 1 first — then every
later one is "the same drawing, with only X filled". If any frame drifts,
regenerate that frame alone with image 1 attached as the reference.

## 10. Manāra, cut and in use — 2026-09-06

Five states, cut from one ChatGPT sheet that carried its own filenames printed
under each figure. The cut is by **content band**, not by grid: the sheet is
three across the top and two across the bottom, and the label lines are found
and discarded by being short (27 px) where the artwork is tall (423–450 px).

`manara.png` · `manara-beam.png` · `manara-dim.png` · `manara-well-done.png` ·
`manara-close.png` — 31–50 KB each, in `public/images/kids/`. The sheet went to
`Design/kids-art/` with the letter sheets: source material must not ship.

She greets on `#/kids` today. The rule she is built to, and which the beam
state exists to serve, stays: **silent and still while anything is playing.**

---

## 11. Iteration 6 — the author's second review, 2026-10-10

Thirteen points after seeing the first skin on screen, and the workbooks
beside it. All built; nothing recorded yet.

**Songs flow — a strip, not cards and not a video.** All the letters on one
long strip, right to left; it glides so the sung letter is at the center
(`transform` eased 350 ms), neighbors visible either side, the sung letter in
the green box. The strip moves *when the singer moves* — a song is not
metronomic. Sisters sit together with a wider gap and a change of color; no
card edge, no click. Back/Next and ← → glide to the previous or next family
and seek the song there. A video was refused: a second copy of the content,
re-rendered on every retake, no pause on a letter, no use of the calibration.
The centering is measured from rectangles with the strip's *current*
translation taken back out, so it is right mid-glide and whatever RTL does to
`offsetLeft` — the first attempt used offsets and sent ب the wrong way.

**Color by shape family, the same everywhere.** Seven kid-friendly colors
(`--fam-0..6`, light and dark variants) cycled over the seventeen families, so
neighbors never match; the family index comes from song 1's own grouping in
the sheet and is written into every card and step by the generator. The big
letter on a card, the strip, the places page — one color per letter. The green
box keeps its one meaning. Not random (a child should meet ب in the same color
every time), not per letter (28 is no palette), not by makhraj (18 letters one
color).

**One recording per letter card.** The sheet's seventh table is one row per
letter now — merged in place in `document.xml` with the repo's docx writer,
every row reported, tag balance checked, the author's two Word edits carried
(meem's rope, the nabra), "fatha" → "fat-ha" in the scripts. The slot is the
bare letter (`ب`, `هـ`→`ه`; the dagger-alif row keeps `ى ألف`), so the file is
`ب.wav` and nothing else is recorded for that letter: **36 letters + 2 songs =
38 takes, every one a single piece.** The card has ONE Play button. Its
Arabic (the forms) is the highlight text; while the recording is still about
the picture — before the first tapped Arabic onset — the picture glows; then
each sound card lights as it is said. Tapping a sound card starts the
recording from that sound (`play({ cluster })`). The separate three-piece
harakat takes and the sukoon takes are gone.

**Manāra is off the letter cards.** The ا card would have shown two
lighthouses; the author found her confusing beside the mnemonic. She greets on
`#/kids` and will return for quiz prompts.

**One lesson, four sections.** Lessons 21 and 22 deleted — the same letters
split in three on the day-one plan; a *section* is the sitting, and
`SectionedLesson` already pages by section and remembers the place. Nothing
had been recorded or calibrated against the two numbers, so they went back
unspent.

**Lesson 33, "Where the Letters Come From".** The workbook's own page
(Level 3 §5): Mouth space · Throat · Tongue · Lips · Nose, one card each — the
head with that place lit (pictures still to come, §9c) and the letters of that
place in their family colors. A diagram, not a drill: no recording. The sounds
song lost its makhraj picture and its "where in the mouth" line.

**Wording.** "Fat-ha · Damma · Kasra · Sukoon" under the sound cards and in
every hint and blurb, as the workbooks spell them; never "a, u, i"; no
"intro". The kids home line is just "The Arabic letters, from the very
beginning." The notes palette says fat-ha too.

**Pictures re-cut inside the frame.** The first cut kept each ChatGPT panel's
rounded frame line and white margin. `recrop.mjs` walks in from each edge past
the white to the first ink — the frame — then a fixed 7 px further (fixed,
because the crescent panels' night sky is as dark as the frame and a
"while dark" walk would never stop). Checked on a montage of all 32.

**The workbook ↔ app crosswalk.** See `CLAUDE.md` §5 for the mechanism and the
gated reminder (QR + "In the app" line in the next workbook edition, when the
app is complete). The mapping as declared: L1 §1–3 ⇄ 31, 20, 32 · L2 §5 ⇄ 3 ·
L2 §6 ⇄ 5, 6 · L3 §1 ⇄ 6 · L3 §2 ⇄ 2 · L3 §3–4 ⇄ 4 · L3 §5 ⇄ 33, 3 · L3 §6–7 ⇄ 7.
The workbook's harakat page already runs Fat-ha · Damma · Kasra · Sukoon in
the card's order, and its makhraj page is the five places lesson 33 shows —
the two were designed apart and agree.

**Verified** (dev server on 5174, the pane's transitions frozen as ever, so
by measurement): the card shows picture · ب in family orange · four labeled
sound cards · one Play · no mascot · three workbook lines; the strip has 28
letters, 7 colors, 16 group gaps, and lands each family at center; lesson 33
shows "Mouth space الجوف · ا و ى"; `#/lesson/2` shows "See workbook Level 3,
page 5 … Section 2, Lam Shamsiyya" linking to `…level-3.pdf#page=7`; no
console errors. A React instance reuse between the two songs carried the
first song's place into the second — fixed by keying on the lesson.

---

## 12. One curriculum — the door comes down, 2026-10-11

The author's decision, after the workbooks and the app were set side by
side: **IQRA Kids is not a separate door. It is Level 1 of the one
curriculum, for everyone.** The lighthouse and the two songs stay; adults
learn alphabets by song too, and what an adult would not forgive — a mascot
on a lesson card — was already off the cards.

What changed in the app, the same day:

- `LessonMeta.level` (1–3, the practice workbooks' own Levels) replaces
  `tracks` and `kidsLevel`. The home page is one list under three Level
  headings; Manāra greets from the Level 1 heading, where the door stood.
  Lessons 1, 5, 6 sit in Level 2 and 2, 3, 4, 7 in Level 3, placed by the
  workbook sections the crosswalk maps them to.
- A `letters` lesson is drawn as letter cards, a song as its strip and the
  places page as its diagrams **by the lesson's kind** (`LettersLesson`),
  wherever it is opened. `#/kids` and `#/kids/lesson/N` redirect to `#/` and
  `#/lesson/N`; `data-mode="kids"` is gone, and with it the one thing it did
  — hide the playback-speed buttons.
- The name "IQRA Kids" survives only in this file's title, in history, and
  in the `images/kids/` folder, which is an asset path and not a word a
  learner reads.

What this record loses: **§2's own order (L4–L11) is retired.** The Level 1
and Level 2 lessons will follow the workbook's order — tanween, natural madd,
shadda; then pairs, three-letter words, timing, four-letter words, hamza,
madd, qalqala — selected from the workbook's own tables, so that a child
hears in the app the word they traced on paper. The sitting rule stands: a
lesson is 8–15 cards, and a workbook section (up to 475 items) is never a
lesson. Numbers 21–30 are still the block for them. Everything else here —
the mnemonics, the shape families, one recording per letter, the strip, the
38 takes still to record — is unchanged and still the authority.

§1's law gains its fourth hat: a lesson's **level** is a heading, never an
identity. Moving a lesson between levels changes one number in `lessons.ts`
and nothing else.

---

## 13. Iteration 7 — the author's review of lesson 20 and the song, 2026-10-24

Thirteen points after seeing the letter cards, the tanween lesson and the
names song on screen. The clear ones are built (verified in the pane, not
yet committed); the suggestions wait for him at the end.

**The sheet was edited, not the generator.** `Word Tables/الحروف
الهجائية.docx` is the source the intake tool reads for its slots, so a card
deleted only in the generator would still be offered for recording. The
edit was done on `word/document.xml` inside the zip with the repo's docx
writer (`Workbooks/build/docx.mjs`), every changed cell and deleted row
printed, tag balance checked (7 tables, 127 rows, 693 cells after) — table
4 (the special letters), table 5 (song 1's first letter), table 7 (what
the teacher says). Git holds the before and after; the one-off script was
not kept.

- **The hamza is the plain ء, flat on the line**, with the workbook's own
  forms ءَ ءُ ءِ نَأۡ (Level 1, page 12). The three seat cards — ؤ (مُؤۡمِن),
  ئ (سُئِلَ), ء (جُزۡء) — are gone: *"I don't think this is the right place
  to show the forms of the hamza. These kids are just learning the
  alphabet."* The seats wait for the hamza lesson in Level 2 (28).
- **و keeps fat-ha, damma, kasra, sukoon** — the madd form نُو went
  ("madd coming later"). The same for the yaa's نِي.
- **ى and يـ are one card.** The letter is ى (the duck); the forms are
  ىَ ىُ ىِ نَىۡ — DOTLESS, codepoint for codepoint the workbook's page 12
  (the sheet had يَـ يُـ يِـ, the joined dotted form, and the author:
  *"The ى in the Quran has no dots below. Fix."*); فِى is gone. The shape
  change is taught by a FLIP: a prompt under the duck ("Tap me to see how I
  change shape at the beginning of a word") turns the card on its vertical
  axis to يـ with the duck in the boat, two bubbles below, and "Show
  original form" turns it back; a tip line under the sounds says it in
  words. ىٰ (مُوسَىٰ) is still its own card, pending the suggestion below.
- **ا has بَا تَا ثَا** (labelled Madd) in place of نَا, and the tip: *Alif
  comes after a letter with a fat-ha and makes that fat-ha longer. That is
  why it is called a letter of madd — madd means to make longer.* The
  author offered to hear a better idea first; none was built.
- **The card's number is its place in its section** — every card read "1"
  because the number was the card's place on a one-card screen.
- **Pictures ك ل م ن ه ة ء و ى ي ا لا re-cut** inside their frames: the
  first cut left a frame edge on م ه ء و and cut the duck's head, the
  tadpole's tail and the lighthouse's top. The panels on the ChatGPT sheet
  are not on a uniform grid (panel 4's frame starts 17 px before its
  quarter, 6 px from panel 3's), so the frame is found as the thin run of
  frame color nearest each cell boundary, the object's box is measured
  inside it, and a square around the object is kept inside the frame —
  never padded (a pad put white under the water of the duck and the
  lighthouse). `IMAGE_VERSION` is v2.
- **Lesson 21 pages by the workbook's page**: four letters a screen, in
  four columns (`.pair-grid.cols-4`; two by two on a phone). Three per
  screen had given ب ت ث | ج | ح خ د | ذ. Lessons 22 and 23 follow.
- **The names song opens on the plain ا**, and **the strip flows by
  itself** — see `CLAUDE.md` §3 "The song strip flows by itself": the
  family being sung centered and bright, the others dimmed, a glide to the
  next family ending as its first letter is sung, Play/Pause only, a tap on
  a letter to start there. *"I am supposed to sing this alphabet song as a
  whole. The letter sliding should be AUTOMATIC as I sing."*

**32 letter cards, 34 takes** (the two songs included) — the recording
plan in `CLAUDE.md` §5 counts them.

**Suggested, not built — the author to decide:**

1. **A home for ىٰ, ة and لا.** They are not letters a child meets in the
   alphabet but shapes a reader meets in words: the alif written as a yaa
   (مُوسَىٰ), the taa marbuta (رَحۡمَةَ), the laam-alif ligature (وَلَا).
   Proposal: **lesson 30, "Different Letter Forms", Level 2, right after
   Hamza (28)**, in the workbook's order where it has them (Level 2's
   hamza section already carries ءَارَ-style rows; Level 3 §4 "Silent
   Alif" has the ىٰ words) and a short authored sheet where it does not —
   one card per shape, three words each from the Mushaf, verified against
   the corpus like lesson 7. Until then the three stay at the end of lesson
   20's last section, where a teacher can skip them.
2. **The dimmed neighbors on the strip** are at 0.22 opacity so the eye
   sees the next family arriving; hiding them outright is one number.
3. **Tap-to-start on the strip** replaced Next as the only way to begin
   mid-song; it can go if a child's stray tap is a problem in class.

### The evening round, 2026-10-24 — order, recording, tracing

**Order.** The author: *"هـ then و then ى, then ا."* The hamza row moved
after the alif in the sheet (tables 4 and 7), so the last section is
و ى ا ء — the author did not place the hamza; after the alif is the
reading taken, flagged for him. **ىٰ، لا and ة left lesson 20** for a
lesson he will design later. Their rows, kept here as its seed:

| letter | name | forms | mnemonic | note |
|---|---|---|---|---|
| ىٰ | — | مُوسَىٰ | A duck | An alif in disguise — the dagger alif on top says so. Script: *Here is the duck again. But this time it is not a yaa at all — it is an alif in disguise! You can tell by the little alif sitting on top. Listen: مُوسَىٰ.* |
| لا | لَام أَلِف | لَا · وَلَا | Two oars crossed in a V | Two letters written as one shape. Script: *This is laam and alif holding hands. It looks like two oars crossed. Two letters, one shape. We read it لَا. And in a word — وَلَا.* |
| ة | تَاء مَرۡبُوطَة | ءَاخِرَةِ · رَحۡمَةَ | The knot with two bubbles above it | A taa wearing the haa's shape. Script: *This is the taa marbuta — a taa wearing the haa's shape. It looks like the knot with two bubbles above it. Taa marbuta has two dots on top. Listen: ءَاخِرَةِ. Taa marbuta sometimes looks like this — رَحۡمَةَ.* |

**Recording, from one sheet.** The author asked for the lesson-20 script
"ready for the audio intake system", the song likewise, and a recording of
each letter's name for the tracing cards. All three are tables of the one
sheet now (7, 8, 9), and the intake tool learned to read a sheet table by
table and to take a "Slot" column as the file names, with the rest of the
row as the prompt on screen while recording. `CLAUDE.md` §5 has the steps.

**Lesson 30 — Tracing the Letters.** *"ONE lesson for writing practice on a
screen with a finger (or a pen — but has to accept finger strokes)… One
letter per screen. The screen DRAWS the letter live with the correct stroke
form, the student is asked to write over it… a correct click sound when the
tracing is accurate. An error sound when not with a message which says try
again… a recording for the name of the letter… The lighthouse then asks the
student to trace the letter… I don't want an error message when it's only
incomplete… I want it clean, professional."* Built as designed in
`CLAUDE.md` §3 ("Tracing"): the strokes are the font's own glyph thinned
and walked through authored waypoints; the rule is geometry (a band, a
short lookahead, progress that only advances), with no clock; incomplete
is never wrong, only leaving the line is. The lighthouse asks with her beam
on the board and is pleased with `manara-well-done.png`. The sounds are
synthesized. What the author should feel for on the iPad: the band (0.11 of
the board) and the lookahead (one band) — both in `tolerances()`; and the
glide of the demonstration (0.55–1.7 s a stroke).

Not built, on purpose: no per-letter record of what was traced (the roster
seat question, §3 "Not built"); no pencil-only mode; no free writing without
the guide.

### 2026-10-25 — the author's check of the tracing, and the spoken script

**The tracing.** *"This is not how Arabic letters are written. Wrong for
ع غ ف ق ص ض ج ح خ and several others… the tracing guide has to cover the
whole grey area… I suppose you can have me trace them and use my strokes
as the template if we really need to."* Both were done. The letter is now
painted along the stroke (the colored glyph shown through a mask of what
has been traced, with a brush wider than the glyph's stroke), so the
color covers the grey exactly, to the tips. The writing orders were
rewritten from handwriting practice — ج ح خ: along the head right to left,
then down the left side into the bowl and round to the end; س ش: from the
top of the first tooth, the teeth, the bowl; ص ض: the loop from its right
end, over the top, round the left, back along the bottom; then the bowl
from the loop's left; ط ظ: the loop, then the stem from the top; ع غ: the
head from its right end over the top, round and back to the waist, then
the bowl; ف: over the loop and down its left side into the body (an open
loop); ق: the loop closed, then the bowl from its right; ك: top down, then
the base to the left, then the sign; م: over the head and down the tail;
هـ: the loop, then the bar; و: the loop closed, then the tail; ى: the hook,
the tooth, the bowl, in one pass ending at the right; ء: the crescent,
then the base to the right — and the teacher can replace any of them with
his own hand: "Teach the strokes" on the card (admin), draw, Save; every
device traces his strokes from then on. **His hand is the source; the
font's are the stand-in.** Two more rules in the engine: a stroke's turning
points are checkpoints (no straight line across ت's mouth or along س's
teeth), and a dot's radius is half the way to its neighbor.

**The spoken script** for lesson 20 follows the author's template — *This
is the letter baa. It looks like a boat with one bubble below it. It
sounds like the English letter b. With a fat-ha it sounds like baa, with a
damma boo, with a kasra bee. Now your turn. Say it.* — for all 29 letters,
in table 7 of the sheet, with an English likeness where there is a fair one
(ث the beginning of *three*, ذ the th of *this*, ط a heavy t close to
*tart*, خ clearing the throat, غ gargling, ء the catch in *uh-oh*), "no
letter like it in English" for ح ع ض ق, and alif's line about madd. One
sentence the template did not have was kept, because the card still shows
the form: *With a sukoon after نَ it is nab (نَبۡ)* — the author to strike
it in Word if he wants the line without it.

**2026-10-25, later — the author's eighteen points on the tracing.** He
checked every letter and wrote the orders himself; they are the defaults
now (`scripts/tracing/waypoints.json`, listed in `CLAUDE.md` §3,
"Tracing"): ج ح خ from the left of the head bar, right, then down; ص ض
from the loop's bottom-left round the loop to the tooth then the bowl, one
stroke; ط ظ the loop then the stem top to bottom; ع غ one stroke from the
head's right tip; ف ق from the loop's bottom-right round and on; ك's sign
is a small hamza, traced from its top, not a dot; م from the head's
top-left; هـ one stroke from the loop's top; و from the loop's right, under,
up and over, then the tail; ى one stroke, never back; ء head then base.
Two faults behind "the color does not fill the letter": the brush was a
fixed share of the box and د's base is twice that — it is now the glyph's
own thickest stroke, measured per letter — and the thinning retracted
every stroke's end by half a stroke, so the tail of ت and the tip of ش were
never reached; a stroke's ends are pulled to the skeleton's tips. The
Firestore rule for his own strokes is deployed, so "Teach the strokes"
saves. He also rewrote the spoken lines in the sheet himself (table 7).

**2026-10-25, the second round — eleven points.** The painting is pixel
by pixel now: every pixel of the glyph belongs to its nearest stroke
point, so a stroke lights only its own segment, the start of ط lights the
start of ط's loop and nothing else, and a dot never lights its neighbor
(`src/lib/tracePaint.ts`). An arrow a little way along the line shows the
way; the demonstration's strokes stay as the next is painted; a dot's ring
is the dot's size; on a phone the page scrolls under the board unless the
touch begins at the dot, and a new card scrolls its board into view. For
the author's friend who cannot write: "Watch all" plays each letter's name
and demonstration and turns the cards itself, and D replays. The lesson
page lost its triple title, the speed buttons, the bars and the floating
laser; the tools are a row of icons at the top right and the contents open
from the header's ☰ on every page. The intake tool opens the alphabet sheet
on its spoken-lines table. The author has taught his own strokes for
several letters, which every device now traces.

**2026-10-25, the third round — ten points, the evening.** The author
recorded all three tables (60 takes) and reviewed the second round on a
laptop and a phone. The laser showed a crosshair and no dot, could not be
turned off from under its own overlay, and on the phone was a red frame
and nothing else: it is now a red dot under the pointer with a fading
trail, the finger is the laser on a phone, two fingers scroll, and the
tool button, a chip at the top or Escape turn it off; the icon is a
pointer with a red tip. The header's Admin link is hidden inside a lesson
(the gear has it); the contents open from a tab on the page's right edge;
the arrow is a small chevron on the dotted line. The painting's teeth and
holes: a pixel's place is its projection onto the nearest segment, not
the nearest sample point (the teeth), and it lights at the earliest pass
whose ink it is, within the stroke's own half-width and with a clear line
of ink between (the holes) — the first pass through a crossing inks it,
as a pen does; his worry that the later part would look "half opacified"
does not arise with opaque color. The room-tone check learned that a
−51 dBFS tick in a −85 dBFS room is not speech, the alphabet generator
cuts each take to one piece with the record click dropped, and the intake
tool says what it wrote by kind and keeps every session in `intake.json`.
What is left before Level 1 can be used: his tap calibration of the 29
lines and the 2 songs, a listen, and Publish.
