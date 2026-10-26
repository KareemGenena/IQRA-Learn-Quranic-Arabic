import type { CardProps } from '../pages/SectionedLesson';

/**
 * One of the five places a letter is made — the workbook's own page, on
 * screen: the head with that place lit, and the letters that come from it in
 * one color. A diagram, not a drill: nothing here is recorded, so the lesson
 * has no Play.
 *
 * ONE color for every letter here, not the family colors the letters wear
 * elsewhere: eighteen letters of seven colors on the tongue card read as a
 * "color soup" (the author, 2026-10-25). The color is the amber of the lit
 * place in the picture, so the letters and the spot they come from read as
 * one thing. The card is right to left like a letter card (number top
 * right, picture right); its English lines are left to right — "6 letters."
 * came out ".letters 6" (2026-10-25).
 */
export function PlaceCard({ item, displayNo }: CardProps) {
  const p = item.place;
  if (!p) return null;
  return (
    <div className="place-card">
      <div className="letter-top">
        <span className="letter-no">{displayNo}</span>
        <span className="place-title" dir="ltr">
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
            <span key={i} className="place-letter">
              {l.text}
            </span>
          ))}
        </div>
      </div>
      <p className="place-note" dir="ltr">
        {p.note}
      </p>
    </div>
  );
}
