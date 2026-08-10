/**
 * The intake session, kept on the device.
 *
 * A recording session is long and interruptible — thirty-odd words, a phone
 * call in the middle, a browser that decides to reload. Everything therefore
 * survives a refresh: the slot list, every take, and which take was chosen.
 *
 * IndexedDB rather than localStorage for the same reason the notes use it:
 * a single 3-second take is a quarter of a megabyte, and a full sheet runs to
 * tens of megabytes — far past localStorage's ceiling for the whole origin.
 *
 * The shape below is deliberately transport-agnostic. When recordings are
 * collected from volunteers rather than from the author's own machine, the
 * same session and the same takes are what gets uploaded; only the sink
 * changes. That is why `speaker` and `consent` are here from the start —
 * they cannot be reconstructed after the fact, and a corpus without them
 * cannot be used for anything.
 */

import type { TakeReport } from './takeCheck';

export interface Slot {
  id: string;
  /** 'word' comes from the sheet; 'profile' is the speaker calibration set. */
  kind: 'word' | 'profile';
  /** What to say — Arabic for a word slot. */
  text: string;
  /** What to do, in English, for the calibration slots. */
  hint?: string;
  /** Derived from the text, never typed. */
  fileName: string;
  /** How many utterances the take should contain, for the split gate. */
  expect: number;
  /** Which row of the source sheet this came from, for the manifest. */
  row?: number;
}

export interface Take {
  no: number;
  blob: Blob;
  sampleRate: number;
  report: TakeReport;
  at: number;
  /** The microphone that made it. Older takes predate this and have none. */
  device?: string;
}

export interface IntakeSession {
  id: string;
  /** The sheet this came from, or how the words were entered. */
  source: string;
  /** Where the files are meant to end up — the author's own label. */
  batch: string;
  /**
   * Who is speaking. Their own name for the author; for a volunteer this is
   * the identity the corpus will carry, so it is asked for once and stored.
   */
  speaker: string;
  /** Whether the speaker has agreed their recording may be used and kept. */
  consent: boolean;
  slots: Slot[];
  /** slot id → the take number that was kept. */
  chosen: Record<string, number>;
  createdAt: number;
}

const DB_NAME = 'iqra-intake';
const STORE = 'intake';
const SESSION_KEY = 'session';
const DIR_KEY = 'dir';
const takeKey = (slotId: string, no: number) => `take:${slotId}:${no}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSession(): Promise<IntakeSession | null> {
  try {
    return (await get<IntakeSession>(SESSION_KEY)) ?? null;
  } catch (err) {
    console.error('could not read the intake session:', err);
    return null;
  }
}

export const saveSession = (session: IntakeSession) => put(SESSION_KEY, session);

export const saveTake = (slotId: string, take: Take) => put(takeKey(slotId, take.no), take);

/** Every take for a slot, oldest first. Missing numbers are simply skipped. */
export async function loadTakes(slotId: string): Promise<Take[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out: Take[] = [];
    const range = IDBKeyRange.bound(`take:${slotId}:`, `take:${slotId}:￿`);
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        out.sort((a, b) => a.no - b.no);
        resolve(out);
        return;
      }
      out.push(cursor.value as Take);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTake(slotId: string, no: number): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(takeKey(slotId, no));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Throws the whole session away — takes included. */
export async function clearIntake(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      // The chosen folder outlives a session: clearing the words should not
      // make the author pick the folder again.
      if (cursor.key !== DIR_KEY) store.delete(cursor.key);
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── the destination folder ────────────────────────────────────────────────
// A directory handle is structured-cloneable, so the browser will remember
// which folder was chosen across reloads. Permission is not remembered as
// reliably, so it is always re-checked before a write.

export const saveDirHandle = (handle: FileSystemDirectoryHandle) => put(DIR_KEY, handle);

export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await get<FileSystemDirectoryHandle>(DIR_KEY)) ?? null;
  } catch {
    return null;
  }
}

export const newId = (): string => Math.random().toString(36).slice(2, 10);
