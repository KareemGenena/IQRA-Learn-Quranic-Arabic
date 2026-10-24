/** Lesson loading and normalisation into Playables. */

import { splitClusters, baseChar, derivedSilent } from './graphemes';
import type { Lesson, LessonItem, LetterWord, PairWord, Playable, SimpleWord } from '../types';

export interface LessonMeta {
  /**
   * The lesson's IDENTITY, and never its position.
   *
   * It is spent the moment a lesson exists, and it is what
   * `public/lessons/lessonNN/`, `public/audio/lessonNN/`, `#/lesson/N` and
   * `calibrations/lessonN/...` are all keyed on. Moving a lesson up the menu,
   * or into a chapter, must therefore never change it: renumbering to reorder
   * would silently point every calibration at the wrong word, which is exactly
   * the bug lesson 4's word ids already cost this project once.
   *
   * Reading order is `order` below; grouping will be a `chapter` beside it.
   */
  id: number;
  title: string;
  titleArabic: string;
  blurb: string;
  /**
   * Where this lesson sits in the menu, if not simply by id.
   *
   * Nothing sets it yet — the lessons were written in the order they are read.
   * It exists so that the day one moves, the move is a number here rather than
   * a renaming of folders, clips and calibration documents.
   */
  order?: number;
  /**
   * The Level this lesson sits under — the same Levels as the practice
   * workbooks, so the app and the paper name the same place with the same
   * word. One curriculum for everyone: the Level 1 letter lessons were a
   * separate "IQRA Kids" menu until 2026-10-11, and are the start of the
   * sequence now. A level is a heading, never an identity — a lesson moving
   * between levels keeps its number. Within a level the order is `order`
   * where set, else the id.
   */
  level: Level;
  /** A Level check (lessons 41–43): drawn as a card with "?" for its number,
   *  last in its Level. Advice, never a gate. */
  check?: boolean;
}

export type Level = 1 | 2 | 3;

/** The Level headings on the home page, worded from the workbooks' own
 *  tables of contents. */
export const LEVELS: { level: Level; title: string; blurb: string }[] = [
  { level: 1, title: 'Level 1', blurb: 'The letters, the harakat, tanween, natural madd and shadda.' },
  { level: 2, title: 'Level 2', blurb: 'Letters joined into words, hamza, the madd rules and qalqala.' },
  {
    level: 3,
    title: 'Level 3',
    blurb: 'Stopping, sun and moon lam, hamzat wasl, where the letters are made, the rules of nūn and mīm sākinah, idghām of two letters, and the silent alif.',
  },
];

/**
 * The lesson menu on the home page. Add a line here for each new lesson.
 *
 * Written in reading order today. Read it through `orderedLessons()` rather
 * than relying on that.
 */
