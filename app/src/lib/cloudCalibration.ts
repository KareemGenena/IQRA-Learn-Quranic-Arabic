/**
 * Cross-device calibration sync via Cloud Firestore (REST — no SDK needed).
 *
 * The admin's calibrate page writes each word's boundaries to
 *   calibrations/lesson{N}/words/{wordId}   as { b: [seconds...] }
 * and every client fetches the whole set on startup, caching it in
 * localStorage so the PWA still has the latest-known timings offline.
 *
 * All failures are soft: no Firestore (offline, database not created yet,
 * rules rejection) simply means the app falls back to the timings baked
 * into words.json or the automatic estimate.
 */

import { getIdToken } from './adminAuth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';
import type { CalibrationMap } from './calibration';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const wordsPath = (lessonId: number) => `${BASE}/calibrations/lesson${lessonId}/words`;

interface FirestoreValue {
  doubleValue?: number;
  integerValue?: string;
}

/** Boundaries must be a strictly increasing list of finite seconds. */
function validBoundaries(arr: number[]): boolean {
  return (
    arr.length >= 2 &&
    arr.length <= 12 &&
    arr.every((v, i) => Number.isFinite(v) && v >= 0 && (i === 0 || v > arr[i - 1]))
  );
}

export async function fetchCloudCalibrations(lessonId: number): Promise<CalibrationMap> {
  const res = await fetch(`${wordsPath(lessonId)}?pageSize=300&key=${API_KEY}`);
  if (!res.ok) throw new Error(`calibration fetch failed: ${res.status}`);
  const json = (await res.json()) as {
    documents?: { name: string; fields?: { b?: { arrayValue?: { values?: FirestoreValue[] } } } }[];
  };

  const map: CalibrationMap = {};
  for (const doc of json.documents ?? []) {
    const wordId = Number(doc.name.split('/').pop());
    const values = doc.fields?.b?.arrayValue?.values ?? [];
    const boundaries = values.map((v) => (v.doubleValue !== undefined ? v.doubleValue : Number(v.integerValue)));
    if (Number.isInteger(wordId) && wordId > 0 && validBoundaries(boundaries)) {
      map[wordId] = boundaries;
    }
  }
  return map;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');
  return { Authorization: `Bearer ${token}` };
}

export async function saveCloudCalibration(
  lessonId: number,
  wordId: number,
  boundaries: number[],
): Promise<void> {
  const res = await fetch(`${wordsPath(lessonId)}/${wordId}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      fields: { b: { arrayValue: { values: boundaries.map((n) => ({ doubleValue: n })) } } },
    }),
  });
  if (!res.ok) throw new Error(`calibration save failed: ${res.status}`);
}

export async function deleteCloudCalibration(lessonId: number, wordId: number): Promise<void> {
  const res = await fetch(`${wordsPath(lessonId)}/${wordId}?key=${API_KEY}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`calibration delete failed: ${res.status}`);
}
