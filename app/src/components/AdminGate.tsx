import { useState } from 'react';
import { tryUnlock } from '../lib/admin';

export function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await tryUnlock(pin)) {
      onUnlock();
    } else {
      setWrong(true);
      setPin('');
    }
  };

  return (
    <form className="admin-gate" onSubmit={submit}>
      <p>This page is for the teacher. Enter the admin PIN:</p>
      <input
        type="password"
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          setWrong(false);
        }}
        autoFocus
        aria-label="Admin PIN"
      />
      <button type="submit" className="btn primary">
        Unlock
      </button>
      {wrong && <p className="gate-error">Wrong PIN.</p>}
    </form>
  );
}