export const LESSONS: LessonMeta[] = [
  {
    id: 1,
    level: 2,
    order: 5,
    title: 'Five-Letter Words',
    titleArabic: 'كلمات من خمسة أحرف',
    blurb: '33 words from Al-Fatiha and Al-Baqarah, heard letter by letter.',
  },
  {
    id: 2,
    level: 3,
    order: 2,
    title: 'Sun & Moon Lam',
    titleArabic: 'اللام الشمسية والقمرية',
    blurb: '46 words from the last surahs — hear when the ل is spoken and when it is silent.',
  },
  {
    id: 3,
    level: 3,
    order: 5,
    title: 'Throat Letters',
    titleArabic: 'حروف الحلق',
    blurb: 'ء ه ح ع غ خ — the six letters of the throat, at the start, middle and end of a word.',
  },
  {
    id: 4,
    level: 3,
    order: 3,
    title: 'Hamzat Wasl after وَ and ثُمَّ',
    titleArabic: 'همزة الوصل بعد الواو وثم',
    blurb: 'Each word alone, then after وَ and ثُمَّ — hear the ٱ of ٱل drop away.',
  },
  {
    id: 5,
    level: 2,
    order: 7,
    title: 'Madd before a Hamza',
    titleArabic: 'المد المتصل والمنفصل قبل همزة',
    blurb: 'Muttasil and munfasil — both held for four harakat, whether the hamza is in the same word or the next.',
  },
  {
    id: 6,
    level: 2,
    order: 8,
    title: 'Madd Lāzim, Ṣilah and More',
    titleArabic: 'المد اللازم ومد الصلة وغيرهما',
    blurb: 'The longest madd, the pronoun that grows a natural madd, and what happens to a madd when you stop.',
  },
  {
    id: 7,
    level: 3,
    order: 6,
    title: 'Nūn Sākinah, Tanwīn and Mīm Sākinah',
    titleArabic: 'أحكام النون الساكنة والتنوين والميم الساكنة',
    blurb: 'Iẕhār, ikhfāʾ, iqlāb and idghām.',
  },

  // ── Level 1 — the letters: the Baghdadi qaida, built for the Maktab's
  // youngest class and read by everyone (once "IQRA Kids"; Design/iqra-kids.md).
  // Numbers 20–30 are reserved for the qaida lessons and 31–33 hold the two
  // songs and the places page; `order` is what decides where each is read, so
  // a lesson can be moved without its number — and therefore its clips and
  // calibrations — moving with it.
  {
    id: 31,
    order: 1,
    level: 1,
    title: 'The Alphabet Song — the Names',
    titleArabic: 'أنشودة الحروف — الأسماء',
    blurb: 'All 28 letters in order, sung. Press pause whenever you want to stop and learn.',
  },
  {
    // One lesson, four sections — a section is a sitting. Lessons 21 and 22
    // were the same letters split in three; nothing was ever recorded or
    // calibrated against them, so their numbers went back unspent.
    id: 20,
    order: 2,
    level: 1,
    title: 'The Letters',
    titleArabic: 'الحروف',
    blurb: 'All 29 letters, each with its picture: fat-ha, damma, kasra, and a sukoon after نَ.',
  },
  {
    id: 32,
    order: 3,
    level: 1,
    title: 'The Alphabet Song — the Sounds',
    titleArabic: 'أنشودة الحروف — الحركات',
    blurb: 'Every letter sung with fat-ha, damma and kasra.',
  },
  {
    id: 33,
    order: 4,
    level: 1,
    title: 'Where the Letters Come From',
    titleArabic: 'مخارج الحروف',
    blurb: 'Mouth space, throat, tongue, lips and nose — the five places, as in the workbook.',
  },

  // ── Lessons cut from the practice workbooks (Workbooks/lessons.map.json,
  // scripts/make-workbook-lessons.mjs), in the WORKBOOK'S order — Level 1
  // after the letters, Level 2 around the lessons that already existed.
  // Titles and blurbs here must match the map; the map is what the
  // generator reads.
  {
    id: 21,
    level: 1,
    order: 5,
    title: 'Tanween',
    titleArabic: 'التنوين',
    blurb: 'Every letter with its three harakat and its three tanween, as the workbook writes them, page by page.',
  },
  {
    id: 22,
    level: 1,
    order: 6,
    title: 'Natural Madd',
    titleArabic: 'المد الطبيعي',
    blurb: 'Each letter held on alif, waw and yaa, beside its fat-ha, damma and kasra.',
  },
  {
    id: 23,
    level: 1,
    order: 7,
    title: 'Shadda',
    titleArabic: 'الشدة',
    blurb: 'Two letters, then the second one doubled — hear the shadda land.',
  },
  {
    id: 24,
    level: 2,
    order: 1,
    title: 'Letter Pairs',
    titleArabic: 'حرفان متصلان',
    blurb: 'Two letters joined, with their harakat and a sukoon.',
  },
  {
    id: 25,
    level: 2,
    order: 2,
    title: 'Three-Letter Words',
    titleArabic: 'كلمات من ثلاثة أحرف',
    blurb: 'Real words of three letters, one at a time.',
  },
  {
    id: 26,
    level: 2,
    order: 3,
    title: 'Timing',
    titleArabic: 'عد الحركات',
    blurb: 'One count or two: a haraka beside the same word with a natural madd.',
  },
  {
    id: 27,
    level: 2,
    order: 4,
    title: 'Four-Letter Words',
    titleArabic: 'كلمات من أربعة أحرف',
    blurb: 'Real words of four letters, a sukoon in the middle of each.',
  },
  {
    id: 28,
    level: 2,
    order: 6,
    title: 'Hamza',
    titleArabic: 'الهمزة',
    blurb: 'The hamza at the start, in the middle and at the end of a word.',
  },
  {
    id: 29,
    level: 2,
    order: 9,
    title: 'Qalqala',
    titleArabic: 'القلقلة',
    blurb: 'ق ط ب ج د with a sukoon — hear the bounce.',
  },
  // Level 3, the workbook sections no lesson covered (34–37), in the
  // workbook's order among lessons 2, 4, 3 and 7.
  {
    id: 34,
    level: 3,
    order: 1,
    title: 'Stopping',
    titleArabic: 'الوقف',
    blurb: 'What happens to the last letter when you stop on a word — the last haraka drops, a madd grows.',
  },
  {
    id: 35,
    level: 3,
    order: 4,
    title: 'Makharij & Sifat',
    titleArabic: 'المخارج والصفات',
    blurb: 'Hams, tafkheem, the lam of ٱللَّه, and the heavy and light raa.',
  },
  {
    id: 36,
    level: 3,
    order: 7,
    title: 'Idghām of Two Letters',
    titleArabic: 'إدغام الحرفين',
    blurb: 'Mithlain, mutajanisain and mutaqaribain — two letters that merge into one.',
  },
  {
    id: 37,
    level: 3,
    order: 8,
    title: 'Silent Alif',
    titleArabic: 'الألف التي لا تُقرأ',
    blurb: 'The alif that is written and not read.',
  },
  // ── The Level checks — one at the end of each Level, built from the
  // Level's own clips by scripts/make-assessments.mjs. ───────────────────
  {
    id: 41,
    level: 1,
    order: 99,
    check: true,
    title: 'Level 1 Check',
    titleArabic: 'اختبار المستوى ١',
    blurb: 'Hear a word and point to it. Advice on whether you are ready for Level 2 — never a gate.',
  },
  {
    id: 42,
    level: 2,
    order: 99,
    check: true,
    title: 'Level 2 Check',
    titleArabic: 'اختبار المستوى ٢',
    blurb: 'Hear a word and point to it. Advice on whether you are ready for Level 3 — never a gate.',
  },
  {
    id: 43,
    level: 3,
    order: 99,
    check: true,
    title: 'Level 3 Check',
    titleArabic: 'اختبار المستوى ٣',
    blurb: 'Hear a word and point to it; name the rule. Advice, never a gate.',
  },
];

