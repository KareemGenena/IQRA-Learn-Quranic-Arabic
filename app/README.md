# IQRA — Learn Quranic Arabic

A PWA that teaches Quranic Arabic pronunciation. Tap a word to hear it while
each letter lights up as it is pronounced. Works fully offline once installed.

## Running it

```bash
npm install
npm run dev       # develop at http://localhost:5173
npm run build     # production build in dist/ (includes the service worker)
npm run preview   # serve the production build locally
```

The production `dist/` folder can be hosted on any static host (GitHub Pages,
Netlify, a shared server...). The service worker precaches everything — app,
fonts, and all audio — so learners can practice with no connection.

## How letter timing works

Timings are **never hand-typed**. For each word the app uses the best source
available, in this order:

1. **This device's own calibration** (the admin's taps, in localStorage).
2. **Cloud calibration** — synced from Firestore on every app start and
   snapshotted locally so the installed PWA has it offline too.
3. **words.json timings** — calibrations baked into the lesson file as the
   first-run/offline baseline.
4. **Automatic estimate** — the app detects where speech starts/ends in the
   recording and divides that span across the letters using tajweed-style
   weights (madd letters longer, final sukoon shorter, tanween longer...).
   See `src/lib/timing.ts`; future rules (ghunna, madd lazim...) go there.

### Calibrating (admin only)

Go to `#calibrate` (there is no visible link) and sign in with the admin's
Firebase account. Play a word and tap <kbd>Space</kbd> — or the big TAP
button on a phone — at the moment each letter begins. Capture runs below
full speed for precision (taps are stored in media time, so they're correct
at every playback speed). Preview, save, next word. Saves sync to Firestore
automatically, so every device gets them on its next app start — no
redeploy needed.

**Sole-writer security:** Firestore rules (`../firestore.rules`) only accept
calibration writes from the admin's email via Firebase Auth; reads are
public. The admin account is managed in the Firebase console under
Authentication → Users.

**Export words.json** downloads the lesson with calibrated timings baked in;
replace `public/lessons/lesson01/words.json` with it to make the timings
permanent for everyone (not just this browser).

## Replacing a recording

Re-record into `../Audio - 5 letters/` (same filename), then run
`npm run sync-audio` to copy the masters into the app. If that word had a
saved calibration, delete it on the calibrate page and recalibrate — the old
taps belong to the old take.

## Playback speed

Learners get a 0.5× / 0.75× / 1× / 1.5× speed toggle. Slowing down keeps the
pitch (no "deep voice" effect) and the letter highlights stay in sync at
every speed automatically, because timings are stored in media time.

## Adding a lesson

1. Create `public/lessons/lesson02/words.json` (copy lesson01's shape:
   `lesson`, `title`, `titleArabic`, `audioPath`, `words[]` with
   `timings: null`).
2. Drop the recordings in `public/audio/lesson02/`.
3. Wire the new lesson into the UI (currently `App.tsx` loads lesson01; a
   lesson picker is the natural next step).

## Arabic text notes (src/lib/graphemes.ts)

- Words are split into letters with `Intl.Segmenter` so diacritics stay
  attached to their letter.
- Tatweel (the decorative stretch, e.g. أَنْهَـارُ) is merged into the letter
  before it — it is not a letter.
- The word is rendered as ONE intact text node and the highlight is a
  positioned overlay measured with the Range API. Splitting Arabic into
  per-letter spans would break the cursive joining — don't.
- Lam-alif (لا) renders as a single glyph and is treated as one highlight
  unit worth two time units.

## Icons

`node scripts/make-icons.mjs` regenerates all PWA icons from
`../Manifest/IQRA Manifest.png`.
