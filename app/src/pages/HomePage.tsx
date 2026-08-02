import { LESSONS } from '../lib/lessons';

export function HomePage() {
  return (
    <main className="home">
      <p className="home-intro">
        Choose a lesson. Tap any word to hear it — each letter lights up exactly as it is
        pronounced.
      </p>
      <ul className="lesson-list">
        {LESSONS.map((l, i) => (
          <li key={l.id}>
            <a className="lesson-card" href={`#/lesson/${l.id}`}>
              <span className="lesson-no">{i + 1}</span>
              <span className="lesson-body">
                <span className="lesson-title">{l.title}</span>
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
        ))}
      </ul>
    </main>
  );
}
