/** The door to Quiz me (Design/drills.md): a lightbulb, drawn in the line of
 *  the lesson tools' icons. */
export function BulbIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.8.6 1.2 1.4 1.2 2.3v.6h5v-.6c0-.9.4-1.7 1.2-2.3A6.2 6.2 0 0 0 12 2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.6 19.2h4.8M10.6 21.6h2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.2a2.6 2.6 0 0 0-2.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
