/**
 * Reads a .docx (a ZIP) into an ordered list of entries and writes one back.
 *
 * Entries that are not changed are written back with their original compressed
 * bytes, untouched — only the parts the caller replaces are re-deflated. Entry
 * order is preserved ([Content_Types].xml stays first).
 */
import { readFileSync, writeFileSync } from 'fs';
import { crc32, deflateRawSync, inflateRawSync } from 'zlib';

export function readDocx(path) {
  const buf = readFileSync(path);
  let eocd = -1;
  for (let p = buf.length - 22; p >= 0 && p > buf.length - 65558; p--) if (buf.readUInt32LE(p) === 0x06054b50) { eocd = p; break; }
  if (eocd < 0) throw new Error(`not a zip file: ${path}`);
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    entries.push({ name, method, crc, size, raw: buf.subarray(start, start + compSize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** The uncompressed bytes of an entry. */
export const bytes = e => e.data ?? (e.method === 0 ? e.raw : inflateRawSync(e.raw));
export const text = e => bytes(e).toString('utf8');

export function getEntry(entries, name) {
  const e = entries.find(x => x.name === name);
  if (!e) throw new Error(`missing part: ${name}`);
  return e;
}

/** Replaces (or adds, at the end) a part's content. */
export function setEntry(entries, name, content) {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const e = entries.find(x => x.name === name);
  if (e) { e.data = data; delete e.raw; } else entries.push({ name, data });
}

export function removeEntry(entries, name) {
  const i = entries.findIndex(x => x.name === name);
  if (i < 0) throw new Error(`missing part: ${name}`);
  entries.splice(i, 1);
}

export function writeDocx(path, entries) {
  const locals = [], central = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 10 << 5 | 4;   // fixed stamp: identical input, identical file
  for (const e of entries) {
    let method, crc, size, raw;
    if (e.data) { method = 8; crc = crc32(e.data); size = e.data.length; raw = deflateRawSync(e.data, { level: 9 }); }
    else ({ method, crc, size, raw } = e);
    const name = Buffer.from(e.name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc >>> 0, 14);
    lh.writeUInt32LE(raw.length, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10); ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc >>> 0, 16);
    ch.writeUInt32LE(raw.length, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, raw); central.push(ch, name);
    offset += 30 + name.length + raw.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(path, Buffer.concat([...locals, ...central, end]));
}
