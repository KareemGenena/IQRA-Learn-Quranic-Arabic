import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { PlayIcon } from '../components/PlayIcon';
import { derivedSilent, splitClusters } from '../lib/graphemes';
import { audioUrl, playWithHighlights, prepareClip, warmAudio } from '../lib/playback';
import { getAudioBlob } from '../lib/audioSource';
import { chime, click, knock } from '../lib/sounds';
import {
  COUNTS,
  PROMPT_OF,
  TOPICS,
  answered,
  current,
  mistakesRun,
  newRun,
  readRun,
  readSettings,
  scoreOf,
  topicAvailable,
  topicOf,
  writeRun,
  writeSettings,
} from '../lib/quiz';
import type { ClipRef, Question, QuizBank, Run, Settings, Topic, TopicId } from '../lib/quiz';
import type { AppConfig } from '../lib/appConfig';
import type { Lesson, Playable } from '../types';

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
function Chooser({
  available,
  initial,
  onStart,
  onCancel,
}: {
  available: Topic[];
  initial: Settings | null;
  onStart: (s: Settings) => void;
  onCancel: () => void;
}) {
  const open = (id: TopicId) => available.some((t) => t.id === id);
  const [topics, setTopics] = useState<TopicId[]>(() => (initial?.topics ?? []).filter(open));
  const [count, setCount] = useState(initial?.count ?? COUNTS[0]);
  const toggle = (id: TopicId) => setTopics((ts) => (ts.includes(id) ? ts.filter((x) => x !== id) : [...ts, id]));

  return (
    <section className="quiz-panel">
      <h3 className="quiz-h">What to practice</h3>
      <ul className="quiz-topics">
        {TOPICS.map((t) => {
          const on = open(t.id);
          return (
            <li key={t.id} className={`quiz-topic ${on ? '' : 'off'}`}>
              <label>
                <input type="checkbox" checked={topics.includes(t.id)} disabled={!on} onChange={() => toggle(t.id)} />
                <span>
                  <span className="quiz-topic-title">{t.title}</span>
                  <span className="quiz-topic-sub">
                    {t.blurb} Workbook Level 1, section {t.section}.{on ? '' : ' Not published yet.'}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
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
    () => [...new Set([...Object.values(PROMPT_OF), 'quiz-review', 'quiz-done'].map((s) => promptUrl(bank, s)).filter((u): u is string => !!u))],
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
  /** Play the spoken instruction first: the kind of question changed. */
  withPrompt: boolean;
  onAnswer: (picked: string, ok: boolean, seconds: number) => void;
}) {
  const player = useSequence();
  const [awake, setAwake] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [found, setFound] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const shownAt = useRef(performance.now());
  const result = useRef<{ picked: string; ok: boolean; seconds: number } | null>(null);
  const sent = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const item = useMemo(() => q.clips.map(clipUrl), [q]);
  const slot = PROMPT_OF[q.kind];
  const line = bank.prompts[slot]?.line ?? '';

  // The instruction (when the kind changed), then the clip; the choices wake
  // when it has played. A clip that will not play never strands the child.
  useEffect(() => {
    alive.current = true;
    item.forEach((u) => void prepareClip(u).catch(() => undefined));
    const p = withPrompt ? promptUrl(bank, slot) : null;
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
      // the right one is marked; hear the clip again with it in view
      void player.run(item).then(() => {
        if (alive.current) timer.current = window.setTimeout(next, 1100);
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
        {q.kind === 'hunt' && q.target && (
          <span className="quiz-target">
            <Still text={q.target} />
          </span>
        )}
        <span>{line}</span>
      </p>
      <div className="check-prompt">
        <button type="button" className="btn primary check-play" onClick={replay}>
          <PlayIcon playing={false} />
          Listen again
        </button>
      </div>

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
                {words ? <span className="quiz-word">{c}</span> : <Still text={c} />}
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
          <button type="button" className="btn" onClick={next}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── a quiz under way ──────────────────────────────────────────────────────
function RunView({ run, bank, onChange, onStop }: { run: Run; bank: QuizBank; onChange: (r: Run) => void; onStop: () => void }) {
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

  const prev = run.pos > 0 ? run.questions.find((x) => x.id === run.order[run.pos - 1]) : undefined;
  const label = `${run.round > 0 ? 'Again · ' : ''}${run.pos + 1} of ${run.order.length}`;
  return (
    <>
      <QuestionView key={`${run.round}:${q.id}`} q={q} bank={bank} label={label} withPrompt={prev?.kind !== q.kind} onAnswer={onAnswer} />
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

  useEffect(() => {
    const u = promptUrl(bank, 'quiz-done');
    if (u) void player.run([u]);
  }, [bank, player]);

  return (
    <section className="check-result quiz-end">
      <p className="check-score">
        {s.right} of {s.total}
      </p>
      <p className="check-verdict">right the first time{run.mistakesOnly ? ', on your mistakes' : ''}</p>
      <ul className="quiz-bars">
        {s.topics.map(({ topic, right, total }) => (
          <li key={topic.id} className="quiz-bar">
            <span className="quiz-bar-name">{topic.title}</span>
            <span className="quiz-bar-track" aria-hidden="true">
              <span className="quiz-bar-fill" style={{ width: `${Math.round((100 * right) / total)}%` }} />
            </span>
            <span className="quiz-bar-count">
              {right} / {total}
            </span>
          </li>
        ))}
      </ul>
      <p className="quiz-time">Time: {formatTime(s.seconds)}</p>
      {s.missed.length > 0 && (
        <>
          <p className="check-revisit">The ones you missed — every one put right before the end:</p>
          <ul className="quiz-missed">
            {s.missed.map((a) => {
              const q = byId.get(a.qid);
              return (
                <li key={a.qid}>
                  <button
                    type="button"
                    className="btn quiz-mini-play"
                    aria-label="Hear it"
                    onClick={() => q && void player.run(q.clips.map(clipUrl))}
                  >
                    <PlayIcon playing={false} />
                  </button>
                  <span className="quiz-missed-ar" dir="rtl">
                    {(q?.kind === 'sameDiff' ? q.clips.map((c) => c.text) : [a.asked]).map((t, k) => (
                      <Still key={k} text={t} />
                    ))}
                  </span>
                  <span className="quiz-missed-picked">
                    {q?.kind === 'sameDiff' ? (
                      <>you said “{a.picked}”</>
                    ) : (
                      <>
                        you tapped <Still text={a.picked} />
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="check-actions">
        {s.missed.length > 0 && (
          <>
            <button type="button" className="btn primary" onClick={onMistakes}>
              Practice my mistakes
            </button>{' '}
          </>
        )}
        <button type="button" className={`btn ${s.missed.length ? '' : 'primary'}`} onClick={onAgain}>
          Again
        </button>{' '}
        <a className="btn" href="#/" onClick={onDone}>
          Done
        </a>
      </p>
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

  const available = useMemo(() => (bank ? TOPICS.filter((t) => topicAvailable(t, bank, config, admin)) : []), [bank, config, admin]);
  const chosen = settings ? { ...settings, topics: settings.topics.filter((id) => available.some((t) => t.id === id)) } : null;

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
  if (!bank) return <p className="loading">Loading…</p>;

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
          {available.length === 0 ? (
            <p className="quiz-lead">Nothing to practice yet: the lessons it draws on are not published.</p>
          ) : chosen && chosen.topics.length > 0 ? (
            <>
              <p className="quiz-chosen">
                <strong>{chosen.count} questions</strong> · {chosen.topics.map((id) => topicOf(id).title).join(' · ')}
              </p>
              <div className="quiz-actions">
                <button type="button" className="btn primary quiz-start-btn" onClick={() => play(newRun(bank, chosen))}>
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
          available={available}
          initial={settings}
          onCancel={() => setScreen('start')}
          onStart={(s) => {
            writeSettings(s);
            setSettings(s);
            play(newRun(bank, s));
          }}
        />
      )}

      {screen === 'ready' && run && <Ready run={run} bank={bank} onReady={onReady} onBack={() => setScreen('start')} />}

      {screen === 'play' && run && (
        <RunView
          run={run}
          bank={bank}
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
          onAgain={() => chosen && chosen.topics.length > 0 && play(newRun(bank, chosen))}
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
