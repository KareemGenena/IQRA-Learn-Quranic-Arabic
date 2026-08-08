# IQRA — Learn Quranic Arabic

A progressive web app that teaches Quranic Arabic pronunciation to English
speakers. Tap a word, hear it recited, and watch each letter light up exactly as
it is pronounced.

**Live:** https://iqra---learn-quranic-arabic.web.app

## Repository layout

| Folder | What it holds |
|---|---|
| `Word Tables/` | The lesson tables as `.docx` — the source of truth for all Arabic text |
| `Audio/` | The teacher's raw recordings, one folder per lesson |
| `app/` | The web app, its generators, and the generated lesson data |

## Working on it

```bash
cd app
npm install
npm run dev          # develop at http://localhost:5173
npm run build        # type-check and build
```

Deploy from this folder:

```bash
firebase deploy --only hosting
```

Lesson content is **generated**, never hand-written: a script reads the Word
table and the recordings and produces `app/public/lessons/lessonNN/words.json`
plus the individual audio clips.

```bash
node scripts/make-lesson3.mjs
```

See [`app/README.md`](app/README.md) for how lessons, timings and the font work,
and [`CLAUDE.md`](CLAUDE.md) for the architecture, the conventions behind the
code, and where the project currently stands.
