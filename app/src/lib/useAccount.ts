/**
 * The signed-in account, as the interface needs it.
 *
 * One hook so that every part of the app answers "who is this?" the same way.
 * Before this existed, the app treated *any* stored session as the admin —
 * fine while there was one account, wrong the moment students have their own.
 * Admin is now an email match, and teaching is a role on the profile.
 *
 * Everything here is a soft-fail: no network means the last-known role, and
 * the worst case is the signed-out app, which is the full app anyway.
 */

import { useCallback, useEffect, useState } from 'react';
import { deleteAuthAccount, getSession, isAdminEmail, signIn, signOut, signUp } from './auth';
import type { Session } from './auth';
import { forgetEnrolments } from './classes';
import { cacheProfile, cachedProfile, deleteProfile, fetchProfile, saveProfile } from './profile';
import type { Profile, Role } from './profile';

export interface Account {
  session: Session | null;
  profile: Profile | null;
  signedIn: boolean;
  /** The one account that may publish lessons and calibrate timings. */
  isAdmin: boolean;
  /** Self-declared teacher (the admin teaches too). */
  isTeacher: boolean;
  /** Best name to show: profile name, then account name, then the email. */
  name: string;
  /** True while the profile is being read for the first time. */
  loading: boolean;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setRole: (role: Role) => Promise<void>;
  setName: (displayName: string) => Promise<void>;
  /** Erase this account for good. The password re-confirms it is really them. */
  deleteAccount: (password: string) => Promise<void>;
}

export function useAccount(): Account {
  const [session, setSession] = useState<Session | null>(getSession);
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [loading, setLoading] = useState(false);

  // Read the profile whenever the *account* changes — keyed on the uid, not
  // on the session object, because refreshing an ID token makes a new object
  // every hour and would refetch for nothing.
  const uid = session?.uid;
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchProfile()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        cacheProfile(p);
      })
      .catch(() => {
        // Offline or rejected: keep whatever the cache already gave us.
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uid]);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const s = await signUp(email, password, displayName);
    setSession(s);
    // A fresh account starts as a learner, with the name they gave.
    const created = await saveProfile({ displayName, role: 'learner' }, null);
    setProfile(created);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Drop any previous account's cached role before the new profile lands.
    cacheProfile(null);
    setProfile(null);
    setSession(await signIn(email, password));
  }, []);

  const logout = useCallback(() => {
    signOut();
    cacheProfile(null);
    setSession(null);
    setProfile(null);
  }, []);

  const setRole = useCallback(
    async (role: Role) => {
      setProfile(await saveProfile({ role }, profile));
    },
    [profile],
  );

  const setName = useCallback(
    async (displayName: string) => {
      setProfile(await saveProfile({ displayName }, profile));
    },
    [profile],
  );

  /**
   * Erase the account, in the only order that cannot strand data.
   *
   * Enrolments first, then the profile, then Firebase Auth. Everything before
   * the last step needs a valid token to authorise it, so deleting the auth
   * account first would leave a name, an email and a row on somebody's roster
   * with no way to ever remove them. A failure partway leaves the account
   * standing and the whole thing retryable — the recoverable failure rather
   * than the permanent one.
   *
   * A teacher's classes are deliberately left alone: their students keep the
   * notes and the class carries on with the teacher's seat vacant.
   */
  const deleteAccount = useCallback(
    async (password: string) => {
      const email = session?.email;
      if (!email) throw new Error('not signed in');
      // Deleting an account demands a fresh sign-in, and proving it is really
      // them is worth the extra step for something this final.
      await signIn(email, password);
      await forgetEnrolments();
      await deleteProfile();
      await deleteAuthAccount();
      cacheProfile(null);
      setSession(null);
      setProfile(null);
    },
    [session?.email],
  );

  const isAdmin = !!session && isAdminEmail(session.email);

  return {
    session,
    profile,
    signedIn: !!session,
    isAdmin,
    isTeacher: isAdmin || profile?.role === 'teacher',
    name: profile?.displayName || session?.displayName || session?.email || '',
    loading,
    register,
    login,
    logout,
    setRole,
    setName,
    deleteAccount,
  };
}
