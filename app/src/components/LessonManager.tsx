import { useState } from 'react';
import { LESSONS } from '../lib/lessons';
import { lessonStatus, saveConfig } from '../lib/appConfig';
import type { AppConfig, FeatureAudience, LessonStatus } from '../lib/appConfig';

const FEATURES: { key: string; label: string }[] = [
  { key: 'laser', label: 'Laser pointer' },
  { key: 'notes', label: 'Lesson notes' },
];

const NEXT_LABEL: Record<LessonStatus, string> = {
  draft: 'In progress — only you can see it',
  published: 'Live for everyone',
  archived: 'Archived — pulled back to admin',
};

interface Props {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

/** Admin-only: decides what the public sees, without a redeploy. */
export function LessonManager({ config, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const push = async (next: AppConfig) => {
    setBusy(true);
    setMsg('Saving…');
    onChange(next); // optimistic: the admin sees it immediately
    try {
      await saveConfig(next);
      setMsg('Saved — this is what learners see now');
    } catch (err) {
      console.error('config save failed:', err);
      setMsg('Could not save. Check you are signed in.');
    } finally {
      setBusy(false);
    }
  };

  const setLesson = (id: number, status: LessonStatus) =>
    push({ ...config, lessons: { ...config.lessons, [id]: status } });

  const setFeature = (key: string, audience: FeatureAudience) =>
    push({ ...config, features: { ...config.features, [key]: audience } });

  return (
    <section className="manager">
      <h3>Lessons</h3>
      <p className="manager-hint">
        A lesson is only visible to learners once you publish it. Archiving pulls it back here
        without touching its words or recordings.
      </p>
      <ul className="manager-list">
        {LESSONS.map((l) => {
          const status = lessonStatus(config, l.id);
          return (
            <li key={l.id} className={`manager-row ${status}`}>
              <span className="manager-name">
                <strong>
                  {l.id}. {l.title}
                </strong>
                <span className={`status-pill ${status}`}>{status}</span>
                <span className="manager-sub">{NEXT_LABEL[status]}</span>
              </span>
              <span className="manager-actions">
                {status !== 'published' && (
                  <button type="button" className="btn primary" disabled={busy} onClick={() => setLesson(l.id, 'published')}>
                    Publish
                  </button>
                )}
                {status !== 'archived' && (
                  <button type="button" className="btn" disabled={busy} onClick={() => setLesson(l.id, 'archived')}>
                    Archive
                  </button>
                )}
                {status !== 'draft' && (
                  <button type="button" className="btn" disabled={busy} onClick={() => setLesson(l.id, 'draft')}>
                    Back to draft
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <h3>Features</h3>
      <p className="manager-hint">
        Anything still being built stays visible to you alone until you switch it on.
      </p>
      <ul className="manager-list">
        {FEATURES.map((f) => {
          const audience = config.features[f.key] ?? 'admin';
          return (
            <li key={f.key} className="manager-row">
              <span className="manager-name">
                <strong>{f.label}</strong>
                <span className={`status-pill ${audience === 'everyone' ? 'published' : 'draft'}`}>
                  {audience === 'everyone' ? 'live' : 'admin only'}
                </span>
              </span>
              <span className="manager-actions">
                <button
                  type="button"
                  className={audience === 'everyone' ? 'btn' : 'btn primary'}
                  disabled={busy}
                  onClick={() => setFeature(f.key, audience === 'everyone' ? 'admin' : 'everyone')}
                >
                  {audience === 'everyone' ? 'Make admin only' : 'Publish to everyone'}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {msg && <p className="manager-msg">{msg}</p>}
    </section>
  );
}
