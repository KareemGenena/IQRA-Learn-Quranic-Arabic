/** Reads one entry out of a ZIP container (a .docx is a ZIP). */

import { readFileSync } from 'fs';
import { inflateRawSync } from 'zlib';

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

export function readZipEntry(zipPath, entryName) {
  const buf = readFileSync(zipPath);

  // End-of-central-directory record lives in the last ~64KB, after the comment.
  let eocd = -1;
  for (let p = buf.length - 22; p >= 0 && p > buf.length - 65558; p--) {
    if (buf.readUInt32LE(p) === EOCD_SIG) {
      eocd = p;
      break;
    }
  }
  if (eocd === -1) throw new Error(`not a zip file: ${zipPath}`);

  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // start of central directory

  for (let i = 0; i < entries; i++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (name === entryName) {
      // The local header repeats the name/extra lengths, which may differ.
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compSize);
      if (method === 0) return raw; // stored
      if (method === 8) return inflateRawSync(raw); // deflate
      throw new Error(`unsupported compression method ${method} for ${entryName}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entryName} not found in ${zipPath}`);
}
