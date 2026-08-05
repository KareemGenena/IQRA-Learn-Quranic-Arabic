/**
 * Note storage — local first.
 *
 * A note is saved to this device the moment it changes, and nothing depends
 * on a network. When cloud sync arrives it becomes a background push of the
 * same document, so a failed or absent upload can never lose work.
 *
 * IndexedDB rather than localStorage: an endless canvas of handwriting runs
 * to megabytes, well past localStorage's ~5 MB ceiling for the whole origin.
 */

export interface Stroke {
  id: string;
  color: string;
  width: number;
  /** Flat [x, y, x, y, …] in canvas coordinates, to keep the doc small. */
  pts: number[];
}

export interface NoteDoc {
  lessonId: number;
  /** Which sheet this is. 'mine' today; 'teacher'/'student' once classes exist. */
  layer: string;
  strokes: Stroke[];
  /** Typed content, as flowing rich text rather than fixed boxes. */
  html: string;
  updatedAt: number;
}

export const emptyNote = (lessonId: number, layer = 'mine'): NoteDoc => ({
  lessonId,
  layer,
  strokes: [],
  html: '',
  updatedAt: 0,
});

const DB_NAME = 'iqra-notes';
const STORE = 'notes';
const key = (lessonId: number, layer: string) => `${lessonId}:${layer}`;

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

export async function loadNote(lessonId: number, layer = 'mine'): Promise<NoteDoc> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key(lessonId, layer));
      req.onsuccess = () => {
        const got = req.result as Partial<NoteDoc> | undefined;
        resolve(got ? { ...emptyNote(lessonId, layer), ...got } : emptyNote(lessonId, layer));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('could not read notes:', err);
    return emptyNote(lessonId, layer);
  }
}

export async function saveNote(doc: NoteDoc): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...doc, updatedAt: Date.now() }, key(doc.lessonId, doc.layer));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const newId = (): string => Math.random().toString(36).slice(2, 10);
