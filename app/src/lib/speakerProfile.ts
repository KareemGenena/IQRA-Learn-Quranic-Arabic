/**
 * The speaker calibration set — five short recordings made once per session,
 * before any words.
 *
 * This exists for the pronunciation work, not for the lessons, and it is here
 * from the first version because it is the one thing that cannot be added
 * afterwards. Comparing a learner's ع against a distribution built from native
 * speakers only works if the two can be put on the same scale, and they cannot
 * be:
 *
 * - **Vowel formants scale with the vocal tract.** A twelve-year-old's F1/F2
 *   sit far from an adult man's for the identical sound. Normalising against
 *   each speaker's *own* vowel space fixes that, which needs the three corners
 *   /aː/ /iː/ /uː/ from every speaker — native and learner alike. Recorded
 *   after ب, which is bilabial and colours neither vowel; ق would have
 *   pharyngealised all three and moved the corners it was meant to locate.
 *
 * - **Loudness is a property of the room and the microphone**, not of the
 *   speaker. Absolute energy cannot be compared between a volunteer's phone
 *   and a studio mic, so the measurements have to be ratios — and the room
 *   tone is what anchors them.
 *
 * Ask a volunteer for these once and they take twenty seconds. Ask a hundred
 * volunteers for them a year later and most of them are gone.
 */

import type { Slot } from './intakeStore';

export interface ProfileItem {
  id: string;
  text: string;
  hint: string;
  fileName: string;
  expect: number;
}

export const SPEAKER_PROFILE: ProfileItem[] = [
  {
    id: 'roomtone',
    text: '—',
    hint: 'Say nothing at all. Three seconds of the room exactly as it is, so everything else can be measured against it.',
    fileName: 'speaker-roomtone.wav',
    expect: 0,
  },
  {
    id: 'vowel-a',
    text: 'بَا',
    hint: 'Hold the vowel steady for about two seconds.',
    fileName: 'speaker-vowel-a.wav',
    expect: 1,
  },
  {
    id: 'vowel-i',
    text: 'بِي',
    hint: 'Hold the vowel steady for about two seconds.',
    fileName: 'speaker-vowel-i.wav',
    expect: 1,
  },
  {
    id: 'vowel-u',
    text: 'بُو',
    hint: 'Hold the vowel steady for about two seconds.',
    fileName: 'speaker-vowel-u.wav',
    expect: 1,
  },
  {
    id: 'carrier',
    text: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ',
    hint: 'At your normal reciting pace, in one breath. This fixes the speaker’s level and speed.',
    fileName: 'speaker-carrier.wav',
    expect: 1,
  },
];

export const profileSlots = (): Slot[] =>
  SPEAKER_PROFILE.map((item) => ({
    id: `profile-${item.id}`,
    kind: 'profile' as const,
    text: item.text,
    hint: item.hint,
    fileName: item.fileName,
    expect: item.expect,
  }));
