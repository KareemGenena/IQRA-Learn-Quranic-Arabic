import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WordsLesson } from './pages/WordsLesson';
import { SectionedLesson } from './pages/SectionedLesson';
import { AdminPage } from './pages/AdminPage';
import { NotesPage } from './pages/NotesPage';
import { AdminGate } from './components/AdminGate';
import { LaserPointer } from './components/LaserPointer';
import { LessonManager } from './components/LessonManager';
import { getSession, signOut } from './lib/adminAuth';
import { storeCloudSnapshot } from './lib/calibration';
import { fetchCloudCalibrations } from './lib/cloudCalibration';
import { LESSONS, loadLesson } from './lib/lessons';
import { cachedConfig, canSeeLesson, canUseFeature, fetchConfig, lessonStatus } from './lib/appConfig';
import type { AppConfig } from './lib/appConfig';
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
  page: 'home' | 'lesson' | 'admin' | 'notes';
  lessonId: number;
}

function parseRoute(hash: string): Route {
  // "calibrate" is the old name for the admin page; still accepted so an old
  // bookmark or an installed shortcut doesn't dead-end.
  const m = /^#\/(lesson|admin|calibrate|notes)(?:\/(\d+))?/.exec(hash);
  if (m) {
    const page = m[1] === 'calibrate' ? 'admin' : (m[1] as Route['page']);
    return { page, lessonId: Number(m[2] ?? 0) };
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
  const [config, setConfig] = useState<AppConfig>(cachedConfig);

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

  // What's published. Soft-fail: the cached copy (or the built-in defaults)
  // keeps a learner with no network seeing the right lessons.
  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

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
  /** The bare sign-in screen: no page title, no second sign-in button. */
  const signingIn = route.page === 'admin' && !admin;
  const showLaser = canUseFeature(config, 'laser', admin);
  const showNotes = canUseFeature(config, 'notes', admin);
  const lessonAllowed = route.lessonId === 0 || canSeeLesson(config, route.lessonId, admin);

  return (
    <div className={`app ${laser ? 'laser-on' : ''}`}>
      {showLaser && (
        <>
          <LaserPointer active={laser} onExit={() => setLaser(false)} />
          <button
            type="button"
            className={`laser-toggle ${laser ? 'on' : ''}`}
            aria-pressed={laser}
            onClick={() => setLaser((v) => !v)}
          >
            {laser ? 'Laser on — tap to exit' : 'Laser'}
          </button>
        </>
      )}

      <header className="app-header">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="logo" />
          <span className="titles">
            <span className="brand-name">IQRA</span>
            <span className="brand-sub">Learn Quranic Arabic</span>
          </span>
        </a>
        <div className="header-actions">
          {/* The installed PWA has no address bar, so signing in needs a
              control here rather than a typed URL. Hidden on the sign-in
              page itself, where it would just point at the current page. */}
          {signingIn ? null : admin ? (
            <>
              <a className="account-btn" href="#/admin">
                Admin
              </a>
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
            </>
          ) : (
            <a className="account-btn" href="#/admin">
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

      {route.page === 'home' && <HomePage config={config} admin={admin} />}

      {route.page !== 'home' && (
        <>
          <nav className="breadcrumb">
            <a href="#/">← All lessons</a>
            {!signingIn && (
              <h2>
                {route.page === 'admin' && route.lessonId === 0
                  ? 'Admin'
                  : `${route.page === 'admin' ? 'Admin — ' : route.page === 'notes' ? 'Notes — ' : ''}Lesson ${route.lessonId}${meta ? ` — ${meta.title}` : ''}`}
              </h2>
            )}
          </nav>

          {/* Admin home: what's published, and which features are live. */}
          {route.page === 'admin' && route.lessonId === 0 && (
            admin ? (
              <>
                <LessonManager config={config} onChange={setConfig} />
                <p className="manager-hint">
                  To calibrate a lesson's timings, open the lesson and use the admin bar.
                </p>
              </>
            ) : (
              <AdminGate onUnlock={() => setAdmin(true)} />
            )
          )}

          {route.lessonId > 0 && (
            <>
              {!lessonAllowed && (
                <p className="loading">
                  This lesson isn&apos;t published yet.{' '}
                  <a href="#/">Back to the lessons</a>
                </p>
              )}
              {lessonAllowed && error && (
                <p className="loading">Could not load this lesson. Please reload.</p>
              )}
              {lessonAllowed && !error && !lesson && <p className="loading">Loading…</p>}

              {lessonAllowed && lesson && route.page === 'notes' && showNotes && (
                <NotesPage lesson={lesson} />
              )}

              {lessonAllowed && lesson && route.page === 'admin' && (
                admin ? <AdminPage lesson={lesson} /> : <AdminGate onUnlock={() => setAdmin(true)} />
              )}

              {lessonAllowed && lesson && route.page === 'lesson' && (
                <>
                  {admin && (
                    <p className="admin-bar">
                      <span className={`status-pill ${lessonStatus(config, route.lessonId)}`}>
                        {lessonStatus(config, route.lessonId)}
                      </span>
                      <a href={`#/admin/${route.lessonId}`}>Calibrate timings</a>
                      <a href="#/admin">Manage lessons</a>
                    </p>
                  )}
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
                  {showNotes && (
                    <p className="notes-link">
                      <a href={`#/notes/${route.lessonId}`}>📝 Open notes for this lesson</a>
                    </p>
                  )}
                  {lesson.kind === 'words' ? (
                    <WordsLesson lesson={lesson} rate={rate} />
                  ) : (
                    <SectionedLesson lesson={lesson} rate={rate} />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
