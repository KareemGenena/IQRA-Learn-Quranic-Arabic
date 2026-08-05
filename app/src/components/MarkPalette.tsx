/**
 * Quranic marks that no phone or desktop Arabic keyboard offers — the dagger
 * alif, hamzat wasl, the Mushaf sukoon, the madd sign and the waqf marks.
 * Tapping one inserts it at the caret.
 */

const GROUPS: { label: string; marks: { ch: string; name: string }[] }[] = [
  {
    label: 'Quranic',
    marks: [
      { ch: 'ٱ', name: 'hamzat wasl (alif wasla)' },
      { ch: 'ٰ', name: 'dagger alif' },
      { ch: 'ۡ', name: 'sukoon (Mushaf)' },
      { ch: 'ٓ', name: 'madd sign' },
      { ch: 'ٔ', name: 'hamza above' },
      { ch: 'ٕ', name: 'hamza below' },
    ],
  },
  {
    label: 'Harakat',
    marks: [
      { ch: 'َ', name: 'fatha' },
      { ch: 'ُ', name: 'damma' },
      { ch: 'ِ', name: 'kasra' },
      { ch: 'ّ', name: 'shadda' },
      { ch: 'ْ', name: 'sukoon' },
      { ch: 'ً', name: 'fathatan' },
      { ch: 'ٌ', name: 'dammatan' },
      { ch: 'ٍ', name: 'kasratan' },
    ],
  },
  {
    label: 'Waqf',
    marks: [
      { ch: 'ۖ', name: 'sala (pause preferred)' },
      { ch: 'ۗ', name: 'qila (stop preferred)' },
      { ch: 'ۘ', name: 'meem (compulsory stop)' },
      { ch: 'ۙ', name: 'la (do not stop)' },
      { ch: 'ۚ', name: 'jeem (permissible stop)' },
      { ch: 'ۛ', name: 'three dots (stop at one)' },
    ],
  },
];

export function MarkPalette({ onInsert }: { onInsert: (ch: string) => void }) {
  return (
    <div className="mark-palette">
      {GROUPS.map((g) => (
        <div key={g.label} className="mark-group">
          <span className="mark-group-label">{g.label}</span>
          <div className="mark-row">
            {g.marks.map((m) => (
              <button
                key={m.ch}
                type="button"
                className="mark-btn"
                title={m.name}
                aria-label={m.name}
                // Keep the caret where it is instead of stealing focus.
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(m.ch)}
              >
                {/* A dotted circle gives the combining mark something to sit on. */}
                <span dir="rtl">{'◌' + m.ch}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
