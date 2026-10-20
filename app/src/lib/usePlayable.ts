import { useCallback, useMemo, useRef, useState } from 'react';
import { splitClusters } from './graphemes';
import { audibleIndices, ghunnaShares } from './timing';
import type { HighlightPhase } from './timing';
import { getAudioSrc } from './audioSource';
import { audioUrl, playWithHighlights, resolveBoundaries, stopActivePlayback } from './playback';
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

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setPaused(false);
  }, []);

  /** Resolves when playback has finished, so callers can chain words.
   *  `start` begins part-way through: media seconds, or `{ cluster }` to
   *  begin where that letter is said — a letter card tapped on بُ. */
  const play = useCallback(
    async (start: number | { cluster: number } = 0): Promise<void> => {
      stopActivePlayback();
      setPlaying(true);
      setPaused(false);
      setLoading(true);
      try {
        const url = audioUrl(lesson, playable);
        const [bounds, src] = await Promise.all([
          resolveBoundaries(lesson, playable, clusters),
          getAudioSrc(url),
        ]);
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
            src,
            bounds,
            // Only commit a change: the tick runs every frame.
            (index, phase) => setActive((a) => (a.index === index && a.phase === phase ? a : { index, phase })),
            () => {
              setPlaying(false);
              setPaused(false);
              handleRef.current = null;
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
        setLoading(false);
        setPlaying(false);
        setPaused(false);
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
    toggle,
  };
}
