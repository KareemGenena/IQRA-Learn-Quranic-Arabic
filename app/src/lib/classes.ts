/**
 * Classes — a teacher, a join code, and a roster.
 *
 * The shape follows the decisions taken with the author:
 *
 *   classes/{classId}                    the class itself
 *   joinCodes/{code}                     code → class, so a stranger can find
 *                                        one class without being able to read
 *                                        (or list) any of them
 *   classes/{classId}/members/{uid}      one per learner: pending, approved
 *                                        or removed
 *   users/{uid}/enrolments/{classId}     the learner's own list of the classes
 *                                        they have asked to join
 *
 * The last one looks redundant and is not. Membership lives under the class,
 * which is the only place a teacher can read a whole roster; but a learner
 * cannot ask "which classes am I in?" without querying across every class in
 * the app. Their own short list answers that in one read. The membership
 * document stays the authority on *status* — this one only says where to look.
 *
 * A teacher may run several classes and a learner may join several, so every
 * relationship is a document rather than a field. Making that many-to-many
 * later would have meant migrating live rosters.
 */

import { getIdToken, getSession } from './auth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export type MemberStatus = 'pending' | 'approved' | 'removed';

export interface ClassDoc {
  id: string;
  name: string;
  teacherUid: string;
  teacherName: string;
  joinCode: string;
  createdAt: number;
  active: boolean;
}

export interface Member {
  uid: string;
  displayName: string;
  status: MemberStatus;
  requestedAt: number;
  decidedAt: number;
}

/** A class as the learner sees it: where it is, and where they stand in it. */
export interface Enrolment {
  classId: string;
  className: string;
  teacherName: string;
  status: MemberStatus | 'gone';
}

// ── plumbing ──────────────────────────────────────────────────────────────
// Firestore's REST encoding is verbose in both directions; these keep the
// rest of the file readable.

const str = (v: string) => ({ stringValue: v });
const int = (v: number) => ({ integerValue: String(v) });
const bool = (v: boolean) => ({ booleanValue: v });

type Fields = Record<string, any> | undefined;
const readStr = (f: Fields, k: string): string => f?.[k]?.stringValue ?? '';
const readInt = (f: Fields, k: string): number => Number(f?.[k]?.integerValue ?? f?.[k]?.doubleValue ?? 0);
const readBool = (f: Fields, k: string): boolean => f?.[k]?.booleanValue ?? false;

async function authed(): Promise<{ token: string; uid: string; email: string; name: string }> {
  const session = getSession();
  const token = await getIdToken();
  if (!session?.uid || !token) throw new Error('not signed in');
  return { token, uid: session.uid, email: session.email, name: session.displayName };
}

