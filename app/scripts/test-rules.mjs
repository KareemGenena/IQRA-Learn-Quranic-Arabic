/**
 * Check firestore.rules by running it against the Firebase Rules test API.
 *
 *   node scripts/test-rules.mjs
 *
 * Run this before `firebase deploy --only firestore:rules`. It exercises the
 * real rules engine on Google's side — no emulator, no Java, and no real
 * accounts, because the auth context is synthetic.
 *
 * Read the failures carefully: the harness is not a perfect twin of
 * production. `resource` on a create is undefined here rather than null, so
 * rules must never lean on `resource == null` to tell a create from an update
 * — use separate `allow create` / `allow update` clauses, which is clearer
 * anyway. That difference already cost one debugging session.
 *
 * Credentials come from the Firebase CLI you already signed in with. The
 * client id and secret below are the firebase-tools ones, public in its own
 * source — they identify the CLI, they do not grant anything on their own.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const PROJECT = 'iqra---learn-quranic-arabic';
const RULES_PATH = path.join(import.meta.dirname, '..', '..', 'firestore.rules');
const ADMIN = 'kintegracion@gmail.com';
const NOW = '2026-01-01T00:00:00Z';

const CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

async function accessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;
  const store = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(store)) throw new Error('Not signed in — run `firebase login` first.');
  const refresh = JSON.parse(fs.readFileSync(store, 'utf8'))?.tokens?.refresh_token;
  if (!refresh) throw new Error('No refresh token — run `firebase login` again.');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      client_secret: CLI_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Could not get a token: ${JSON.stringify(json)}`);
  return json.access_token;
}

const doc = (p) => `/databases/(default)/documents/${p}`;
const who = (uid, email) => ({ uid, token: { email, email_verified: true } });

const STUDENT = who('stu1', 'student@example.com');
const OWNER = who('adm1', ADMIN);

/** A stored profile, as the rules see `resource` on an update. */
const stored = (over = {}) => ({
  data: { email: 'student@example.com', displayName: 'Aisha', role: 'learner', createdAt: 1000, ...over },
});
const profile = (over = {}) => ({
  email: 'student@example.com', displayName: 'Aisha', role: 'learner', createdAt: 1000, ...over,
});

const read = (name, expectation, auth, p) => ({
  name, expectation, request: { auth, path: doc(p), method: 'get', time: NOW },
});
const write = (name, expectation, auth, p, data, method = 'create', existing = null) => ({
  name, expectation,
  request: { auth, path: doc(p), method, time: NOW, resource: { data } },
  ...(existing ? { resource: existing } : {}),
});

const CASES = [
  // --- profiles: users/{uid} ---
  read('anon cannot read a profile', 'DENY', null, 'users/stu1'),
  read('you can read your own profile', 'ALLOW', STUDENT, 'users/stu1'),
  read('you cannot read another learner profile', 'DENY', STUDENT, 'users/stu2'),
  read('the owner can read any profile', 'ALLOW', OWNER, 'users/stu2'),

  write('create your own profile as a learner', 'ALLOW', STUDENT, 'users/stu1', profile()),
  write('create your own profile as a teacher', 'ALLOW', STUDENT, 'users/stu1', profile({ role: 'teacher' })),
  write('cannot make yourself admin', 'DENY', STUDENT, 'users/stu1', profile({ role: 'admin' })),
  write('cannot invent a role', 'DENY', STUDENT, 'users/stu1', profile({ role: 'owner' })),
  write('cannot claim another email', 'DENY', STUDENT, 'users/stu1', profile({ email: 'other@example.com' })),
  write('cannot smuggle in an extra field', 'DENY', STUDENT, 'users/stu1', profile({ classes: ['x'] })),
  write('cannot write into another profile', 'DENY', STUDENT, 'users/stu2', profile({ email: 'other@example.com' })),
  write('anon cannot create a profile', 'DENY', null, 'users/stu1', profile()),
  write('displayName has a ceiling', 'DENY', STUDENT, 'users/stu1', profile({ displayName: 'x'.repeat(200) })),
  write('a missing createdAt is refused', 'DENY', STUDENT, 'users/stu1',
    { email: 'student@example.com', displayName: 'Aisha', role: 'learner' }),

  write('declare yourself a teacher later', 'ALLOW', STUDENT, 'users/stu1',
    profile({ role: 'teacher' }), 'update', stored()),
  write('cannot rewrite your creation date', 'DENY', STUDENT, 'users/stu1',
    profile({ createdAt: 9999 }), 'update', stored()),
  write('cannot become admin by updating', 'DENY', STUDENT, 'users/stu1',
    profile({ role: 'admin' }), 'update', stored()),
  { name: 'you can delete your own account', expectation: 'ALLOW',
    request: { auth: STUDENT, path: doc('users/stu1'), method: 'delete', time: NOW }, resource: stored() },
  { name: 'you cannot delete someone else', expectation: 'DENY',
    request: { auth: STUDENT, path: doc('users/stu2'), method: 'delete', time: NOW }, resource: stored() },
  { name: 'not even the owner deletes someone else', expectation: 'DENY',
    request: { auth: OWNER, path: doc('users/stu1'), method: 'delete', time: NOW }, resource: stored() },
  { name: 'anon deletes nothing', expectation: 'DENY',
    request: { auth: null, path: doc('users/stu1'), method: 'delete', time: NOW }, resource: stored() },

  // --- what was already there must not have regressed ---
  read('anyone reads the published config', 'ALLOW', null, 'config/app'),
  write('a learner cannot change what is published', 'DENY', STUDENT, 'config/app',
    { lessons: {} }, 'update', { data: { lessons: {} } }),
  write('the owner can change what is published', 'ALLOW', OWNER, 'config/app',
    { lessons: {} }, 'update', { data: { lessons: {} } }),
  read('anyone reads calibrations', 'ALLOW', null, 'calibrations/lesson1/words/01'),
  write('a learner cannot write calibrations', 'DENY', STUDENT, 'calibrations/lesson1/words/01', { b: [0.1, 0.2] }),
  write('the owner can write calibrations', 'ALLOW', OWNER, 'calibrations/lesson1/words/01', { b: [0.1, 0.2] }),
  write('calibration boundaries are shape-checked', 'DENY', OWNER, 'calibrations/lesson1/words/01', { b: [0.1] }),
];

const token = await accessToken();
const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: { files: [{ name: 'firestore.rules', content: fs.readFileSync(RULES_PATH, 'utf8') }] },
    testSuite: { testCases: CASES.map(({ name: _name, ...c }) => c) },
  }),
});
const json = await res.json();

if (json.error) {
  console.error('Rules API error:', JSON.stringify(json.error, null, 2));
  process.exit(1);
}
if (json.issues?.length) {
  console.error('The rules did not compile cleanly:');
  for (const i of json.issues) console.error(` ${i.sourcePosition?.line}: ${i.description}`);
  process.exit(1);
}

let failed = 0;
json.testResults.forEach((result, i) => {
  const ok = result.state === 'SUCCESS';
  if (!ok) failed++;
  const mark = ok ? '  ok  ' : ' FAIL ';
  console.log(`${mark}[${CASES[i].expectation.padEnd(5)}] ${CASES[i].name}`);
  if (!ok && result.errorPosition) console.log(`        firestore.rules line ${result.errorPosition.line}`);
});

console.log(`\n${json.testResults.length - failed}/${json.testResults.length} passed`);
process.exit(failed ? 1 : 0);
