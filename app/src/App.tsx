import { Suspense, lazy, useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { WorkbookIndex, WorkbookPage } from './pages/WorkbookPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { ReadingSwitch } from './components/ReadingSwitch';
import { LettersLesson, drawsLetterCards } from './pages/LettersLesson';
import { WorkbookLinks } from './components/WorkbookLinks';
import { WordsLesson } from './pages/WordsLesson';
import { SectionedLesson } from './pages/SectionedLesson';
import { AdminPage } from './pages/AdminPage';
import { NotesPage } from './pages/NotesPage';
import { AccountPage } from './pages/AccountPage';
import { ClassesPage } from './pages/ClassesPage';
import { RecordingsPage } from './pages/RecordingsPage';
import { SignInPanel } from './components/SignInPanel';
import { LaserPointer } from './components/LaserPointer';
import { LessonManager } from './components/LessonManager';
import { useAccount } from './lib/useAccount';
import { storeCloudSnapshot } from './lib/calibration';
import { installAudioWarmup } from './lib/playback';
import { fetchCloudCalibrations } from './lib/cloudCalibration';
import { LESSONS, lessonAfter, lessonLabel, loadLesson } from './lib/lessons';
import { markDone, markOpened } from './lib/progress';
import { cachedConfig, canSeeLesson, canUseFeature, fetchConfig, lessonStatus } from './lib/appConfig';
import type { AppConfig } from './lib/appConfig';
import type { Account } from './lib/useAccount';
import type { Lesson, Reading } from './types';

/**
 * The intake system is the lesson owner's recording tool, and no learner will
 * ever open it — so it is split out rather than shipped inside the bundle
 * every visitor downloads and the service worker precaches.
 */
const IntakePage = lazy(() =>
  import('./pages/IntakePage').then((m) => ({ default: m.IntakePage })),
);

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

/** Continuing unless the learner switched: that is how every clip recorded
 *  before 2026-10-11 reads, and how a word is met in its āyah. */
function initialReading(): Reading {
  return localStorage.getItem('iqra-reading') === 'stop' ? 'stop' : 'continuing';
}

interface Route {
  page: 'home' | 'lesson' | 'admin' | 'notes' | 'account' | 'classes' | 'recordings' | 'intake' | 'workbook';
  lessonId: number;
  /** The workbook companion: #/workbook, #/workbook/L/<printed page>, or
   *  #/workbook/L/section/N (the QR's landing — resolves to a page). */
  level?: number;
  wbPage?: number;
  wbSection?: number;
}

/**
 * The addresses the IQRA Kids menu used until 2026-10-11, when its lessons
 * became Level 1 of the one curriculum: #/kids was the menu and
 * #/kids/lesson/N a lesson in its skin. A bookmark, a shared link or a
 * home-screen shortcut made before then still lands on the same lesson — the
 * number, the clips and the calibrations never changed, only the way in.
 */
function legacyHash(hash: string): string | null {
  const m = /^#\/kids(?:\/lesson\/(\d+))?/.exec(hash);
  if (!m) return null;
  return m[1] ? `#/lesson/${m[1]}` : '#/';
}

function parseRoute(hash: string): Route {
  const w = /^#\/workbook(?:\/([1-3])(?:\/(section\/)?(\d+))?)?/.exec(hash);
  if (w) {
    return {
      page: 'workbook',
      lessonId: 0,
      level: w[1] ? Number(w[1]) : undefined,
      wbPage: w[3] && !w[2] ? Number(w[3]) : undefined,
      wbSection: w[2] ? Number(w[3]) : undefined,
    };
  }
  // "calibrate" is the old name for the admin page; still accepted so an old
  // bookmark or an installed shortcut doesn't dead-end.
  const m = /^#\/(lesson|admin|calibrate|notes|account|classes|recordings|intake)(?:\/(\d+))?/.exec(hash);
  if (m) {
    const page = m[1] === 'calibrate' ? 'admin' : (m[1] as Route['page']);
    return { page, lessonId: Number(m[2] ?? 0) };
  }
  return { page: 'home', lessonId: 0 };
}

/**
 * The admin pages belong to one account. Someone signed out is offered the
 * sign-in form; someone already signed in as themselves is simply told, since
 * a form they could never satisfy would only look like a puzzle to solve.
 */
function NotAdmin({ account }: { account: Account }) {
  if (!account.signedIn) {
    return (
      <SignInPanel
        account={account}
        blurb="These are the lesson owner's tools. Sign in to reach them."
      />
    );
  }
  return (
    <p className="loading">
      This page belongs to the lesson owner. <a href="#/">Back to the lessons</a>
    </p>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [rate, setRate] = useState<number>(initialRate);
  const [reading, setReading] = useState<Reading>(initialReading);
  const [laser, setLaser] = useState(false);
  const [config, setConfig] = useState<AppConfig>(cachedConfig);

  // Who is signed in. `admin` is an email match, never merely "has a session"
  // — every student will have a session of their own.
  const account = useAccount();
  const admin = account.isAdmin;

  useEffect(() => {
    const onChange = () => {
      const legacy = legacyHash(window.location.hash);
      if (legacy) {
        // Replace, not assign: Back should not return to the old address.
        window.location.replace(legacy);
        return;
      }
      setRoute(parseRoute(window.location.hash));
    };
    onChange();
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('iqra-theme', theme);
  }, [theme]);

  // Open the audio output on the first tap or key, before any Play — the
  // first clip of a session used to come out late and short (playback.ts).
  useEffect(() => installAudioWarmup(), []);

  useEffect(() => {
    localStorage.setItem('iqra-rate', String(rate));
  }, [rate]);

  useEffect(() => {
    localStorage.setItem('iqra-reading', reading);
  }, [reading]);

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
  const lessonAllowed = route.lessonId === 0 || canSeeLesson(config, route.lessonId, admin);
  // The two readings — read on / at a stop — are a Level 3 matter: the stop
  // changes the ending of a WORD, and Levels 1 and 2 are letters, syllables
  // and the first words. The switch and the tabs show only there (the
  // author, 2026-10-24); elsewhere every card has its one reading.
  const twoReadings =
    meta?.level === 3 && !!lesson && !drawsLetterCards(lesson) && lesson.kind !== 'assessment';

  // Opening a lesson is the first mark of progress (src/lib/progress.ts).
  useEffect(() => {
    if (route.page === 'lesson' && route.lessonId > 0 && lessonAllowed) markOpened(route.lessonId);
  }, [route.page, route.lessonId, lessonAllowed]);

  // The way on from this lesson: the next the learner may see. Moving on
  // marks this one done — a learner who skips ahead is where they are.
  const next = route.lessonId > 0 ? lessonAfter(route.lessonId, (l) => canSeeLesson(config, l.id, admin)) : undefined;
  const moveOn = () => {
    markDone(route.lessonId);
    if (next) window.location.hash = `#/lesson/${next.id}`;
  };
  /** The bare sign-in screen: no page title, no second sign-in button. */
  const signingIn =
    (route.page === 'account' || route.page === 'classes' || route.page === 'recordings') &&
    !account.signedIn;
  const showLaser = canUseFeature(config, 'laser', admin);
  const showNotes = canUseFeature(config, 'notes', admin);

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
            <span className="brand-name">IQRA 1447</span>
            <span className="brand-sub">Learn Quranic Arabic</span>
          </span>
        </a>
        <div className="header-actions">
          {/* The installed PWA has no address bar, so signing in needs a
              control here rather than a typed URL. Hidden on the sign-in
              page itself, where it would just point at the current page. */}
          {signingIn ? null : account.signedIn ? (
            <>
              {admin && (
                <a className="account-btn" href="#/admin">
                  Admin
                </a>
              )}
              <a className="account-btn" href="#/account">
                {account.name || 'Account'}
              </a>
            </>
          ) : (
            <a className="account-btn" href="#/account">
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
                {route.page === 'workbook'
                  ? route.level
                    ? `Workbook Level ${route.level}`
                    : 'Practice workbooks'
                  : route.page === 'account'
                  ? 'Your account'
                  : route.page === 'classes'
                    ? 'Classes'
                    : route.page === 'recordings'
                    ? 'Class recordings'
                    : route.page === 'intake'
                    ? 'Audio intake'
                    : route.page === 'admin' && route.lessonId === 0
                    ? 'Admin'
                    : `${route.page === 'admin' ? 'Admin — ' : route.page === 'notes' ? 'Notes — ' : ''}${lessonLabel(route.lessonId)}${meta ? ` — ${meta.title}` : ''}`}
              </h2>
            )}
          </nav>

          {route.page === 'account' && <AccountPage account={account} />}

          {route.page === 'classes' && <ClassesPage account={account} />}

          {route.page === 'recordings' && <RecordingsPage account={account} />}

          {route.page === 'workbook' &&
            (route.level ? (
              <WorkbookPage
                level={route.level}
                printed={route.wbPage ?? 1}
                section={route.wbSection}
                rate={rate}
                reading={reading}
                setReading={setReading}
              />
            ) : (
              <WorkbookIndex />
            ))}

          {/* The intake system records the lessons themselves, so it belongs
              to whoever owns them. It will open up when volunteers start
              contributing recordings — the page is already written for a
              speaker who is not the author. */}
          {route.page === 'intake' &&
            (admin ? (
              <Suspense fallback={<p className="loading">Loading…</p>}>
                <IntakePage />
              </Suspense>
            ) : (
              <NotAdmin account={account} />
            ))}

          {/* Admin home: what's published, and which features are live. */}
          {route.page === 'admin' && route.lessonId === 0 && (
            admin ? (
              <>
                <LessonManager config={config} onChange={setConfig} />
                <p className="manager-hint">
                  To calibrate a lesson's timings, open the lesson and use the admin bar.
                </p>
                <p className="admin-bar">
                  <a href="#/intake">🎙 Audio intake</a>
                  <span className="manager-hint">
                    Record a sheet's words straight into the folder the generators read.
                  </span>
                </p>
              </>
            ) : (
              <NotAdmin account={account} />
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
                <NotesPage lesson={lesson} account={account} />
              )}

              {lessonAllowed && lesson && route.page === 'admin' && (
                admin ? <AdminPage lesson={lesson} /> : <NotAdmin account={account} />
              )}

              {lessonAllowed && lesson && route.page === 'lesson' && (
                <>
                  {admin && (
                    <p className="admin-bar">
                      <span className={`status-pill ${lessonStatus(config, route.lessonId)}`}>
                        {lessonStatus(config, route.lessonId)}
                      </span>
                      <a href={`#/admin/${route.lessonId}`}>Calibrate timings</a>
                      <a href="#/intake">Audio intake</a>
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
                    {/* Two readings, one switch: it decides what Play, Play
                        all and N mean on every card, and stays until changed.
                        Level 3 only — see `twoReadings`. */}
                    {twoReadings && <ReadingSwitch reading={reading} setReading={setReading} />}
                  </div>
                  <WorkbookLinks lessonId={route.lessonId} />
                  {showNotes && (
                    <p className="notes-link">
                      <a href={`#/notes/${route.lessonId}`}>📝 Open notes for this lesson</a>
                    </p>
                  )}
                  {lesson.kind === 'assessment' ? (
                    <AssessmentPage lesson={lesson} rate={rate} />
                  ) : drawsLetterCards(lesson) ? (
                    <LettersLesson
                      lesson={lesson}
                      rate={rate}
                      reading={twoReadings ? reading : undefined}
                      onReadingToggle={twoReadings ? () => setReading(reading === 'stop' ? 'continuing' : 'stop') : undefined}
                      onEnd={next ? moveOn : undefined}
                    />
                  ) : lesson.kind === 'words' ? (
                    <WordsLesson lesson={lesson} rate={rate} reading={twoReadings ? reading : undefined} />
                  ) : (
                    <SectionedLesson
                      lesson={lesson}
                      rate={rate}
                      reading={twoReadings ? reading : undefined}
                      onReadingToggle={twoReadings ? () => setReading(reading === 'stop' ? 'continuing' : 'stop') : undefined}
                      onEnd={next ? moveOn : undefined}
                    />
                  )}
                  {/* The way on. Always shown, never required: the home page
                      lists every lesson, and this is only the default path. */}
                  <div className="next-lesson">
                    {next ? (
                      <a
                        className="next-btn"
                        href={`#/lesson/${next.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          moveOn();
                        }}
                      >
                        <span className="next-label">Next lesson</span>
                        <span className="next-title">{next.title}</span>
                        <span className="lesson-go" aria-hidden="true">
                          ›
                        </span>
                      </a>
                    ) : (
                      <span className="next-end">This is the last lesson for now.</span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
