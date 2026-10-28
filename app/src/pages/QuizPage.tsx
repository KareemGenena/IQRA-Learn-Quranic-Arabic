import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { Mixed } from '../components/Mixed';
import { PlayIcon } from '../components/PlayIcon';
import { TraceCard } from '../components/TraceCard';
import { derivedSilent, splitClusters } from '../lib/graphemes';
import { loadLesson, toItems } from '../lib/lessons';
import { audioUrl, playWithHighlights, prepareClip, warmAudio } from '../lib/playback';
import { getAudioBlob } from '../lib/audioSource';
import { chime, click, knock } from '../lib/sounds';
import {
  ASK,
  COUNTS,
  PLACE_WORDS,
  TOPICS,
  UNSCORED,
  answered,
  contrastOf,
  current,
  mistakesRun,
  newRun,
  readRun,
  readSettings,
  scoreOf,
  topicOf,
  topicStatus,
  visibleBank,
  writeRun,
  writeSettings,
} from '../lib/quiz';
import type { Answer, ClipRef, Contrast, Level, Question, QuizBank, Run, Settings, TopicId, TopicStatus } from '../lib/quiz';
import { canSeeLesson } from '../lib/appConfig';
import type { AppConfig } from '../lib/appConfig';
import type { Lesson, LessonItem, Playable } from '../types';

/** Lesson 30, for the tracing questions: the board, the strokes, Manāra. */
interface Tracing {
  lesson: Lesson;
  items: LessonItem[];
}

/**
 * Quiz me — the question book (Design/drills.md). Its own door, never a
 * lesson: the lightbulb in the header, a card on the home page.
 *
 * Choose topics and 15, 30 or 45 questions (behind a grown-ups question);
 * the choice is remembered, so the next quiz is one tap. A clip plays, the
 * choices wake when it ends, tap what you heard; misses come back at the end,
 * round after round, until each is answered right once. Guest mode: nothing
 * about who is answering is kept, and the quiz under way is written to the
 * device after every answer so a reload does not lose it.
 *
 * Single keys, no chords, for the learner who drives an iPad by voice:
 * P plays again, 1–3 choose (1–9 on the letter hunt), N goes on.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Every clip URL goes through `audioUrl`, which versions it. */
function urlOf(audioPath: string, file: string, rev?: string): string {
  const lesson = { lesson: 0, title: '', titleArabic: '', audioPath, kind: 'letters', words: [] } as Lesson;
  const playable: Playable = { key: file, text: '', audio: file, timings: null, silentClusters: [], prefixClusters: 0, ...(rev ? { rev } : {}) };
  return audioUrl(lesson, playable);
}
const clipUrl = (c: ClipRef) => urlOf(`audio/lesson${pad(c.lesson)}/`, c.file, c.rev);
/** A spoken instruction's clip, once it has been recorded. */
function promptUrl(bank: QuizBank, slot: string): string | null {
  const p = bank.prompts[slot];
  return p?.file ? urlOf('audio/quiz/', p.file, p.rev) : null;
}
/** The teacher saying two sound-alike letters one after the other. */
const contrastUrl = (c: Contrast) => urlOf('audio/quiz/', c.file, c.rev);

/** "Hear the difference" after a mix-up between two letters the teacher
 *  recorded side by side: the letter heard against the one tapped, or the two
 *  sounds that were different when "Same" was the answer. */
function contrastFor(bank: QuizBank, q: Question, picked: string): Contrast | undefined {
  if (q.kind === 'whichLetter') return contrastOf(bank, q.asked, picked);
  if (q.kind === 'sameDiff' && q.answer[0] === 1) return contrastOf(bank, q.clips[0].text, q.clips[1].text);
  return undefined;
}

/** One clip to its end; resolves when it ends, fails or is stopped. */
function playOnce(url: string, onStop: (stop: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    const handle = playWithHighlights(url, [], () => undefined, resolve, 1, undefined, undefined, 0, true);
    onStop(() => handle.stop());
  });
}

/** Clips one after another, a short breath between. A new sequence, or a
 *  stop, supersedes the one playing; `run` tells whether it played through. */
function useSequence() {
  const gen = useRef(0);
  const stopNow = useRef<() => void>(() => undefined);
  const stop = useCallback(() => {
    gen.current += 1;
    stopNow.current();
  }, []);
  const run = useCallback(async (urls: string[], gap = 450): Promise<boolean> => {
    const mine = ++gen.current;
    stopNow.current();
    for (let k = 0; k < urls.length; k++) {
      if (k > 0) await new Promise((r) => window.setTimeout(r, gap));
      if (gen.current !== mine) return false;
      await playOnce(urls[k], (s) => (stopNow.current = s));
    }
    return gen.current === mine;
  }, []);
  useEffect(() => stop, [stop]);
  return useMemo(() => ({ run, stop }), [run, stop]);
}

/** A word drawn still, for a choice. */
function Still({ text }: { text: string }) {
  const clusters = useMemo(() => splitClusters(text), [text]);
  const silent = useMemo(() => derivedSilent(text), [text]);
  return <ArabicWord text={text} clusters={clusters} activeIndex={null} silentClusters={silent} prefixClusters={0} />;
}

function formatTime(s: number): string {
  const r = Math.round(s);
  if (r < 60) return `${r} s`;
  return `${Math.floor(r / 60)} min${r % 60 ? ` ${r % 60} s` : ''}`;
}

// ── the grown-ups question ────────────────────────────────────────────────
const newPair = (): [number, number] => [3 + Math.floor(Math.random() * 7), 3 + Math.floor(Math.random() * 7)];

/** A multiplication in front of choosing what to practice — enough to keep a
 *  little one from changing it by accident; older children and adults pass,
 *  on purpose (the author, 2026-10-27). */
