import type { CardProps } from '../pages/SectionedLesson';

/**
 * One of the five places a letter is made — the workbook's own page, on
 * screen: the head with that place lit, and the letters that come from it in
 * their family colors. A diagram, not a drill: nothing here is recorded.
 */
export function PlaceCard({ item, displayNo }: CardProps) {
  const p = item.place;
  if (!p) return null;
  return (
    <div className="place-card">
      <div className="letter-top">
        <span className="letter-no">{displayNo}</span>
        <span className="place-title">
          {p.title}
          <span className="place-title-ar" dir="rtl" lang="ar">
            {p.titleArabic}
          </span>
        </span>
      </div>
      <div className="place-stage">
        {item.image && (
          <img
            className="place-pic"
            src={item.image}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="place-letters" dir="rtl" lang="ar">
          {p.letters.map((l, i) => (
            <span key={i} className={`song-letter fam-${(l.family ?? 0) % 7}`}>
              {l.text}
            </span>
          ))}
        </div>
      </div>
      <p className="place-note">{p.note}</p>
    </div>
  );
}