async function call(path: string, init: RequestInit, token: string): Promise<any> {
  const join = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${join}key=${API_KEY}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const decodeClass = (id: string, f: Fields): ClassDoc => ({
  id,
  name: readStr(f, 'name'),
  teacherUid: readStr(f, 'teacherUid'),
  teacherName: readStr(f, 'teacherName'),
  joinCode: readStr(f, 'joinCode'),
  createdAt: readInt(f, 'createdAt'),
  active: readBool(f, 'active'),
});

const decodeMember = (uid: string, f: Fields): Member => {
  const status = readStr(f, 'status');
  return {
    uid,
    displayName: readStr(f, 'displayName'),
    status: status === 'approved' || status === 'removed' ? status : 'pending',
    requestedAt: readInt(f, 'requestedAt'),
    decidedAt: readInt(f, 'decidedAt'),
  };
};

// ── join codes ────────────────────────────────────────────────────────────

/**
 * The alphabet leaves out O/0 and I/1/L, which are the characters people
 * mis-copy when a code is read aloud or written on a whiteboard. Six
 * characters from 30 is about a billion combinations — and a guessed code
 * only reaches the pending queue, where the teacher still has to say yes.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── teacher ───────────────────────────────────────────────────────────────

/**
 * Create a class and the code that reaches it.
 *
 * The class is written first: the rules will not accept a join code unless the
 * class it points at already exists and is yours, which stops anyone minting a
 * code for someone else's roster.
 */
export async function createClass(name: string, teacherName: string): Promise<ClassDoc> {
  const { token, uid } = await authed();
  const classId = crypto.randomUUID();

  let code = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomCode();
    if ((await call(`/joinCodes/${candidate}`, { method: 'GET' }, token)) === null) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error('could not find a free join code');

  const fields = {
    name: str(name),
    teacherUid: str(uid),
    teacherName: str(teacherName),
    joinCode: str(code),
    createdAt: int(Date.now()),
    active: bool(true),
  };
  await call(`/classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ fields }) }, token);
  await call(
    `/joinCodes/${code}`,
    { method: 'PATCH', body: JSON.stringify({ fields: { classId: str(classId), teacherUid: str(uid) } }) },
    token,
  );
  return decodeClass(classId, fields);
}

/** Every class this teacher runs. */
export async function myClasses(): Promise<ClassDoc[]> {
  const { token, uid } = await authed();
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'classes' }],
      where: {
        fieldFilter: { field: { fieldPath: 'teacherUid' }, op: 'EQUAL', value: str(uid) },
      },
    },
  };
  const rows = (await call(':runQuery', { method: 'POST', body: JSON.stringify(body) }, token)) as
    | { document?: { name: string; fields?: Fields } }[]
    | null;
  return (rows ?? [])
    .filter((r) => r.document)
    .map((r) => decodeClass(r.document!.name.split('/').pop()!, r.document!.fields))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** The roster, newest request first so anything waiting is at the top. */
export async function roster(classId: string): Promise<Member[]> {
  const { token } = await authed();
  const json = (await call(`/classes/${classId}/members?pageSize=200`, { method: 'GET' }, token)) as
    | { documents?: { name: string; fields?: Fields }[] }
    | null;
  return (json?.documents ?? [])
    .map((d) => decodeMember(d.name.split('/').pop()!, d.fields))
    .sort((a, b) => {
      if (a.status !== b.status) {
        const order = { pending: 0, approved: 1, removed: 2 };
        return order[a.status] - order[b.status];
      }
      return a.requestedAt - b.requestedAt;
    });
}

/** Approve, decline or deactivate — the teacher's only say over a member. */
export async function setMemberStatus(classId: string, uid: string, status: MemberStatus): Promise<void> {
  const { token } = await authed();
  await call(
    `/classes/${classId}/members/${uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt`,
    { method: 'PATCH', body: JSON.stringify({ fields: { status: str(status), decidedAt: int(Date.now()) } }) },
    token,
  );
}

export async function renameClass(classId: string, name: string): Promise<void> {
  const { token } = await authed();
  await call(
    `/classes/${classId}?updateMask.fieldPaths=name`,
    { method: 'PATCH', body: JSON.stringify({ fields: { name: str(name) } }) },
    token,
  );
}

// ── learner ───────────────────────────────────────────────────────────────

/**
 * Ask to join, by code.
 *
 * Returns the class so the learner immediately sees whose class they have
 * knocked on, rather than a bare "request sent".
 */
export async function requestToJoin(rawCode: string, displayName: string): Promise<ClassDoc> {
  const { token, uid } = await authed();
  const code = normaliseCode(rawCode);
  if (code.length < 4) throw new Error('CODE_TOO_SHORT');

  const lookup = (await call(`/joinCodes/${code}`, { method: 'GET' }, token)) as { fields?: Fields } | null;
  if (!lookup) throw new Error('NO_SUCH_CODE');
  const classId = readStr(lookup.fields, 'classId');

  const classDoc = (await call(`/classes/${classId}`, { method: 'GET' }, token)) as { fields?: Fields } | null;
  if (!classDoc) throw new Error('NO_SUCH_CODE');
  const klass = decodeClass(classId, classDoc.fields);

  await call(
    `/classes/${classId}/members/${uid}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          displayName: str(displayName),
          status: str('pending'),
          requestedAt: int(Date.now()),
          decidedAt: int(0),
        },
      }),
    },
    token,
  );

  // The learner's own signpost to this class. Written second: if it fails the
  // request still stands, and the teacher can still see it.
  await call(
    `/users/${uid}/enrolments/${classId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: { classId: str(classId), className: str(klass.name), teacherName: str(klass.teacherName) },
      }),
    },
    token,
  );
  return klass;
}

/** The classes this learner has asked to join, with where they stand in each. */
export async function myEnrolments(): Promise<Enrolment[]> {
  const { token, uid } = await authed();
  const json = (await call(`/users/${uid}/enrolments?pageSize=100`, { method: 'GET' }, token)) as
    | { documents?: { name: string; fields?: Fields }[] }
    | null;

  const rows = (json?.documents ?? []).map((d) => ({
    classId: d.name.split('/').pop()!,
    className: readStr(d.fields, 'className'),
    teacherName: readStr(d.fields, 'teacherName'),
  }));

  return Promise.all(
    rows.map(async (row): Promise<Enrolment> => {
      // The membership document is the authority on status; the signpost above
      // only remembers the name it had when they joined.
      const member = (await call(
        `/classes/${row.classId}/members/${uid}`,
        { method: 'GET' },
        token,
      ).catch(() => null)) as { fields?: Fields } | null;
      return { ...row, status: member ? decodeMember(uid, member.fields).status : 'gone' };
    }),
  );
}

/** Leave a class: the membership goes, and so does the learner's signpost. */
export async function leaveClass(classId: string): Promise<void> {
  const { token, uid } = await authed();
  await call(`/classes/${classId}/members/${uid}`, { method: 'DELETE' }, token).catch(() => null);
  await call(`/users/${uid}/enrolments/${classId}`, { method: 'DELETE' }, token).catch(() => null);
}

/**
 * Everything this account holds in the class system, removed.
 *
 * Called before the profile and the auth account go, because both of those
 * are needed to authorise these deletions. A teacher's classes are left
 * standing on purpose — their students keep the notes and the class carries
 * on with the seat vacant.
 */
export async function forgetEnrolments(): Promise<void> {
  const { token, uid } = await authed();
  const json = (await call(`/users/${uid}/enrolments?pageSize=100`, { method: 'GET' }, token).catch(
    () => null,
  )) as { documents?: { name: string }[] } | null;

  for (const doc of json?.documents ?? []) {
    const classId = doc.name.split('/').pop()!;
    await call(`/classes/${classId}/members/${uid}`, { method: 'DELETE' }, token).catch(() => null);
    await call(`/users/${uid}/enrolments/${classId}`, { method: 'DELETE' }, token).catch(() => null);
  }
}
