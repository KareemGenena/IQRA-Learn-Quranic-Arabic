/**
 * Class recordings — where the link to a recorded session lives.
 *
 *   classes/{classId}/recordings/{recordingId}
 *
 * The teacher records their class (Zoom, or anything else that produces a
 * link) and posts it here instead of into a chat thread. A link in a chat is
 * gone by the following week: it sits below whatever was said since, it is not
 * there at all for someone who joined later, and it cannot be found by lesson.
 * The same URL kept beside the class it belongs to is findable for as long as
 * the class exists.
 *
 * This is deliberately a *pointer*, not a copy. Nothing is uploaded and no
 * video is hosted here — the recording stays wherever the teacher put it, under
 * whatever retention and sharing rules they chose there, and the app never has
 * a copy to leak or to keep after they delete theirs.
 *
 * Per class, like the notes: a teacher running two classes records two
 * different sessions, and the one thing worse than no link is the other
 * class's link.
 */

import { getIdToken, getSession } from './auth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface Recording {
  id: string;
  /** What the teacher calls this session — "Lesson 5, madd" or just a date. */
  title: string;
  url: string;
  /** Cloud recordings are usually behind one. Kept beside the link, not in it. */
  passcode: string;
  note: string;
  /** The day the class was held — the teacher's, not the upload's. */
  recordedAt: number;
  /** When it was posted here. Set once, and what the list falls back to. */
  createdAt: number;
  /** The lesson it belongs to, or 0 for none. */
  lessonId: number;
}

/** Everything a teacher fills in. The two timestamps are the app's business. */
export type RecordingDraft = Omit<Recording, 'id' | 'createdAt'>;

export const TITLE_MAX = 120;
export const NOTE_MAX = 500;
export const URL_MAX = 500;
export const PASSCODE_MAX = 60;

/**
 * A URL fit to put in front of a class.
 *
 * `https:` only, and parsed rather than pattern-matched. A teacher pasting from
 * a mail client can easily bring along a `javascript:` or `data:` URL, and the
 * page renders these as links other people click. The rules refuse anything
 * that is not https as well, so this is the message rather than the defence.
 */
export function tidyUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  // A pasted "zoom.us/rec/..." is meant as a web address, not a relative path.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.href.length > URL_MAX) return null;
  return parsed.href;
}

/** "zoom.us", "drive.google.com" — enough to know what you are about to open. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ── plumbing ──────────────────────────────────────────────────────────────

const str = (v: string) => ({ stringValue: v });
const int = (v: number) => ({ integerValue: String(v) });

type Fields = Record<string, any> | undefined;
const readStr = (f: Fields, k: string): string => f?.[k]?.stringValue ?? '';
const readInt = (f: Fields, k: string): number =>
  Number(f?.[k]?.integerValue ?? f?.[k]?.doubleValue ?? 0);

async function call(path: string, init: RequestInit): Promise<any> {
  const token = await getIdToken();
  if (!token || !getSession()?.uid) throw new Error('not signed in');
  const join = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${join}key=${API_KEY}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const decode = (id: string, f: Fields): Recording => ({
  id,
  title: readStr(f, 'title'),
  url: readStr(f, 'url'),
  passcode: readStr(f, 'passcode'),
  note: readStr(f, 'note'),
  recordedAt: readInt(f, 'recordedAt'),
  createdAt: readInt(f, 'createdAt'),
  lessonId: readInt(f, 'lessonId'),
});

const encode = (r: RecordingDraft & { createdAt: number }) => ({
  title: str(r.title),
  url: str(r.url),
  passcode: str(r.passcode),
  note: str(r.note),
  recordedAt: int(r.recordedAt),
  createdAt: int(r.createdAt),
  lessonId: int(r.lessonId),
});

// ── reading ───────────────────────────────────────────────────────────────

/**
 * Every recording in this class, the most recent class first.
 *
 * Sorted here rather than by the query: ordering server-side would need an
 * index, and a class holds tens of these, not thousands. `recordedAt` is the
 * day the class was held, which is the order a learner thinks in — falling back
 * to when it was posted for a row where the teacher left the date blank.
 */
export async function listRecordings(classId: string): Promise<Recording[]> {
  const json = (await call(`/classes/${classId}/recordings?pageSize=200`, { method: 'GET' })) as
    | { documents?: { name: string; fields?: Fields }[] }
    | null;
  return (json?.documents ?? [])
    .map((d) => decode(d.name.split('/').pop()!, d.fields))
    .sort((a, b) => (b.recordedAt || b.createdAt) - (a.recordedAt || a.createdAt));
}

// ── the teacher ───────────────────────────────────────────────────────────

export async function addRecording(classId: string, draft: RecordingDraft): Promise<Recording> {
  const id = crypto.randomUUID();
  const fields = encode({ ...draft, createdAt: Date.now() });
  await call(`/classes/${classId}/recordings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return decode(id, fields);
}

/**
 * Rewrite a recording in place — a corrected link, a fixed passcode, a better
 * title. `createdAt` is carried over rather than restamped: it is when the
 * class was posted, and the rules hold it still.
 */
export async function editRecording(
  classId: string,
  id: string,
  draft: RecordingDraft,
  createdAt: number,
): Promise<Recording> {
  const fields = encode({ ...draft, createdAt });
  await call(`/classes/${classId}/recordings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return decode(id, fields);
}

export async function deleteRecording(classId: string, id: string): Promise<void> {
  await call(`/classes/${classId}/recordings/${id}`, { method: 'DELETE' });
}
