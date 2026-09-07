import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { splitClusters } from '../lib/graphemes';
import type { CardProps } from '../pages/SectionedLesson';
import type { Lesson, Playable } from '../types';

/**
 * A letter, the way a five-year-old meets it.
 *
 * Picture on the left, the bare letter large on the right, the four sounds
 * as small cards underneath, the name small in the corner. Manāra stands
 * between picture and letter and points her beam at whichever the teacher's
 * voice is talking about: the picture during the intro, the sounds during the
 * forms line. She never speaks, and she is still whenever nothing plays.
 *
 * The adult ItemCard is left alone — this is the kids skin's card, chosen by
 * the route (#/kids/lesson/N), and the lesson data underneath is the same.
 */

const manara = (state: 'still' | 'beam') =>
  `${import.meta.env.BASE_URL}images/kids/${state === 'beam' ? 'manara-beam' : 'manara'}.png?v=${__IMAGE_VERSION__}`;

interface SmallFormProps {
  lesson: Lesson;
  playable: Playable;
  rate: number;
  label?: string;
  register?: (key: string, play: () => Promise<void>) => void;
  /** Lit by the forms line saying this sound, not by its own playback. */
  lit: boolean;
}

/** One sound: بَ, بُ, بِ, نَبۡ. Tappable on its own. */
function SmallForm({ lesson, playable, rate, label, register, lit }: SmallFormProps) {
  const { clusters, activeIndex, activePhase, playing, play, toggle } = usePlayable(lesson, playable, rate);

  useEffect(() => {
    register?.(playable.key, play);
  }, [register, playable.key, play]);

  return (
    <button
      type="button"
      className={`small-form ${playing ? 'playing' : ''} ${lit ? 'lit' : ''}`}
      onClick={() => void toggle()}
      aria-label={`Play ${playable.text}`}
    >
      <ArabicWord
        text={playable.text}
        clusters={clusters}
        activeIndex={activeIndex}
        activePhase={activePhase}
        silentClusters={playable.silentClusters}
      />
      {label && <span className="small-label">{label}</span>}
    </button>
  );
}

interface SpokenProps {
  lesson: Lesson;
  playable: Playable;
  rate: number;
  label: string;
  register?: (key: string, play: () => Promise<void>) => void;
  onState: (playing: boolean, activeIndex: number | null) => void;
}

/** A spoken line, played whole. Reports what it is doing so the card can
 *  point the beam and light the sound being said. */
function Spoken({ lesson, playable, rate, label, register, onState }: SpokenProps) {
  const { activeIndex, playing, play, toggle } = usePlayable(lesson, playable, rate);

  useEffect(() => {
    register?.(playable.key, play);
  }, [register, playable.key, play]);

  useEffect(() => {
    onState(playing, playing ? activeIndex : null);
  }, [playing, activeIndex, onState]);

  return (
    <button type="button" className={`spoken-btn ${playing ? 'playing' : ''}`} onClick={() => void toggle()}>
      <PlayIcon playing={playing} />
      <span>{label}</span>
    </button>
  );
}

export function LetterCard({ lesson, item, rate, displayNo, register }: CardProps) {
  const intro = item.extras?.find((e) => e.key.endsWith('i'));
  const line = item.extras?.find((e) => e.key.endsWith('l'));

  const [introOn, setIntroOn] = useState(false);
  const [lineForm, setLineForm] = useState<number | null>(null);

  /**
   * The forms line highlights LETTERS — نَبۡ is two clusters — while the card
   * lights whole sound-cards. So each cluster of the line is mapped to the
   * form it belongs to, by counting clusters form by form.
   */
  const formOfCluster = useMemo(() => {
    const map: number[] = [];
    item.forms.forEach((f, formIndex) => {
      for (let i = 0; i < splitClusters(f.text).length; i++) map.push(formIndex);
    });
    return map;
  }, [item.forms]);

  const onIntro = useCallback((playing: boolean) => setIntroOn(playing), []);
  const onLine = useCallback(
    (playing: boolean, activeIndex: number | null) => {
      setLineForm(playing && activeIndex !== null ? (formOfCluster[activeIndex] ?? null) : null);
    },
    [formOfCluster],
  );

  const beam = introOn ? 'picture' : lineForm !== null ? 'letter' : null;

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
          <figure className="letter-pic">
            <img src={item.image} alt="" />
            {item.mnemonic && <figcaption>{item.mnemonic}</figcaption>}
          </figure>
        )}
        {/* The beam is one drawing pointing right; mirrored, it points left at
            the picture. The tower is symmetrical enough that nobody can tell —
            so the beam moves and Manāra stays, which is what a lighthouse does. */}
        <div className={`manara-spot beam-${beam ?? 'none'}`} aria-hidden="true">
          <img className="manara" src={beam ? manara('beam') : manara('still')} alt="" />
        </div>
        <div className="letter-big" dir="rtl" lang="ar">
          {item.letter}
        </div>
      </div>

      <div className="letter-forms" dir="rtl">
        {item.forms.map((f, i) => (
          <SmallForm
            key={f.key}
            lesson={lesson}
            playable={f}
            rate={rate}
            label={item.labels?.[i]}
            register={register}
            lit={lineForm === i}
          />
        ))}
      </div>

      {(intro || line) && (
        <div className="letter-spoken">
          {intro && (
            <Spoken lesson={lesson} playable={intro} rate={rate} label="About this letter" register={register} onState={onIntro} />
          )}
          {line && <Spoken lesson={lesson} playable={line} rate={rate} label="Say it" register={register} onState={onLine} />}
        </div>
      )}
    </div>
  );
}