/**
 * The lessons in the order a learner meets them: by Level, then by `order`
 * (or id) within it.
 *
 * The one place that decides reading order, so that when a lesson moves
 * within or between Levels, this is what changes — not the lesson numbers,
 * and not each page that happens to list lessons.
 */
export function orderedLessons(lessons: LessonMeta[] = LESSONS): LessonMeta[] {
  return [...lessons].sort(
    (a, b) => a.level - b.level || (a.order ?? a.id) - (b.order ?? b.id),
  );
}

/**
 * The lesson read after this one — the next in the same sequence the home
 * page shows that passes `visible` (a learner never sees a draft; the admin
 * does). Undefined after the last.
 */
export function lessonAfter(
  id: number,
  visible: (l: LessonMeta) => boolean = () => true,
  lessons: LessonMeta[] = LESSONS,
): LessonMeta | undefined {
  const ordered = orderedLessons(lessons);
  const i = ordered.findIndex((l) => l.id === id);
  return i < 0 ? undefined : ordered.slice(i + 1).find(visible);
}

/** The same sequence cut into its Levels, for the headings on the home page. */
export function lessonsByLevel(lessons: LessonMeta[] = LESSONS) {
  const ordered = orderedLessons(lessons);
  return LEVELS.map((lv) => ({ ...lv, lessons: ordered.filter((l) => l.level === lv.level) }));
}

