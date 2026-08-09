/**
 * The class note layer — one sheet per class, per lesson, written by the
 * teacher and read by everyone approved in that class.
 *
 *   classes/{classId}/notes/{lessonId}   { strokes, html, updatedAt }
 *
 * Per class, not per teacher: someone running two classes annotates the same
 * lesson differently for each, and mixing them would be worse than useless.
 *
 * A learner's own notes stay where they are — on their device, in IndexedDB,
 * private. Nothing here touches them.
 */

import { getIdToken, getSession } from './auth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';
import type { NoteDoc, Stroke } from './notesStore';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Firestore refuses a document over 1 MiB, and an endless canvas of
 * handwriting can reach that. The ceiling is set below the real one so the
 * teacher is told plainly rather than having a save rejected by the server.
 */
const MAX_BYTES = 900_000;

export const NOTE_TOO_BIG = 'NOTE_TOO_BIG';

/**
 * Canvas coordinates carry no meaning past a tenth of a pixel, and full
 * float precision roughly triples the size of a stroke. Rounding is the
 * cheapest thing that keeps a long note under the ceiling.
 */
const trim = (strokes: Stroke[]): Stroke[] =>
  strokes.map((s) => ({ ...s, pts: s.pts.map((n) => Math.round(n * 10) / 10) }));

const notePath = (classId: string, lessonId: number) => `${BASE}/classes/${classId}/notes/${lessonId}`;

async function token(): Promise<string> {
  const t = await getIdToken();
  if (!t) throw new Error('not signed in');
  return t;
}

/** The class sheet for this lesson, or null if the teacher hasn't written one. */
export async function fetchClassNote(classId: string, lessonId: number): Promise<NoteDoc | null> {
  const res = await fetch(`${notePath(classId, lessonId)}?key=${API_KEY}`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`class note fetch failed: ${res.status}`);

  const json = (await res.json()) as { fields?: Record<string, any> };
  const raw = json.fields?.body?.stringValue ?? '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { strokes?: Stroke[]; html?: string };
    return {
      lessonId,
      layer: classLayer(classId),
      strokes: parsed.strokes ?? [],
      html: parsed.html ?? '',
      updatedAt: Number(json.fields?.updatedAt?.integerValue ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Write the class sheet. Only the class's teacher may, and the rules enforce
 * that — this simply reports back what the server would have said anyway.
 */
export async function saveClassNote(classId: string, doc: NoteDoc): Promise<void> {
  const body = JSON.stringify({ strokes: trim(doc.strokes), html: doc.html });
  if (body.length > MAX_BYTES) throw new Error(NOTE_TOO_BIG);

  const res = await fetch(`${notePath(classId, doc.lessonId)}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({
      fields: {
        // One JSON string rather than a Firestore array of maps: strokes are
        // opaque to every query the app will ever make, and the encoded form
        // is several times larger.
        body: { stringValue: body },
        updatedAt: { integerValue: String(Date.now()) },
      },
    }),
  });
  if (!res.ok) throw new Error(`class note save failed: ${res.status}`);
}

/** How a class sheet is cached on this device, so it can be read offline. */
export const classLayer = (classId: string) => `class:${classId}`;

/** True when this device is signed in at all — nothing here works otherwise. */
export const canReachCloud = (): boolean => !!getSession();
