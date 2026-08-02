import { useCallback, useMemo, useRef, useState } from 'react';
import { splitClusters } from './graphemes';
import { audibleIndices } from './timing';
import { getAudioSrc } from './audioSource';
import { audioUrl, playWithHighlights, resolveBoundaries, stopActivePlayback } from './playback';
import type { PlaybackHandle } from './playback';
import type { Lesson, Playable } from '../types';

/** Everything a card needs to render and play one piece of Arabic. */
export function usePlayable(lesson: Lesson, playable: Playable, rate: number) {
  const clusters = useMemo(() => splitClusters(playable.text), [playable.text]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<PlaybackHandle | null>(null);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  /** Resolves when playback has finished, so callers can chain words. */
  const play = useCallback(async (): Promise<void> => {
    stopActivePlayback();
    setPlaying(true);
    try {
      const url = audioUrl(lesson, playable);
      const [boundaries, src] = await Promise.all([
        resolveBoundaries(lesson, playable, clusters),
        getAudioSrc(url),
      ]);
      const indexMap = audibleIndices(clusters, playable.silentClusters);
      await new Promise<void>((resolve) => {
        handleRef.current = playWithHighlights(
          src,
          boundaries,
          setActiveIndex,
          () => {
            setPlaying(false);
            handleRef.current = null;
            resolve();
          },
          rate,
          indexMap,
        );
      });
    } catch (err) {
      console.error(`playback failed for ${playable.key}:`, err);
      setPlaying(false);
    }
  }, [lesson, playable, clusters, rate]);

  const toggle = useCallback(() => {
    if (playing) {
      stop();
      return Promise.resolve();
    }
    return play();
  }, [playing, play, stop]);

  return { clusters, activeIndex, playing, play, stop, toggle };
}
