import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WordsLesson } from './pages/WordsLesson';
import { SectionedLesson } from './pages/SectionedLesson';
import { AdminPage } from './pages/AdminPage';
import { AdminGate } from './components/AdminGate';
import { LaserPointer } from './components/LaserPointer';
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
  page: 'home' | 'lesson' | 'admin';
  lessonId: number;
}

function parseRoute(hash: string): Route {
  // "calibrate" is the old name for the admin page; still accepted so an old
  // bookmark or an installed shortcut doesn't dead-end.
  const m = /^#\/(lesson|admin|calibrate)\/(\d+)/.exec(hash);
  if (m) {
    return { page: m[1] === 'lesson' ? 'lesson' : 'admin', lessonId: Number(m[2]) };
  }
  return { page: 'home', lessonId: 0 };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [rate, setRate] = useState<number>(initialRate);
  const [admin, setAdmin] = useState(() => getSession() !== null);
  const [laser, setLaser] = useState(false);

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
    <div className={`app ${laser ? 'laser-on' : ''}`}>
      <LaserPointer active={laser} onExit={() => setLaser(false)} />
      <button
        type="button"
        className={`laser-toggle ${laser ? 'on' : ''}`}
        aria-pressed={laser}
        onClick={() => setLaser((v) => !v)}
      >
        {laser ? 'Laser on — tap to exit' : 'Laser'}
      </button>

      <header className="app-header">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="logo" />
          <span className="titles">
            <span className="brand-name">IQRA</span>
            <span className="brand-sub">Learn Quranic Arabic</span>
          </span>
        </a>
        <div className="header-actions">
          {/* The installed PWA has no address bar, so the admin page needs a
              way in that isn't a typed URL. */}
          {admin ? (
            <button
              type="button"
              className="account-btn"
              onClick={() => {
                signOut();
                setAdmin(false);
                window.location.hash = '#/';
              }}
            >
              Sign out
            </button>
          ) : (
            <a className="account-btn" href="#/admin/1">
              Sign in
            </a>
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {admin && route.page === 'lesson' && (
        <p className="admin-bar">
          <a href={`#/admin/${route.lessonId}`}>Admin — calibrate this lesson&apos;s timings</a>
        </p>
      )}

      {route.page === 'home' && <HomePage />}

      {route.page !== 'home' && (
        <>
          <nav className="breadcrumb">
            <a href="#/">← All lessons</a>
            <h2>
              {route.page === 'admin' ? 'Admin — ' : ''}
              Lesson {route.lessonId}
              {meta ? ` — ${meta.title}` : ''}
            </h2>
            {route.page === 'admin' && admin && (
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

          {lesson && route.page === 'admin' && (
            admin ? <AdminPage lesson={lesson} /> : <AdminGate onUnlock={() => setAdmin(true)} />
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
              {lesson.kind === 'words' ? (
                <WordsLesson lesson={lesson} rate={rate} />
              ) : (
                <SectionedLesson lesson={lesson} rate={rate} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
