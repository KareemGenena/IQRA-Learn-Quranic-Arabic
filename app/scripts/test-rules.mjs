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
const OTHER = who('stu2', 'other@example.com');
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

const TEACHER = who('tch1', 'teacher@example.com');

/** Stand in for the get()/exists() the class rules perform. */
const ownedBy = (uid) => ({
  function: 'get',
  args: [{ anyValue: {} }],
  result: { value: { data: { teacherUid: uid } } },
});
const memberExists = (yes) => ({
  function: 'exists',
  args: [{ anyValue: {} }],
  result: { value: yes },
});

/**
 * One mock for both get()s a recordings rule makes.
 *
 * `classOwner()` reads `.teacherUid` off the class and `standing()` reads
 * `.status` off the membership. The harness matches a mock by function name,
 * and both calls are `get`, so a single document carrying both fields answers
 * each of them with what it is actually looking for.
 */
const classAnd = (teacherUid, status) => ({
  function: 'get',
  args: [{ anyValue: {} }],
  result: { value: { data: { teacherUid, status } } },
});

const recording = (over = {}) => ({
  title: 'Tuesday — madd practice',
  url: 'https://zoom.us/rec/share/abc123',
  passcode: 'x8?Kq1',
  note: 'We stopped at row 20.',
  recordedAt: 1000,
  createdAt: 1000,
  lessonId: 5,
  ...over,
});

const klass = (over = {}) => ({
  name: 'Tuesday Halaqa',
  teacherUid: 'tch1',
  teacherName: 'Teacher',
  joinCode: 'K7QM4P',
  createdAt: 1000,
  active: true,
  ...over,
});
const membership = (over = {}) => ({
  displayName: 'Aisha',
  status: 'pending',
  requestedAt: 1000,
  decidedAt: 0,
  ...over,
});

const cls = (name, expectation, auth, path, method, data, existing, mocks) => ({
  name,
  expectation,
  request: {
    auth,
    path: doc(path),
    method,
    time: NOW,
    ...(data ? { resource: { data } } : {}),
  },
  ...(existing ? { resource: { data: existing } } : {}),
  ...(mocks ? { functionMocks: mocks } : {}),
});

