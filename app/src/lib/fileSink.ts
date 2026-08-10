/**
 * Getting the finished recordings out of the browser.
 *
 * The point of the intake system is that a file lands, correctly named, in the
 * folder a generator already reads. The File System Access API does exactly
 * that: the author picks `Audio/Audio - …/` once and every take is written
 * straight into it — no download, no unzip, no rename, which is the whole
 * class of mistake this replaces.
 *
 * That API is Chromium-only, so there is a second path: a single ZIP holding
 * every kept take, which works in any browser and is what a volunteer on a
 * phone will use. The ZIP is written by hand and stored uncompressed — WAV
 * barely deflates, and it keeps this to forty lines with no dependency.
 */

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  }
}

/** Whether this browser can write into a folder the author picks. */
export const canWriteToFolder = (): boolean => typeof window.showDirectoryPicker === 'function';

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // the picker was dismissed — not an error
  }
}

/**
 * Whether the remembered folder is still writable, asking for permission if
 * the browser has forgotten. A handle survives a reload; the permission that
 * came with it often does not.
 */
export async function ensureWritable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

export async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Blob,
): Promise<void> {
  const file = await dir.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  await stream.write(data);
  await stream.close();
}

/** Names already in the folder — so overwriting an existing take is a choice. */
export async function listFolder(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const name of dir.keys()) names.push(name);
  return names;
}

// ── the ZIP fallback ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Blob;
}

/** A stored-method ZIP. Arabic filenames need the UTF-8 flag, bit 11. */
export async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  // Explicitly backed by ArrayBuffer, not ArrayBufferLike: a Blob will not
  // accept a view that might sit on a SharedArrayBuffer.
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.data.arrayBuffer());
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filenames
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

/** Hands a blob to the browser's downloads. */
export function download(name: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Revoking immediately can beat the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
