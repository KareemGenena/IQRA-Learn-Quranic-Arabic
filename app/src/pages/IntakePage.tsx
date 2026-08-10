/**
 * The audio intake system.
 *
 * What it replaces: recording each word in a sound recorder, typing a
 * filename, saving it into the right folder, and finding out weeks later at
 * generation time that one of the three was wrong. Here the sheet supplies the
 * words, the filename is derived from the word rather than typed, the take is
 * judged the moment it is made, and the file is written straight into the
 * folder a generator already reads.
 *
 * Three things about it are deliberate and load-bearing:
 *
 * - **The filename is never typed.** `audioName.ts` derives it with the same
 *   transformation every generator uses to match a recording to its row.
 * - **The take is checked against the row's expected utterance count** with the
 *   same measurements `splitIntoN` will make later, so a take that would fail
 *   the split fails here instead, while the microphone is still set up.
 * - **The speaker profile comes first.** It is worthless to the lessons and
 *   indispensable to the pronunciation work, and it cannot be collected after
 *   the fact — see `speakerProfile.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioFileName, nameProblem } from '../lib/audioName';
import { readDocx, guessWordColumn } from '../lib/docxTable';
import {
  canWriteToFolder,
  download,
  ensureWritable,
  listFolder,
  makeZip,
  pickFolder,
  writeFile,
} from '../lib/fileSink';
import {
  clearIntake,
  loadDirHandle,
  loadSession,
  loadTakes,
  newId,
  saveDirHandle,
  saveSession,
  saveTake,
} from '../lib/intakeStore';
import type { IntakeSession, Slot, Take } from '../lib/intakeStore';
import { listMicrophones, startRecording } from '../lib/recorder';
import type { RecorderHandle } from '../lib/recorder';
import { profileSlots } from '../lib/speakerProfile';
import { LEVEL_BAND, checkTake, dbfs, levelAdvice, verdict } from '../lib/takeCheck';
import { encodeWav } from '../lib/wavFile';

type TakeMap = Record<string, Take[]>;

export function IntakePage() {
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [ready, setReady] = useState(false);
  const [takes, setTakes] = useState<TakeMap>({});
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const found = await loadSession();
      const handle = await loadDirHandle();
      if (!alive) return;
      setDir(handle);
      if (found) {
        const map: TakeMap = {};
        for (const slot of found.slots) map[slot.id] = await loadTakes(slot.id);
        if (!alive) return;
        setTakes(map);
        setSession(found);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const begin = useCallback((made: IntakeSession) => {
    setSession(made);
    setTakes({});
    setCurrent(0);
    void saveSession(made);
  }, []);

  const update = useCallback((next: IntakeSession) => {
    setSession(next);
    void saveSession(next);
  }, []);

  const discard = useCallback(async () => {
    await clearIntake();
    setSession(null);
    setTakes({});
    setCurrent(0);
    setStatus('');
  }, []);

  if (!ready) return <p className="loading">Loading…</p>;
  if (!session) return <SetupPanel onBegin={begin} />;

  return (
    <main className="intake">
      <SessionBar session={session} onDiscard={discard} />
      <Destination dir={dir} onPick={setDir} />
      <Recorder
        session={session}
        takes={takes}
        setTakes={setTakes}
        current={current}
        setCurrent={setCurrent}
        onUpdate={update}
      />
      <SavePanel
        session={session}
        takes={takes}
        dir={dir}
        status={status}
        setStatus={setStatus}
      />
    </main>
  );
}

// ── setting a session up ──────────────────────────────────────────────────

function SetupPanel({ onBegin }: { onBegin: (s: IntakeSession) => void }) {
  const [source, setSource] = useState('typed by hand');
  const [rows, setRows] = useState<string[][]>([]);
  const [column, setColumn] = useState(0);
  const [words, setWords] = useState('');
  const [batch, setBatch] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [consent, setConsent] = useState(false);
  const [expect, setExpect] = useState(1);
  const [error, setError] = useState('');

  /** Pull a column out of the table and drop the rows with nothing in it. */
  const fill = (table: string[][], col: number) => {
    const arabic = /[ء-ي]/;
    setWords(
      table
        .map((r) => (r[col] ?? '').trim())
        .filter((t) => t && arabic.test(t))
        .join('\n'),
    );
  };

  const openDocx = async (file: File) => {
    setError('');
    try {
      const { rows: table, paragraphs } = await readDocx(file);
      setSource(file.name);
      if (table.length) {
        const col = guessWordColumn(table);
        setRows(table);
        setColumn(col);
        fill(table, col);
      } else {
        // Not every sheet is a Word table — some are written as plain
        // paragraphs. Those land in the same editable list, so the rest of the
        // page never has to know the difference.
        setRows([]);
        const arabic = /[ء-ي]/;
        setWords(paragraphs.filter((p) => arabic.test(p)).join('\n'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const list = words
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);

  const problems = list
    .map((text) => ({ text, why: nameProblem(text) }))
    .filter((p) => p.why);

  const names = list.map(audioFileName);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);

  const start = () => {
    onBegin({
      id: newId(),
      source,
      batch: batch.trim(),
      speaker: speaker.trim(),
      consent,
      slots: [
        ...profileSlots(),
        ...list.map((text, i) => ({
          id: `w${i}`,
          kind: 'word' as const,
          text,
          fileName: audioFileName(text),
          expect,
          row: i,
        })),
      ],
      chosen: {},
      createdAt: Date.now(),
    });
  };

  const ready = list.length > 0 && !problems.length && batch.trim() && speaker.trim() && consent;

  return (
    <main className="intake">
      <section className="account-card intake-card">
        <h3 className="account-heading">1 · Where the words come from</h3>
        <p className="account-hint">
          Open the sheet itself — the .docx in <code>Word Tables/</code> is the source of truth, and
          reading it here is one fewer copy of the words that can drift.
        </p>
        <input
          type="file"
          accept=".docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void openDocx(file);
          }}
        />
        {error && <p className="gate-error">{error}</p>}

        {rows.length > 0 && (
          <label className="intake-field">
            <span>Which column holds the words</span>
            <select
              value={column}
              onChange={(e) => {
                const col = Number(e.target.value);
                setColumn(col);
                fill(rows, col);
              }}
            >
              {Array.from({ length: Math.max(...rows.map((r) => r.length)) }, (_, c) => (
                <option key={c} value={c}>
                  Column {c + 1} —{' '}
                  {rows
                    .map((r) => r[c])
                    .filter(Boolean)
                    .slice(0, 3)
                    .join('، ') || '(empty)'}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="intake-field">
          <span>The words, one per line. Edit freely — this is the list that gets recorded.</span>
          <textarea
            className="intake-words"
            dir="rtl"
            lang="ar"
            rows={8}
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
        </label>
        <p className="account-hint">
          {list.length} word{list.length === 1 ? '' : 's'} · from {source}
        </p>
        {problems.map((p) => (
          <p key={p.text} className="gate-error">
            “{p.text}” cannot be a filename: {p.why}
          </p>
        ))}
        {duplicates.length > 0 && (
          <p className="gate-error">
            Two rows would write the same file: {[...new Set(duplicates)].join(', ')}. Recording
            both would leave only the second.
          </p>
        )}

        <label className="intake-field">
          <span>Utterances per recording</span>
          <select value={expect} onChange={(e) => setExpect(Number(e.target.value))}>
            <option value={1}>1 — one word per take</option>
            <option value={2}>2 — two forms in one take</option>
            <option value={3}>3 — three forms in one take (the وَ / ثُمَّ pattern)</option>
          </select>
        </label>
        <p className="account-hint">
          This is what the splitter will expect to find. Any slot can be changed on its own once the
          list is made.
        </p>
      </section>

      <section className="account-card intake-card">
        <h3 className="account-heading">2 · Who is recording</h3>
        <label className="intake-field">
          <span>Batch — the folder these belong to, e.g. “Lesson 5 — madd before hamza”</span>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} />
        </label>
        <label className="intake-field">
          <span>Speaker</span>
          <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
        </label>
        <label className="intake-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            The speaker agrees that these recordings may be kept and used to teach Qur’anic
            pronunciation, and to build the reference set that later gives learners feedback on
            their own.
          </span>
        </label>
        <p className="account-hint">
          Recorded in the manifest beside the audio. A recording whose consent was never captured
          cannot honestly be used for anything later, and there is no way to go back and ask.
        </p>
      </section>

      <div className="cal-actions">
        <button type="button" className="btn primary" disabled={!ready} onClick={start}>
          Make {list.length} slot{list.length === 1 ? '' : 's'}
        </button>
      </div>
    </main>
  );
}

// ── the session, once it exists ───────────────────────────────────────────

function SessionBar({
  session,
  onDiscard,
}: {
  session: IntakeSession;
  onDiscard: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="account-card intake-card">
      <h3 className="account-heading">{session.batch}</h3>
      <p className="account-hint">
        {session.slots.filter((s) => s.kind === 'word').length} words from {session.source} ·
        recorded by {session.speaker} · consent {session.consent ? 'given' : 'NOT given'}
      </p>
      {confirming ? (
        <div className="confirm">
          <p>Throw away this session and every take in it? Files already written stay where they are.</p>
          <div className="confirm-actions">
            <button type="button" className="btn danger solid" onClick={onDiscard}>
              Discard everything
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
          Start a different sheet
        </button>
      )}
    </section>
  );
}

function Destination({
  dir,
  onPick,
}: {
  dir: FileSystemDirectoryHandle | null;
  onPick: (d: FileSystemDirectoryHandle | null) => void;
}) {
  const supported = canWriteToFolder();
  return (
    <section className="account-card intake-card">
      <h3 className="account-heading">Where the files go</h3>
      {supported ? (
        <>
          <p className="account-hint">
            {dir ? (
              <>
                Writing into <strong>{dir.name}</strong>. Point this at the <code>Audio/</code>
                folder the generator reads and there is nothing to move afterwards.
              </>
            ) : (
              'No folder chosen yet — takes are kept on this device until there is one.'
            )}
          </p>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const picked = await pickFolder();
              if (picked) {
                await saveDirHandle(picked);
                onPick(picked);
              }
            }}
          >
            {dir ? 'Choose a different folder' : 'Choose a folder'}
          </button>
        </>
      ) : (
        <p className="account-hint">
          This browser cannot write into a folder, so the takes come out as one ZIP instead. Chrome
          or Edge on a desktop can write them straight into <code>Audio/</code>.
        </p>
      )}
    </section>
  );
}

// ── recording ─────────────────────────────────────────────────────────────

function Recorder({
  session,
  takes,
  setTakes,
  current,
  setCurrent,
  onUpdate,
}: {
  session: IntakeSession;
  takes: TakeMap;
  setTakes: React.Dispatch<React.SetStateAction<TakeMap>>;
  current: number;
  setCurrent: (i: number) => void;
  onUpdate: (s: IntakeSession) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  /** Loudest moment of the take in progress — a meter you can only glance at
   *  tells you nothing about a peak that happened half a second ago. */
  const [held, setHeld] = useState(0);
  const [micError, setMicError] = useState('');
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState('');
  const handle = useRef<RecorderHandle | null>(null);
  const playing = useRef<HTMLAudioElement | null>(null);

  const slot = session.slots[current];

  useEffect(() => {
    listMicrophones().then(setMics).catch(() => {});
  }, []);

  // The meter, while a take is running.
  useEffect(() => {
    if (!recording) return;
    let frame = 0;
    const tick = () => {
      const now = handle.current?.level() ?? 0;
      setLevel(now);
      setHeld((h) => (now > h ? now : h));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [recording]);

  const stop = useCallback(async () => {
    const h = handle.current;
    if (!h) return;
    handle.current = null;
    setRecording(false);
    setLevel(0);
    const { samples, sampleRate, device } = await h.stop();
    if (!samples.length) return;

    const report = checkTake(samples, sampleRate, slot.expect);
    const existing = takes[slot.id] ?? [];
    const take: Take = {
      no: (existing.at(-1)?.no ?? 0) + 1,
      blob: encodeWav(samples, sampleRate),
      sampleRate,
      report,
      at: Date.now(),
      device,
    };
    await saveTake(slot.id, take);
    setTakes((prev) => ({ ...prev, [slot.id]: [...(prev[slot.id] ?? []), take] }));
    // A new take is the one you meant; the old ones stay for comparison.
    onUpdate({ ...session, chosen: { ...session.chosen, [slot.id]: take.no } });
  }, [onUpdate, session, setTakes, slot, takes]);

  const record = useCallback(async () => {
    if (handle.current) {
      void stop();
      return;
    }
    setMicError('');
    try {
      handle.current = await startRecording(mic || undefined);
      setHeld(0);
      setRecording(true);
    } catch {
      setMicError('The microphone was refused or is in use by another program.');
    }
  }, [mic, stop]);

  const play = useCallback(() => {
    const chosen = (takes[slot.id] ?? []).find((t) => t.no === session.chosen[slot.id]);
    if (!chosen) return;
    playing.current?.pause();
    const audio = new Audio(URL.createObjectURL(chosen.blob));
    playing.current = audio;
    void audio.play();
  }, [session.chosen, slot.id, takes]);

  const move = useCallback(
    (by: number) => {
      const next = current + by;
      if (next >= 0 && next < session.slots.length) setCurrent(next);
    },
    [current, session.slots.length, setCurrent],
  );

  // Single keys only, and always `e.code` — the same rule the lessons follow,
  // for the same reason: a chord cannot be spoken, and Shift rewrites `e.key`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        void record();
      } else if (e.code === 'KeyN') {
        move(1);
      } else if (e.code === 'KeyP') {
        move(-1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, play, record]);

  /**
   * Changing how many words a take should hold changes where the splitter
   * cuts, so every take already made has to be re-measured against the new
   * count — a report left over from the old one would describe cuts that will
   * never happen.
   */
  const setExpect = async (n: number) => {
    onUpdate({
      ...session,
      slots: session.slots.map((s) => (s.id === slot.id ? { ...s, expect: n } : s)),
    });
    const mine = takes[slot.id] ?? [];
    if (!mine.length) return;
    const ctx = new AudioContext();
    const redone: Take[] = [];
    for (const take of mine) {
      const audio = await ctx.decodeAudioData(await take.blob.arrayBuffer());
      const next = { ...take, report: checkTake(audio.getChannelData(0), audio.sampleRate, n) };
      await saveTake(slot.id, next);
      redone.push(next);
    }
    void ctx.close();
    setTakes((prev) => ({ ...prev, [slot.id]: redone }));
  };

  const mine = takes[slot.id] ?? [];
  const chosenNo = session.chosen[slot.id];
  const chosen = mine.find((t) => t.no === chosenNo);
  const done = session.slots.filter((s) => session.chosen[s.id] !== undefined).length;

  // Every kept take that has a voice in it. Room tone is excluded: it is
  // supposed to be quiet, and averaging it in would drag the batch down and
  // recommend raising a level that is already right.
  const spokenPeaks = session.slots
    .filter((s) => s.expect > 0)
    .map((s) => (takes[s.id] ?? []).find((t) => t.no === session.chosen[s.id])?.report.peak)
    .filter((p): p is number => p !== undefined);
  const advice = levelAdvice(spokenPeaks);

  return (
    <>
      <LevelCheck advice={advice} />
      <section className="account-card intake-card intake-stage">
        <p className="intake-progress">
          {done} of {session.slots.length} recorded
        </p>

        <p className="intake-kind">
          {slot.kind === 'profile' ? 'Speaker profile' : `Word ${(slot.row ?? 0) + 1}`}
        </p>
        <p className="arabic-text intake-word" dir="rtl" lang="ar">
          {slot.text}
        </p>
        {slot.hint && <p className="account-hint intake-hint">{slot.hint}</p>}
        <p className="intake-filename" dir="ltr">
          {slot.fileName}
        </p>

        {/* The meter is in dBFS, not linear amplitude. Linear puts every
            usable speaking level in the leftmost sliver of the bar, which is
            exactly why a too-quiet input is easy to miss. */}
        <Meter live={level} held={held} recording={recording} />
        <p className="intake-meter-note">
          {recording
            ? held > 0
              ? `Loudest so far ${dbfs(held).toFixed(0)} dBFS`
              : 'Listening…'
            : `Aim for the shaded band — peaks around ${LEVEL_BAND.aim} dBFS`}
        </p>

        <div className="cal-actions">
          <button
            type="button"
            className={`btn ${recording ? 'danger solid' : 'primary'}`}
            onClick={() => void record()}
          >
            {recording ? 'Stop' : 'Record'}
          </button>
          <button type="button" className="btn" disabled={!chosen} onClick={play}>
            Play
          </button>
          <button type="button" className="btn" onClick={() => move(-1)} disabled={current === 0}>
            Previous
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => move(1)}
            disabled={current === session.slots.length - 1}
          >
            Next
          </button>
        </div>
        {micError && <p className="gate-error">{micError}</p>}
        <p className="kbd-hint">
          <kbd>R</kbd> record or stop · <kbd>Space</kbd> play · <kbd>N</kbd> next ·{' '}
          <kbd>P</kbd> previous
        </p>

        {slot.kind === 'word' && (
          <label className="intake-field intake-expect">
            <span>Utterances in this take</span>
            <select value={slot.expect} onChange={(e) => void setExpect(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        )}

        {mics.length > 1 && (
          <label className="intake-field">
            <span>Microphone</span>
            <select value={mic} onChange={(e) => setMic(e.target.value)}>
              <option value="">Default</option>
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Microphone'}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="account-hint intake-note">
          Echo cancellation, noise suppression and auto-gain are all switched off, and nothing is
          downsampled. Keep the same microphone and the same distance for the whole batch — that
          matters more than the microphone itself.
        </p>
      </section>

      <TakeList
        takes={mine}
        expect={slot.expect}
        chosen={chosenNo}
        onChoose={(no) => onUpdate({ ...session, chosen: { ...session.chosen, [slot.id]: no } })}
      />

      <SlotList session={session} takes={takes} current={current} onGo={setCurrent} />
    </>
  );
}

/**
 * A level meter scaled in decibels from −60 to 0, with the target band drawn
 * on it and a peak-hold marker that stays put after the loudest moment.
 */
function Meter({ live, held, recording }: { live: number; held: number; recording: boolean }) {
  const FLOOR = -60;
  const pos = (db: number) => Math.max(0, Math.min(100, ((db - FLOOR) / -FLOOR) * 100));
  const liveDb = live > 0 ? dbfs(live) : FLOOR;
  const heldDb = held > 0 ? dbfs(held) : FLOOR;
  return (
    <div className={`intake-meter ${recording ? 'live' : ''}`}>
      <span
        className="intake-meter-band"
        style={{
          left: `${pos(LEVEL_BAND.low)}%`,
          width: `${pos(LEVEL_BAND.high) - pos(LEVEL_BAND.low)}%`,
        }}
      />
      <span
        className={`intake-meter-fill ${heldDb > -1 ? 'hot' : ''}`}
        style={{ width: `${pos(liveDb)}%` }}
      />
      {held > 0 && (
        <span
          className={`intake-meter-hold ${heldDb > -1 ? 'hot' : ''}`}
          style={{ left: `${pos(heldDb)}%` }}
        />
      )}
    </div>
  );
}

/**
 * The batch-level verdict on input gain.
 *
 * Placed so that it has something to say by the end of the speaker profile —
 * five takes in, before the sheet proper. Finding out the input was 8 dB low
 * after thirty-three words is the failure this exists to prevent.
 */
function LevelCheck({ advice }: { advice: ReturnType<typeof levelAdvice> }) {
  if (!advice || advice.level === 'good') return null;
  return (
    <section className={`account-card intake-card intake-level ${advice.level}`}>
      <h3 className="account-heading">Input level</h3>
      <p className="account-hint">{advice.message}</p>
    </section>
  );
}

function TakeList({
  takes,
  expect,
  chosen,
  onChoose,
}: {
  takes: Take[];
  expect: number;
  chosen: number | undefined;
  onChoose: (no: number) => void;
}) {
  if (!takes.length) return null;
  return (
    <section className="account-card intake-card">
      <h3 className="account-heading">Takes</h3>
      {takes.map((take) => {
        const v = verdict(take.report, expect);
        return (
          <div key={take.no} className={`intake-take ${take.no === chosen ? 'chosen' : ''}`}>
            <div className="intake-take-head">
              <span className={`intake-verdict ${v.level}`}>
                {v.level === 'good' ? '✓' : v.level === 'warn' ? '!' : '✗'}
              </span>
              <strong>Take {take.no}</strong>
              <span className="intake-take-meta">
                {take.report.duration.toFixed(2)}s
                {/* Room tone has nothing to cut, so the cut list would read
                    "cuts into s" — an empty measurement pretending to be one. */}
                {expect > 0 && (
                  <>
                    {' '}
                    · cuts into {take.report.durations.map((d) => d.toFixed(2)).join(' / ')}s
                  </>
                )}{' '}
                · peak {(20 * Math.log10(take.report.peak || 1e-6)).toFixed(0)} dBFS
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => void new Audio(URL.createObjectURL(take.blob)).play()}
              >
                Play
              </button>
              <button
                type="button"
                className={`btn ${take.no === chosen ? 'primary' : ''}`}
                onClick={() => onChoose(take.no)}
              >
                {take.no === chosen ? 'Keeping this' : 'Keep this'}
              </button>
            </div>
            {v.notes.map((note) => (
              <p key={note} className="account-hint intake-take-note">
                {note}
              </p>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function SlotList({
  session,
  takes,
  current,
  onGo,
}: {
  session: IntakeSession;
  takes: TakeMap;
  current: number;
  onGo: (i: number) => void;
}) {
  return (
    <section className="account-card intake-card">
      <h3 className="account-heading">Every slot</h3>
      <ol className="intake-slots">
        {session.slots.map((slot, i) => {
          const mine = takes[slot.id] ?? [];
          const chosen = mine.find((t) => t.no === session.chosen[slot.id]);
          const level = chosen ? verdict(chosen.report, slot.expect).level : 'none';
          return (
            <li key={slot.id}>
              <button
                type="button"
                className={`intake-slot ${i === current ? 'here' : ''} ${level}`}
                onClick={() => onGo(i)}
              >
                <span className="intake-slot-text" dir="rtl" lang="ar">
                  {slot.text}
                </span>
                <span className="intake-slot-file" dir="ltr">
                  {slot.fileName}
                </span>
                <span className={`intake-verdict ${level}`}>
                  {level === 'good' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '✗' : '·'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── writing the files out ─────────────────────────────────────────────────

/**
 * What the audio alone cannot say: which sheet a word came from, what was
 * actually recorded, how loud the room was, who spoke and whether they agreed
 * to it. The generators ignore this file; the pronunciation corpus cannot be
 * built without it, and none of it can be recovered afterwards.
 */
function manifest(session: IntakeSession, takes: TakeMap) {
  return {
    batch: session.batch,
    source: session.source,
    speaker: session.speaker,
    consent: session.consent,
    createdAt: new Date(session.createdAt).toISOString(),
    writtenAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    recordings: session.slots
      .map((slot) => {
        const take = (takes[slot.id] ?? []).find((t) => t.no === session.chosen[slot.id]);
        if (!take) return null;
        return {
          file: slot.fileName,
          kind: slot.kind,
          text: slot.text,
          device: take.device ?? null,
          row: slot.row ?? null,
          expectedUtterances: slot.expect,
          take: take.no,
          takesMade: (takes[slot.id] ?? []).length,
          sampleRate: take.sampleRate,
          duration: Number(take.report.duration.toFixed(3)),
          peak: Number(take.report.peak.toFixed(4)),
          noiseFloor: Number(take.report.noiseFloor.toFixed(6)),
          snrDb: Number.isFinite(take.report.snr) ? Number(take.report.snr.toFixed(1)) : null,
          piecesFound: take.report.naturalRuns,
          cutInto: take.report.durations.map((d) => Number(d.toFixed(3))),
          recordedAt: new Date(take.at).toISOString(),
        };
      })
      .filter(Boolean),
  };
}

function SavePanel({
  session,
  takes,
  dir,
  status,
  setStatus,
}: {
  session: IntakeSession;
  takes: TakeMap;
  dir: FileSystemDirectoryHandle | null;
  status: string;
  setStatus: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const keepers = useMemo(
    () =>
      session.slots
        .map((slot) => {
          const take = (takes[slot.id] ?? []).find((t) => t.no === session.chosen[slot.id]);
          return take ? { slot, take } : null;
        })
        .filter((x): x is { slot: Slot; take: Take } => x !== null),
    [session, takes],
  );

  const bad = keepers.filter(({ slot, take }) => verdict(take.report, slot.expect).level === 'bad');

  const toFolder = async () => {
    if (!dir) return;
    setBusy(true);
    try {
      if (!(await ensureWritable(dir))) {
        setStatus('That folder is no longer writable — choose it again.');
        return;
      }
      const before = new Set(await listFolder(dir));
      let replaced = 0;
      for (const { slot, take } of keepers) {
        if (before.has(slot.fileName)) replaced += 1;
        await writeFile(dir, slot.fileName, take.blob);
      }
      await writeFile(
        dir,
        'intake.json',
        new Blob([JSON.stringify(manifest(session, takes), null, 2)], { type: 'application/json' }),
      );
      setStatus(
        `Wrote ${keepers.length} file${keepers.length === 1 ? '' : 's'} into ${dir.name}` +
          (replaced ? `, ${replaced} of them over a file that was already there.` : '.'),
      );
    } catch (err) {
      setStatus(err instanceof Error ? `Could not write: ${err.message}` : 'Could not write.');
    } finally {
      setBusy(false);
    }
  };

  const toZip = async () => {
    setBusy(true);
    try {
      const zip = await makeZip([
        ...keepers.map(({ slot, take }) => ({ name: slot.fileName, data: take.blob })),
        {
          name: 'intake.json',
          data: new Blob([JSON.stringify(manifest(session, takes), null, 2)]),
        },
      ]);
      download(`${session.batch || 'intake'}.zip`, zip);
      setStatus(`Zipped ${keepers.length} file${keepers.length === 1 ? '' : 's'}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-card intake-card">
      <h3 className="account-heading">Save</h3>
      <p className="account-hint">
        {keepers.length} of {session.slots.length} slots have a kept take.
        {bad.length > 0 && ` ${bad.length} would fail the split as recorded.`}
      </p>
      <div className="cal-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!dir || !keepers.length || busy}
          onClick={() => void toFolder()}
        >
          Write into the folder
        </button>
        <button
          type="button"
          className="btn"
          disabled={!keepers.length || busy}
          onClick={() => void toZip()}
        >
          Download as a ZIP
        </button>
      </div>
      {status && <p className="sync-msg">{status}</p>}
    </section>
  );
}
