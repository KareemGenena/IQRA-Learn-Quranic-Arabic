import { orderedLessons } from '../lib/lessons';
import { canSeeLesson, lessonStatus } from '../lib/appConfig';
import type { AppConfig } from '../lib/appConfig';

export function HomePage({ config, admin }: { config: AppConfig; admin: boolean }) {
  const lessons = orderedLessons().filter((l) => canSeeLesson(config, l.id, admin));

  return (
    <main className="home">
      <p className="home-intro">
        Choose a lesson. Tap any word to hear it — each letter lights up exactly as it is
        pronounced.
      </p>
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
      {lessons.length === 0 && <p className="loading">No lessons are published yet.</p>}
      {/* Which build this device is actually running. An installed app has no
          address bar and no way to tell a stale copy from a current one — the
          author once spent weeks looking at a months-old build. Comparing this
          line against the deploy answers it in a glance. */}
      <p className="build-stamp">Version {__BUILD_ID__}</p>
    </main>
  );
}
