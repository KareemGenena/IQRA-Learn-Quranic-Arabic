/**
 * The teacher's own stroke templates, shared through Cloud Firestore (REST,
 * no SDK — the same device as cloudCalibration.ts).
 *
 * The strokes baked into lesson 30 are derived from the font; when the
 * teacher draws a letter himself on its card (the admin's "Teach the
 * strokes"), his strokes are saved here —
 *
 *   tracing/{letter}  ->  { s: [ { p: [x0, y0, x1, y1, …] }, … ], at }
 *
 * (a stroke's points flattened into one list, because Firestore holds no
 * array inside an array) — and every device prefers them to the baked
 * ones. Fetched once per session, kept in localStorage so the PWA has the
 * latest-known templates offline; `scripts/tracing/pull-cloud.mjs` bakes
 * them into strokes.json. All failures are soft: no cloud, no change.
 */

import { getIdToken } from './auth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';
import type { LetterTrace } from '../types';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tracing`;
const STORE = 'iqra-tracing-cloud';

type Map_ = Record<string, LetterTrace>;

let cache: Map_ | null = null;
let pending: Promise<Map_> | null = null;
const listeners = new Set<() => void>();

interface FV {
  doubleValue?: number;
  integerValue?: string;
  arrayValue?: { values?: FV[] };
  mapValue?: { fields?: Record<string, FV> };
}

const num = (v: FV) => (v.doubleValue !== undefined ? v.doubleValue : Number(v.integerValue));

/** A template is 1–12 strokes of 1 or 2–200 points, every coordinate in [−0.5, 1.5]. */
function valid(t: LetterTrace): boolean {
  return (
    t.strokes.length >= 1 &&
    t.strokes.length <= 12 &&
    t.strokes.every(
      (s) => (s.length === 1 || (s.length >= 2 && s.length <= 200)) && s.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > -0.5 && x < 1.5 && y > -0.5 && y < 1.5),
    )
  );
}

function fromDoc(doc: { name: string; fields?: Record<string, FV> }): [string, LetterTrace] | null {
  const letter = decodeURIComponent(doc.name.split('/').pop() ?? '');
  const strokes = (doc.fields?.s?.arrayValue?.values ?? []).map((sv) => {
    const flat = (sv.mapValue?.fields?.p?.arrayValue?.values ?? []).map(num);
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    return pts;
  });
  const t = { strokes };
  return letter && valid(t) ? [letter, t] : null;
}

function readStore(): Map_ {
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Map_) ?? {};
  } catch {
    return {};
  }
}

function writeStore(map: Map_): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(map));
  } catch {
    // a full store only costs the offline copy
  }
}

function notify(): void {
  for (const l of listeners) l();
}

/** The cloud's templates, once per session; the last-known set when offline. */
export function loadCloudTraces(): Promise<Map_> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch(`${BASE}?pageSize=100&key=${API_KEY}`);
      if (!res.ok) throw new Error(`tracing fetch failed: ${res.status}`);
      const json = (await res.json()) as { documents?: { name: string; fields?: Record<string, FV> }[] };
      const map: Map_ = {};
      for (const doc of json.documents ?? []) {
        const got = fromDoc(doc);
        if (got) map[got[0]] = got[1];
      }
      cache = map;
      writeStore(map);
    } catch {
      cache = readStore();
    }
    pending = null;
    notify();
    return cache;
  })();
  return pending;
}

/** The teacher's template for a letter, if the cloud has one (sync, from the cache). */
export function cloudTrace(letter: string): LetterTrace | undefined {
  return (cache ?? readStore())[letter];
}

export function onTracesChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');
  return { Authorization: `Bearer ${token}` };
}

export async function saveCloudTrace(letter: string, trace: LetterTrace): Promise<void> {
  if (!valid(trace)) throw new Error('not a valid template');
  const res = await fetch(`${BASE}/${encodeURIComponent(letter)}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      fields: {
        s: {
          arrayValue: {
            values: trace.strokes.map((s) => ({
              mapValue: { fields: { p: { arrayValue: { values: s.flat().map((n) => ({ doubleValue: n })) } } } },
            })),
          },
        },
        at: { integerValue: String(Date.now()) },
      },
    }),
  });
  if (!res.ok) throw new Error(`tracing save failed: ${res.status}`);
  cache = { ...(cache ?? readStore()), [letter]: trace };
  writeStore(cache);
  notify();
}

export async function deleteCloudTrace(letter: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(letter)}?key=${API_KEY}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`tracing delete failed: ${res.status}`);
  const next = { ...(cache ?? readStore()) };
  delete next[letter];
  cache = next;
  writeStore(cache);
  notify();
}