/**
 * How a lesson is named wherever its number is shown — "Level 3 · Lesson 4":
 * its Level and its place in that Level's sequence, the same count the home
 * page shows beside it. Never the id: that is the lesson's identity, not its
 * position, and printing it read as a broken order ("Lesson 1" after lesson
 * 25 — the author, 2026-10-24). One function, so no page can disagree with
 * the home page.
 */
export function lessonLabel(id: number, lessons: LessonMeta[] = LESSONS): string {
  for (const lv of lessonsByLevel(lessons)) {
    const i = lv.lessons.findIndex((l) => l.id === id);
    if (i >= 0) return `${lv.title} · Lesson ${i + 1}`;
  }
  return `Lesson ${id}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export async function loadLesson(id: number): Promise<Lesson> {
  const res = await fetch(`${import.meta.env.BASE_URL}lessons/lesson${pad(id)}/words.json`);
  if (!res.ok) throw new Error(`lesson ${id}: ${res.status}`);
  const lesson = (await res.json()) as Lesson;
  return { ...lesson, kind: lesson.kind ?? 'words' };
}

export function isPairWord(w: SimpleWord | PairWord): w is PairWord {
  return (w as PairWord).bare !== undefined;
}

// The ال prefix was painted in the accent colour (its two clusters, the alif
// and the lam) until 2026-10-24: the author wants it black like the rest of
// the word. The sun lam is still greyed, by `derivedSilent`, and the badge
// still names the rule.

export function barePlayable(word: PairWord): Playable {
  return {
    key: `${word.id}a`,
    text: word.bare.text,
    audio: word.bare.audio,
    timings: word.bare.timings,
    stop: word.bare.stop,
    silentClusters: derivedSilent(word.bare.text),
    prefixClusters: 0,
  };
}

export function withAlPlayable(word: PairWord): Playable {
  return {
    key: `${word.id}b`,
    text: word.withAl.text,
    audio: word.withAl.audio,
    timings: word.withAl.timings,
    stop: word.withAl.stop,
    // In a shamsiyya word the lam is written but not pronounced — it
    // assimilates into the doubled letter that follows.
    silentClusters: derivedSilent(word.withAl.text),
    prefixClusters: 0,
  };
}

export function simplePlayable(word: SimpleWord): Playable {
  return {
    key: String(word.id),
    text: word.arabic,
    audio: word.audio,
    timings: word.timings,
    stop: word.stop,
    silentClusters: derivedSilent(word.arabic),
    prefixClusters: 0,
  };
}

/**
 * The stop reading of a playable, when one was recorded: the same text, its
 * own clip, timed as a reading at a stop (the last vowel dropped, a madd
 * before it held) and calibrated under its own key.
 */
export function stopPlayable(p: Playable): Playable | undefined {
  if (!p.stop) return undefined;
  return {
    ...p,
    key: `${p.key}-waqf`,
    audio: p.stop.audio,
    timings: p.stop.timings,
    // Drawn exactly as the continuing reading — no greying of the final
    // vowel at a stop (the author's call, 2026-10-20: the layers it added
    // read as extra marks on the card).
    waqf: true,
    stop: undefined,
  };
}

type AnyWord = Partial<SimpleWord & PairWord & LetterWord>;

/** Whether any form in the lesson has a stop reading — the switch in the
 *  lesson header is only shown when there is something for it to switch. */
export function lessonHasStop(lesson: Lesson): boolean {
  return (lesson.words as AnyWord[]).some(
    (w) => !!(w.stop || w.bare?.stop || w.withAl?.stop || w.forms?.some((f) => f.stop)),
  );
}

/**
 * Which cluster holds the letter being taught. The Position column
 * disambiguates a letter that appears more than once — "Beginning" takes the
 * first occurrence, "End" the last, "Middle" the first interior one.
 */
function findTargetCluster(text: string, letter: string, position: string): number | undefined {
  const clusters = splitClusters(text);
  const hits = clusters
    .map((c, i) => ({ i, base: baseChar(c.text) }))
    .filter((c) => c.base === letter)
    .map((c) => c.i);
  if (hits.length === 0) return undefined;
  const p = position.toLowerCase();
  if (p.startsWith('end')) return hits[hits.length - 1];
  if (p.startsWith('mid')) {
    return hits.find((i) => i > 0 && i < clusters.length - 1) ?? hits[0];
  }
  return hits[0];
}

function letterPlayables(word: LetterWord): Playable[] {
  // Several forms of the same word on one card, each played separately.
  if (word.forms) {
    return word.forms.map((f, i) => ({
      key: `${word.id}${'abc'[i] ?? i}`,
      text: f.text,
      audio: f.audio,
      timings: f.timings,
      stop: f.stop,
      silentClusters: derivedSilent(f.text),
      letterNames: word.letterNames,
      waqf: word.waqf,
      waqfMadd: word.waqfMadd,
      dimFinalMark: word.dimFinalMark,
      // The ٱل is colored apart only where it is actually present.
      prefixClusters: 0,
    }));
  }
  return [
    {
      key: String(word.id),
      text: word.text,
      audio: word.audio,
      timings: word.timings,
      stop: word.stop,
      silentClusters: derivedSilent(word.text),
      letterNames: word.letterNames,
      waqf: word.waqf,
      waqfMadd: word.waqfMadd,
      dimFinalMark: word.dimFinalMark,
      prefixClusters: 0,
      highlightCluster: word.target
        ? findTargetCluster(word.text, word.target.letter, word.target.position)
        : undefined,
    },
  ];
}

/** Normalises any paged lesson into the cards the page component renders. */
export function toItems(lesson: Lesson): LessonItem[] {
  if (lesson.kind === 'letters') {
    return (lesson.words as LetterWord[]).map((w) => ({
      id: w.id,
      section: w.section,
      badges: w.badges ?? [],
      meaning: w.meaning,
      // Versioned for the same reason a clip URL is: a redrawn picture keeps
      // its filename, so without `?v=` the browser's own HTTP cache would go on
      // serving the old one. See IMAGE_VERSION in vite.config.ts.
      image: w.image
        ? `${import.meta.env.BASE_URL}${lesson.imagePath ?? ''}${w.image}?v=${__IMAGE_VERSION__}`
        : undefined,
      // A "where the letters come from" card has no recording of its own.
      forms: w.place ? [] : letterPlayables(w),
      formLabels: w.formLabels,
      letter: w.letter,
      name: w.name,
      mnemonic: w.mnemonic,
      labels: w.labels,
      parts: w.parts,
      family: w.family,
      place: w.place,
    }));
  }
  return (lesson.words as PairWord[]).map((w) => ({
    id: w.id,
    section: w.type,
    badges: [w.type === 'shamsiyya' ? 'Sun ش' : 'Moon ق'],
    meaning: w.meaning,
    forms: [barePlayable(w), withAlPlayable(w)],
  }));
}

/** A section's stable key, whichever lesson shape it came from. */
export const sectionKey = (s: { id?: string; type?: string }) => s.id ?? s.type ?? '';

/** Every playable in a lesson, in teaching order, each followed by its stop
 *  reading where one exists — the admin page calibrates both. */
export function allPlayables(lesson: Lesson): { label: string; playable: Playable }[] {
  return continuingPlayables(lesson).flatMap((u) => {
    const stop = stopPlayable(u.playable);
    return stop ? [u, { label: `${u.label} at a stop`, playable: stop }] : [u];
  });
}

function continuingPlayables(lesson: Lesson): { label: string; playable: Playable }[] {
  if (lesson.kind === 'pairs') {
    return (lesson.words as PairWord[]).flatMap((w) => [
      { label: `${w.id}`, playable: barePlayable(w) },
      { label: `${w.id} +ال`, playable: withAlPlayable(w) },
    ]);
  }
  if (lesson.kind === 'letters') {
    return (lesson.words as LetterWord[])
      .filter((w) => !w.place)
      .flatMap((w) =>
        letterPlayables(w).map((playable, i) => ({
          label: w.forms ? `${w.id}${'abcdefgh'[i] ?? i}` : `${w.id}`,
          playable,
        })),
      );
  }
  return (lesson.words as SimpleWord[]).map((w) => ({
    label: `${w.id}`,
    playable: simplePlayable(w),
  }));
}
