import { useEffect, useState, type CSSProperties } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { ItemCard } from '../components/ItemCard';
import { loadLesson, toItems } from '../lib/lessons';
import { splitClusters } from '../lib/graphemes';
import type { Lesson, LessonItem } from '../types';

/**
 * A proof sheet: every card of a lesson drawn large, one per row, with its id
 * — exactly as `ArabicWord` draws it in the lesson, minus the audio. Dev only
 * (`#/proof/N?from=&to=`); `scripts/snap-proof.mjs` photographs it with
 * headless Chrome so every mark on every card can be checked without paging
 * through the lesson by hand.
 */
export function ProofPage({ lessonId, from, to, px, card }: { lessonId: number; from: number; to: number; px?: number; card?: number }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  useEffect(() => {
    void loadLesson(lessonId).then(setLesson);
  }, [lessonId]);
  if (!lesson) return <p className="loading">…</p>;
  const items = toItems(lesson).filter((it) => it.id >= from && it.id <= to);
  // card=W: the real lesson card, W px wide, one under another — for the
  // layout around the word (badges, play button), not the word alone.
  if (card) {
    return (
      <main className="proof-cards" style={{ display: 'grid', gap: 16, justifyContent: 'start', padding: 20, background: '#fff' }}>
        {items.map((item: LessonItem) => (
          <div key={item.id} style={{ width: card }}>
            <ItemCard lesson={lesson} item={item} rate={1} displayNo={item.id} />
          </div>
        ))}
      </main>
    );
  }
  return (
    <main className="proof" style={px ? ({ '--proof-px': `${px}px` } as CSSProperties) : undefined}>
      {items.map((item: LessonItem) => (
        <div key={item.id} className="proof-row">
          <span className="proof-id">{item.id}</span>
          <span className="proof-badges">{item.badges.join(' · ')}</span>
          <div className="proof-forms">
            {item.forms.map((form) => (
              <ArabicWord
                key={form.key}
                text={form.text}
                clusters={splitClusters(form.text)}
                activeIndex={null}
                prefixClusters={form.prefixClusters}
                silentClusters={form.silentClusters}
                markCluster={form.highlightCluster}
                dimFinalMark={form.dimFinalMark}
              />
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
