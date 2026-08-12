import { useCallback, useEffect, useMemo, useState } from 'react';
import { SignInPanel } from '../components/SignInPanel';
import { LESSONS } from '../lib/lessons';
import {
  addRecording,
  deleteRecording,
  editRecording,
  hostOf,
  listRecordings,
  NOTE_MAX,
  PASSCODE_MAX,
  TITLE_MAX,
  tidyUrl,
} from '../lib/recordings';
import type { Recording, RecordingDraft } from '../lib/recordings';
import { useClasses } from '../lib/useClasses';
import type { Account } from '../lib/useAccount';

/**
 * Class recordings: the teacher posts the link to a recorded session, and the
 * class finds it here rather than by scrolling back through a chat thread.
 *
 * One page for both sides. Which class is always on screen — a teacher running
 * two classes must never have to guess which roster is about to be given a
 * link, and that is the only mistake this page makes easy.
 */
export function RecordingsPage({ account }: { account: Account }) {
  if (!account.signedIn) {
    return (
      <SignInPanel
        account={account}
        blurb="Recordings belong to a class, so signing in is how the app knows which are yours. Every lesson works without an account."
      />
    );
  }
  return <RecordingsForClass account={account} />;
}

function RecordingsForClass({ account }: { account: Account }) {
  const classes = useClasses(account);
  const active = classes.active;
  const activeId = active?.id ?? '';
  const teaches = active?.youAre === 'teacher';

  const [items, setItems] = useState<Recording[] | null>(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    if (!activeId) return;
    setItems(null);
    setError('');
    listRecordings(activeId)
      .then(setItems)
      .catch(() => {
        setItems([]);
        setError('Could not load the recordings. Check your connection.');
      });
  }, [activeId]);

  useEffect(load, [load]);

  // Switching class must not leave a half-filled form pointing at the new one.
  useEffect(() => {
    setEditingId(null);
    setAdding(false);
  }, [activeId]);

  if (classes.loading) return <main className="classes-page"><p className="account-hint">Loading…</p></main>;

  if (!active) {
    return (
      <main className="classes-page">
        <section className="class-block">
          <h3 className="account-heading">Class recordings</h3>
          <p className="account-hint">
            Recordings live in a class. You are not in one yet — if your teacher gave you a code,
            enter it under <a href="#/classes">Classes</a>. If you teach, start a class there and
            your recordings will appear here.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="classes-page">
      <section className="class-block">
        <div className="sheet-bar">
          {classes.options && classes.options.length > 1 ? (
            <label className="class-picker">
              <span className="join-code-label">Class</span>
              <select value={active.id} onChange={(e) => classes.setActive(e.target.value)}>
                {classes.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.youAre === 'student' ? ` — ${o.teacherName || 'your teacher'}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="class-now">
              <span className="join-code-label">Class</span> <strong>{active.name}</strong>
            </span>
          )}
          <span className="sheet-role can-edit">
            {teaches ? 'You post these for the class' : 'Posted by your teacher'}
          </span>
        </div>

        {items === null && <p className="account-hint">Loading…</p>}

        {items?.length === 0 && (
          <p className="account-hint">
            {teaches
              ? 'No recordings yet. Paste the link to your last session below and the class will find it here.'
              : 'Your teacher has not posted a recording for this class yet.'}
          </p>
        )}

        <ul className="recording-list">
          {items?.map((r) =>
            editingId === r.id ? (
              <li key={r.id}>
                <RecordingForm
                  initial={r}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (draft) => {
                    await editRecording(activeId, r.id, draft, r.createdAt);
                    setEditingId(null);
                    load();
                  }}
                />
              </li>
            ) : (
              <RecordingRow
                key={r.id}
                recording={r}
                canEdit={teaches}
                onEdit={() => setEditingId(r.id)}
                onDeleted={load}
                classId={activeId}
                onError={setError}
              />
            ),
          )}
        </ul>

        {teaches &&
          (adding ? (
            <RecordingForm
              submitLabel="Post to the class"
              onCancel={() => setAdding(false)}
              onSubmit={async (draft) => {
                await addRecording(activeId, draft);
                setAdding(false);
                load();
              }}
            />
          ) : (
            <button type="button" className="btn primary" onClick={() => setAdding(true)}>
              Add a recording
            </button>
          ))}

        {teaches && (
          <p className="account-hint">
            Only the link is kept here — the recording itself stays where you put it, and anyone you
            remove from the class loses this page. If your recording has its own passcode, put it in
            the field beside the link rather than leaving it in a chat message.
          </p>
        )}

        {error && <p className="gate-error">{error}</p>}
      </section>
    </main>
  );
}

// ── one row ───────────────────────────────────────────────────────────────

/**
 * Dates are stored as UTC midnight of the day the teacher picked, so that the
 * day shown is the day chosen — a local-midnight timestamp read in another
 * timezone slides to the day before.
 */
const isoDay = (ms: number): string => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const msFromIsoDay = (day: string): number => (day ? Date.parse(`${day}T00:00:00Z`) : 0);
const showDay = (ms: number): string =>
  ms
    ? new Date(ms).toLocaleDateString(undefined, {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

function RecordingRow({
  recording,
  canEdit,
  classId,
  onEdit,
  onDeleted,
  onError,
}: {
  recording: Recording;
  canEdit: boolean;
  classId: string;
  onEdit: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const lesson = LESSONS.find((l) => l.id === recording.lessonId);

  const copyPasscode = async () => {
    try {
      await navigator.clipboard.writeText(recording.passcode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused, or an insecure origin. The passcode is on screen in full.
    }
  };

  const remove = async () => {
    try {
      await deleteRecording(classId, recording.id);
      onDeleted();
    } catch {
      onError('Could not remove that recording.');
    }
  };

  return (
    <li className="recording">
      <div className="recording-head">
        <span className="recording-title">{recording.title || 'Recorded session'}</span>
        {recording.recordedAt > 0 && (
          <span className="recording-date">{showDay(recording.recordedAt)}</span>
        )}
      </div>

      {lesson && (
        <a className="recording-lesson" href={`#/lesson/${lesson.id}`}>
          Lesson {lesson.id} — {lesson.title}
        </a>
      )}

      {recording.note && <p className="recording-note">{recording.note}</p>}

      <div className="recording-actions">
        {/* noreferrer as well as noopener: the recording host has no business
            being told which page inside this app sent someone to it. */}
        <a
          className="btn primary"
          href={recording.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open recording
        </a>
        <span className="recording-host">{hostOf(recording.url)}</span>

        {recording.passcode && (
          <span className="recording-pass">
            <span className="join-code-label">Passcode</span>
            <code className="join-code small">{recording.passcode}</code>
            <button type="button" className="btn" onClick={copyPasscode}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        )}
      </div>

      {canEdit && (
        <div className="recording-admin">
          <button type="button" className="link-btn" onClick={onEdit}>
            Edit
          </button>
          {confirming ? (
            <>
              <span className="account-hint">Remove this link?</span>
              <button type="button" className="link-btn danger" onClick={remove}>
                Yes, remove
              </button>
              <button type="button" className="link-btn" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
              Remove
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ── the form ──────────────────────────────────────────────────────────────

const BLANK: RecordingDraft = { title: '', url: '', passcode: '', note: '', recordedAt: 0, lessonId: 0 };

function RecordingForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Recording;
  submitLabel: string;
  onSubmit: (draft: RecordingDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const start = useMemo<RecordingDraft>(
    () =>
      initial
        ? {
            title: initial.title,
            url: initial.url,
            passcode: initial.passcode,
            note: initial.note,
            recordedAt: initial.recordedAt,
            lessonId: initial.lessonId,
          }
        : { ...BLANK, recordedAt: msFromIsoDay(isoDay(Date.now())) },
    [initial],
  );

  const [draft, setDraft] = useState<RecordingDraft>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof RecordingDraft>(key: K, value: RecordingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = tidyUrl(draft.url);
    if (!url) {
      setError('That does not look like a web address. It has to start with https://');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ ...draft, url, title: draft.title.trim(), note: draft.note.trim() });
    } catch {
      setError('That did not save. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <form className="recording-form" onSubmit={submit}>
      <label className="account-hint" htmlFor="rec-url">
        Link to the recording
      </label>
      <input
        id="rec-url"
        type="url"
        inputMode="url"
        value={draft.url}
        onChange={(e) => set('url', e.target.value)}
        placeholder="https://zoom.us/rec/share/…"
        maxLength={600}
        autoComplete="off"
        spellCheck={false}
        required
      />

      <div className="recording-form-row">
        <label className="account-hint">
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Tuesday — madd practice"
            maxLength={TITLE_MAX}
          />
        </label>
        <label className="account-hint">
          Date of the class
          <input
            type="date"
            value={isoDay(draft.recordedAt)}
            onChange={(e) => set('recordedAt', msFromIsoDay(e.target.value))}
          />
        </label>
      </div>

      <div className="recording-form-row">
        <label className="account-hint">
          Passcode (if the recording needs one)
          <input
            type="text"
            value={draft.passcode}
            onChange={(e) => set('passcode', e.target.value)}
            maxLength={PASSCODE_MAX}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="account-hint">
          Lesson it covers
          <select
            value={draft.lessonId}
            onChange={(e) => set('lessonId', Number(e.target.value))}
          >
            <option value={0}>No particular lesson</option>
            {LESSONS.map((l) => (
              <option key={l.id} value={l.id}>
                Lesson {l.id} — {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="account-hint" htmlFor="rec-note">
        Anything to say about it
      </label>
      <textarea
        id="rec-note"
        value={draft.note}
        onChange={(e) => set('note', e.target.value)}
        maxLength={NOTE_MAX}
        rows={2}
        placeholder="We stopped at row 20 — start there next week."
      />

      <div className="recording-form-actions">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {error && <p className="gate-error">{error}</p>}
    </form>
  );
}
