import { LESSONS, lessonsByLevel, orderedLessons } from '../lib/lessons';
import { canSeeLesson, lessonStatus } from '../lib/appConfig';
import { continueWith, readProgress, stateOf } from '../lib/progress';
import type { AppConfig } from '../lib/appConfig';
import type { LessonMeta } from '../lib/lessons';
import type { ProgressMap } from '../lib/progress';

/**
 * The home page: one curriculum under three Level headings — the same Levels
 * as the practice workbooks, so "Level 1" means the same thing on the paper
 * and on the screen. Every lesson is listed and every lesson is tappable; the
 * order is the way through, never a gate.
 *
 * The letter lessons at the top were a separate "IQRA Kids" door until
 * 2026-10-11. They are the beginning of the sequence now, and Manāra, the
 * lighthouse who greeted at that door, greets from the Level 1 heading. A
 * level heading is only shown when something is published under it, so a
 * learner is never sent to an empty room.
 */
function LessonList({
  lessons,
  config,
  progress,
}: {
  lessons: LessonMeta[];
  config: AppConfig;
  progress: ProgressMap;
}) {
  return (
    <ul className="lesson-list">
      {lessons.map((l, i) => {
        const status = lessonStatus(config, l.id);
        const state = stateOf(progress, l.id);
        return (
          <li key={l.id}>
            <a className={`lesson-card is-${state}${l.check ? ' is-check' : ''}`} href={`#/lesson/${l.id}`}>
              {/* The number stays; a done lesson wears a small tick on the
                  circle's corner instead of losing its number to it. */}
              <span className="lesson-no">
                {l.check ? '?' : i + 1}
                {state === 'done' && (
                  <span className="lesson-tick" role="img" aria-label="done">
                    ✓
                  </span>
                )}
              </span>
              <span className="lesson-body">
                <span className="lesson-title">
                  {l.title}
                  {/* Only the admin ever sees an unpublished lesson here. */}
                  {status !== 'published' && <span className={`status-pill ${status}`}>{status}</span>}
                  {state === 'started' && <span className="lesson-mark">in progress</span>}
                </span>
                <span className="lesson-ar" dir="rtl" lang="ar">
                  {l.titleArabic}
                </span>
                <span className="lesson-blurb">{l.blurb}</span>
              </span>
              <span className="lesson-go" aria-hidden="true">
                ›
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function HomePage({ config, admin }: { config: AppConfig; admin: boolean }) {
  const visible = (l: LessonMeta) => canSeeLesson(config, l.id, admin);
  const levels = lessonsByLevel(LESSONS)
    .map((lv) => ({ ...lv, lessons: lv.lessons.filter(visible) }))
    .filter((lv) => lv.lessons.length > 0);

  // The way through: one card at the top saying where to pick up, and the
  // whole curriculum beneath it. A default, never a gate.
  const progress = readProgress();
  const ordered = orderedLessons(LESSONS).filter(visible);
  const next = continueWith(ordered, progress);
  const anyDone = ordered.some((l) => stateOf(progress, l.id) === 'done');
  const label = !next ? '' : stateOf(progress, next.id) === 'started' ? 'Continue' : anyDone ? 'Next up' : 'Start here';

  return (
    <main className="home">
      <p className="home-intro">
        Choose a lesson. Tap any word to hear it — each letter lights up exactly as it is
        pronounced.
      </p>

      {next && (
        <a className="continue-card" href={`#/lesson/${next.id}`}>
          <span className="continue-label">{label}</span>
          <span className="lesson-body">
            <span className="continue-title">{next.title}</span>
            <span className="continue-level">Level {next.level}</span>
          </span>
          <span className="lesson-go" aria-hidden="true">
            ›
          </span>
        </a>
      )}
      {!next && ordered.length > 0 && (
        <p className="continue-done">You have been through every lesson. Pick any one to review.</p>
      )}

      {levels.map((lv) => (
        <section key={lv.level} className="level-section">
          <div className={`level-head ${lv.level === 1 ? 'manara-greeting' : ''}`}>
            {/* Manāra. She greets and she points, and she is silent and still
                while anything is playing — the app's whole trick is watching
                letters light up, and a character animating over that would
                spoil it. */}
            {lv.level === 1 && (
              <img
                className="manara"
                src={`${import.meta.env.BASE_URL}images/kids/manara.png?v=${__IMAGE_VERSION__}`}
                alt=""
              />
            )}
            <div>
              <h3>{lv.title}</h3>
              <p className="lesson-blurb">{lv.blurb}</p>
            </div>
          </div>
          <LessonList lessons={lv.lessons} config={config} progress={progress} />
        </section>
      ))}

      {/* The electronic side of the paper: the workbooks page by page, each
          word said aloud. A section opener's QR lands there too. */}
      <section className="level-section">
        <h3>Practice workbooks</h3>
        <p className="lesson-blurb">The three workbooks, page by page, with each word said aloud.</p>
        <ul className="lesson-list">
          <li>
            <a className="lesson-card" href="#/workbook">
              <span className="lesson-no" aria-hidden="true">
                📖
              </span>
              <span className="lesson-body">
                <span className="lesson-title">Listen to a workbook page</span>
                <span className="lesson-blurb">Open the page you are tracing and tap any word to hear it.</span>
              </span>
              <span className="lesson-go" aria-hidden="true">
                ›
              </span>
            </a>
          </li>
        </ul>
      </section>

      {levels.length === 0 && <p className="loading">No lessons are published yet.</p>}
      {/* Which build this device is actually running. An installed app has no
          address bar and no way to tell a stale copy from a current one — the
          author once spent weeks looking at a months-old build. Comparing this
          line against the deploy answers it in a glance. */}
      <p className="build-stamp">Version {__BUILD_ID__}</p>
    </main>
  );
}
