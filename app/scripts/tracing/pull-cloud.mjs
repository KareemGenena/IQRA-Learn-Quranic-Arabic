/**
 * Pulls the teacher's own stroke templates down from Cloud Firestore
 * (`tracing/{letter}`, written by the card's "Teach the strokes") into
 * `scripts/tracing/authored.json`, so the next `derive-strokes.mjs` bakes
 * them into strokes.json over the font-derived defaults and every build
 * carries them without the cloud. Public read, no sign-in.
 *
 *   node scripts/tracing/pull-cloud.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = readFileSync(join(here, '..', '..', 'src', 'lib', 'firebaseConfig.ts'), 'utf8');
const PROJECT_ID = /projectId:\s*'([^']+)'/.exec(cfg)?.[1];
const API_KEY = /apiKey:\s*'([^']+)'/.exec(cfg)?.[1];
if (!PROJECT_ID || !API_KEY) throw new Error('firebaseConfig.ts: projectId or apiKey not found');

const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tracing?pageSize=100&key=${API_KEY}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`fetch failed: ${res.status} ${await res.text()}`);
const json = await res.json();
const num = (v) => (v.doubleValue !== undefined ? v.doubleValue : Number(v.integerValue));
const out = {};
for (const doc of json.documents ?? []) {
  const letter = decodeURIComponent(doc.name.split('/').pop());
  const strokes = (doc.fields?.s?.arrayValue?.values ?? []).map((sv) => {
    const flat = (sv.mapValue?.fields?.p?.arrayValue?.values ?? []).map(num);
    const pts = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    return pts;
  });
  if (strokes.length) out[letter] = { strokes, at: Number(doc.fields?.at?.integerValue ?? 0) };
}
writeFileSync(join(here, 'authored.json'), JSON.stringify(out, null, 1), 'utf8');
console.log(`${Object.keys(out).length} authored template(s): ${Object.keys(out).join(' ') || '—'}`);
console.log('now: node scripts/tracing/derive-strokes.mjs <workdir> && node scripts/make-alphabet.mjs');