function Gate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const [pair, setPair] = useState(newPair);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (Number(value) === pair[0] * pair[1]) {
      onPass();
      return;
    }
    setWrong(true);
    setPair(newPair());
    setValue('');
  };

  return (
    <div className="quiz-gate-back" role="dialog" aria-modal="true" aria-label="For grown-ups">
      <form className="quiz-gate" onSubmit={submit}>
        <p className="quiz-gate-title">For grown-ups</p>
        <label className="quiz-gate-q">
          What is {pair[0]} × {pair[1]}?
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            aria-label="Answer"
          />
        </label>
        {wrong && <p className="quiz-gate-wrong">Not quite. Try this one.</p>}
        <div className="quiz-actions">
          <button type="submit" className="btn primary">
            OK
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── choosing ──────────────────────────────────────────────────────────────
const LEVELS: Level[] = [1, 2, 3];
const WHY_NOT: Record<Exclude<TopicStatus, 'ready'>, string> = {
  unpublished: 'Not published yet.',
  unrecorded: 'Not recorded yet.',
};

/** A box that can be half-ticked: some of what it stands for, not all. */
function TriBox({ checked, some, disabled, onChange, label }: { checked: boolean; some: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !checked;
  }, [some, checked]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />;
}

/**
 * What to practice, grouped by Level, as the author designed it (2026-10-27):
 * a box for everything, a box for each Level, and each Level opening to its
 * topics. A Level 3 learner ticks Level 3 and meets nothing of Level 1. A
 * topic with nothing to practice yet stays in its list, greyed, saying why.
 */
function Chooser({
  statuses,
  initial,
  onStart,
  onCancel,
}: {
  statuses: Record<TopicId, TopicStatus>;
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onCancel: () => void;
}) {
  const ready = TOPICS.filter((t) => statuses[t.id] === 'ready').map((t) => t.id);
  const [topics, setTopics] = useState<TopicId[]>(() => (initial?.topics ?? []).filter((id) => ready.includes(id)));
  const [count, setCount] = useState(initial?.count ?? COUNTS[0]);
  const [openLevels, setOpenLevels] = useState<Level[]>(() =>
    LEVELS.filter((lv) => TOPICS.some((t) => t.level === lv && (initial?.topics ?? []).includes(t.id))),
  );
  const toggle = (id: TopicId) => setTopics((ts) => (ts.includes(id) ? ts.filter((x) => x !== id) : [...ts, id]));
  /** Tick every ready topic in `ids`, or untick them all if all are ticked. */
  const toggleAll = (ids: TopicId[]) =>
    setTopics((ts) => (ids.every((id) => ts.includes(id)) ? ts.filter((x) => !ids.includes(x)) : [...new Set([...ts, ...ids])]));
  const allOn = ready.length > 0 && ready.every((id) => topics.includes(id));

  return (
    <section className="quiz-panel">
      <h3 className="quiz-h">What to practice</h3>
      <label className="quiz-all">
        <TriBox checked={allOn} some={topics.length > 0} disabled={!ready.length} onChange={() => toggleAll(ready)} label="Select all" />
        <span>Select all</span>
      </label>
      {LEVELS.map((lv) => {
        const mine = TOPICS.filter((t) => t.level === lv);
        const usable = mine.filter((t) => statuses[t.id] === 'ready').map((t) => t.id);
        const open = openLevels.includes(lv);
        const ticked = usable.filter((id) => topics.includes(id)).length;
        if (!mine.length) {
          return (
            <div key={lv} className="quiz-level off">
              <span className="quiz-level-name">Level {lv}</span>
              <span className="quiz-level-note">Coming later</span>
            </div>
          );
        }
        return (
          <div key={lv} className="quiz-level-group">
            <div className={`quiz-level ${usable.length ? '' : 'off'}`}>
              <TriBox
                checked={usable.length > 0 && ticked === usable.length}
                some={ticked > 0}
                disabled={!usable.length}
                onChange={() => toggleAll(usable)}
                label={`All of Level ${lv}`}
              />
              <button
                type="button"
                className="quiz-level-name"
                aria-expanded={open}
                onClick={() => setOpenLevels((ls) => (ls.includes(lv) ? ls.filter((x) => x !== lv) : [...ls, lv]))}
              >
                <span className="quiz-level-arrow" aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
                Level {lv}
                <span className="quiz-level-note">
                  {ticked ? `${ticked} of ${mine.length} ticked` : `${mine.length} topics`}
                </span>
              </button>
            </div>
            {open && (
              <ul className="quiz-topics">
                {mine.map((t) => {
                  const status = statuses[t.id];
                  const on = status === 'ready';
                  return (
                    <li key={t.id} className={`quiz-topic ${on ? '' : 'off'}`}>
                      <label>
                        <input type="checkbox" checked={topics.includes(t.id)} disabled={!on} onChange={() => toggle(t.id)} />
                        <span>
                          <span className="quiz-topic-title">{t.title}</span>
                          <span className="quiz-topic-sub">
                            <Mixed text={`${t.blurb} ${t.where}${on ? '' : ` ${WHY_NOT[status as Exclude<TopicStatus, 'ready'>]}`}`} />
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <h3 className="quiz-h">How many questions</h3>
      <div className="quiz-counts" role="radiogroup" aria-label="How many questions">
        {COUNTS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={count === n} className={`quiz-count ${count === n ? 'on' : ''}`} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="quiz-actions">
        <button
          type="button"
          className="btn primary quiz-start-btn"
          disabled={topics.length === 0}
          onClick={() => onStart({ topics: TOPICS.filter((t) => topics.includes(t.id)).map((t) => t.id), count })}
        >
          Start
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

// ── getting the sounds ready ──────────────────────────────────────────────
/** Every sound the quiz needs, downloaded before the first question, so a
 *  slow or dropped connection never stalls it halfway. The spoken
 *  instructions are a bonus: one that fails is simply not heard. */
function Ready({ run, bank, onReady, onBack }: { run: Run; bank: QuizBank; onReady: () => void; onBack: () => void }) {
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(onReady);
  ready.current = onReady;

  const urls = useMemo(() => [...new Set(run.questions.flatMap((q) => q.clips.map(clipUrl)))], [run]);
  const extras = useMemo(
    () =>
      [
        ...new Set(
          [...Object.values(ASK).map((a) => a.slot), 'quiz-review', 'quiz-done']
            .map((s) => (s ? promptUrl(bank, s) : null))
            .filter((u): u is string => !!u),
        ),
      ],
    [bank],
  );

  useEffect(() => {
    let alive = true;
    let next = 0;
    let bad = 0;
    setDone(0);
    setFailed(false);
    const worker = async () => {
      while (next < urls.length) {
        const u = urls[next++];
        try {
          await getAudioBlob(u);
        } catch {
          bad += 1;
        }
        if (alive) setDone((d) => d + 1);
      }
    };
    void Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker)).then(async () => {
      await Promise.all(extras.map((u) => getAudioBlob(u).catch(() => undefined)));
      if (!alive) return;
      if (bad) setFailed(true);
      else ready.current();
    });
    return () => {
      alive = false;
    };
  }, [urls, extras, attempt]);

  return (
    <section className="quiz-panel quiz-ready">
      {failed ? (
        <>
          <p className="quiz-lead">Some sounds could not be downloaded. Check the internet, then try again.</p>
          <div className="quiz-actions">
            <button type="button" className="btn primary" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
            <button type="button" className="btn" onClick={onBack}>
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="quiz-lead">Getting the sounds ready…</p>
          <div className="quiz-bar-track" aria-hidden="true">
            <span className="quiz-bar-fill" style={{ width: `${urls.length ? Math.round((100 * done) / urls.length) : 100}%` }} />
          </div>
        </>
      )}
    </section>
  );
}

// ── one question ──────────────────────────────────────────────────────────
function QuestionView({
  q,
  bank,
  label,
  withPrompt,
  onAnswer,
}: {
  q: Question;
  bank: QuizBank;
  label: string;
  /** Play the spoken instruction first: it differs from the last question's. */
  withPrompt: boolean;
  onAnswer: (picked: string, ok: boolean, seconds: number) => void;
}) {
  const player = useSequence();
  const [awake, setAwake] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [found, setFound] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [contrast, setContrast] = useState<Contrast | undefined>(undefined);
  const shownAt = useRef(performance.now());
  const result = useRef<{ picked: string; ok: boolean; seconds: number } | null>(null);
  const sent = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const item = useMemo(() => q.clips.map(clipUrl), [q]);
  const { line, slot } = ASK[q.kind];
  /** Letter shapes are read, not heard: their choices are bare glyphs. */
  const glyphs = q.kind === 'shape' || q.kind === 'position' || q.kind === 'join';

  // The instruction (when the kind changed), then the clip; the choices wake
  // when it has played. A clip that will not play never strands the child.
  useEffect(() => {
    alive.current = true;
    item.forEach((u) => void prepareClip(u).catch(() => undefined));
    const p = withPrompt && slot ? promptUrl(bank, slot) : null;
    void player.run([...(p ? [p] : []), ...item]).then((through) => {
      if (through && alive.current) setAwake(true);
    });
    const wake = window.setTimeout(() => alive.current && setAwake(true), 7000);
    return () => {
      alive.current = false;
      window.clearTimeout(wake);
      window.clearTimeout(timer.current);
      player.stop();
    };
    // one run per question: the view is keyed by it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replay = useCallback(() => {
    void player.run(item).then((through) => {
      if (through && alive.current) setAwake(true);
    });
  }, [player, item]);

  const next = useCallback(() => {
    const r = result.current;
    if (!r || sent.current || !alive.current) return;
    sent.current = true;
    window.clearTimeout(timer.current);
    player.stop();
    onAnswer(r.picked, r.ok, r.seconds);
  }, [onAnswer, player]);

  const settle = (picked: string, ok: boolean) => {
    result.current = { picked, ok, seconds: Math.min(60, (performance.now() - shownAt.current) / 1000) };
    setVerdict(ok);
    if (ok) {
      chime();
      timer.current = window.setTimeout(next, 900);
    } else {
      knock();
      // the right one is marked; hear the clip again with it in view — and,
      // after a mix-up the teacher recorded, the two letters side by side
      const c = contrastFor(bank, q, picked);
      setContrast(c);
      void player.run([...item, ...(c ? [contrastUrl(c)] : [])], c ? 700 : 450).then(() => {
        // nothing heard on a letter-shape question: the answer stays in view longer
        if (alive.current) timer.current = window.setTimeout(next, item.length ? 1100 : 2200);
      });
    }
  };

  const choose = (k: number) => {
    if (!awake || verdict !== null) return;
    setChosen(k);
    settle(q.choices[k], q.answer.includes(k));
  };

  const tap = (k: number) => {
    if (!awake || verdict !== null || found.includes(k)) return;
    if (q.answer.includes(k)) {
      const f = [...found, k];
      setFound(f);
      if (f.length === q.answer.length) settle(q.target ?? '', true);
      else click();
      return;
    }
    setChosen(k);
    settle(q.choices[k], false);
  };

  // Re-bound every render: it reads the state of the moment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.code === 'KeyP') replay();
      else if (e.code === 'KeyN') next();
      else {
        // e.code, never e.key: Shift and the keypad change e.key (CLAUDE.md)
        const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        const k = m ? Number(m[1]) - 1 : -1;
        if (k >= 0 && k < q.choices.length) (q.kind === 'hunt' ? tap : choose)(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const words = q.kind === 'sameDiff';
  return (
    <section className="check-stage quiz-stage">
      <p className="check-progress">
        {label} · {topicOf(q.topic).title}
      </p>
      <p className="quiz-line">
        <span>{line}</span>
        {q.kind === 'hunt' && q.target && (
          <span className="quiz-target">
            <Still text={q.target} />
          </span>
        )}
      </p>
      {q.show && (
        <div className="quiz-show">
          <span className="quiz-glyph quiz-show-glyph" dir="rtl" lang="ar">
            {q.show}
          </span>
          {q.place && <span className="quiz-show-place">{PLACE_WORDS[q.place]}</span>}
        </div>
      )}
      {item.length > 0 && (
        <div className="check-prompt">
          <button type="button" className="btn primary check-play" onClick={replay}>
            <PlayIcon playing={false} />
            Listen again
          </button>
        </div>
      )}

      {q.kind === 'hunt' ? (
        <div className="quiz-hunt">
          {q.choices.map((c, k) => {
            const state = found.includes(k)
              ? 'found'
              : chosen === k
                ? 'wrong'
                : verdict === false && q.answer.includes(k)
                  ? 'show'
                  : !awake
                    ? 'asleep'
                    : '';
            return (
              <button key={k} type="button" className={`hunt-cell ${state}`} disabled={!awake || verdict !== null} onClick={() => tap(k)} aria-label={`Cell ${k + 1}`}>
                <span className="check-key">{k + 1}</span>
                <Still text={c} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className={`check-options n${q.choices.length} kind-${q.kind}`}>
          {q.choices.map((c, k) => {
            const state =
              verdict === null ? (awake ? '' : 'asleep') : q.answer.includes(k) ? 'right' : k === chosen ? 'wrong' : 'dim';
            return (
              <button key={k} type="button" className={`check-option ${state}`} disabled={!awake || verdict !== null} onClick={() => choose(k)} aria-label={`Option ${k + 1}`}>
                <span className="check-key">{k + 1}</span>
                {words ? (
                  <span className="quiz-word">{c}</span>
                ) : glyphs ? (
                  <span className="quiz-glyph" dir="rtl" lang="ar">
                    {c}
                  </span>
                ) : (
                  <Still text={c} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {verdict !== null && (
        <div className={`check-feedback ${verdict ? 'right' : 'wrong'}`}>
          <span>
            {verdict ? 'Yes!' : q.kind === 'hunt' ? 'Not that one. The others are marked.' : 'Not this one. The answer is marked.'}
          </span>
          {words && (
            <span className="quiz-pair" dir="rtl">
              {q.clips.map((c, k) => (
                <Still key={k} text={c.text} />
              ))}
            </span>
          )}
          {contrast && (
            <span className="quiz-contrast">
              Hear the difference:{' '}
              <span className="quiz-contrast-ar" dir="rtl" lang="ar">
                {contrast.letters.join('  ·  ')}
              </span>
            </span>
          )}
          <button type="button" className="btn" onClick={next}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── tracing ───────────────────────────────────────────────────────────────
/**
 * Lesson 30's own card: the name, the letter drawing itself, then the
 * learner's turn — the teacher's strokes where he drew them. Leaving the line
 * is the one mistake there, so it is the one mistake here: traced without a
 * slip is right the first time, and a letter traced with slips comes back at
 * the end like any miss.
 */
function TraceQuestion({
  q,
  label,
  tracing,
  onAnswer,
}: {
  q: Question;
  label: string;
  tracing: Tracing | null;
  onAnswer: (picked: string, ok: boolean, seconds: number) => void;
}) {
  const [slips, setSlips] = useState<number | null>(null);
  const shownAt = useRef(performance.now());
  const result = useRef<{ picked: string; ok: boolean; seconds: number } | null>(null);
  const sent = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const item = tracing?.items.find((it) => it.id === q.trace);

  // No spoken instruction: the card says the letter's name and draws it —
  // that is the instruction (the author, 2026-10-27: nothing redundant).
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const next = useCallback(() => {
    const r = result.current;
    if (!r || sent.current || !alive.current) return;
    sent.current = true;
    window.clearTimeout(timer.current);
    onAnswer(r.picked, r.ok, r.seconds);
  }, [onAnswer]);

  const traced = useCallback(
    (n: number) => {
      result.current = { picked: n ? `${n} ${n === 1 ? 'slip' : 'slips'}` : (q.target ?? ''), ok: n === 0, seconds: Math.min(120, (performance.now() - shownAt.current) / 1000) };
      setSlips(n);
      timer.current = window.setTimeout(next, n ? 2200 : 1600);
    },
    [q.target, next],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next]);

  return (
    <section className="check-stage quiz-stage quiz-trace">
      <p className="check-progress">
        {label} · {topicOf(q.topic).title}
      </p>
      <p className="quiz-line">{ASK.trace.line}</p>
      {tracing && item ? (
        <TraceCard lesson={tracing.lesson} item={item} rate={1} displayNo={0} quiz onTraced={traced} />
      ) : (
        <p className="loading">Getting the letter ready…</p>
      )}
      {slips !== null && (
        <div className={`check-feedback ${slips === 0 ? 'right' : 'wrong'}`}>
          <span>
            {slips === 0
              ? 'Traced without leaving the line!'
              : `Traced — the finger left the line ${slips === 1 ? 'once' : `${slips} times`}. This letter comes back at the end.`}
          </span>
          <button type="button" className="btn" onClick={next}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── memory pairs ──────────────────────────────────────────────────────────
/**
 * The classic game (the author, 2026-10-27: "I have to be able to see the
 * cards before selecting"): four letters, each on two cards. All eight show
 * face up first, as long as the child likes; "Turn them over" hides them.
 * Then turn two: the same letter twice stays up, anything else is seen for a
 * moment and turns back. Every card says its letter's name as it turns. A
 * game, not a question — never right or wrong: the end screen counts the
 * turns.
 */
function MemoryQuestion({ q, label, onAnswer }: { q: Question; label: string; onAnswer: (picked: string, ok: boolean, seconds: number) => void }) {
  const player = useSequence();
  /** Each card is a letter's index in `q.choices`; every letter twice. */
  const cards = useMemo(() => {
    const deck = q.choices.flatMap((_, pair) => [pair, pair]);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }, [q]);
  const [looking, setLooking] = useState(true);
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [miss, setMiss] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const lock = useRef(false);
  const shownAt = useRef(performance.now());
  const sent = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const done = matched.length === q.choices.length;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      player.stop();
    };
  }, [player]);

  const say = (pair: number) => void player.run([clipUrl(q.clips[pair])]);

  const finish = (t: number) => {
    if (sent.current || !alive.current) return;
    sent.current = true;
    window.clearTimeout(timer.current);
    onAnswer(String(t), true, Math.min(300, (performance.now() - shownAt.current) / 1000));
  };

  const flip = (k: number) => {
    const pair = cards[k];
    if (looking) {
      say(pair);
      return;
    }
    if (lock.current || matched.includes(pair) || up.includes(k)) return;
    say(pair);
    const now = [...up, k];
    setUp(now);
    if (now.length < 2) return;
    const t = turns + 1;
    setTurns(t);
    if (cards[now[0]] === cards[now[1]]) {
      const m = [...matched, pair];
      setMatched(m);
      setUp([]);
      if (m.length === q.choices.length) {
        chime();
        timer.current = window.setTimeout(() => finish(t), 1800);
      } else click();
      return;
    }
    // not a pair: both stay in view a moment, then turn back
    lock.current = true;
    setMiss(now);
    timer.current = window.setTimeout(() => {
      lock.current = false;
      setUp([]);
      setMiss([]);
    }, 1600);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN' && done) finish(turns);
      else if (e.code === 'Enter' && looking) setLooking(false);
      const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
      if (m) flip(Number(m[1]) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section className="check-stage quiz-stage quiz-memory">
      <p className="check-progress">
        {label} · {topicOf(q.topic).title}
        {looking ? '' : ` · ${turns} ${turns === 1 ? 'turn' : 'turns'}`}
      </p>
      <p className="quiz-line">{ASK.memory.line}</p>
      <div className="memory-grid">
        {cards.map((pair, k) => {
          const open = looking || up.includes(k) || matched.includes(pair);
          const state = matched.includes(pair) ? 'matched' : miss.includes(k) ? 'miss' : open ? 'up' : 'down';
          return (
            <button
              key={k}
              type="button"
              className={`memory-card ${state}`}
              onClick={() => flip(k)}
              aria-label={open ? `${q.choices[pair]}, ${q.clips[pair].text}` : `Card ${k + 1}, face down`}
            >
              <span className="check-key">{k + 1}</span>
              {open ? (
                <span className="memory-face">
                  <span className="memory-letter" dir="rtl" lang="ar">
                    {q.choices[pair]}
                  </span>
                  {matched.includes(pair) && (
                    <span className="memory-name" dir="rtl" lang="ar">
                      {q.clips[pair].text}
                    </span>
                  )}
                </span>
              ) : (
                <span className="memory-back" aria-hidden="true">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>
      {looking && (
        <div className="quiz-actions quiz-memory-go">
          <button type="button" className="btn primary quiz-start-btn" onClick={() => setLooking(false)}>
            Turn them over
          </button>
        </div>
      )}
      {done && (
        <div className="check-feedback right">
          <span>
            All the pairs, in {turns} {turns === 1 ? 'turn' : 'turns'}!
          </span>
          <button type="button" className="btn" onClick={() => finish(turns)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── find the one ──────────────────────────────────────────────────────────
/**
 * The author's design (2026-10-27): three words, PLAYED rather than tapped —
 * each lights while its word sounds, once, in order — and then the learner
 * taps the one with the rule. Hearing and choosing are different gestures, so
 * a tap never plays; and there is no Listen again: each is heard once.
 */
function FindQuestion({ q, label, onAnswer }: { q: Question; label: string; onAnswer: (picked: string, ok: boolean, seconds: number) => void }) {
  const player = useSequence();
  const [lit, setLit] = useState<number | null>(null);
  const [awake, setAwake] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const shownAt = useRef(performance.now());
  const result = useRef<{ picked: string; ok: boolean; seconds: number } | null>(null);
  const sent = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    alive.current = true;
    (async () => {
      await new Promise((r) => window.setTimeout(r, 500));
      for (let k = 0; k < q.clips.length; k++) {
        if (!alive.current) return;
        setLit(k);
        const through = await player.run([clipUrl(q.clips[k])]);
        if (!through || !alive.current) return;
        setLit(null);
        await new Promise((r) => window.setTimeout(r, 450));
      }
      if (alive.current) {
        shownAt.current = performance.now();
        setAwake(true);
      }
    })();
    // a clip that never ends never strands the child
    const wake = window.setTimeout(() => {
      if (!alive.current) return;
      setLit(null);
      setAwake(true);
    }, 20000);
    return () => {
      alive.current = false;
      window.clearTimeout(wake);
      window.clearTimeout(timer.current);
      player.stop();
    };
    // one sequence per question: the view is keyed by it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = useCallback(() => {
    const r = result.current;
    if (!r || sent.current || !alive.current) return;
    sent.current = true;
    window.clearTimeout(timer.current);
    player.stop();
    onAnswer(r.picked, r.ok, r.seconds);
  }, [onAnswer, player]);

  const choose = (k: number) => {
    if (!awake || verdict !== null) return;
    const ok = q.answer.includes(k);
    setChosen(k);
    setVerdict(ok);
    result.current = { picked: q.choices[k], ok, seconds: Math.min(60, (performance.now() - shownAt.current) / 1000) };
    if (ok) {
      chime();
      timer.current = window.setTimeout(next, 900);
      return;
    }
    knock();
    // the right one, heard again with it lit
    const right = q.answer[0];
    setLit(right);
    void player.run([clipUrl(q.clips[right])], 450).then(() => {
      if (!alive.current) return;
      setLit(null);
      timer.current = window.setTimeout(next, 1200);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN') next();
      const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
      if (m) choose(Number(m[1]) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section className="check-stage quiz-stage quiz-find">
      <p className="check-progress">
        {label} · {topicOf(q.topic).title}
      </p>
      <p className="quiz-line">{awake ? ASK[q.kind].line : 'Listen to each word.'}</p>
      <div className={`check-options n${q.choices.length} kind-find`}>
        {q.choices.map((c, k) => {
          const state =
            lit === k ? 'lit' : verdict === null ? (awake ? '' : 'asleep') : q.answer.includes(k) ? 'right' : k === chosen ? 'wrong' : 'dim';
          return (
            <button key={k} type="button" className={`check-option ${state}`} disabled={!awake || verdict !== null} onClick={() => choose(k)} aria-label={`Word ${k + 1}`}>
              <span className="check-key">{k + 1}</span>
              <Still text={c} />
            </button>
          );
        })}
      </div>
      {verdict !== null && (
        <div className={`check-feedback ${verdict ? 'right' : 'wrong'}`}>
          <span>{verdict ? 'Yes!' : 'Not this one. The answer is marked.'}</span>
          <button type="button" className="btn" onClick={next}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── a quiz under way ──────────────────────────────────────────────────────
function RunView({
  run,
  bank,
  tracing,
  onChange,
  onStop,
}: {
  run: Run;
  bank: QuizBank;
  tracing: Tracing | null;
  onChange: (r: Run) => void;
  onStop: () => void;
}) {
  const q = current(run);
  const [introSeen, setIntroSeen] = useState(run.pos > 0 ? run.round : 0);
  const player = useSequence();
  const inIntro = run.round > 0 && run.pos === 0 && introSeen !== run.round;

  useEffect(() => {
    if (!inIntro) return;
    const u = promptUrl(bank, 'quiz-review');
    if (u) void player.run([u]);
  }, [inIntro, bank, player]);

  const onAnswer = useCallback(
    (picked: string, ok: boolean, seconds: number) => {
      if (q) onChange(answered(run, q, picked, ok, seconds));
    },
    [run, q, onChange],
  );

  if (!q) return null;

  if (inIntro) {
    return (
      <section className="check-stage quiz-intro">
        <p className="quiz-line">{bank.prompts['quiz-review']?.line ?? ''}</p>
        <p className="quiz-lead">
          {run.order.length} {run.order.length === 1 ? 'question' : 'questions'} to try again.
        </p>
        <button
          type="button"
          className="btn primary quiz-start-btn"
          onClick={() => {
            warmAudio();
            player.stop();
            setIntroSeen(run.round);
          }}
        >
          Go
        </button>
      </section>
    );
  }

  // The spoken instruction plays when it is not the one just heard: questions
  // of one kind in a row hear it once (the author, 2026-10-27).
  const prev = run.pos > 0 ? run.questions.find((x) => x.id === run.order[run.pos - 1]) : undefined;
  const slot = ASK[q.kind].slot;
  const withPrompt = !!slot && (!prev || ASK[prev.kind].slot !== slot);
  const label = `${run.round > 0 ? 'Again · ' : ''}${run.pos + 1} of ${run.order.length}`;
  const key = `${run.round}:${q.id}`;
  return (
    <>
      {q.kind === 'trace' ? (
        <TraceQuestion key={key} q={q} label={label} tracing={tracing} onAnswer={onAnswer} />
      ) : q.kind === 'memory' ? (
        <MemoryQuestion key={key} q={q} label={label} onAnswer={onAnswer} />
      ) : q.kind === 'find' ? (
        <FindQuestion key={key} q={q} label={label} onAnswer={onAnswer} />
      ) : (
        <QuestionView key={key} q={q} bank={bank} label={label} withPrompt={withPrompt} onAnswer={onAnswer} />
      )}
      <p className="quiz-stop">
        <button type="button" className="link-btn" onClick={onStop}>
          Stop the quiz
        </button>{' '}
        — it stays here to continue later.
      </p>
    </>
  );
}

// ── the end ───────────────────────────────────────────────────────────────
/**
 * The one number the end leads with, as a meter: right the first time out of
 * the questions asked, the fill on a lighter track of the same green, the
 * count large in the middle. Not a two-slice pie: one ratio, one ring.
 */
function ScoreRing({ right, total, note }: { right: number; total: number; note: string }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  const share = total ? right / total : 0;
  return (
    <div className="score-ring" role="img" aria-label={`${right} of ${total} ${note}`}>
      <svg viewBox="0 0 120 120" width="168" height="168" aria-hidden="true">
        <circle className="score-ring-track" cx="60" cy="60" r={r} />
        {share > 0 && (
          <circle
            className="score-ring-fill"
            cx="60"
            cy="60"
            r={r}
            strokeDasharray={`${(len * share).toFixed(1)} ${len.toFixed(1)}`}
            transform="rotate(-90 60 60)"
          />
        )}
      </svg>
      <span className="score-ring-text" aria-hidden="true">
        <span className="score-ring-value">
          {right}
          <span className="score-ring-of"> of {total}</span>
        </span>
        <span className="score-ring-note">{note}</span>
      </span>
    </div>
  );
}

function EndScreen({
  run,
  bank,
  onAgain,
  onMistakes,
  onDone,
}: {
  run: Run;
  bank: QuizBank;
  onAgain: () => void;
  onMistakes: () => void;
  onDone: () => void;
}) {
  const s = useMemo(() => scoreOf(run), [run]);
  const player = useSequence();
  const byId = useMemo(() => new Map(run.questions.map((q) => [q.id, q])), [run]);
  /** Every scored question in the order asked, and how many tries it took. */
  const dots = useMemo(() => {
    const tries = new Map<string, Answer[]>();
    for (const a of run.answers) if (!UNSCORED.includes(a.kind)) tries.set(a.qid, [...(tries.get(a.qid) ?? []), a]);
    return [...tries.entries()].map(([qid, as]) => ({ qid, asked: as[0].asked, tries: as.findIndex((a) => a.ok) + 1 || as.length }));
  }, [run]);
  const traced = run.answers.filter((a) => a.kind === 'trace' && a.ok).length;
  const share = s.total ? s.right / s.total : 0;
  const img = (file: string) => `${import.meta.env.BASE_URL}images/kids/${file}?v=${__IMAGE_VERSION__}`;

  useEffect(() => {
    const u = promptUrl(bank, 'quiz-done');
    if (u) void player.run([u]);
  }, [bank, player]);

  return (
    <section className="check-result quiz-end">
      <div className="quiz-end-head">
        {/* Manāra beams at a good result and stays still otherwise — never
            a frown at a child (Design/iqra-kids.md). */}
        <img className="quiz-end-manara" src={img(share >= 0.7 ? 'manara-well-done.png' : 'manara.png')} alt="" />
        {s.total > 0 ? (
          <ScoreRing right={s.right} total={s.total} note={run.mistakesOnly ? 'right the first time, on your mistakes' : 'right the first time'} />
        ) : (
          <p className="check-verdict">All done!</p>
        )}
      </div>

      {dots.length > 0 && (
        <figure className="quiz-dots-fig">
          <div className="quiz-dots" role="img" aria-label={`${s.right} right the first time, ${s.total - s.right} put right later`}>
            {dots.map((d) => (
              <span
                key={d.qid}
                className={`quiz-dot ${d.tries === 1 ? 'first' : 'later'}`}
                title={`${d.asked} — ${d.tries === 1 ? 'right the first time' : `right on try ${d.tries}`}`}
              />
            ))}
          </div>
          <figcaption className="quiz-legend">
            <span>
              <span className="quiz-dot first" aria-hidden="true" /> Right the first time · {s.right}
            </span>
            {s.total > s.right && (
              <span>
                <span className="quiz-dot later" aria-hidden="true" /> Put right later · {s.total - s.right}
              </span>
            )}
          </figcaption>
        </figure>
      )}

      <div className="quiz-tiles">
        <div className="quiz-tile">
          <span className="quiz-tile-label">Time</span>
          <span className="quiz-tile-value">{formatTime(s.seconds)}</span>
        </div>
        <div className="quiz-tile">
          <span className="quiz-tile-label">Rounds</span>
          <span className="quiz-tile-value">{Math.max(1, s.rounds.length)}</span>
        </div>
        {traced > 0 && (
          <div className="quiz-tile">
            <span className="quiz-tile-label">Letters traced</span>
            <span className="quiz-tile-value">{traced}</span>
          </div>
        )}
        {s.games.played > 0 && (
          <div className="quiz-tile">
            <span className="quiz-tile-label">Memory pairs</span>
            <span className="quiz-tile-value">
              {s.games.played} {s.games.played === 1 ? 'game' : 'games'} · {s.games.turns} turns
            </span>
          </div>
        )}
      </div>

      {s.topics.length > 0 && (
        <>
          <h4 className="quiz-end-h">Right the first time, by topic</h4>
          <ul className="quiz-bars">
            {s.topics.map(({ topic, right, total }) => (
              <li key={topic.id} className="quiz-bar" title={`${topic.title}: ${right} of ${total} right the first time`}>
                <span className="quiz-bar-name">{topic.title}</span>
                <span className="quiz-bar-track" aria-hidden="true">
                  {right > 0 && <span className="quiz-bar-fill" style={{ width: `${(100 * right) / total}%` }} />}
                </span>
                <span className="quiz-bar-count">
                  {right} of {total}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {s.missed.length > 0 && (
        <>
          <h4 className="quiz-end-h">The ones you missed — every one put right before the end</h4>
          <ul className="quiz-missed">
            {s.missed.map((a) => {
              const q = byId.get(a.qid);
              const c = q ? contrastFor(bank, q, a.picked) : undefined;
              // what to hear again: the word that was the answer, where three
              // were heard; nothing, where a shape was read
              const clips = !q ? [] : q.kind === 'find' ? [q.clips[q.answer[0]]] : q.clips;
              return (
                <li key={a.qid}>
                  {clips.length > 0 && (
                    <button type="button" className="btn quiz-mini-play" aria-label="Hear it" onClick={() => void player.run(clips.map(clipUrl))}>
                      <PlayIcon playing={false} />
                    </button>
                  )}
                  {q?.kind === 'position' ? (
                    <span className="quiz-missed-en">
                      <Mixed text={a.asked} />
                    </span>
                  ) : (
                    <span className="quiz-missed-ar" dir="rtl">
                      {(q?.kind === 'sameDiff' ? q.clips.map((x) => x.text) : [a.asked]).map((t, k) => (
                        <Still key={k} text={t} />
                      ))}
                    </span>
                  )}
                  <span className="quiz-missed-picked">
                    {q?.kind === 'sameDiff' ? (
                      <>you said “{a.picked}”</>
                    ) : q?.kind === 'trace' ? (
                      <>traced with {a.picked}</>
                    ) : (
                      <>
                        you tapped <Still text={a.picked} />
                      </>
                    )}
                  </span>
                  {c && (
                    <button type="button" className="btn quiz-diff-btn" onClick={() => void player.run([contrastUrl(c)])}>
                      Hear the difference
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="quiz-actions quiz-end-actions">
        {s.missed.length > 0 && (
          <button type="button" className="btn primary" onClick={onMistakes}>
            Practice my mistakes
          </button>
        )}
        <button type="button" className={`btn ${s.missed.length ? '' : 'primary'}`} onClick={onAgain}>
          Again
        </button>
        <a className="btn" href="#/" onClick={onDone}>
          Done
        </a>
      </div>
    </section>
  );
}

// ── the page ──────────────────────────────────────────────────────────────
type Screen = 'start' | 'choose' | 'ready' | 'play' | 'end';

export function QuizPage({ config, admin }: { config: AppConfig; admin: boolean }) {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [failed, setFailed] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(readSettings);
  const [saved, setSaved] = useState<Run | null>(readRun);
  const [run, setRun] = useState<Run | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const [gate, setGate] = useState(false);
  const [tracing, setTracing] = useState<Tracing | null>(null);

  // Lesson 30 — the tracing board and its strokes — once a quiz asks for it.
  const needsTracing = !!run?.questions.some((q) => q.kind === 'trace');
  useEffect(() => {
    if (!needsTracing || tracing) return;
    let alive = true;
    loadLesson(30)
      .then((lesson) => alive && setTracing({ lesson, items: toItems(lesson) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [needsTracing, tracing]);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}quiz/quiz.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`quiz.json: ${r.status}`);
        return r.json() as Promise<QuizBank>;
      })
      .then((b) => alive && setBank(b))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // What a learner may be asked: only clips of lessons they may open. A
  // topic is ready, waiting on a lesson's publication, or not yet recorded.
  const visible = useMemo(() => (bank ? visibleBank(bank, (id) => canSeeLesson(config, id, admin)) : null), [bank, config, admin]);
  const statuses = useMemo(
    () => (bank && visible ? (Object.fromEntries(TOPICS.map((t) => [t.id, topicStatus(t, bank, visible)])) as Record<TopicId, TopicStatus>) : null),
    [bank, visible],
  );
  const ready = statuses ? TOPICS.filter((t) => statuses[t.id] === 'ready') : [];
  const chosen = settings ? { ...settings, topics: settings.topics.filter((id) => ready.some((t) => t.id === id)) } : null;

  /** Into a quiz: from a tap, so the sound can start on iOS. */
  const play = (r: Run) => {
    warmAudio();
    writeRun(r);
    setSaved(null);
    setRun(r);
    setScreen('ready');
  };

  const onChange = useCallback((r: Run) => {
    writeRun(r);
    setRun(r);
    if (r.done) setScreen('end');
  }, []);

  const onReady = useCallback(() => setScreen('play'), []);

  if (failed) return <p className="loading">Could not load the quiz. Please reload.</p>;
  if (!bank || !visible || !statuses) return <p className="loading">Loading…</p>;

  return (
    <main className="quiz-page">
      {screen === 'start' && (
        <section className="quiz-panel">
          <p className="quiz-lead">
            Hear a sound, then tap what you heard. Every mistake comes back at the end until you get it right.
          </p>
          {saved && (
            <div className="quiz-banner">
              <span>A quiz on this device is not finished.</span>
              <span className="quiz-actions">
                <button type="button" className="btn primary" onClick={() => play(saved)}>
                  Continue
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    writeRun(null);
                    setSaved(null);
                  }}
                >
                  Start over
                </button>
              </span>
            </div>
          )}
          {ready.length === 0 ? (
            <p className="quiz-lead">Nothing to practice yet: the lessons it draws on are not published.</p>
          ) : chosen && chosen.topics.length > 0 ? (
            <>
              <p className="quiz-chosen">
                <strong>{chosen.count} questions</strong> · {chosen.topics.map((id) => topicOf(id).title).join(' · ')}
              </p>
              <div className="quiz-actions">
                <button type="button" className="btn primary quiz-start-btn" onClick={() => play(newRun(visible, chosen))}>
                  Start
                </button>
                <button type="button" className="btn" onClick={() => setGate(true)}>
                  Change
                </button>
              </div>
            </>
          ) : (
            <div className="quiz-actions">
              <button type="button" className="btn primary quiz-start-btn" onClick={() => setGate(true)}>
                Choose what to practice
              </button>
            </div>
          )}
          <p className="account-hint">Choosing asks a grown-up question first, so a little one cannot change it by accident.</p>
        </section>
      )}

      {screen === 'choose' && (
        <Chooser
          statuses={statuses}
          initial={settings}
          onCancel={() => setScreen('start')}
          onStart={(s) => {
            writeSettings(s);
            setSettings(s);
            play(newRun(visible, s));
          }}
        />
      )}

      {screen === 'ready' && run && <Ready run={run} bank={bank} onReady={onReady} onBack={() => setScreen('start')} />}

      {screen === 'play' && run && (
        <RunView
          run={run}
          bank={bank}
          tracing={tracing}
          onChange={onChange}
          onStop={() => {
            setSaved(readRun());
            setScreen('start');
          }}
        />
      )}

      {screen === 'end' && run && (
        <EndScreen
          run={run}
          bank={bank}
          onAgain={() => chosen && chosen.topics.length > 0 && play(newRun(visible, chosen))}
          onMistakes={() => play(mistakesRun(run))}
          onDone={() => writeRun(null)}
        />
      )}

      {gate && (
        <Gate
          onCancel={() => setGate(false)}
          onPass={() => {
            setGate(false);
            setScreen('choose');
          }}
        />
      )}
    </main>
  );
}
