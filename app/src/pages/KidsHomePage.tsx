import { LESSONS, orderedLessons } from '../lib/lessons';
import { canSeeLesson, lessonStatus } from '../lib/appConfig';
import type { AppConfig } from '../lib/appConfig';
import type { LessonMeta } from '../lib/lessons';

/**
 * The IQRA Kids menu.
 *
 * A door on the home page, never a mode-choice screen: the app has always been
 * additive, and a splash asking "who are you?" would be the first thing a
 * learner had to get past. The same lessons live behind both menus — a lesson
 * carries `tracks`, and nothing here touches an id, a folder, a clip filename
 * or a calibration key.
 *
 * Levels 1–3 are the Maktab's own cohorts, so they are headings rather than
 * folders: a lesson can belong to more than one, and a child moving up a level
 * must not change what a lesson is.
 */
const LEVELS: { level: 1 | 2 | 3; title: string; blurb: string }[] = [
  { level: 1, title: 'Level 1', blurb: 'The letters — their names, their sounds, and where each one is made.' },
  { level: 2, title: 'Level 2', blurb: 'Putting letters together, and the first tajweed rules.' },
  { level: 3, title: 'Level 3', blurb: 'Reading fluently, ready to begin memorising.' },
];

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

export function KidsHomePage({ config, admin }: { config: AppConfig; admin: boolean }) {
  const lessons = orderedLessons(LESSONS, 'kids').filter((l) => canSeeLesson(config, l.id, admin));

  return (
    <main className="home">
      {/* Manāra. She greets and she points, and she is silent and still while
          anything is playing — the app's whole trick is watching letters light
          up, and a character animating over that would spoil it. */}
      <div className="manara-greeting">
        <img
          className="manara"
          src={`${import.meta.env.BASE_URL}images/kids/manara.png?v=${__IMAGE_VERSION__}`}
          alt=""
        />
        <p className="home-intro">
          The Arabic letters, from the very beginning. A teacher leads; the app plays, shows and
          waits.
        </p>
      </div>

      {LEVELS.map(({ level, title, blurb }) => {
        const here = lessons.filter((l) => l.kidsLevel === level);
        if (here.length === 0) return null;
        return (
          <section key={level} className="kids-level">
            <h3>{title}</h3>
            <p className="lesson-blurb">{blurb}</p>
            <LessonList lessons={here} config={config} />
          </section>
        );
      })}

      {/* A kids lesson with no level yet still needs a way in. */}
      {lessons.some((l) => !l.kidsLevel) && (
        <section className="kids-level">
          <h3>Not sorted yet</h3>
          <LessonList lessons={lessons.filter((l) => !l.kidsLevel)} config={config} />
        </section>
      )}

      {lessons.length === 0 && <p className="loading">No kids lessons are published yet.</p>}
      <p className="build-stamp">Version {__BUILD_ID__}</p>
    </main>
  );
}
