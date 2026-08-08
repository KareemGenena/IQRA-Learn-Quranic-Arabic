/**
 * Accounts — Firebase Authentication over REST (no SDK).
 *
 * Accounts stay additive: the whole app works signed out, and signing in only
 * adds sync and, for a teacher or the admin, tools. There is no mode picker.
 *
 * Nothing in this file decides what anyone is *allowed* to do. It only says
 * who someone is. What they may do comes from their role (`profile.ts`) and,
 * for anything that matters, from the Firestore rules — the only copy of the
 * decision that a client cannot edit.
 *
 * The session (a refresh token) persists in localStorage and ID tokens are
 * refreshed automatically before they expire.
 */

import { API_KEY } from './firebaseConfig';

/**
 * The single account that may publish lessons and write calibrations. This
 * is a convenience for the interface — `firestore.rules` hard-codes the same
 * address and is where it is actually enforced. Change both together.
 */
export const ADMIN_EMAIL = 'kintegracion@gmail.com';

export interface Session {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  /** ms epoch when idToken expires */
  expiresAt: number;
}

const STORAGE_KEY = 'iqra-admin-session';

/**
 * The claims inside an ID token, read locally.
 *
 * This is used only to label the interface ("signed in as …") and to recover
 * the uid from a session stored before uid was kept. It is never a security
 * check: the server re-verifies the signature on every write.
 */
function claims(idToken: string): Record<string, string> {
  try {
    const part = idToken.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (!s.idToken || !s.refreshToken) return null;
    // Sessions stored before accounts existed have no uid; the token carries it.
    const c = s.uid && s.email ? {} : claims(s.idToken);
    return {
      uid: s.uid || c.user_id || c.sub || '',
      email: s.email || c.email || '',
      displayName: s.displayName || c.name || '',
      idToken: s.idToken,
      refreshToken: s.refreshToken,
      expiresAt: s.expiresAt ?? 0,
    };
  } catch {
    return null;
  }
}

function storeSession(s: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** True for the one account that owns the lessons. */
export const isAdminEmail = (email: string | undefined): boolean => email === ADMIN_EMAIL;

interface AuthResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  email: string;
  localId: string;
  displayName?: string;
}

async function identityToolkit(method: string, body: unknown): Promise<any> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'AUTH_FAILED');
  return json;
}

function sessionFrom(json: AuthResponse, displayName = ''): Session {
  const s: Session = {
    uid: json.localId,
    email: json.email,
    displayName: json.displayName || displayName,
    idToken: json.idToken,
    refreshToken: json.refreshToken,
    expiresAt: Date.now() + Number(json.expiresIn) * 1000,
  };
  storeSession(s);
  return s;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const json = (await identityToolkit('signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  })) as AuthResponse;
  return sessionFrom(json);
}

/**
 * Create an account. The display name is stored on the Firebase account as
 * well as on the profile, so a teacher's roster can show a name even before
 * the profile document has loaded.
 */
export async function signUp(email: string, password: string, displayName: string): Promise<Session> {
  const created = (await identityToolkit('signUp', {
    email,
    password,
    returnSecureToken: true,
  })) as AuthResponse;
  const session = sessionFrom(created, displayName);

  if (displayName) {
    try {
      const updated = (await identityToolkit('update', {
        idToken: session.idToken,
        displayName,
        returnSecureToken: false,
      })) as { displayName?: string };
      storeSession({ ...session, displayName: updated.displayName || displayName });
    } catch {
      // A name that didn't stick is not worth failing a sign-up over; the
      // profile document carries it too.
    }
  }
  return getSession() ?? session;
}

/**
 * A currently-valid ID token for Firestore reads and writes, refreshing if
 * needed. Returns null when signed out or the refresh fails (e.g. offline).
 */
export async function getIdToken(): Promise<string | null> {
  const s = getSession();
  if (!s) return null;
  if (Date.now() < s.expiresAt - 5 * 60_000) return s.idToken;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
    });
    const json = await res.json();
    if (!res.ok) return null;
    storeSession({
      ...s,
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + Number(json.expires_in) * 1000,
    });
    return json.id_token as string;
  } catch {
    return null;
  }
}

/**
 * Delete the Firebase Auth account itself.
 *
 * Firebase refuses this on a stale sign-in (CREDENTIAL_TOO_OLD_LOGIN_AGAIN),
 * which is why the caller re-authenticates first — deleting an account is
 * exactly the operation that should require proving it is really you.
 */
export async function deleteAuthAccount(): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');
  await identityToolkit('delete', { idToken: token });
  signOut();
}

/** Turn an Identity Toolkit error code into something a person can act on. */
export function authMessage(code: string): string {
  switch (code) {
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_PASSWORD':
    case 'EMAIL_NOT_FOUND':
      return 'Wrong email or password.';
    case 'EMAIL_EXISTS':
      return 'That email already has an account. Try signing in instead.';
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
      return 'Please use at least 6 characters.';
    case 'INVALID_EMAIL':
      return "That doesn't look like an email address.";
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN':
    case 'TOKEN_EXPIRED':
      return 'Please enter your password again to confirm this.';
    case 'OPERATION_NOT_ALLOWED':
      return 'Email sign-in is switched off for this project.';
    default:
      return `Sorry — that didn't work (${code || 'network error'}).`;
  }
}
