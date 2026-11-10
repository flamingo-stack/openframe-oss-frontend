// The archive of the over-the-air bundle (docs/ota.md): a ustar tar of regular files, compressed
// as ONE xz stream. Not per-file compression: the export's pages and RSC payloads are near-copies
// of each other, which only a stream spanning files can share (1.0.213: 21.6 MB as a per-file zip,
// 4.5 MB as tar.xz). The shells decode it with Apple's Compression framework (COMPRESSION_LZMA)
// and XZ for Java, then read the tar the way readTar does; fixtures/bundle-cases.json holds all
// three to the same outcome. Node has no xz codec, so this runs `xz`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { OtaError } from './ota-error.mjs';

const BLOCK = 512;
// An 8 MiB dictionary: about 9 MiB to decode on a phone. -T1 because xz 5.6+ defaults to its
// multi-threaded encoder, which cuts the input into independent blocks (a larger stream, other
// bytes); single-threaded, every xz version writes one block. Same entries, same bytes, for one
// xz build.
const XZ_ARGS = ['-6', '-T1', '--check=crc64', '-c'];
const MAX_NAME = 255;
const MAX_SIZE = 8 ** 11 - 1;
const REGULAR = '0';
const END = Buffer.alloc(2 * BLOCK);
// The magic that opens every xz stream. Apple's COMPRESSION_LZMA also decodes the legacy .lzma
// container, which has none, and consumes all of it, so the shells look for this first.
const XZ_MAGIC = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);

/**
 * A relative file path the shells may write as-is: printable ASCII without space or backslash,
 * `/`-separated, and no empty, `.` or `..` segment (so no absolute path, no directory entry, no
 * escape from the bundle directory). Its length is ustar's: see `splitName`.
 */
export function isSafeEntryName(name) {
  return (
    name.length <= MAX_NAME &&
    /^[\x21-\x5b\x5d-\x7e]+$/.test(name) &&
    name.split('/').every(s => s !== '' && s !== '.' && s !== '..')
  );
}

/**
 * ustar holds a path as a 155-byte prefix and a 100-byte name, split at a `/`, so the file name
 * itself is at most 100 bytes. Next's RSC payload files are named after their whole route
 * (`__next.<segments joined by .>.txt`, 67 bytes at most on 1.0.213), so a route of about 72
 * characters or more fails here and stops the release.
 */
function splitName(name) {
  if (name.length <= 100) return ['', name];
  for (let i = name.indexOf('/'); i !== -1; i = name.indexOf('/', i + 1)) {
    if (i <= 155 && name.length - i - 1 <= 100) return [name.slice(0, i), name.slice(i + 1)];
  }
  throw new OtaError(
    'ENTRY_NAME',
    `${name}: too long for the bundle's ustar format (file name over 100 bytes, or path over 255). ` +
      'Shorten the route, or teach ota-tar.mjs and the shells pax path records.',
  );
}

/** A ustar header's checksum: the sum of its bytes, with the checksum field counted as spaces. */
export function headerChecksum(header) {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i];
  return sum;
}

