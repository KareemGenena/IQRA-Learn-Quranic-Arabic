/**
 * Admin sign-in via Firebase Authentication (REST — no SDK).
 *
 * The calibrate page is gated by a real Firebase account and Firestore
 * rules only accept calibration writes from the admin's email, so the
 * admin is the sole writer. The session (a refresh token) persists in
 * localStorage on the admin's own device and ID tokens are refreshed
 * automatically before they expire.
 */

import { API_KEY } from './firebaseConfig';

interface Session {
  idToken: string;
  refreshToken: string;
  /** ms epoch when idToken expires */
  expiresAt: number;
  email: string;
}

const STORAGE_KEY = 'iqra-admin-session';

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
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

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'SIGN_IN_FAILED');
  storeSession({
    idToken: json.idToken,
    refreshToken: json.refreshToken,
    expiresAt: Date.now() + Number(json.expiresIn) * 1000,
    email: json.email,
  });
}

/**
 * A currently-valid ID token for Firestore writes, refreshing if needed.
 * Returns null when signed out or the refresh fails (e.g. offline).
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
      idToken: json.id_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + Number(json.expires_in) * 1000,
      email: s.email,
    });
    return json.id_token as string;
  } catch {
    return null;
  }
}
