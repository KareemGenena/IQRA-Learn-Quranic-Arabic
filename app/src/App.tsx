import { useEffect, useState } from 'react';
import { WordGrid } from './components/WordGrid';
import { AdminGate } from './components/AdminGate';
import { CalibratePage } from './pages/CalibratePage';
import { getSession, signOut } from './lib/adminAuth';
import { storeCloudSnapshot } from './lib/calibration';
import { fetchCloudCalibrations } from './lib/cloudCalibration';
import type { Lesson } from './types';

type Theme = 'light' | 'dark';

// Speed-ups only: the recordings are already at a slow teaching pace, and
// the browser's time-stretcher sounds robotic below 1× while compression
// (speeding up) stays natural-sounding.
const RATES = [1, 1.25, 1.5, 2];

function initialTheme(): Theme {
  const saved = localStorage.getItem('iqra-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initialRate(): number {
  const saved = Number(localStorage.getItem('iqra-rate'));
  return RATES.includes(saved) ? saved : 1;
}

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [rate, setRate] = useState<number>(initialRate);
  const [admin, setAdmin] = useState(() => getSession() !== null);
  const route = useHashRoute();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('iqra-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('iqra-rate', String(rate));
  }, [rate]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}lessons/lesson01/words.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setLesson)
      .catch(() => setError(true));
  }, []);

  // Pull the latest calibrations from the cloud (soft-fail: offline or
  // Firestore unavailable just means the last-known/baked timings are used).
  useEffect(() => {
    if (!lesson) return;
    fetchCloudCalibrations(lesson.lesson)
      .then((map) => storeCloudSnapshot(lesson.lesson, map))
      .catch(() => {});
  }, [lesson]);

  const calibrating = route === '#calibrate';

  return (
    <div className="app">
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="logo" />
        <div className="titles">
          <h1>IQRA</h1>
          <p>Learn Quranic Arabic</p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {error && <p className="loading">Could not load the lesson. Please reload.</p>}
      {!error && !lesson && <p className="loading">Loading…</p>}

      {lesson && calibrating && (
        <>
          <nav className="breadcrumb">
            <a href="#">← Back to words</a>
            <h2>Calibrate timings</h2>
            {admin && (
              <button
                type="button"
                className="signout-btn"
                onClick={() => {
                  signOut();
                  setAdmin(false);
                }}
              >
                Sign out
              </button>
            )}
          </nav>
          {admin ? (
            <CalibratePage lesson={lesson} />
          ) : (
            <AdminGate onUnlock={() => setAdmin(true)} />
          )}
        </>
      )}

      {lesson && !calibrating && (
        <>
          <section className="lesson-head">
            <h2>
              Lesson {lesson.lesson} — {lesson.title}
            </h2>
            <p className="lesson-sub" dir="rtl" lang="ar">
              {lesson.titleArabic}
            </p>
            <div className="toolbar">
              <p className="hint">
                Tap a word to hear it. Watch each letter light up as it is pronounced.
              </p>
              <div className="rate-group" role="group" aria-label="Playback speed">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rate-btn ${r === rate ? 'active' : ''}`}
                    onClick={() => setRate(r)}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </div>
          </section>
          <WordGrid lesson={lesson} rate={rate} />
        </>
      )}
    </div>
  );
}
