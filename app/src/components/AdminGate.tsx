import { useState } from 'react';
import { signIn } from '../lib/adminAuth';

export function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      onUnlock();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'INVALID_LOGIN_CREDENTIALS' || code === 'INVALID_PASSWORD' || code === 'EMAIL_NOT_FOUND'
          ? 'Wrong email or password.'
          : `Sign-in failed (${code || 'network error'}).`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-gate" onSubmit={submit}>
      <p>This page is for the teacher. Sign in with the admin account:</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="username"
        autoFocus
        aria-label="Admin email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        aria-label="Admin password"
      />
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p className="gate-error">{error}</p>}
    </form>
  );
}