function classCases() {
  const C = 'classes/c1';
  const M = 'classes/c1/members/stu1';
  return [
    // the class itself
    cls('a teacher reads their own class', 'ALLOW', TEACHER, C, 'get', null, klass(), [memberExists(false)]),
    cls('a stranger cannot read a class', 'DENY', STUDENT, C, 'get', null, klass(), [memberExists(false)]),
    cls('someone who has asked to join can read it', 'ALLOW', STUDENT, C, 'get', null, klass(), [memberExists(true)]),
    cls('anon cannot read a class', 'DENY', null, C, 'get', null, klass(), [memberExists(true)]),

    cls('a teacher creates their own class', 'ALLOW', TEACHER, C, 'create', klass()),
    cls('cannot create a class owned by someone else', 'DENY', STUDENT, C, 'create', klass()),
    cls('a class needs a name', 'DENY', TEACHER, C, 'create', klass({ name: '' })),
    cls('a class name has a ceiling', 'DENY', TEACHER, C, 'create', klass({ name: 'x'.repeat(200) })),
    cls('no extra fields on a class', 'DENY', TEACHER, C, 'create', klass({ secret: 'x' })),

    cls('a teacher renames their class', 'ALLOW', TEACHER, C, 'update', klass({ name: 'Thursday' }), klass()),
    cls('a class cannot change hands silently', 'DENY', TEACHER, C, 'update', klass({ teacherUid: 'stu1' }), klass()),
    cls('the join code cannot be swapped', 'DENY', TEACHER, C, 'update', klass({ joinCode: 'ZZZZZZ' }), klass()),
    cls('a stranger cannot rename a class', 'DENY', STUDENT, C, 'update', klass({ name: 'Mine' }), klass()),
    cls('a teacher deletes their own class', 'ALLOW', TEACHER, C, 'delete', null, klass()),
    cls('a stranger cannot delete a class', 'DENY', STUDENT, C, 'delete', null, klass()),

    // the roster
    cls('you enrol yourself, pending', 'ALLOW', STUDENT, M, 'create', membership()),
    cls('you cannot enrol yourself as approved', 'DENY', STUDENT, M, 'create', membership({ status: 'approved' })),
    cls('you cannot enrol somebody else', 'DENY', OTHER, M, 'create', membership()),
    cls('anon cannot enrol', 'DENY', null, M, 'create', membership()),

    cls('the teacher approves a member', 'ALLOW', TEACHER, M, 'update',
      membership({ status: 'approved', decidedAt: 2000 }), membership(), [ownedBy('tch1')]),
    cls('the teacher deactivates a member', 'ALLOW', TEACHER, M, 'update',
      membership({ status: 'removed', decidedAt: 2000 }), membership(), [ownedBy('tch1')]),
    cls('a learner cannot approve themselves', 'DENY', STUDENT, M, 'update',
      membership({ status: 'approved' }), membership(), [ownedBy('tch1')]),
    cls('another teacher cannot approve into this class', 'DENY', TEACHER, M, 'update',
      membership({ status: 'approved' }), membership(), [ownedBy('someone-else')]),
    cls('a teacher cannot rewrite a member name', 'DENY', TEACHER, M, 'update',
      membership({ status: 'approved', displayName: 'Changed' }), membership(), [ownedBy('tch1')]),

    cls('you read your own membership', 'ALLOW', STUDENT, M, 'get', null, membership(), [ownedBy('tch1')]),
    cls('the teacher reads a membership', 'ALLOW', TEACHER, M, 'get', null, membership(), [ownedBy('tch1')]),
    cls('a stranger cannot read a membership', 'DENY', OTHER, M, 'get', null, membership(), [ownedBy('tch1')]),
    cls('you can leave a class', 'ALLOW', STUDENT, M, 'delete', null, membership(), [ownedBy('tch1')]),
    cls('the teacher can strike someone off', 'ALLOW', TEACHER, M, 'delete', null, membership(), [ownedBy('tch1')]),
    cls('a stranger cannot remove a member', 'DENY', OTHER, M, 'delete', null, membership(), [ownedBy('tch1')]),

    // the class note sheet
    cls('the teacher writes the class notes', 'ALLOW', TEACHER, 'classes/c1/notes/3', 'create',
      { body: '{"strokes":[],"html":"<p>hi</p>"}', updatedAt: 5 }, null, [ownedBy('tch1')]),
    cls('the teacher rewrites them', 'ALLOW', TEACHER, 'classes/c1/notes/3', 'update',
      { body: '{"strokes":[]}', updatedAt: 6 }, { body: '{}', updatedAt: 5 }, [ownedBy('tch1')]),
    cls('a learner cannot write the class notes', 'DENY', STUDENT, 'classes/c1/notes/3', 'create',
      { body: '{}', updatedAt: 5 }, null, [ownedBy('tch1')]),
    cls('another teacher cannot write them', 'DENY', TEACHER, 'classes/c1/notes/3', 'create',
      { body: '{}', updatedAt: 5 }, null, [ownedBy('someone-else')]),
    cls('someone on the roster reads them', 'ALLOW', STUDENT, 'classes/c1/notes/3', 'get',
      null, { body: '{}', updatedAt: 5 }, [ownedBy('tch1'), memberExists(true)]),
    cls('a stranger cannot read them', 'DENY', OTHER, 'classes/c1/notes/3', 'get',
      null, { body: '{}', updatedAt: 5 }, [ownedBy('tch1'), memberExists(false)]),
    cls('anon cannot read them', 'DENY', null, 'classes/c1/notes/3', 'get',
      null, { body: '{}', updatedAt: 5 }, [ownedBy('tch1'), memberExists(true)]),
    cls('no extra fields on a note', 'DENY', TEACHER, 'classes/c1/notes/3', 'create',
      { body: '{}', updatedAt: 5, secret: 'x' }, null, [ownedBy('tch1')]),

    // class recordings — links to recorded sessions
    ...(() => {
      const R = 'classes/c1/recordings/r1';
      // Not the teacher, so the read has to be earned by standing in the class.
      const asMember = (status, exists = true) => [classAnd('someone-else', status), memberExists(exists)];
      return [
        cls('the teacher reads the recordings', 'ALLOW', TEACHER, R, 'get', null, recording(),
          [classAnd('tch1', 'approved')]),
        cls('an approved learner reads them', 'ALLOW', STUDENT, R, 'get', null, recording(),
          asMember('approved')),
        cls('a deactivated learner keeps them', 'ALLOW', STUDENT, R, 'get', null, recording(),
          asMember('removed')),
        cls('someone still on the waiting list cannot', 'DENY', STUDENT, R, 'get', null, recording(),
          asMember('pending')),
        cls('a stranger cannot read them', 'DENY', OTHER, R, 'get', null, recording(),
          asMember('approved', false)),
        cls('anon cannot read them', 'DENY', null, R, 'get', null, recording(),
          asMember('approved')),
        // The whole page is a list, so this is the case that matters most.
        // The read rule deliberately never looks at `resource`: a condition
        // that did would be re-evaluated per document and fail the entire
        // query the moment one row failed it.
        cls('an approved learner can list them', 'ALLOW', STUDENT, R, 'list',
          null, recording(), asMember('approved')),

        cls('the teacher posts a recording', 'ALLOW', TEACHER, R, 'create', recording(), null,
          [classAnd('tch1', 'approved')]),
        cls('a learner cannot post one', 'DENY', STUDENT, R, 'create', recording(), null,
          asMember('approved')),
        cls('another teacher cannot post into this class', 'DENY', TEACHER, R, 'create', recording(), null,
          [classAnd('someone-else', 'approved')]),
        cls('a plain http link is refused', 'DENY', TEACHER, R, 'create',
          recording({ url: 'http://zoom.us/rec/share/abc' }), null, [classAnd('tch1', 'approved')]),
        cls('a javascript: link is refused', 'DENY', TEACHER, R, 'create',
          recording({ url: 'javascript:alert(1)' }), null, [classAnd('tch1', 'approved')]),
        cls('a bare https:// with nothing after it is refused', 'DENY', TEACHER, R, 'create',
          recording({ url: 'https://' }), null, [classAnd('tch1', 'approved')]),
        cls('no extra fields on a recording', 'DENY', TEACHER, R, 'create',
          recording({ secret: 'x' }), null, [classAnd('tch1', 'approved')]),
        cls('a recording note has a ceiling', 'DENY', TEACHER, R, 'create',
          recording({ note: 'x'.repeat(600) }), null, [classAnd('tch1', 'approved')]),

        cls('the teacher corrects a passcode', 'ALLOW', TEACHER, R, 'update',
          recording({ passcode: 'fixed1' }), recording(), [classAnd('tch1', 'approved')]),
        cls('when it was posted does not move', 'DENY', TEACHER, R, 'update',
          recording({ createdAt: 9999 }), recording(), [classAnd('tch1', 'approved')]),
        cls('a learner cannot rewrite a recording', 'DENY', STUDENT, R, 'update',
          recording({ url: 'https://evil.example/x' }), recording(), asMember('approved')),

        cls('the teacher removes a recording', 'ALLOW', TEACHER, R, 'delete', null, recording(),
          [classAnd('tch1', 'approved')]),
        cls('a learner cannot remove one', 'DENY', STUDENT, R, 'delete', null, recording(),
          asMember('approved')),
      ];
    })(),

    // join codes
    cls('a signed-in person can fetch a code they know', 'ALLOW', STUDENT, 'joinCodes/K7QM4P', 'get',
      null, { classId: 'c1', teacherUid: 'tch1' }),
    cls('anon cannot fetch a code', 'DENY', null, 'joinCodes/K7QM4P', 'get',
      null, { classId: 'c1', teacherUid: 'tch1' }),
    cls('codes cannot be listed', 'DENY', STUDENT, 'joinCodes/K7QM4P', 'list',
      null, { classId: 'c1', teacherUid: 'tch1' }),
    cls('a teacher mints a code for their own class', 'ALLOW', TEACHER, 'joinCodes/K7QM4P', 'create',
      { classId: 'c1', teacherUid: 'tch1' }, null, [ownedBy('tch1')]),
    cls('nobody mints a code for a class they do not own', 'DENY', STUDENT, 'joinCodes/K7QM4P', 'create',
      { classId: 'c1', teacherUid: 'stu1' }, null, [ownedBy('tch1')]),
    cls('a code cannot be repointed', 'DENY', TEACHER, 'joinCodes/K7QM4P', 'update',
      { classId: 'c9', teacherUid: 'tch1' }, { classId: 'c1', teacherUid: 'tch1' }, [ownedBy('tch1')]),
    cls('a teacher retires their own code', 'ALLOW', TEACHER, 'joinCodes/K7QM4P', 'delete',
      null, { classId: 'c1', teacherUid: 'tch1' }),
    cls('a stranger cannot retire a code', 'DENY', STUDENT, 'joinCodes/K7QM4P', 'delete',
      null, { classId: 'c1', teacherUid: 'tch1' }),

    // the learner's own list
    cls('you read your own enrolments', 'ALLOW', STUDENT, 'users/stu1/enrolments/c1', 'get',
      null, { classId: 'c1', className: 'Tuesday', teacherName: 'T' }),
    cls('you cannot read anyone else\'s enrolments', 'DENY', OTHER, 'users/stu1/enrolments/c1', 'get',
      null, { classId: 'c1', className: 'Tuesday', teacherName: 'T' }),
  ];
}

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

  // --- classes ---
  // functionMocks stand in for the get()/exists() the rules perform, so a
  // case says exactly which world it is testing rather than depending on
  // documents existing somewhere.
  ...classCases(),

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
