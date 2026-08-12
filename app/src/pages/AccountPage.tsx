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
  const [saved, setSaved] = useState(false);

  if (!account.signedIn) return <SignInPanel account={account} />;

  const teacher = account.profile?.role === 'teacher';

  /**
   * Always write, even when the role looks unchanged.
   *
   * Before a profile exists there is nothing to compare against, so "I'm
   * learning" is drawn as already chosen — and skipping the write made
   * pressing it look like a dead button while it quietly created the
   * document. A redundant write costs nothing; a control that appears to do
   * nothing costs trust.
   */
  const choose = async (role: 'learner' | 'teacher') => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await account.setRole(role);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
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

      <NameCard account={account} />

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
        <p className="save-state" aria-live="polite">
          {busy ? 'Saving…' : saved ? 'Saved.' : ''}
        </p>
        {error && <p className="gate-error">{error}</p>}
        <p className="account-hint">
          <a href="#/classes">
            {teacher ? 'Your classes and join codes →' : 'Join a class with a code →'}
          </a>
        </p>
        <p className="account-hint">
          <a href="#/recordings">Class recordings →</a>
        </p>
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

      <DeleteAccount account={account} />
    </main>
  );
}

/**
 * Your name, as other people see it.
 *
 * Worth its own card because it is the only thing about you anyone else reads:
 * students see their teacher's name, teachers see theirs on the roster. With
 * none set the app used to fall back to the email address, which put it in
 * front of every student who joined — so the prompt to set one is pointed.
 */
function NameCard({ account }: { account: Account }) {
  const [draft, setDraft] = useState(account.publicName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await account.setName(draft.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-card">
      <h3 className="account-heading">Your name</h3>
      <p className="account-hint">
        {account.publicName
          ? 'This is what your teacher and classmates see. Your email is never shown to them.'
          : 'You have not set one. Without it your classes show no name at all — and your email is never shown either way.'}
      </p>
      <form className="class-new-row" onSubmit={submit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={80}
          aria-label="Your name"
        />
        <button type="submit" className="btn primary" disabled={busy || draft.trim() === account.publicName}>
          {busy ? 'Saving…' : 'Save name'}
        </button>
      </form>
      <p className="save-state" aria-live="polite">
        {saved ? 'Saved.' : ''}
      </p>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}

/**
 * Ending the account, for good.
 *
 * Kept behind a deliberate second step and a password, and it says plainly
 * what goes and what stays before asking. Signing out is right next to it, so
 * anyone who only meant to leave the device has the gentler option in view.
 */
function DeleteAccount({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const teacher = account.profile?.role === 'teacher';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await account.deleteAccount(password);
      window.location.hash = '#/';
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'INVALID_LOGIN_CREDENTIALS' || code === 'INVALID_PASSWORD'
          ? 'That password is not right.'
          : `Could not delete the account (${code || 'network error'}). Nothing has been removed.`,
      );
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  if (!open) {
    return (
      <section className="account-card">
        <h3 className="account-heading">Delete your account</h3>
        <p className="account-hint">
          Removes your account and everything it holds. The lessons stay open to you without an
          account.
        </p>
        <button type="button" className="btn danger" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      </section>
    );
  }

  return (
    <section className="account-card danger-zone">
      <h3 className="account-heading">Delete your account — this cannot be undone</h3>
      <ul className="account-list">
        <li>Your name, email and account are erased.</li>
        <li>Your own notes are erased.</li>
        {teacher && <li>Notes you wrote for your students stay with them to read.</li>}
        <li>Every lesson stays open to you, signed out, exactly as it is now.</li>
      </ul>
      <form className="delete-form" onSubmit={submit}>
        <label className="account-hint" htmlFor="confirm-pw">
          Enter your password to confirm.
        </label>
        <input
          id="confirm-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="delete-actions">
          <button type="submit" className="btn danger solid" disabled={busy || !password}>
            {busy ? 'Deleting…' : 'Delete for good'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setError('');
              setPassword('');
            }}
          >
            Keep my account
          </button>
        </div>
      </form>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}
