import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { PlayIcon } from '../components/PlayIcon';
import { derivedSilent, splitClusters } from '../lib/graphemes';
import { LESSONS } from '../lib/lessons';
import { markDone, recordScore } from '../lib/progress';
import { usePlayable } from '../lib/usePlayable';
import type { AssessmentItem, Lesson, Playable } from '../types';

/**
 * A Level check — lessons 41–43, one at the end of each Level
 * (scripts/make-assessments.mjs builds them from the Level's own clips).
 *
 * Hear and point: a clip plays, four words show, tap the one you heard.
 * Which rule: a word shows and plays, name its rule. The result is advice —
 * ready for the next Level, or revisit lesson N — and never a lock: every
 * lesson stays one tap away on the home page. The paper Maktab instrument
 * is a different thing (CLAUDE.md §4) and this does not pretend to be it.
 *
 * Single keys, no chords, for the learner who drives an iPad by voice:
 * P plays, 1–4 choose, N goes on.
 */
const PASS = 0.7;

function stubFor(item: AssessmentItem): Lesson {
  return { lesson: item.audio.lesson, title: '', titleArabic: '', audioPath: item.audio.path, kind: 'letters', words: [] };
}

function playableFor(item: AssessmentItem): Playable {
  return {
    key: item.audio.key,
    text: item.text,
    audio: item.audio.file,
    timings: null,
    silentClusters: derivedSilent(item.text),
    prefixClusters: 0,
  };
}

/** A word drawn still, for an option. */
function Still({ text }: { text: string }) {
  const clusters = useMemo(() => splitClusters(text), [text]);
  const silent = useMemo(() => derivedSilent(text), [text]);
  return <ArabicWord text={text} clusters={clusters} activeIndex={null} silentClusters={silent} prefixClusters={0} />;
}

function Question({
  item,
  no,
  total,
  rate,
  onAnswer,
  onNext,
  chosen,
}: {
  item: AssessmentItem;
  no: number;
  total: number;
  rate: number;
  chosen: number | null;
  onAnswer: (i: number) => void;
  onNext: () => void;
}) {
  const stub = useMemo(() => stubFor(item), [item]);
  const playable = useMemo(() => playableFor(item), [item]);
  const { clusters, activeIndex, activePhase, playing, play, toggle } = usePlayable(stub, playable, rate);

  // A hear item plays itself when it comes up; a rule item waits to be asked.
  useEffect(() => {
    if (item.type === 'hear') void play();
  }, [item, play]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.code === 'KeyP') void play();
      else if (e.code === 'KeyN' && chosen !== null) onNext();
      else if (/^(Digit|Numpad)[1-4]$/.test(e.code) && chosen === null) onAnswer(Number(e.code.slice(-1)) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chosen, onAnswer, onNext, play]);

  return (
    <section className="check-stage">
      <p className="check-progress">
        {no} of {total} · {item.type === 'hear' ? 'Which word did you hear?' : 'Which rule is this?'}
      </p>

      <div className="check-prompt">
        {item.type === 'rule' && (
          <span className="check-word">
            <ArabicWord
              text={item.text}
              clusters={clusters}
              activeIndex={activeIndex}
              activePhase={activePhase}
              silentClusters={playable.silentClusters}
              prefixClusters={0}
            />
          </span>
        )}
        <button type="button" className={`btn primary check-play ${playing ? 'playing' : ''}`} onClick={() => void toggle()}>
          <PlayIcon playing={playing} />
          {item.type === 'hear' ? 'Listen again' : 'Hear it'}
        </button>
      </div>

      <div className={`check-options ${item.type}`}>
        {item.options.map((opt, i) => {
          const state =
            chosen === null ? '' : i === item.answer ? 'right' : i === chosen ? 'wrong' : 'dim';
          return (
            <button
              key={opt}
              type="button"
              className={`check-option ${state}`}
              disabled={chosen !== null}
              onClick={() => onAnswer(i)}
              aria-label={`Option ${i + 1}`}
            >
              <span className="check-key">{i + 1}</span>
              {item.type === 'hear' ? <Still text={opt} /> : <span className="check-rule">{opt}</span>}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <p className={`check-feedback ${chosen === item.answer ? 'right' : 'wrong'}`}>
          {chosen === item.answer ? 'Yes.' : 'Not this one — the answer is marked.'}{' '}
          <button type="button" className="btn primary" onClick={onNext}>
            {no === total ? 'See the result' : 'Next'}
          </button>
        </p>
      )}
    </section>
  );
}

export function AssessmentPage({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const items = lesson.items ?? [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  const [finished, setFinished] = useState(false);

  const chosen = answers[index] ?? null;
  const onAnswer = useCallback(
    (i: number) => setAnswers((a) => (a[index] === null ? a.map((v, k) => (k === index ? i : v)) : a)),
    [index],
  );
  const onNext = useCallback(() => {
    if (index + 1 < items.length) setIndex(index + 1);
    else setFinished(true);
  }, [index, items.length]);

  const right = answers.filter((a, i) => a === items[i]?.answer).length;

  useEffect(() => {
    if (!finished) return;
    recordScore(lesson.lesson, right, items.length);
    if (items.length && right / items.length >= PASS) markDone(lesson.lesson);
  }, [finished, lesson.lesson, right, items.length]);

  const restart = () => {
    setAnswers(items.map(() => null));
    setIndex(0);
    setFinished(false);
  };

  if (items.length === 0) {
    return (
      <main className="check">
        <p className="loading">
          Nothing to check yet — the Level {lesson.level} lessons have no recordings. Come back once they do.
        </p>
      </main>
    );
  }

  if (finished) {
    const missed = new Map<number, number>();
    items.forEach((it, i) => {
      if (answers[i] !== it.answer) missed.set(it.source.lesson, (missed.get(it.source.lesson) ?? 0) + 1);
    });
    const revisit = [...missed.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => LESSONS.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => !!l);
    const passed = right / items.length >= PASS;
    const nextLevel = (lesson.level ?? 0) + 1;
    return (
      <main className="check">
        <section className="check-result">
          <p className="check-score">
            {right} of {items.length}
          </p>
          <p className="check-verdict">
            {passed
              ? nextLevel <= 3
                ? `Ready for Level ${nextLevel}.`
                : 'Level 3 done.'
              : 'Not yet — a little more practice first.'}
          </p>
          {revisit.length > 0 && (
            <>
              <p className="check-revisit">Worth revisiting:</p>
              <ul className="lesson-list">
                {revisit.map((l) => (
                  <li key={l.id}>
                    <a className="lesson-card" href={`#/lesson/${l.id}`}>
                      <span className="lesson-body">
                        <span className="lesson-title">{l.title}</span>
                        <span className="lesson-blurb">
                          {missed.get(l.id)} {missed.get(l.id) === 1 ? 'slip' : 'slips'} here
                        </span>
                      </span>
                      <span className="lesson-go" aria-hidden="true">
                        ›
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="check-actions">
            <button type="button" className="btn" onClick={restart}>
              Try again
            </button>{' '}
            <a className="btn primary" href="#/">
              All lessons
            </a>
          </p>
          <p className="account-hint">Advice, not a gate: every lesson stays open to you.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="check">
      <Question
        key={items[index].id}
        item={items[index]}
        no={index + 1}
        total={items.length}
        rate={rate}
        chosen={chosen}
        onAnswer={onAnswer}
        onNext={onNext}
      />
    </main>
  );
}
