import { useCallback, useEffect, useState } from 'react';
import { SignInPanel } from '../components/SignInPanel';
import {
  createClass,
  leaveClass,
  myClasses,
  myEnrolments,
  normaliseCode,
  renameClass,
  requestToJoin,
  roster,
  setMemberStatus,
} from '../lib/classes';
import type { ClassDoc, Enrolment, Member } from '../lib/classes';
import type { Account } from '../lib/useAccount';

/**
 * Classes: the teacher's side and the learner's side on one page.
 *
 * Both are shown to a teacher, because a teacher is also someone who might
 * join another teacher's class — the roles are not exclusive and the app has
 * never asked anyone to pick one.
 */
export function ClassesPage({ account }: { account: Account }) {
  if (!account.signedIn) {
    return (
      <SignInPanel
        account={account}
        blurb="Classes need an account, so your teacher knows who you are. Every lesson works without one."
      />
    );
  }
  return (
    <main className="classes-page">
      {account.isTeacher && <TeacherPanel account={account} />}
      <LearnerPanel account={account} />
      {!account.isTeacher && (
        <p className="account-hint">
          If you teach, turn that on in <a href="#/account">your account</a> and you can start a
          class of your own.
        </p>
      )}
    </main>
  );
}

// ── the teacher's side ────────────────────────────────────────────────────

