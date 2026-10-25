import { useCallback, useMemo, useRef, useState } from 'react';
import { splitClusters } from './graphemes';
import { audibleIndices, ghunnaShares } from './timing';
import type { HighlightPhase } from './timing';
import { audioUrl, playWithHighlights, prepareClip, resolveBoundaries, stopActivePlayback, warmAudio } from './playback';
import type { PlaybackHandle } from './playback';
import type { Lesson, Playable } from '../types';

interface Active {
  index: number | null;
  phase: HighlightPhase;
}
const IDLE: Active = { index: null, phase: null };

/** Everything a card needs to render and play one piece of Arabic. */
export function usePlayable(lesson: Lesson, playable: Playable, rate: number) {
  const clusters = useMemo(() => splitClusters(playable.text), [playable.text]);
  const [active, setActive] = useState<Active>(IDLE);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  /** True from the tap until the clip and its timing are in hand — the
   *  download on a first play. A card shows it, and ignores a second tap. */
  const [loading, setLoading] = useState(false);
  /** The boundaries the current playback resolved to — a song card needs
   *  them to jump to a letter. Empty until something has played. */
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const handleRef = useRef<PlaybackHandle | null>(null);
  /** Each play is a generation. A second play on this hook, or a stop,
   *  before the first has its clip supersedes it: the first then neither
   *  sounds nor resets the state the second has set (two in flight once left
   *  a card dark while its clip played; a stop during the download once let
   *  the clip play after the page was left). */
  const genRef = useRef(0);

  const stop = useCallback(() => {
    genRef.current += 1;
    handleRef.current?.stop();
    handleRef.current = null;
    setPlaying(false);
    setPaused(false);
    setLoading(false);
  }, []);

  /** Resolves when playback has finished, so callers can chain words.
   *  `start` begins part-way through: media seconds, or `{ cluster }` to
   *  begin where that letter is said — a letter card tapped on بُ. */
  const play = useCallback(
    async (start: number | { cluster: number } = 0): Promise<void> => {
      stopActivePlayback();
      // Still inside the tap: iOS lets a suspended or interrupted context
      // resume, and the session-key element be unlocked, only from a gesture.
      warmAudio();
      const gen = ++genRef.current;
      setPlaying(true);
      setPaused(false);
      setLoading(true);
      try {
        const url = audioUrl(lesson, playable);
        // The clip is fetched, decoded and (off 1×) stretched here, so the
        // player's own call finds it ready and starts at once.
        const [bounds] = await Promise.all([
          resolveBoundaries(lesson, playable, clusters),
          prepareClip(url, rate),
        ]);
        if (genRef.current !== gen) return; // superseded or stopped meanwhile
        setLoading(false);
        setBoundaries(bounds);
        const indexMap = audibleIndices(clusters, playable.silentClusters);
        const startAt =
          typeof start === 'number' ? start : (bounds[indexMap.indexOf(start.cluster)] ?? 0);
        const shares = ghunnaShares(clusters, playable.silentClusters, {
          letterNames: playable.letterNames,
          waqf: playable.waqf,
          waqfMadd: playable.waqfMadd,
        });
        await new Promise<void>((resolve) => {
          handleRef.current = playWithHighlights(
            url,
            bounds,
            // Only commit a change: the tick runs every frame.
            (index, phase) => setActive((a) => (a.index === index && a.phase === phase ? a : { index, phase })),
            () => {
              if (genRef.current === gen) {
                setPlaying(false);
                setPaused(false);
                handleRef.current = null;
              }
              resolve();
            },
            rate,
            indexMap,
            shares,
            startAt,
          );
        });
      } catch (err) {
        console.error(`playback failed for ${playable.key}:`, err);
        if (genRef.current === gen) {
          setLoading(false);
          setPlaying(false);
          setPaused(false);
        }
      }
    },
    [lesson, playable, clusters, rate],
  );

  const pause = useCallback(() => {
    if (!handleRef.current) return;
    handleRef.current.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!handleRef.current) return;
    handleRef.current.resume();
    setPaused(false);
  }, []);

  const seek = useCallback((time: number) => {
    handleRef.current?.seek(time);
  }, []);

  /** The media time being heard right now, or null when nothing plays —
   *  the song strip glides on it, frame by frame. */
  const now = useCallback(() => handleRef.current?.now() ?? null, []);

  const toggle = useCallback(() => {
    // A tap while the first tap's clip is still downloading used to cancel
    // it — and the clip then arrived to a card that said it was not playing.
    if (loading) return Promise.resolve();
    if (playing) {
      stop();
      return Promise.resolve();
    }
    return play();
  }, [loading, playing, play, stop]);

  return {
    clusters,
    activeIndex: active.index,
    activePhase: active.phase,
    playing,
    loading,
    paused,
    boundaries,
    play,
    stop,
    pause,
    resume,
    seek,
    now,
    toggle,
  };
}
