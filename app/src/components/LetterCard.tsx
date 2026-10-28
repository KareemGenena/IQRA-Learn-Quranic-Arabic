import { useEffect, useMemo, useState } from 'react';
import { Mixed } from './Mixed';
import { Transport } from './Transport';
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
 * A card may have a BACK (`item.flip`): the shape the letter takes at the
 * beginning of a word, with its own picture — ى is the duck, and tapped, the
 * card turns on its vertical axis to يـ, the duck in the boat (the author,
 * 2026-10-24). "Show original form" turns it back. And a card may carry one
 * teaching line under its sounds (`item.tip`): alif's "comes after a fat-ha
 * and makes it longer".
 *
 * ItemCard is left alone — this is the card a `letters` lesson draws, chosen
 * by the lesson's kind; the data underneath has the same shape.
 */
export function LetterCard({ lesson, item, rate, displayNo, register }: CardProps) {
  const playable = item.forms[0];
  const { activeIndex, playing, paused, loading, play, stop, pause, resume } = usePlayable(lesson, playable, rate);

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

  // The back of the card, where it has one. A card always opens on its front.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [item.id]);

  const litPart = playing && activeIndex !== null ? partOfCluster[activeIndex] ?? null : null;
  const aboutPicture = playing && !reached;
  const fam = `fam-${(item.family ?? 0) % 7}`;

  /** Picture and big letter — one face of the card. */
  const stage = (face: { image?: string; mnemonic?: string; letter?: string }, action?: { label: string; onClick: () => void }) => (
    <div className="letter-stage">
      {face.image && (
        <figure className={`letter-pic ${aboutPicture ? 'glow' : ''}`}>
          <img src={face.image} alt="" onClick={action?.onClick} />
          {face.mnemonic && <figcaption>{face.mnemonic}</figcaption>}
          {action && (
            <button type="button" className="flip-prompt" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </figure>
      )}
      <div className={`letter-big ${fam}`} dir="rtl" lang="ar">
        {face.letter}
      </div>
    </div>
  );

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

      {item.flip ? (
        <div className={`letter-flip ${flipped ? 'flipped' : ''}`}>
          <div className="letter-flip-inner">
            {/* The face turned away is inert as well as aria-hidden: its
                button was still a Tab stop, a focus ring nobody could see. */}
            <div className="flip-face front" aria-hidden={flipped} inert={flipped}>
              {stage(item, { label: item.flip.prompt, onClick: () => setFlipped(true) })}
            </div>
            <div className="flip-face back" aria-hidden={!flipped} inert={!flipped}>
              {stage(item.flip, { label: item.flip.back, onClick: () => setFlipped(false) })}
            </div>
          </div>
        </div>
      ) : (
        stage(item)
      )}

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

      {item.tip && (
        <p className="letter-tip">
          <Mixed text={item.tip} />
        </p>
      )}

      {/* The teacher's whole line is long: Play, Pause and Stop, each what
          it says — a pause holds the place and Play carries on from it. */}
      <div className="letter-actions">
        <Transport
          state={!playing ? 'idle' : paused ? 'paused' : 'playing'}
          waiting={loading}
          onPlay={() => (paused ? resume() : void play())}
          onPause={pause}
          onStop={stop}
          label={`Play ${item.name ?? item.letter ?? ''}`}
        />
      </div>
    </div>
  );
}
