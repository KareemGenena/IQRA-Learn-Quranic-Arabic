import { useState } from 'react';
import { authMessage } from '../lib/auth';
import type { Account } from '../lib/useAccount';

/**
 * Sign in, or create an account.
 *
 * The blurb is the honest one: an account adds sync and teaching tools, and
 * the lessons work perfectly well without one. Nothing here is a gate to the
 * app — only to the things that need to know who you are.
 */
export function SignInPanel({ account, blurb }: { account: Account; blurb?: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const creating = mode === 'up';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (creating) await account.register(email.trim(), password, name.trim());
      else await account.login(email.trim(), password);
    } catch (err) {
      setError(authMessage(err instanceof Error ? err.message : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-gate" onSubmit={submit}>
      <p className="gate-title">{creating ? 'Create an account' : 'Sign in'}</p>
      <p className="gate-sub">
        {blurb ??
          'Signing in lets your notes follow you between devices, and gives teachers their teaching tools. You can keep using every lesson without an account.'}
      </p>

      {creating && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          aria-label="Your name"
          required
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="username"
        aria-label="Email"
        autoFocus={!creating}
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete={creating ? 'new-password' : 'current-password'}
        aria-label="Password"
        required
      />

      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? (creating ? 'Creating…' : 'Signing in…') : creating ? 'Create account' : 'Sign in'}
      </button>
      {error && <p className="gate-error">{error}</p>}

      <p className="gate-switch">
        {creating ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(creating ? 'in' : 'up');
            setError('');
          }}
        >
          {creating ? 'Sign in instead' : 'Create an account'}
        </button>
      </p>
    </form>
  );
}
