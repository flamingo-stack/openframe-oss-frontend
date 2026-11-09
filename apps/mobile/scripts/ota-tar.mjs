// The archive of the over-the-air bundle (docs/ota.md): a ustar tar of regular files, compressed
// as ONE xz stream. Not per-file compression: the export's pages and RSC payloads are near-copies
// of each other, which only a stream spanning files can share (1.0.213: 21.6 MB as a per-file zip,
// 4.5 MB as tar.xz). The shells decode it with Apple's Compression framework (COMPRESSION_LZMA)
// and XZ for Java, then read the tar the way readTar does. Node has no xz codec, so this runs `xz`.
import { spawnSync } from 'node:child_process';

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
  throw new Error(
    `${name}: too long for the bundle's ustar format (file name over 100 bytes, or path over 255). ` +
      'Shorten the route, or teach ota-tar.mjs and the shells pax path records.',
  );
}

function checksum(header) {
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
  h.write(`${checksum(h).toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return h;
}

/** An uncompressed ustar archive of `entries`, in the order given: mode 644, owner 0, mtime 0. */
export function writeTar(entries) {
  const parts = [];
  const seen = new Set();
  for (const { name, data } of entries) {
    if (!isSafeEntryName(name)) throw new Error(`unsafe file name: ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new Error(`duplicate file name: ${name}`);
    seen.add(name);
    if (data.length > MAX_SIZE) throw new Error(`${name}: too large for ustar`);
    parts.push(header(name, data.length), data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
  }
  return Buffer.concat([...parts, END]);
}

function xz(args, input) {
  const result = spawnSync('xz', args, { input, maxBuffer: 2 ** 31 - 1 });
  if (result.error?.code === 'ENOENT') throw new Error('xz not found: apt install xz-utils, or brew install xz');
  const stderr = result.stderr?.toString().trim();
  if (result.error || result.status !== 0) {
    throw new Error(`xz ${args.join(' ')}: ${stderr || result.error?.message || `exit ${result.status}`}`);
  }
  return result.stdout;
}

/** `writeTar(entries)` compressed as one xz stream. The same entries give the same bytes. */
export function packTarXz(entries) {
  return xz(XZ_ARGS, writeTar(entries));
}

export function xzDecompress(archive) {
  return xz(['-dc'], archive);
}

/**
 * Every entry of an uncompressed ustar archive, `{name, type, data}`, in order. Throws on a bad
 * checksum or magic, an entry running past the end, or anything but zeros after the end marker.
 */
export function readTar(tar) {
  const entries = [];
  let p = 0;
  for (;;) {
    if (p + BLOCK > tar.length) throw new Error('tar ends without its end-of-archive blocks');
    const h = tar.subarray(p, p + BLOCK);
    if (h.every(b => b === 0)) break;
    const field = (offset, length) => h.toString('latin1', offset, offset + length).replace(/\0.*$/s, '');
    if (field(257, 6) !== 'ustar' || h.toString('latin1', 263, 265) !== '00') throw new Error(`no ustar header at ${p}`);
    const sum = field(148, 8).trim();
    if (!/^[0-7]{1,7}$/.test(sum) || parseInt(sum, 8) !== checksum(h)) throw new Error(`header checksum mismatch at ${p}`);
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const sizeField = field(124, 12).trim();
    if (!/^[0-7]{1,11}$/.test(sizeField)) throw new Error(`${name}: size field ${JSON.stringify(sizeField)} is not octal`);
    const size = parseInt(sizeField, 8);
    const start = p + BLOCK;
    if (start + size > tar.length) throw new Error(`${name}: runs past the end of the archive`);
    entries.push({ name, type: field(156, 1) || REGULAR, data: tar.subarray(start, start + size) });
    p = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  if (!tar.subarray(p).every(b => b === 0) || tar.length - p < END.length) {
    throw new Error('anything but the two zero blocks after the last entry');
  }
  return entries;
}

export const isRegularFile = entry => entry.type === REGULAR;
