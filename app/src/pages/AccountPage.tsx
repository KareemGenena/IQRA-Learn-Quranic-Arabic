import { useState } from 'react';
import { SignInPanel } from '../components/SignInPanel';
import type { Account } from '../lib/useAccount';

/**
 * Your account: who you are, and whether you teach.
 *
 * Teaching is self-declared, and on its own it grants nothing — it only puts
 * the teaching tools in front of someone who says they need them. Authority
 * over a class will come from owning that class, not from this switch.
 */
export function AccountPage({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!account.signedIn) return <SignInPanel account={account} />;

  const teacher = account.profile?.role === 'teacher';

  const choose = async (role: 'learner' | 'teacher') => {
    if (role === account.profile?.role) return;
    setBusy(true);
    setError('');
    try {
      await account.setRole(role);
    } catch {
      setError('Could not save that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="account-page">
      <section className="account-card">
        <p className="account-who">{account.name}</p>
        {account.session?.email && account.session.email !== account.name && (
          <p className="account-email">{account.session.email}</p>
        )}
        {account.isAdmin && <span className="role-pill admin">Admin</span>}
      </section>

      <section className="account-card">
        <h3 className="account-heading">How do you use IQRA?</h3>
        <p className="account-hint">
          You can change this at any time. Learners keep their own notes; teachers can also run a
          class.
        </p>
        <div className="role-group" role="group" aria-label="Your role">
          <button
            type="button"
            className={`role-btn ${!teacher ? 'active' : ''}`}
            aria-pressed={!teacher}
            disabled={busy || account.loading}
            onClick={() => choose('learner')}
          >
            <span className="role-name">I&apos;m learning</span>
            <span className="role-sub">Lessons and my own notes</span>
          </button>
          <button
            type="button"
            className={`role-btn ${teacher ? 'active' : ''}`}
            aria-pressed={teacher}
            disabled={busy || account.loading}
            onClick={() => choose('teacher')}
          >
            <span className="role-name">I teach</span>
            <span className="role-sub">Everything above, plus a class</span>
          </button>
        </div>
        {error && <p className="gate-error">{error}</p>}
        {teacher && (
          <p className="account-hint">
            Classes — join codes and a roster — are the next thing being built. Nothing to set up
            yet.
          </p>
        )}
      </section>

      <section className="account-card">
        {account.isAdmin && (
          <p className="account-hint">
            <a href="#/admin">Manage lessons and features →</a>
          </p>
        )}
        <button type="button" className="btn" onClick={account.logout}>
          Sign out
        </button>
      </section>
    </main>
  );
}
