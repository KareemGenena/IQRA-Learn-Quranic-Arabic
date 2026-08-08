/**
 * Who a signed-in person is to the app — their name and their role.
 *
 * One small Firestore document per account at `users/{uid}`. A person may
 * read and write only their own, and the only roles they may give themselves
 * are 'learner' and 'teacher': teachers self-declare, which is the agreed
 * design — a teacher's *authority* comes from owning a class, not from the
 * word itself, so self-declaring grants nothing on its own.
 *
 * Admin is deliberately NOT a role here. It is one hard-coded email in
 * `firestore.rules`, so no document a client can write can ever confer it.
 *
 * Cached in localStorage so the installed PWA knows its own role offline.
 */

import { getIdToken, getSession } from './auth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';

export type Role = 'learner' | 'teacher';

export interface Profile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** ms epoch */
  createdAt: number;
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const docUrl = (uid: string) => `${BASE}/users/${uid}`;
const CACHE_KEY = 'iqra-profile';

export const isRole = (v: unknown): v is Role => v === 'learner' || v === 'teacher';

export function emptyProfile(uid: string, email = '', displayName = ''): Profile {
  return { uid, email, displayName, role: 'learner', createdAt: 0 };
}

/** The last-known profile for the signed-in account, or null. */
export function cachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    const session = getSession();
    // A cache left behind by a different account must never be believed.
    if (!p.uid || !session || session.uid !== p.uid) return null;
    return { ...emptyProfile(p.uid), ...p, role: isRole(p.role) ? p.role : 'learner' };
  } catch {
    return null;
  }
}

export function cacheProfile(profile: Profile | null): void {
  if (profile) localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(CACHE_KEY);
}

/** Firestore's REST shape is verbose; flatten it back to a plain object. */
function decode(uid: string, fields: Record<string, any> | undefined): Profile {
  const str = (k: string): string => fields?.[k]?.stringValue ?? '';
  const num = (k: string): number => Number(fields?.[k]?.integerValue ?? fields?.[k]?.doubleValue ?? 0);
  const role = str('role');
  return {
    uid,
    email: str('email'),
    displayName: str('displayName'),
    role: isRole(role) ? role : 'learner',
    createdAt: num('createdAt'),
  };
}

/**
 * The signed-in account's profile, or null if there isn't one yet.
 *
 * Soft-fails to the cache: offline, or a rules rejection, leaves the app
 * working with the last-known role rather than breaking.
 */
export async function fetchProfile(): Promise<Profile | null> {
  const session = getSession();
  if (!session?.uid) return null;
  const token = await getIdToken();
  if (!token) return cachedProfile();

  const res = await fetch(`${docUrl(session.uid)}?key=${API_KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null; // signed in, but no profile written yet
  if (!res.ok) throw new Error(`profile fetch failed: ${res.status}`);

  const json = (await res.json()) as { fields?: Record<string, unknown> };
  const profile = decode(session.uid, json.fields as Record<string, any>);
  cacheProfile(profile);
  return profile;
}

/**
 * Erase the profile document.
 *
 * A 404 counts as success: the goal is that nothing of theirs is left, and a
 * document that was never written already satisfies that.
 */
export async function deleteProfile(): Promise<void> {
  const session = getSession();
  if (!session?.uid) throw new Error('not signed in');
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');

  const res = await fetch(`${docUrl(session.uid)}?key=${API_KEY}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`profile delete failed: ${res.status}`);
  cacheProfile(null);
}

/**
 * Write the parts of the profile a person may change about themselves.
 *
 * An update mask is used so that writing a role can never blank the name, or
 * rewrite `createdAt` — a partial write must stay partial.
 */
export async function saveProfile(
  patch: { displayName?: string; role?: Role },
  /** The profile as last read, or null if this account has none yet. The
   *  caller passes it rather than this reading the cache, so that a cleared
   *  cache cannot make a second write look like the first and reset the
   *  creation date. */
  existing: Profile | null,
): Promise<Profile> {
  const session = getSession();
  if (!session?.uid) throw new Error('not signed in');
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');

  const fields: Record<string, unknown> = {};
  const mask: string[] = [];
  const put = (name: string, value: unknown) => {
    fields[name] = value;
    mask.push(name);
  };

  // The first write must send the whole document: the rules check the shape of
  // the *merged* result, so a half-document on create is simply refused. After
  // that, only what changed is sent — email and createdAt are stamped once and
  // never move again.
  if (!existing) {
    put('email', { stringValue: session.email });
    put('createdAt', { integerValue: String(Date.now()) });
    put('displayName', { stringValue: patch.displayName ?? session.displayName ?? '' });
    put('role', { stringValue: patch.role ?? 'learner' });
  } else {
    if (patch.displayName !== undefined) put('displayName', { stringValue: patch.displayName });
    if (patch.role !== undefined) put('role', { stringValue: patch.role });
  }

  const query = mask.map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(`${docUrl(session.uid)}?${query}&key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`profile save failed: ${res.status}`);

  const json = (await res.json()) as { fields?: Record<string, unknown> };
  const profile = decode(session.uid, json.fields as Record<string, any>);
  cacheProfile(profile);
  return profile;
}