function header(name, size) {
  const [prefix, base] = splitName(name);
  const h = Buffer.alloc(BLOCK);
  h.write(base, 0, 'ascii');
  h.write('0000644\0', 100, 'ascii');
  h.write('0000000\0', 108, 'ascii');
  h.write('0000000\0', 116, 'ascii');
  h.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
  h.write('00000000000\0', 136, 'ascii');
  h.write(REGULAR, 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  h.write(prefix, 345, 'ascii');
  h.write(`${headerChecksum(h).toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return h;
}

/** An uncompressed ustar archive of `entries`, in the order given: mode 644, owner 0, mtime 0. */
export function writeTar(entries) {
  const parts = [];
  const seen = new Set();
  for (const { name, data } of entries) {
    if (!isSafeEntryName(name)) throw new OtaError('ENTRY_NAME', `unsafe file name: ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new OtaError('DUPLICATE', `duplicate file name: ${name}`);
    seen.add(name);
    if (data.length > MAX_SIZE) throw new OtaError('TAR', `${name}: too large for ustar`);
    parts.push(header(name, data.length), data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
  }
  return Buffer.concat([...parts, END]);
}

function xz(args, options) {
  const result = spawnSync('xz', args, { maxBuffer: 2 ** 31 - 1, ...options });
  if (result.error?.code === 'ENOENT') throw new Error('xz not found: apt install xz-utils, or brew install xz');
  return result;
}

const xzFailure = result => result.stderr?.toString().trim() || result.error?.message || `exit ${result.status}`;

/** `writeTar(entries)` compressed as one xz stream. The same entries give the same bytes. */
export function packTarXz(entries) {
  const result = xz(XZ_ARGS, { input: writeTar(entries) });
  if (result.error || result.status !== 0) throw new Error(`xz ${XZ_ARGS.join(' ')}: ${xzFailure(result)}`);
  return result.stdout;
}

/**
 * Refuses anything but exactly one xz stream with nothing after it, not even stream padding.
 * Decoders disagree past the first stream: `xz` decodes every concatenated stream, Apple's
 * COMPRESSION_LZMA stops after the first without an error, so a second stream would give the
 * phones different files from the ones this script checked.
 */
function assertOneXzStream(archive) {
  if (!archive.subarray(0, XZ_MAGIC.length).equals(XZ_MAGIC)) throw new OtaError('XZ', 'not an xz stream');
  const dir = mkdtempSync(join(tmpdir(), 'ota-xz-'));
  try {
    const file = join(dir, 'bundle.xz');
    writeFileSync(file, archive);
    const result = xz(['--robot', '--list', file], { encoding: 'utf8' });
    const line = result.stdout?.split('\n').find(l => l.startsWith('file\t'));
    if (result.error || result.status !== 0 || !line)
      throw new OtaError('XZ', `not an intact xz file: ${xzFailure(result)}`);
    // file, streams, blocks, compressed, uncompressed, ratio, check, padding
    const [, streams, , , , , , padding] = line.split('\t');
    if (streams !== '1' || padding !== '0') {
      throw new OtaError(
        'XZ',
        `${streams} xz streams and ${padding} bytes of stream padding: the bundle must be one stream`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The tar inside a bundle: exactly one xz stream, fully decoded. */
export function xzDecompress(archive) {
  assertOneXzStream(archive);
  const result = xz(['--format=xz', '-dc'], { input: archive });
  if (result.error || result.status !== 0) throw new OtaError('XZ', `xz -dc: ${xzFailure(result)}`);
  return result.stdout;
}

/**
 * Every entry of an uncompressed ustar archive, `{name, type, data}`, in order. Throws (TAR) on a
 * magic other than `ustar\0` + `00`, a checksum or size field not exactly as writeTar writes it
 * (checksum: six octal digits, NUL, space; size: eleven octal digits, NUL), a wrong checksum, an
 * entry running past the end, or anything after the last entry but two or more whole zero blocks.
 * Only writeTar makes bundles, so nothing else needs reading, and three implementations agree on
 * an exact format more easily than on how far to be lenient. Read besides: the name and prefix
 * fields, each up to its first NUL, and the type byte. Every other header byte (mode, owner, times,
 * link name, user and group names, device numbers, the unused tail) and the padding after the data
 * are ignored, never applied: the shells write files with their own permissions.
 */
export function readTar(tar) {
  const entries = [];
  let p = 0;
  for (;;) {
    if (p + BLOCK > tar.length) throw new OtaError('TAR', 'tar ends without its end-of-archive blocks');
    const h = tar.subarray(p, p + BLOCK);
    if (h.every(b => b === 0)) break;
    const field = (offset, length) => h.toString('latin1', offset, offset + length).replace(/\0.*$/s, '');
    if (field(257, 6) !== 'ustar' || h.toString('latin1', 263, 265) !== '00') {
      throw new OtaError('TAR', `no ustar header at ${p}`);
    }
    const sum = h.toString('latin1', 148, 156);
    if (!/^[0-7]{6}\0 $/.test(sum) || parseInt(sum, 8) !== headerChecksum(h)) {
      throw new OtaError('TAR', `header checksum mismatch at ${p}`);
    }
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const sizeField = h.toString('latin1', 124, 136);
    if (!/^[0-7]{11}\0$/.test(sizeField)) {
      throw new OtaError(
        'TAR',
        `${name}: size field ${JSON.stringify(sizeField)} is not eleven octal digits and a NUL`,
      );
    }
    const size = parseInt(sizeField, 8);
    const start = p + BLOCK;
    if (start + size > tar.length) throw new OtaError('TAR', `${name}: runs past the end of the archive`);
    // Only '0' is a regular file; pre-POSIX tars wrote NUL for one, which is refused with the rest.
    entries.push({ name, type: h.toString('latin1', 156, 157), data: tar.subarray(start, start + size) });
    p = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  const rest = tar.length - p;
  if (rest < END.length || rest % BLOCK !== 0 || !tar.subarray(p).every(b => b === 0)) {
    throw new OtaError('TAR', 'anything but two or more zero blocks after the last entry');
  }
  return entries;
}

export const isRegularFile = entry => entry.type === REGULAR;
