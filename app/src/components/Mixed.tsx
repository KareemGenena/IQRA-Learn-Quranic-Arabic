import type { ReactNode } from 'react';

/**
 * English with Arabic in it, the Arabic legible.
 *
 * A hint or a chip is set in a small Latin face, and a run of Arabic inside
 * it — "the letters قطب جد", "Stop on ـٌ or ـٍ", a caption's مَرۡ — came out
 * at that size in a fallback font: the author could not read the tanwīn
 * signs at all (2026-10-24). Each Arabic run is wrapped so CSS can give it
 * the Mushaf face and a larger size (`.ar-run`), isolated for bidi. Spaces
 * inside a run stay in it (قطب جد is one run); a line break ends one, so a
 * multi-line hint keeps its lines.
 */
const AR = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
const RUN = new RegExp(`[${AR}](?:[${AR} \\u00A0\\u200B-\\u200D]*[${AR}])?`, 'g');

export function mixed(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RUN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={m.index} className="ar-run" lang="ar" dir="rtl">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Mixed({ text }: { text: string }) {
  return <>{mixed(text)}</>;
}
