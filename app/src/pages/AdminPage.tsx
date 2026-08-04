import { useEffect, useMemo, useRef, useState } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { splitClusters } from '../lib/graphemes';
import { audibleIndices } from '../lib/timing';
import { getAudioSrc } from '../lib/audioSource';
import { speechBounds } from '../lib/audioAnalysis';
import { allPlayables } from '../lib/lessons';
import { clearCalibration, loadCalibration, saveCalibration } from '../lib/calibration';
import { deleteCloudCalibration, saveCloudCalibration } from '../lib/cloudCalibration';
import { audioUrl, playWithHighlights, stopActivePlayback } from '../lib/playback';
import type { PlaybackHandle } from '../lib/playback';
import type { Lesson } from '../types';

type Phase = 'idle' | 'capturing' | 'review';

export function AdminPage({ lesson }: { lesson: Lesson }) {
  const units = useMemo(() => allPlayables(lesson), [lesson]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [taps, setTaps] = useState<number[]>([]);
  const [boundaries, setBoundaries] = useState<number[] | null>(null);
  const [offsetMs, setOffsetMs] = useState(150);
  const [rate, setRate] = useState(0.75);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [calVersion, setCalVersion] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tapsRef = useRef<number[]>([]);
  const previewRef = useRef<PlaybackHandle | null>(null);

  const unit = units[idx];
  const playable = unit.playable;
  const clusters = useMemo(() => splitClusters(playable.text), [playable.text]);
  /** Only pronounced letters get a tap — the silent lam is skipped. */
  const audible = useMemo(
    () => audibleIndices(clusters, playable.silentClusters),
    [clusters, playable.silentClusters],
  );
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

  const selectUnit = (n: number) => {
    stopEverything();
    setIdx(n);
    setPhase('idle');
    setTaps([]);
    setBoundaries(null);
  };

  const startCapture = async () => {
    stopEverything();
    const url = audioUrl(lesson, playable);
    const [bounds, src] = await Promise.all([speechBounds(url), getAudioSrc(url)]);

    tapsRef.current = [];
    setTaps([]);
    setPhase('capturing');

    const audio = new Audio(src);
    audio.playbackRate = rate;
    audio.preservesPitch = true;
    audioRef.current = audio;

    const finalize = () => {
      const captured = tapsRef.current;
      if (captured.length === audible.length) {
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
    // Don't sit through the silent tail once every letter has been tapped.
    audio.addEventListener('timeupdate', () => {
      if (
        audioRef.current === audio &&
        tapsRef.current.length === audible.length &&
        audio.currentTime >= bounds.end
      ) {
        finalize();
      }
    });
    void audio.play();
  };

  const recordTap = () => {
    const audio = audioRef.current;
    if (phase !== 'capturing' || !audio || tapsRef.current.length >= audible.length) return;
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
  }, [phase, audible.length, offsetMs, rate]);

  const preview = async () => {
    if (!boundaries) return;
    stopEverything();
    const src = await getAudioSrc(audioUrl(lesson, playable));
    previewRef.current = playWithHighlights(
      src,
      boundaries,
      setActiveIndex,
      () => {
        previewRef.current = null;
      },
      rate,
      audible,
    );
  };

  const save = () => {
    if (!boundaries) return;
    saveCalibration(lesson.lesson, playable.key, boundaries);
    setSyncMsg(`${unit.label}: syncing…`);
    saveCloudCalibration(lesson.lesson, playable.key, boundaries)
      .then(() => setSyncMsg(`${unit.label}: saved & synced to all devices ✓`))
      .catch((err) => {
        console.error('cloud sync failed:', err);
        setSyncMsg(`${unit.label}: saved on this device — cloud sync FAILED`);
      });
    setCalVersion((v) => v + 1);
    setPhase('idle');
    setBoundaries(null);
    setTaps([]);
    if (idx < units.length - 1) selectUnit(idx + 1);
  };

  const removeSaved = () => {
    clearCalibration(lesson.lesson, playable.key);
    setSyncMsg(`${unit.label}: deleting from cloud…`);
    deleteCloudCalibration(lesson.lesson, playable.key)
      .then(() => setSyncMsg(`${unit.label}: calibration deleted everywhere ✓`))
      .catch((err) => {
        console.error('cloud delete failed:', err);
        setSyncMsg(`${unit.label}: deleted here — cloud delete FAILED`);
      });
    setCalVersion((v) => v + 1);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(calibration, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calibration-lesson${lesson.lesson}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const calibratedCount = units.filter((u) => calibration[u.playable.key]).length;
  // The pending marker points at the CLUSTER awaiting its tap.
  const pendingIndex = phase === 'capturing' ? (audible[taps.length] ?? null) : null;

  return (
    <main className="calibrate-page">
      <p className="cal-intro">
        Play a word and tap <kbd>Space</kbd> (or the big button) at the moment each letter begins.
        Silent letters are skipped automatically. Saved timings sync to every device.
      </p>

      <div className="cal-word-nav" dir="rtl">
        {units.map((u, i) => (
          <button
            key={u.playable.key}
            type="button"
            className={`cal-chip ${i === idx ? 'current' : ''} ${calibration[u.playable.key] ? 'done' : ''}`}
            onClick={() => selectUnit(i)}
          >
            {u.label}
          </button>
        ))}
      </div>

      <div className="cal-stage">
        <ArabicWord
          text={playable.text}
          clusters={clusters}
          activeIndex={activeIndex}
          pendingIndex={pendingIndex}
          prefixClusters={playable.prefixClusters}
          silentClusters={playable.silentClusters}
          className="cal-word"
        />
        <p className="cal-status">
          {phase === 'idle' &&
            (calibration[playable.key]
              ? 'Calibrated. Recapture to redo it.'
              : 'Not calibrated yet — timings are automatic.')}
          {phase === 'capturing' &&
            `Listening… tap for letter ${Math.min(taps.length + 1, audible.length)} of ${audible.length}`}
          {phase === 'review' && 'Captured! Preview it, then save or redo.'}
        </p>

        {phase === 'capturing' ? (
          <button type="button" className="btn tap-btn" onPointerDown={recordTap}>
            TAP
          </button>
        ) : (
          <div className="cal-actions">
            <button type="button" className="btn primary" onClick={() => void startCapture()}>
              {phase === 'review' ? 'Recapture' : 'Start capture'}
            </button>
            {phase === 'review' && (
              <>
                <button type="button" className="btn" onClick={() => void preview()}>
                  Preview
                </button>
                <button type="button" className="btn primary" onClick={save}>
                  Save
                </button>
              </>
            )}
            {phase === 'idle' && calibration[playable.key] && (
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

      {syncMsg && <p className="sync-msg">{syncMsg}</p>}

      <div className="cal-footer">
        <span>
          {calibratedCount} / {units.length} calibrated
        </span>
        <button type="button" className="btn" onClick={exportJson}>
          Export calibration
        </button>
      </div>
    </main>
  );
}