function TeacherPanel({ account }: { account: Account }) {
  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    myClasses()
      .then(setClasses)
      .catch(() => setError('Could not load your classes. Check your connection.'));
  }, []);

  useEffect(load, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const made = await createClass(name.trim(), account.name);
      setClasses((prev) => [...(prev ?? []), made]);
      setName('');
    } catch {
      setError('Could not create that class. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="class-block">
      <h3 className="account-heading">Classes you teach</h3>

      {classes === null && <p className="account-hint">Loading…</p>}
      {classes?.length === 0 && (
        <p className="account-hint">
          No classes yet. Give one a name below, and you&apos;ll get a code to hand to your
          students.
        </p>
      )}

      {classes?.map((klass) => (
        <ClassCard key={klass.id} klass={klass} onRenamed={load} />
      ))}

      <form className="class-new" onSubmit={create}>
        <label htmlFor="class-name" className="account-hint">
          Start another class
        </label>
        <div className="class-new-row">
          <input
            id="class-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tuesday evening"
            maxLength={80}
          />
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </form>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}

function ClassCard({ klass, onRenamed }: { klass: ClassDoc; onRenamed: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(klass.name);

  const load = useCallback(() => {
    roster(klass.id)
      .then(setMembers)
      .catch(() => setError('Could not load the roster.'));
  }, [klass.id]);

  useEffect(load, [load]);

  const decide = async (uid: string, status: Member['status']) => {
    setError('');
    // Move the row at once; the roster is re-read after, so a failed write
    // corrects itself rather than leaving a lie on screen.
    setMembers((prev) => prev?.map((m) => (m.uid === uid ? { ...m, status } : m)) ?? prev);
    try {
      await setMemberStatus(klass.id, uid, status);
    } catch {
      setError('That did not save. Check your connection.');
    } finally {
      load();
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(klass.joinCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (no permission, or an insecure origin). The code is
      // on screen in full, so there is nothing to rescue.
    }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await renameClass(klass.id, draftName.trim());
      setRenaming(false);
      onRenamed();
    } catch {
      setError('Could not rename that class.');
    }
  };

  const waiting = members?.filter((m) => m.status === 'pending') ?? [];
  const approved = members?.filter((m) => m.status === 'approved') ?? [];
  const removed = members?.filter((m) => m.status === 'removed') ?? [];

  return (
    <article className="class-card">
      <header className="class-head">
        {renaming ? (
          <form className="class-rename" onSubmit={saveName}>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={80} autoFocus />
            <button type="submit" className="btn">Save</button>
            <button type="button" className="btn" onClick={() => { setRenaming(false); setDraftName(klass.name); }}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h4 className="class-name">{klass.name}</h4>
            <button type="button" className="link-btn" onClick={() => setRenaming(true)}>
              Rename
            </button>
          </>
        )}
      </header>

      {/* The code is the thing a teacher comes here for, so it is large,
          selectable, and never hidden behind a menu. */}
      <div className="join-code-row">
        <span className="join-code-label">Join code</span>
        <code className="join-code">{klass.joinCode}</code>
        <button type="button" className="btn" onClick={copyCode}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="account-hint">
        Students enter this at <strong>Classes → Join a class</strong>. It only puts them on your
        waiting list — nobody joins until you say yes.
      </p>

      {members === null && <p className="account-hint">Loading the roster…</p>}

      {waiting.length > 0 && (
        <>
          <h5 className="roster-heading">Waiting for you ({waiting.length})</h5>
          <ul className="roster">
            {waiting.map((m) => (
              <li key={m.uid} className="roster-row">
                <span className="roster-name">{m.displayName || 'Unnamed'}</span>
                <span className="roster-actions">
                  <button type="button" className="btn primary" onClick={() => decide(m.uid, 'approved')}>
                    Approve
                  </button>
                  <button type="button" className="btn" onClick={() => decide(m.uid, 'removed')}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {approved.length > 0 && (
        <>
          <h5 className="roster-heading">In the class ({approved.length})</h5>
          <ul className="roster">
            {approved.map((m) => (
              <li key={m.uid} className="roster-row">
                <span className="roster-name">{m.displayName || 'Unnamed'}</span>
                <button type="button" className="btn" onClick={() => decide(m.uid, 'removed')}>
                  Deactivate
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {removed.length > 0 && (
        <>
          <h5 className="roster-heading">Not active ({removed.length})</h5>
          <ul className="roster">
            {removed.map((m) => (
              <li key={m.uid} className="roster-row">
                <span className="roster-name muted">{m.displayName || 'Unnamed'}</span>
                <button type="button" className="btn" onClick={() => decide(m.uid, 'approved')}>
                  Let back in
                </button>
              </li>
            ))}
          </ul>
          <p className="account-hint">
            They keep every lesson, their own notes, and the notes you wrote up to now. They just
            stop receiving new ones.
          </p>
        </>
      )}

      {members?.length === 0 && <p className="account-hint">Nobody has used the code yet.</p>}
      {error && <p className="gate-error">{error}</p>}
    </article>
  );
}

// ── the learner's side ────────────────────────────────────────────────────

const STATUS_TEXT: Record<Enrolment['status'], string> = {
  pending: 'Waiting for the teacher to approve you',
  approved: 'You are in this class',
  removed: 'No longer active — you keep the lessons and everything written so far',
  gone: 'This class is no longer available',
};

function LearnerPanel({ account }: { account: Account }) {
  const [enrolments, setEnrolments] = useState<Enrolment[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState('');

  const load = useCallback(() => {
    myEnrolments()
      .then(setEnrolments)
      .catch(() => setError('Could not load your classes. Check your connection.'));
  }, []);

  useEffect(load, [load]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setJoined('');
    try {
      const klass = await requestToJoin(code, account.name);
      setJoined(`Asked to join ${klass.name}. ${klass.teacherName || 'The teacher'} will approve you.`);
      setCode('');
      load();
    } catch (err) {
      const why = err instanceof Error ? err.message : '';
      setError(
        why === 'NO_SUCH_CODE'
          ? "No class has that code. Check it with your teacher — letters and numbers only."
          : why === 'CODE_TOO_SHORT'
            ? 'That code looks too short.'
            : 'Could not send that request. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const leave = async (classId: string) => {
    try {
      await leaveClass(classId);
      load();
    } catch {
      setError('Could not leave that class.');
    }
  };

  return (
    <section className="class-block">
      <h3 className="account-heading">Your classes</h3>

      {enrolments === null && <p className="account-hint">Loading…</p>}
      {enrolments?.length === 0 && (
        <p className="account-hint">
          You are not in a class. That is fine — every lesson works on your own. If a teacher gave
          you a code, put it in below.
        </p>
      )}

      <ul className="enrolment-list">
        {enrolments?.map((e) => (
          <li key={e.classId} className={`enrolment ${e.status}`}>
            <span className="enrolment-name">{e.className}</span>
            <span className="enrolment-teacher">{e.teacherName}</span>
            <span className="enrolment-status">{STATUS_TEXT[e.status]}</span>
            <button type="button" className="link-btn" onClick={() => leave(e.classId)}>
              Leave
            </button>
          </li>
        ))}
      </ul>

      <form className="class-new" onSubmit={join}>
        <label htmlFor="join-code" className="account-hint">
          Join a class
        </label>
        <div className="class-new-row">
          <input
            id="join-code"
            className="code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(normaliseCode(e.target.value))}
            placeholder="ABC123"
            maxLength={10}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="btn primary" disabled={busy || code.length < 4}>
            {busy ? 'Sending…' : 'Ask to join'}
          </button>
        </div>
      </form>
      {joined && <p className="save-state">{joined}</p>}
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}
