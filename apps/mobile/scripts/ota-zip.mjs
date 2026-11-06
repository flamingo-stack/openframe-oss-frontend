// The zip format of the over-the-air bundle (docs/ota.md), written and read here
// rather than by the `zip` tool: entries are files only (no directories, no
// symlinks), names are plain ASCII, timestamps are fixed, and the reader checks
// every entry the way the shells' extractors will meet it.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const VERSION = 20;
const MADE_BY_UNIX = 3;
// 1980-01-01 00:00, the earliest DOS date: the same bytes for the same files.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const REGULAR_FILE = 0o100644;
const STORED = 0;
const DEFLATED = 8;
const FLAG_ENCRYPTED = 0x1;
const MAX_ENTRIES = 0xffff;
const MAX_32 = 0xffffffff;

/**
 * A relative file path the shells may write as-is: printable ASCII without space or
 * backslash, `/`-separated, and no empty, `.` or `..` segment (so no absolute path,
 * no directory entry, no escape from the bundle directory).
 */
export function isSafeEntryName(name) {
  return /^[\x21-\x5b\x5d-\x7e]+$/.test(name) && name.split('/').every(s => s !== '' && s !== '.' && s !== '..');
}

/** @param {{ name: string, data: Buffer }[]} entries in archive order */
export function writeZip(entries) {
  if (entries.length > MAX_ENTRIES) throw new Error(`${entries.length} files: more than a zip without ZIP64 holds`);
  const parts = [];
  const central = [];
  const seen = new Set();
  let offset = 0;
  for (const { name, data } of entries) {
    if (!isSafeEntryName(name)) throw new Error(`unsafe file name: ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new Error(`duplicate file name: ${name}`);
    seen.add(name);
    const deflated = deflateRawSync(data, { level: 9 });
    const [method, body] = deflated.length < data.length ? [DEFLATED, deflated] : [STORED, data];
    const nameBytes = Buffer.from(name, 'ascii');
    const crc = crc32(data);
    if (data.length >= MAX_32 || offset >= MAX_32) throw new Error('bundle too large for a zip without ZIP64');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_HEADER, 0);
    header.writeUInt16LE((MADE_BY_UNIX << 8) | VERSION, 4);
    header.writeUInt16LE(VERSION, 6);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE((REGULAR_FILE << 16) >>> 0, 38);
    header.writeUInt32LE(offset, 42);

    parts.push(local, nameBytes, body);
    central.push(header, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(central);
  if (offset + directory.length >= MAX_32) throw new Error('bundle too large for a zip without ZIP64');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

/**
 * Every entry of a single-disk zip, from its central directory, each with its contents
 * inflated and checked against its size and CRC. Throws on anything malformed, and on a
 * local header whose name differs from the central one (Android's `ZipInputStream` reads
 * the local headers, other extractors the central directory).
 */
export function readZip(zip) {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip: no end of central directory');
  const count = zip.readUInt16LE(end + 10);
  const directorySize = zip.readUInt32LE(end + 12);
  const directoryOffset = zip.readUInt32LE(end + 16);
  if (zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0 || zip.readUInt16LE(end + 8) !== count) {
    throw new Error('multi-disk zip');
  }
  if (directoryOffset + directorySize !== end) throw new Error('central directory does not end where the archive does');

  const entries = [];
  let p = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || zip.readUInt32LE(p) !== CENTRAL_HEADER) throw new Error(`corrupt central directory at entry ${i}`);
    const nameLength = zip.readUInt16LE(p + 28);
    const entry = {
      name: zip.toString('latin1', p + 46, p + 46 + nameLength),
      madeBy: zip.readUInt16LE(p + 4) >> 8,
      flags: zip.readUInt16LE(p + 8),
      method: zip.readUInt16LE(p + 10),
      crc: zip.readUInt32LE(p + 16),
      compressedSize: zip.readUInt32LE(p + 20),
      size: zip.readUInt32LE(p + 24),
      mode: zip.readUInt32LE(p + 38) >>> 16,
      localOffset: zip.readUInt32LE(p + 42),
    };
    p += 46 + nameLength + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
    entry.data = readContents(zip, entry, directoryOffset);
    entries.push(entry);
  }
  if (p !== end) throw new Error('central directory size does not match its entries');
  return entries;
}

function readContents(zip, entry, directoryOffset) {
  const o = entry.localOffset;
  if (o + 30 > directoryOffset || zip.readUInt32LE(o) !== LOCAL_HEADER) {
    throw new Error(`${entry.name}: no local header at ${o}`);
  }
  const nameLength = zip.readUInt16LE(o + 26);
  if (zip.toString('latin1', o + 30, o + 30 + nameLength) !== entry.name) {
    throw new Error(`${entry.name}: local header names another file`);
  }
  if (entry.flags & FLAG_ENCRYPTED) throw new Error(`${entry.name}: encrypted`);
  const start = o + 30 + nameLength + zip.readUInt16LE(o + 28);
  if (start + entry.compressedSize > directoryOffset) throw new Error(`${entry.name}: runs into the central directory`);
  const body = zip.subarray(start, start + entry.compressedSize);
  let data;
  if (entry.method === STORED) data = body;
  else if (entry.method === DEFLATED) data = inflateRawSync(body);
  else throw new Error(`${entry.name}: compression method ${entry.method}`);
  if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error(`${entry.name}: size or CRC mismatch`);
  return data;
}

/** Whether an entry read by `readZip` is a regular file with a Unix mode. */
export function isRegularFile(entry) {
  return entry.madeBy === MADE_BY_UNIX && (entry.mode & S_IFMT) === S_IFREG;
}
