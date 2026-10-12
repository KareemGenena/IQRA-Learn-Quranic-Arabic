import { LESSONS, lessonsByLevel } from '../lib/lessons';
import { canSeeLesson, lessonStatus } from '../lib/appConfig';
import type { AppConfig } from '../lib/appConfig';
import type { LessonMeta } from '../lib/lessons';

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
function LessonList({ lessons, config }: { lessons: LessonMeta[]; config: AppConfig }) {
  return (
    <ul className="lesson-list">
      {lessons.map((l, i) => {
        const status = lessonStatus(config, l.id);
        return (
          <li key={l.id}>
            <a className="lesson-card" href={`#/lesson/${l.id}`}>
              <span className="lesson-no">{i + 1}</span>
              <span className="lesson-body">
                <span className="lesson-title">
                  {l.title}
                  {/* Only the admin ever sees an unpublished lesson here. */}
                  {status !== 'published' && <span className={`status-pill ${status}`}>{status}</span>}
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
  const levels = lessonsByLevel(LESSONS)
    .map((lv) => ({ ...lv, lessons: lv.lessons.filter((l) => canSeeLesson(config, l.id, admin)) }))
    .filter((lv) => lv.lessons.length > 0);

  return (
    <main className="home">
      <p className="home-intro">
        Choose a lesson. Tap any word to hear it — each letter lights up exactly as it is
        pronounced.
      </p>

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
          <LessonList lessons={lv.lessons} config={config} />
        </section>
      ))}

      {levels.length === 0 && <p className="loading">No lessons are published yet.</p>}
      {/* Which build this device is actually running. An installed app has no
          address bar and no way to tell a stale copy from a current one — the
          author once spent weeks looking at a months-old build. Comparing this
          line against the deploy answers it in a glance. */}
      <p className="build-stamp">Version {__BUILD_ID__}</p>
    </main>
  );
}
