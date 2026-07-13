import { useEffect, useMemo, useRef, useState } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { splitClusters } from '../lib/graphemes';
import { speechBounds } from '../lib/audioAnalysis';
import {
  clearCalibration,
  loadCalibration,
  saveCalibration,
} from '../lib/calibration';
import {
  audioUrl,
  playWithHighlights,
  stopActivePlayback,
} from '../lib/playback';
import type { PlaybackHandle } from '../lib/playback';
import type { Lesson } from '../types';

type Phase = 'idle' | 'capturing' | 'review';

export function CalibratePage({ lesson }: { lesson: Lesson }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [taps, setTaps] = useState<number[]>([]);
  const [boundaries, setBoundaries] = useState<number[] | null>(null);
  const [offsetMs, setOffsetMs] = useState(150);
  // Capture below full speed: taps land more precisely, and the saved
  // boundaries are in media time so they are correct at every speed.
  // 0.75 is the default — 0.5 is more precise still but sounds robotic.
  const [rate, setRate] = useState(0.75);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [calVersion, setCalVersion] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tapsRef = useRef<number[]>([]);
  const previewRef = useRef<PlaybackHandle | null>(null);

  const word = lesson.words[wordIdx];
  const clusters = useMemo(() => splitClusters(word.arabic), [word.arabic]);
  const calibration = useMemo(
    () => loadCalibration(lesson.lesson),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson.lesson, calVersion],
  );

  const stopEverything = () => {
    stopActivePlayback();
    previewRef.current?.stop();
    previewRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setActiveIndex(null);
  };

  const selectWord = (idx: number) => {
    stopEverything();
    setWordIdx(idx);
    setPhase('idle');
    setTaps([]);
    setBoundaries(null);
  };

  const startCapture = async () => {
    stopEverything();
    const url = audioUrl(lesson, word);
    const bounds = await speechBounds(url);

    tapsRef.current = [];
    setTaps([]);
    setPhase('capturing');

    const audio = new Audio(url);
    audio.playbackRate = rate;
    audio.preservesPitch = true;
    audioRef.current = audio;

    const finalize = () => {
      const captured = tapsRef.current;
      if (captured.length === clusters.length) {
        // Final boundary: detected speech end, but never before the last tap
        // (a late tap must still leave the last letter some highlight time).
        const lastTap = captured[captured.length - 1];
        const end = Math.min(Math.max(bounds.end, lastTap + 0.2), bounds.duration);
        setBoundaries([...captured, end]);
        setPhase('review');
      } else {
        setPhase('idle');
        setTaps([]);
      }
      audio.pause();
      audioRef.current = null;
    };

    audio.addEventListener('ended', finalize);
    // Don't make the user sit through the silent tail of the recording:
    // once all letters are tapped and speech is over, wrap up early.
    audio.addEventListener('timeupdate', () => {
      if (
        audioRef.current === audio &&
        tapsRef.current.length === clusters.length &&
        audio.currentTime >= bounds.end
      ) {
        finalize();
      }
    });
    void audio.play();
  };

  const recordTap = () => {
    const audio = audioRef.current;
    if (phase !== 'capturing' || !audio || tapsRef.current.length >= clusters.length) return;
    // Reaction time is wall-clock; the media only advanced by offset × rate.
    const t = Math.max(0, audio.currentTime - (offsetMs / 1000) * rate);
    const prev = tapsRef.current[tapsRef.current.length - 1] ?? -1;
    tapsRef.current = [...tapsRef.current, Math.max(t, prev + 0.01)];
    setTaps(tapsRef.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        recordTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, clusters.length, offsetMs, rate]);

  const preview = () => {
    if (!boundaries) return;
    stopEverything();
    previewRef.current = playWithHighlights(
      audioUrl(lesson, word),
      boundaries,
      setActiveIndex,
      () => {
        previewRef.current = null;
      },
      rate,
    );
  };

  const save = () => {
    if (!boundaries) return;
    saveCalibration(lesson.lesson, word.id, boundaries);
    setCalVersion((v) => v + 1);
    setPhase('idle');
    setBoundaries(null);
    setTaps([]);
    if (wordIdx < lesson.words.length - 1) selectWord(wordIdx + 1);
  };

  const removeSaved = () => {
    clearCalibration(lesson.lesson, word.id);
    setCalVersion((v) => v + 1);
  };

  const exportJson = () => {
    const out = {
      ...lesson,
      words: lesson.words.map((w) => ({
        ...w,
        timings: calibration[w.id] ?? w.timings,
      })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'words.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const calibratedCount = Object.keys(calibration).length;
  const pendingIndex = phase === 'capturing' ? taps.length : null;

  return (
    <main className="calibrate-page">
      <p className="cal-intro">
        Play a word and tap <kbd>Space</kbd> (or the big button) at the moment each letter begins.
        Preview the result, then save. Saved timings are used by the app immediately.
      </p>

      <div className="cal-word-nav" dir="rtl">
        {lesson.words.map((w, i) => (
          <button
            key={w.id}
            type="button"
            className={`cal-chip ${i === wordIdx ? 'current' : ''} ${calibration[w.id] ? 'done' : ''}`}
            onClick={() => selectWord(i)}
          >
            {w.id}
          </button>
        ))}
      </div>

      <div className="cal-stage">
        <ArabicWord
          text={word.arabic}
          clusters={clusters}
          activeIndex={activeIndex}
          pendingIndex={pendingIndex}
          className="cal-word"
        />
        <p className="cal-status">
          {phase === 'idle' &&
            (calibration[word.id]
              ? 'This word is calibrated. Recapture to redo it.'
              : 'Not calibrated yet — timings are automatic.')}
          {phase === 'capturing' &&
            `Listening... tap for letter ${Math.min(taps.length + 1, clusters.length)} of ${clusters.length}`}
          {phase === 'review' && 'Captured! Preview it, then save or redo.'}
        </p>

        {phase === 'capturing' ? (
          <button type="button" className="btn tap-btn" onPointerDown={recordTap}>
            TAP
          </button>
        ) : (
          <div className="cal-actions">
            <button type="button" className="btn primary" onClick={startCapture}>
              {phase === 'review' ? 'Recapture' : 'Start capture'}
            </button>
            {phase === 'review' && (
              <>
                <button type="button" className="btn" onClick={preview}>
                  Preview
                </button>
                <button type="button" className="btn primary" onClick={save}>
                  Save
                </button>
              </>
            )}
            {phase === 'idle' && calibration[word.id] && (
              <button type="button" className="btn danger" onClick={removeSaved}>
                Delete calibration
              </button>
            )}
          </div>
        )}

        <div className="rate-group" role="group" aria-label="Capture speed">
          {[0.5, 0.75, 1].map((r) => (
            <button
              key={r}
              type="button"
              className={`rate-btn ${r === rate ? 'active' : ''}`}
              disabled={phase === 'capturing'}
              onClick={() => setRate(r)}
            >
              {r}×
            </button>
          ))}
        </div>

        <label className="cal-offset">
          Tap reaction offset: {offsetMs} ms
          <input
            type="range"
            min="0"
            max="300"
            step="10"
            value={offsetMs}
            onChange={(e) => setOffsetMs(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="cal-footer">
        <span>
          {calibratedCount} / {lesson.words.length} words calibrated
        </span>
        <button type="button" className="btn" onClick={exportJson}>
          Export words.json
        </button>
      </div>
    </main>
  );
}
