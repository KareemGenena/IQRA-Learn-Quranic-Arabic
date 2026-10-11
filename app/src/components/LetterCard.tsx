import { useEffect, useMemo, useState } from 'react';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { splitClusters } from '../lib/graphemes';
import type { CardProps } from '../pages/SectionedLesson';

/**
 * A letter, the way a five-year-old meets it.
 *
 * Picture on the left, the bare letter large on the right in its family
 * color, the sounds as small cards beneath (fat-ha, damma, kasra, sukoon),
 * the name small in the corner — and ONE recording: the teacher's whole line,
 * from "This is the letter baa, it looks like a boat…" through "with a fat-ha
 * it's بَ…". While the recording is still talking about the picture, the
 * picture glows; once the Arabic begins, each sound card lights as it is said.
 * Tapping a sound card starts the recording from that sound.
 *
 * The adult ItemCard is left alone — this is the kids skin's card, chosen by
 * the route (#/kids/lesson/N); the lesson data underneath is the same.
 */
export function LetterCard({ lesson, item, rate, displayNo, register }: CardProps) {
  const playable = item.forms[0];
  const { activeIndex, playing, play, toggle } = usePlayable(lesson, playable, rate);

  useEffect(() => {
    register?.(playable.key, () => play());
  }, [register, playable.key, play]);

  /**
   * The recording highlights LETTERS — نَبۡ is two clusters — while the card
   * lights whole sound cards, so each cluster is mapped to the part it is in.
   */
  const { partOfCluster, firstCluster } = useMemo(() => {
    const partOfCluster: number[] = [];
    const firstCluster: number[] = [];
    (item.parts ?? []).forEach((p, i) => {
      firstCluster.push(partOfCluster.length);
      for (let k = 0; k < splitClusters(p).length; k++) partOfCluster.push(i);
    });
    return { partOfCluster, firstCluster };
  }, [item.parts]);

  // Before the first Arabic letter the teacher is talking about the picture.
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (!playing) setReached(false);
    else if (activeIndex !== null) setReached(true);
  }, [playing, activeIndex]);

  const litPart = playing && activeIndex !== null ? partOfCluster[activeIndex] ?? null : null;
  const aboutPicture = playing && !reached;
  const fam = `fam-${(item.family ?? 0) % 7}`;

  return (
    <div className="letter-card">
      <div className="letter-top">
        <span className="letter-no">{displayNo}</span>
        {item.name && (
          <span className="letter-name" dir="rtl" lang="ar">
            {item.name}
          </span>
        )}
      </div>

      <div className="letter-stage">
        {item.image && (
          <figure className={`letter-pic ${aboutPicture ? 'glow' : ''}`}>
            <img src={item.image} alt="" />
            {item.mnemonic && <figcaption>{item.mnemonic}</figcaption>}
          </figure>
        )}
        <div className={`letter-big ${fam}`} dir="rtl" lang="ar">
          {item.letter}
        </div>
      </div>

      <div className="letter-forms" dir="rtl">
        {(item.parts ?? []).map((p, i) => (
          <button
            type="button"
            key={i}
            className={`small-form ${litPart === i ? 'lit' : ''}`}
            onClick={() => void play({ cluster: firstCluster[i] })}
            aria-label={`Play from ${p}`}
          >
            <span className="small-form-text" lang="ar">
              {p}
            </span>
            {item.labels?.[i] && <span className="small-label">{item.labels[i]}</span>}
          </button>
        ))}
      </div>

      <div className="letter-actions">
        <button
          type="button"
          className={`btn primary play-letter ${playing ? 'playing' : ''}`}
          onClick={() => void toggle()}
          aria-label={playing ? 'Stop' : `Play ${item.name ?? item.letter ?? ''}`}
        >
          <PlayIcon playing={playing} />
          <span>{playing ? 'Stop' : 'Play'}</span>
        </button>
      </div>
    </div>
  );
}
