import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WordsLesson } from './pages/WordsLesson';
import { PairsLesson } from './pages/PairsLesson';
import { CalibratePage } from './pages/CalibratePage';
import { AdminGate } from './components/AdminGate';
import { getSession, signOut } from './lib/adminAuth';
import { storeCloudSnapshot } from './lib/calibration';
import { fetchCloudCalibrations } from './lib/cloudCalibration';
import { LESSONS, loadLesson } from './lib/lessons';
import type { Lesson } from './types';

type Theme = 'light' | 'dark';

// Speed-ups only: the recordings are already at a slow teaching pace, and the
// browser's time-stretcher sounds robotic below 1×.
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

interface Route {
  page: 'home' | 'lesson' | 'calibrate';
  lessonId: number;
}

function parseRoute(hash: string): Route {
  const m = /^#\/(lesson|calibrate)\/(\d+)/.exec(hash);
  if (m) return { page: m[1] as 'lesson' | 'calibrate', lessonId: Number(m[2]) };
  return { page: 'home', lessonId: 0 };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [rate, setRate] = useState<number>(initialRate);
  const [admin, setAdmin] = useState(() => getSession() !== null);

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('iqra-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('iqra-rate', String(rate));
  }, [rate]);

  useEffect(() => {
    if (route.lessonId === 0) {
      setLesson(null);
      return;
    }
    let alive = true;
    setError(false);
    loadLesson(route.lessonId)
      .then((l) => alive && setLesson(l))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [route.lessonId]);

  // Pull the latest calibrations (soft-fail: offline just means the
  // last-known or baked timings are used).
  useEffect(() => {
    if (!lesson) return;
    fetchCloudCalibrations(lesson.lesson)
      .then((map) => storeCloudSnapshot(lesson.lesson, map))
      .catch(() => {});
  }, [lesson]);

  const meta = LESSONS.find((l) => l.id === route.lessonId);

  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="logo" />
          <span className="titles">
            <span className="brand-name">IQRA</span>
            <span className="brand-sub">Learn Quranic Arabic</span>
          </span>
        </a>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {route.page === 'home' && <HomePage />}

      {route.page !== 'home' && (
        <>
          <nav className="breadcrumb">
            <a href="#/">← All lessons</a>
            <h2>
              {route.page === 'calibrate' ? 'Calibrate — ' : ''}
              Lesson {route.lessonId}
              {meta ? ` — ${meta.title}` : ''}
            </h2>
            {route.page === 'calibrate' && admin && (
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

          {error && <p className="loading">Could not load this lesson. Please reload.</p>}
          {!error && !lesson && <p className="loading">Loading…</p>}

          {lesson && route.page === 'calibrate' && (
            admin ? <CalibratePage lesson={lesson} /> : <AdminGate onUnlock={() => setAdmin(true)} />
          )}

          {lesson && route.page === 'lesson' && (
            <>
              <div className="toolbar">
                <p className="lesson-ar-head" dir="rtl" lang="ar">
                  {lesson.titleArabic}
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
              {lesson.kind === 'pairs' ? (
                <PairsLesson lesson={lesson} rate={rate} />
              ) : (
                <WordsLesson lesson={lesson} rate={rate} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
