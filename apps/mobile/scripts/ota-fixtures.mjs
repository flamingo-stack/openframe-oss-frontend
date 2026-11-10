#!/usr/bin/env node
// Writes the shared test cases of the over-the-air format into apps/mobile/ota/fixtures
// (docs/ota.md, "Shared test cases"): manifest-cases.json and the keys they are signed with,
// bundle-cases.json and the bundles it names. The release scripts (ota-fixtures.test.mjs) and the
// unit tests of both shells run every case and must reach its outcome: the error code, or the
// payload or file list given. env-cases.json and decision-cases.json are written by hand.
//
// The outcomes are written out below, never read back from ota-verify.mjs, so a bug there fails the
// cases instead of becoming one. Every run makes new keys (their private halves are not kept) and
// new signatures, so rerun it only to change a case, and commit everything it writes.
//
//   node apps/mobile/scripts/ota-fixtures.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { writeTar } from './ota-tar.mjs';
import { bundleName, keyIdOf } from './ota-verify.mjs';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'ota', 'fixtures');

const sha256 = data => createHash('sha256').update(data).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

// ---------------------------------------------------------------------------------------------
// Manifests

/** The shells hold `a` and `b` (current and next); `c` is a key no shell holds. */
const KEYS = Object.fromEntries(
  ['a', 'b', 'c'].map(name => [name, generateKeyPairSync('ec', { namedCurve: 'prime256v1' })]),
);
const HELD = ['a', 'b'];
const keyId = name => keyIdOf(KEYS[name].publicKey);
const P256_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

const VERSION = '1.2.3';
const PAYLOAD = {
  format: 1,
  version: VERSION,
  bridgeLevel: 1,
  url: `https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/${VERSION}/${bundleName(VERSION)}`,
  size: 4482516,
  sha256: sha256('a bundle'),
};
const KNOWN_FIELDS = Object.keys(PAYLOAD);
const known = payload => Object.fromEntries(KNOWN_FIELDS.map(field => [field, payload[field]]));

const derSign = (bytes, name) => sign('sha256', bytes, { key: KEYS[name].privateKey, dsaEncoding: 'der' });

/** `r` and `s` of a DER ECDSA-Sig-Value; a P-256 one always has short-form lengths. */
function derParts(der) {
  assert.equal(der[0], 0x30);
  assert.equal(der[1], der.length - 2);
  const r = der.subarray(4, 4 + der[3]);
  const sAt = 4 + der[3];
  assert.equal(der[sAt], 0x02);
  return { r, s: der.subarray(sAt + 2, sAt + 2 + der[sAt + 1]) };
}
const toBig = bytes => BigInt(`0x${bytes.toString('hex') || '0'}`);
/** The minimal DER INTEGER content of a non-negative number. */
function intContent(n) {
  const hex = n.toString(16);
  const bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  return bytes[0] & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes;
}
const derInt = content => Buffer.concat([Buffer.from([0x02, content.length]), content]);
function derSequence(...contents) {
  const body = Buffer.concat(contents.map(derInt));
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** The same bytes with a non-zero unused bit before the padding, which lenient decoders accept. */
function dirtyPaddingBits(b64) {
  const at = b64.indexOf('=') - 1;
  assert.ok(at > 0, 'needs padding');
  return b64.slice(0, at) + B64[B64.indexOf(b64[at]) | 1] + b64.slice(at + 1);
}

/** mobile.json as ota-pack writes it, from base64 strings given or derived. */
function envelope({ keyId: id = keyId('a'), payloadB64, signatureB64 }) {
  return json({ keyId: id, payload: payloadB64, signature: signatureB64 });
}

/** A manifest of `payloadText` signed by `signer`, with any field of the envelope overridden. */
function manifest(payloadText, { signer = 'a', ...overrides } = {}) {
  const bytes = Buffer.from(payloadText, 'utf8');
  return envelope({
    keyId: keyId(signer),
    payloadB64: bytes.toString('base64'),
    signatureB64: derSign(bytes, signer).toString('base64'),
    ...overrides,
  });
}

/**
 * A payload whose JSON is padded with an unknown field until `accept(base64)` holds. The padding is
 * `?`: ASCII text reaches base64's `+` and `/` only through a `>` or `?` at an offset of 2 mod 3.
 */
function payloadWhere(accept) {
  for (let k = 0; k < 6; k++) {
    const text = JSON.stringify(k ? { ...PAYLOAD, note: '?'.repeat(k) } : PAYLOAD);
    if (accept(Buffer.from(text).toString('base64'))) return text;
  }
  throw new Error('no padding of the payload satisfies the case');
}

/** A signature by `a` over `bytes` whose `r` and `s` satisfy `accept`, re-signing until one does. */
function signatureWhere(bytes, accept) {
  for (let i = 0; i < 64; i++) {
    const signature = derSign(bytes, 'a');
    if (accept(derParts(signature))) return signature;
  }
  throw new Error('no signature satisfies the case');
}

/** A signature over `bytes` whose base64 has padding, re-signing until one does. */
function paddedSignature(bytes) {
  for (;;) {
    const signature = derSign(bytes, 'a');
    if (signature.length % 3) return signature;
  }
}

function manifestCases() {
  const text = JSON.stringify(PAYLOAD);
  const bytes = Buffer.from(text);
  const payloadB64 = bytes.toString('base64');
  // A low-S signature, so its n - s twin below is the high-S form.
  const signature = signatureWhere(bytes, ({ s }) => toBig(s) <= P256_N / 2n);
  const { r, s } = derParts(signature);
  const ok = (name, manifestText, payload = PAYLOAD, keys = HELD) => ({
    name,
    keys,
    manifest: manifestText,
    expect: { payload: known(payload) },
  });
  const refused = (name, manifestText, error, keys = HELD) => ({
    name,
    keys,
    manifest: manifestText,
    expect: { error },
  });
  const withSignature = der => envelope({ payloadB64, signatureB64: der.toString('base64') });
  const signed = (name, payload, error) =>
    refused(name, manifest(typeof payload === 'string' ? payload : JSON.stringify(payload)), error);

  const unpaddedPayload = payloadWhere(b64 => b64.endsWith('='));
  const urlSafePayload = payloadWhere(b64 => /[+/]/.test(b64));
  const sigPadded = paddedSignature(bytes);
  const fixed32 = int => Buffer.from(toBig(int).toString(16).padStart(64, '0'), 'hex');
  const longFormLength = Buffer.concat([Buffer.from([0x30, 0x81, signature.length - 2]), signature.subarray(2)]);
  // An r whose top bit is set, so DER gives it a leading zero; dropping that makes it negative.
  const highR = derParts(signatureWhere(bytes, ({ r }) => r[0] === 0));
  const valid = manifest(text);
  // A version case names its own bundle, so the version rule is the only one it can fail.
  const withVersion = version => ({
    ...PAYLOAD,
    version,
    url: PAYLOAD.url.replace(bundleName(VERSION), bundleName(version)),
  });

  return [
    // accepted
    ok('a manifest signed by the current key', manifest(text)),
    ok('a manifest signed by the next key', manifest(text, { signer: 'b' })),
    ok(
      'a payload field this format does not know is ignored',
      manifest(JSON.stringify({ ...PAYLOAD, delta: { from: '1.2.2' } })),
    ),
    ok('an envelope field this format does not know is ignored', json({ ...JSON.parse(manifest(text)), comment: 'x' })),
    ok(
      'any https host: the signature covers the url',
      manifest(JSON.stringify({ ...PAYLOAD, url: `https://example.com/x/${bundleName(VERSION)}` })),
      {
        ...PAYLOAD,
        url: `https://example.com/x/${bundleName(VERSION)}`,
      },
    ),
    ok(
      'a high-S signature (s replaced by n - s) verifies',
      withSignature(derSequence(intContent(toBig(r)), intContent(P256_N - toBig(s)))),
    ),
    ok(
      'version parts of nine digits',
      manifest(JSON.stringify(withVersion('999999999.0.0'))),
      withVersion('999999999.0.0'),
    ),

    // the envelope
    refused('the manifest is not JSON', 'not json', 'ENVELOPE'),
    refused('the manifest is a JSON array', json([keyId('a'), payloadB64, signature.toString('base64')]), 'ENVELOPE'),
    refused('the manifest is JSON null', 'null', 'ENVELOPE'),
    refused('no signature field', json({ keyId: keyId('a'), payload: payloadB64 }), 'ENVELOPE'),
    refused(
      'a keyId that is not a string',
      json({ keyId: 1, payload: payloadB64, signature: signature.toString('base64') }),
      'ENVELOPE',
    ),
    refused(
      'a payload without its base64 padding',
      manifest(unpaddedPayload, { payloadB64: Buffer.from(unpaddedPayload).toString('base64').replace(/=+$/, '') }),
      'ENVELOPE',
    ),
    refused(
      'a payload in the URL-safe base64 alphabet',
      manifest(urlSafePayload, {
        payloadB64: Buffer.from(urlSafePayload).toString('base64').replaceAll('+', '-').replaceAll('/', '_'),
      }),
      'ENVELOPE',
    ),
    refused(
      'a payload in base64 broken into MIME lines',
      manifest(text, { payloadB64: payloadB64.replace(/.{76}/g, '$&\n') }),
      'ENVELOPE',
    ),
    refused('a payload in base64 with a leading space', manifest(text, { payloadB64: ` ${payloadB64}` }), 'ENVELOPE'),
    refused(
      'a payload in base64 with non-zero padding bits',
      manifest(unpaddedPayload, { payloadB64: dirtyPaddingBits(Buffer.from(unpaddedPayload).toString('base64')) }),
      'ENVELOPE',
    ),
    refused(
      'a signature in base64 with non-zero padding bits',
      envelope({ payloadB64, signatureB64: dirtyPaddingBits(sigPadded.toString('base64')) }),
      'ENVELOPE',
    ),
    refused(
      'bad base64 is refused before the key is looked up',
      manifest(text, { signer: 'c', payloadB64: `${payloadB64}!` }),
      'ENVELOPE',
    ),
    refused(
      'a non-canonical signature under an unknown key: the envelope is checked first',
      envelope({ keyId: keyId('c'), payloadB64, signatureB64: dirtyPaddingBits(sigPadded.toString('base64')) }),
      'ENVELOPE',
    ),
    // Strict JSON (RFC 8259, UTF-8): what JSON.parse refuses, a shell's parser must refuse too.
    refused('a byte order mark before the manifest', `﻿${valid}`, 'ENVELOPE'),
    refused(
      'a trailing comma in the manifest',
      valid.replace(/\n}\n$/, () => ',\n}\n'),
      'ENVELOPE',
    ),
    refused('a comment in the manifest', `/* mobile.json */\n${valid}`, 'ENVELOPE'),
    refused('text after the manifest object', `${valid}x`, 'ENVELOPE'),
    refused('single-quoted strings in the manifest', valid.replaceAll('"', "'"), 'ENVELOPE'),

    // the key
    refused('signed by a key the shell does not hold', manifest(text, { signer: 'c' }), 'UNKNOWN_KEY'),
    refused(
      'signed by the next key on a shell that holds only the current one',
      manifest(text, { signer: 'b' }),
      'UNKNOWN_KEY',
      ['a'],
    ),
    refused(
      'the keyId of a held key in upper case',
      manifest(text, { keyId: keyId('a').toUpperCase() }),
      'UNKNOWN_KEY',
    ),
    refused('an empty keyId', manifest(text, { keyId: '' }), 'UNKNOWN_KEY'),
    refused(
      'an unknown key is refused before the signature is checked',
      manifest(text, { signer: 'c', signatureB64: '' }),
      'UNKNOWN_KEY',
    ),

    // the signature
    refused(
      'the keyId of the current key on a signature by the next',
      manifest(text, { signer: 'b', keyId: keyId('a') }),
      'SIGNATURE',
    ),
    refused(
      'the payload changed after signing',
      manifest(text, { payloadB64: Buffer.from(JSON.stringify({ ...PAYLOAD, version: '9.9.9' })).toString('base64') }),
      'SIGNATURE',
    ),
    refused('a signature over other bytes', withSignature(derSign(Buffer.from(`${text} `), 'a')), 'SIGNATURE'),
    refused('an empty signature', withSignature(Buffer.alloc(0)), 'SIGNATURE'),
    refused(
      'a raw r || s signature (IEEE P1363), not DER',
      withSignature(Buffer.concat([fixed32(r), fixed32(s)])),
      'SIGNATURE',
    ),
    refused(
      'a DER integer with a needless leading zero',
      withSignature(derSequence(Buffer.concat([Buffer.from([0]), r]), s)),
      'SIGNATURE',
    ),
    refused('a DER sequence with a long-form length (BER)', withSignature(longFormLength), 'SIGNATURE'),
    refused('a byte after the DER signature', withSignature(Buffer.concat([signature, Buffer.from([0])])), 'SIGNATURE'),
    refused('s = 0', withSignature(derSequence(intContent(toBig(r)), intContent(0n))), 'SIGNATURE'),
    refused(
      'a negative DER integer r (its leading zero dropped), which SunEC accepts',
      withSignature(derSequence(highR.r.subarray(1), highR.s)),
      'SIGNATURE',
    ),
    refused(
      'a payload that is not JSON under a signature over other bytes: the signature is checked first',
      manifest('hello', { signatureB64: derSign(Buffer.from('other'), 'a').toString('base64') }),
      'SIGNATURE',
    ),

    // the payload, validly signed
    signed('a payload that is not JSON', 'hello', 'PAYLOAD'),
    refused(
      'a payload that is not UTF-8',
      (() => {
        const raw = Buffer.concat([Buffer.from(text.slice(0, -1)), Buffer.from(',"note":"\xff"}', 'latin1')]);
        return envelope({ payloadB64: raw.toString('base64'), signatureB64: derSign(raw, 'a').toString('base64') });
      })(),
      'PAYLOAD',
    ),
    signed('a payload that is a JSON array', [PAYLOAD], 'PAYLOAD'),
    signed('a payload without sha256', { ...PAYLOAD, sha256: undefined }, 'PAYLOAD'),
    signed('a payload without url', { ...PAYLOAD, url: undefined }, 'PAYLOAD'),
    signed('format 2', { ...PAYLOAD, format: 2 }, 'PAYLOAD'),
    signed('format "1", a string', { ...PAYLOAD, format: '1' }, 'PAYLOAD'),
    signed('version 1.2', withVersion('1.2'), 'PAYLOAD'),
    signed('version 01.2.3', withVersion('01.2.3'), 'PAYLOAD'),
    signed('version 1.2.3-rc.1', withVersion('1.2.3-rc.1'), 'PAYLOAD'),
    signed('version +1.2.3', withVersion('+1.2.3'), 'PAYLOAD'),
    signed('version 1.2.3 and a newline', withVersion('1.2.3\n'), 'PAYLOAD'),
    signed('version 1.2.1000000000: a part of ten digits', withVersion('1.2.1000000000'), 'PAYLOAD'),
    signed('version 1.2.3. with a trailing dot', withVersion('1.2.3.'), 'PAYLOAD'),
    // Swift's \d and Java's Integer.parseInt take any Unicode digit; the version is ASCII only.
    signed('version 1.2.\u0663, an Arabic-Indic digit', withVersion('1.2.\u0663'), 'PAYLOAD'),
    signed('version null', { ...PAYLOAD, version: null }, 'PAYLOAD'),
    signed('bridgeLevel 0', { ...PAYLOAD, bridgeLevel: 0 }, 'PAYLOAD'),
    signed('bridgeLevel 1.5', { ...PAYLOAD, bridgeLevel: 1.5 }, 'PAYLOAD'),
    signed('bridgeLevel "1", a string', { ...PAYLOAD, bridgeLevel: '1' }, 'PAYLOAD'),
    signed('size 0', { ...PAYLOAD, size: 0 }, 'PAYLOAD'),
    signed('size -1', { ...PAYLOAD, size: -1 }, 'PAYLOAD'),
    signed('size "4482516", a string', { ...PAYLOAD, size: String(PAYLOAD.size) }, 'PAYLOAD'),
    signed('sha256 in upper case', { ...PAYLOAD, sha256: PAYLOAD.sha256.toUpperCase() }, 'PAYLOAD'),
    signed('sha256 of 63 digits', { ...PAYLOAD, sha256: PAYLOAD.sha256.slice(1) }, 'PAYLOAD'),
    signed('sha256 and a newline', { ...PAYLOAD, sha256: `${PAYLOAD.sha256}\n` }, 'PAYLOAD'),
    signed(
      'a url with the file name glued to its last path segment',
      { ...PAYLOAD, url: `https://example.com/x${bundleName(VERSION)}` },
      'PAYLOAD',
    ),
    signed('an http url', { ...PAYLOAD, url: PAYLOAD.url.replace('https:', 'http:') }, 'PAYLOAD'),
    signed(
      'an HTTPS:// url: the scheme is compared as bytes',
      { ...PAYLOAD, url: PAYLOAD.url.replace('https:', 'HTTPS:') },
      'PAYLOAD',
    ),
    signed(
      'a url naming the bundle of another version',
      { ...PAYLOAD, url: PAYLOAD.url.replace(bundleName(VERSION), bundleName('1.2.4')) },
      'PAYLOAD',
    ),
    signed('a url with a query after the file name', { ...PAYLOAD, url: `${PAYLOAD.url}?x=1` }, 'PAYLOAD'),
    signed(
      'a url whose query ends in the file name',
      { ...PAYLOAD, url: `https://example.com/x?f=/${bundleName(VERSION)}` },
      'PAYLOAD',
    ),
    signed(
      'a url whose fragment ends in the file name',
      { ...PAYLOAD, url: `https://example.com/x#/${bundleName(VERSION)}` },
      'PAYLOAD',
    ),
    // JSONSerialization reads true as the number 1; a shell must not.
    signed('format true', { ...PAYLOAD, format: true }, 'PAYLOAD'),
    signed('bridgeLevel true', { ...PAYLOAD, bridgeLevel: true }, 'PAYLOAD'),
    signed('size true', { ...PAYLOAD, size: true }, 'PAYLOAD'),
  ];
}

// ---------------------------------------------------------------------------------------------
// Bundles

const BLOCK = 512;
const END = Buffer.alloc(2 * BLOCK);

/** A ustar header written as given, without the checks writeTar makes, so it can be wrong. */
function rawHeader({
  name,
  prefix = '',
  size,
  type = '0',
  magic = 'ustar\0',
  version = '00',
  sizeField,
  checksumDelta = 0,
  checksumField = sum => `${sum.toString(8).padStart(6, '0')}\0 `,
  extra = [],
}) {
  const h = Buffer.alloc(BLOCK);
  h.write(name, 0, 100, 'latin1');
  h.write('0000644\0', 100, 'ascii');
  h.write('0000000\0', 108, 'ascii');
  h.write('0000000\0', 116, 'ascii');
  if (Buffer.isBuffer(sizeField)) sizeField.copy(h, 124);
  else h.write(sizeField ?? `${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'latin1');
  h.write('00000000000\0', 136, 'ascii');
  h.write(type, 156, 1, 'latin1');
  h.write(magic, 257, 6, 'latin1');
  h.write(version, 263, 2, 'latin1');
  h.write(prefix, 345, 155, 'latin1');
  for (const [offset, text] of extra) h.write(text, offset, 'latin1');
  // The checksum computed here rather than by ota-tar.mjs, so a bug there cannot become a case.
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
  h.write(checksumField(sum + checksumDelta), 148, 8, 'ascii');
  return h;
}

/** One entry's blocks: `rawHeader(options)`, the data, and the `pad` bytes (zeros) that fill its last block. */
function rawEntry({ data = '', pad = 0, ...options }) {
  const bytes = Buffer.from(data);
  return Buffer.concat([
    rawHeader({ size: bytes.length, ...options }),
    bytes,
    Buffer.alloc((BLOCK - (bytes.length % BLOCK)) % BLOCK, pad),
  ]);
}
const rawTar = (entries, end = END) => Buffer.concat([...entries.map(rawEntry), end]);

const XZ = ['-6', '-T1', '--check=crc64'];
const xz = (data, args = XZ) => execFileSync('xz', [...args, '-c'], { input: data, maxBuffer: 2 ** 30 });
function xzList(archive) {
  const dir = mkdtempSync(join(tmpdir(), 'ota-fixtures-'));
  try {
    writeFileSync(join(dir, 'x.xz'), archive);
    const out = spawnSync('xz', ['--robot', '--list', join(dir, 'x.xz')], { encoding: 'utf8' });
    const [, streams, blocks] = (out.stdout.split('\n').find(l => l.startsWith('file\t')) ?? '').split('\t');
    return { ok: out.status === 0, streams, blocks };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const xzDecodes = archive => spawnSync('xz', ['-dc'], { input: archive }).status === 0;

const INDEX =
  '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>OpenFrame</title></head><body></body></html>';
const index = { name: 'index.html', data: INDEX };
// A pax record is "<length> <key>=<value>\n", the length counting the whole record.
const PAX_PATH_RECORD = '22 path=../../evil.js\n';
assert.equal(PAX_PATH_RECORD.length, 22);
const LONG_PATH = `_next/static/chunks/app/(app)/${'d'.repeat(80)}/${'f'.repeat(60)}.js`;
const TYPICAL = [
  index,
  { name: '404.html', data: '<!DOCTYPE html><html><head></head><body>404</body></html>' },
  { name: 'devices/details/index.html', data: INDEX },
  { name: 'devices/details/__next.devices.details.txt', data: '' },
  { name: '_next/static/media/one-block.bin', data: 'b'.repeat(BLOCK) },
  { name: '_next/static/media/one-block-and-a-byte.bin', data: 'c'.repeat(BLOCK + 1) },
  { name: '_next/static/media/every-byte.bin', data: Buffer.from(Array.from({ length: 256 }, (_, i) => i)) },
  { name: `${'n'.repeat(97)}.js`, data: 'a name that fills its 100-byte field with no NUL after it' },
  {
    name: `${'p'.repeat(155)}/${'q'.repeat(96)}.js`,
    data: 'a 255-byte path whose 155-byte prefix has no NUL after it',
  },
  { name: LONG_PATH, data: 'export {};' },
];
const fileList = entries =>
  entries.map(({ name, prefix, path, data }) => {
    const bytes = Buffer.from(data ?? '');
    return { path: path ?? (prefix ? `${prefix}/${name}` : name), size: bytes.length, sha256: sha256(bytes) };
  });

function bundleCases() {
  const typicalTar = writeTar(TYPICAL.map(({ name, data }) => ({ name, data: Buffer.from(data) })));
  const typical = xz(typicalTar);
  const typicalFiles = fileList(TYPICAL);
  const env = `<script>window.__ENV = {"NEXT_PUBLIC_APP_MODE":"saas-tenant"};</script>`;
  const indexTar = rawTar([index]);
  const files = {};
  const cases = [];

  /** A case on `archive` as the bundle `<file>.tar.xz`; size and sha256 are the bundle's unless overridden. */
  function add(name, file, archive, expect, overrides = {}) {
    files[file] ??= archive;
    assert.ok(files[file].equals(archive), `${file} written twice with different bytes`);
    cases.push({
      name,
      bundle: `bundles/${file}.tar.xz`,
      size: archive.length,
      sha256: sha256(archive),
      ...overrides,
      expect,
    });
  }
  const tarCase = (name, file, entries, error, end) =>
    add(name, file, xz(rawTar(entries, end)), error ? { error } : { files: fileList(entries) });

  // accepted
  add('a typical bundle', 'typical', typical, { files: typicalFiles });
  tarCase(
    'zero blocks past the two that end the archive, as tar pads to 10 KiB',
    'record-padding',
    [index],
    null,
    Buffer.alloc(20 * BLOCK - BLOCK - BLOCK),
  );
  const multiBlock = xz(typicalTar, [...XZ, '--block-size=1024']);
  assert.ok(Number(xzList(multiBlock).blocks) > 1);
  add('one xz stream of several blocks', 'several-blocks', multiBlock, { files: typicalFiles });
  add(
    'a name field ends at its first NUL',
    'nul-in-name',
    xz(rawTar([{ name: 'index.html\0../../evil.js', data: INDEX }])),
    { files: fileList([{ path: 'index.html', data: INDEX }]) },
  );
  add(
    'a prefix field ends at its first NUL',
    'nul-in-prefix',
    xz(rawTar([index, { name: 'b.js', prefix: 'a\0garbage', data: '1' }])),
    { files: fileList([index, { path: 'a/b.js', data: '1' }]) },
  );
  tarCase(
    'header bytes besides magic, version, checksum, size, type, name and prefix are ignored, as is the data padding',
    'ignored-header-fields',
    [
      {
        ...index,
        pad: 0x41,
        extra: [
          [100, '0004777\0'], // mode: setuid, world-writable
          [108, 'zzzzzzz\0'], // uid
          [116, '-1\0'], // gid
          [136, '77777777777\0'], // mtime
          [157, '/etc/passwd'], // link name
          [265, 'root'], // user name
          [297, 'wheel'], // group name
          [329, 'devmajr\0'], // device numbers
          [500, 'tail bytes!!'], // the unused tail
        ],
      },
    ],
    null,
  );
  tarCase(
    'an index.html that mentions window.__ENV outside the element',
    'env-mentioned',
    [{ name: 'index.html', data: INDEX.replace('<body>', '<body><script>const env = window.__ENV;</script>') }],
    null,
  );

  // checked against the payload before anything is decompressed
  add(
    'a bundle one byte longer than the payload says',
    'typical',
    typical,
    { error: 'SIZE' },
    { size: typical.length - 1 },
  );
  add(
    'a bundle whose SHA-256 differs from the payload',
    'typical',
    typical,
    { error: 'SHA256' },
    { sha256: sha256('another bundle') },
  );
  add(
    'size is checked before SHA-256',
    'typical',
    typical,
    { error: 'SIZE' },
    { size: typical.length + 1, sha256: sha256('another bundle') },
  );
  add(
    'size is checked before anything is decompressed',
    'plain-tar',
    indexTar,
    { error: 'SIZE' },
    {
      size: indexTar.length + 1,
    },
  );
  add(
    'SHA-256 is checked before anything is decompressed',
    'plain-tar',
    indexTar,
    { error: 'SHA256' },
    {
      sha256: sha256('another bundle'),
    },
  );

  // the xz stream
  add('a plain tar, not compressed', 'plain-tar', indexTar, { error: 'XZ' });
  add('a gzip-compressed tar', 'gzip', gzipSync(indexTar), { error: 'XZ' });
  add('a tar in the legacy .lzma container', 'lzma-alone', xz(indexTar, ['--format=lzma', '-6']), { error: 'XZ' });
  add('an empty file', 'empty', Buffer.alloc(0), { error: 'XZ' });
  const second = xz(rawTar([{ name: 'evil.js', data: 'only xz sees me' }]));
  const twoStreams = Buffer.concat([xz(indexTar), second]);
  assert.equal(xzList(twoStreams).streams, '2');
  add('a second xz stream after the first, which Apple Compression would never read', 'two-streams', twoStreams, {
    error: 'XZ',
  });
  add('stream padding after the stream', 'stream-padding', Buffer.concat([xz(indexTar), Buffer.alloc(4)]), {
    error: 'XZ',
  });
  add('a truncated stream', 'truncated', typical.subarray(0, typical.length - 16), { error: 'XZ' });
  const flipped = Buffer.from(typical);
  flipped[Math.floor(flipped.length / 2)] ^= 0x01;
  assert.ok(!xzDecodes(flipped));
  add('a flipped bit inside the compressed data', 'flipped-bit', flipped, { error: 'XZ' });
  // The block's CRC64 sits right before the index, whose size the footer gives: (backward size + 1) * 4.
  const withBadCheck = archive => {
    const corrupt = Buffer.from(archive);
    const indexStart = corrupt.length - 12 - (corrupt.readUInt32LE(corrupt.length - 8) + 1) * 4;
    corrupt[indexStart - 1] ^= 0x01;
    assert.ok(xzList(corrupt).ok && !xzDecodes(corrupt), 'the index stays intact, the check fails');
    return corrupt;
  };
  add('a block whose CRC64 does not match, found only once it is all decoded', 'bad-check', withBadCheck(typical), {
    error: 'XZ',
  });

  // the tar inside
  tarCase('a header checksum off by one', 'checksum', [{ ...index, checksumDelta: 1 }], 'TAR');
  tarCase('GNU tar magic, not ustar', 'gnu-magic', [{ ...index, magic: 'ustar ', version: ' \0' }], 'TAR');
  tarCase('no magic at all (v7 tar)', 'v7', [{ ...index, magic: '\0'.repeat(6), version: '\0\0' }], 'TAR');
  tarCase('the ustar magic with a version other than 00', 'ustar-version', [{ ...index, version: '\0\0' }], 'TAR');
  tarCase(
    'a size field with a digit that is not octal',
    'size-not-octal',
    [{ ...index, sizeField: '00000000019\0' }],
    'TAR',
  );
  const base256 = Buffer.alloc(12);
  base256[0] = 0x80;
  base256.writeUInt32BE(INDEX.length, 8);
  tarCase('a GNU base-256 size field', 'size-base-256', [{ ...index, sizeField: base256 }], 'TAR');
  tarCase(
    'a size field padded with spaces, not zeros',
    'size-spaces',
    [{ ...index, sizeField: `${INDEX.length.toString(8).padStart(11, ' ')}\0` }],
    'TAR',
  );
  tarCase(
    'a size field with a + sign',
    'size-plus',
    [{ ...index, sizeField: `+${INDEX.length.toString(8).padStart(10, '0')}\0` }],
    'TAR',
  );
  tarCase(
    'a size field ending in a space, not a NUL',
    'size-space-end',
    [{ ...index, sizeField: `${INDEX.length.toString(8).padStart(11, '0')} ` }],
    'TAR',
  );
  tarCase(
    'a checksum field ending in two NULs, not a NUL and a space',
    'checksum-two-nuls',
    [{ ...index, checksumField: sum => `${sum.toString(8).padStart(6, '0')}\0\0` }],
    'TAR',
  );
  tarCase(
    'a checksum field of seven digits',
    'checksum-seven-digits',
    [{ ...index, checksumField: sum => `${sum.toString(8).padStart(7, '0')}\0` }],
    'TAR',
  );
  add(
    'an entry that runs past the end of the archive',
    'past-the-end',
    xz(rawTar([{ ...index, sizeField: '00000010000\0' }], Buffer.alloc(0))),
    { error: 'TAR' },
  );
  tarCase('no end-of-archive blocks', 'no-end', [index], 'TAR', Buffer.alloc(0));
  tarCase('one end-of-archive block, not two', 'one-end-block', [index], 'TAR', Buffer.alloc(BLOCK));
  tarCase(
    'bytes after the end-of-archive blocks',
    'trailing-bytes',
    [index],
    'TAR',
    Buffer.concat([END, Buffer.from('trailing')]),
  );
  tarCase(
    'zeros after the end that are not a whole block',
    'partial-block',
    [index],
    'TAR',
    Buffer.alloc(2 * BLOCK + 100),
  );
  tarCase(
    'an entry after the end-of-archive blocks',
    'entry-after-end',
    [index],
    'TAR',
    Buffer.concat([END, rawEntry({ name: 'evil.js', data: 'x' }), END]),
  );
  tarCase(
    'an entry after a single zero block',
    'entry-after-one-zero-block',
    [index],
    'TAR',
    Buffer.concat([Buffer.alloc(BLOCK), rawEntry({ name: 'evil.js', data: 'x' }), END]),
  );

  // the entries, in archive order
  tarCase(
    'a pax extended header',
    'pax',
    [{ name: 'PaxHeaders/index.html', type: 'x', data: PAX_PATH_RECORD }, index],
    'ENTRY_TYPE',
  );
  tarCase(
    'a directory entry: the type is checked before the name',
    'directory',
    [{ name: 'assets/', type: '5' }, index],
    'ENTRY_TYPE',
  );
  tarCase('a symbolic link', 'symlink', [index, { name: 'hosts', type: '2' }], 'ENTRY_TYPE');
  tarCase('a hard link', 'hard-link', [index, { name: 'copy.html', type: '1' }], 'ENTRY_TYPE');
  tarCase(
    'a GNU long-name entry',
    'gnu-long-name',
    [{ name: '././@LongLink', type: 'L', data: '../evil.js\0' }, index],
    'ENTRY_TYPE',
  );
  tarCase(
    'a NUL type byte, which pre-POSIX tars meant as a regular file',
    'nul-type',
    [{ ...index, type: '\0' }],
    'ENTRY_TYPE',
  );
  for (const [file, name, prefix] of [
    ['parent', '../evil.js'],
    ['parent-in-prefix', 'evil.js', '..'],
    ['absolute', '/evil.js'],
    ['empty-segment', 'a//b.js'],
    ['dot-segment', './index.html'],
    ['trailing-slash', 'assets/'],
    ['backslash', 'a\\b.js'],
    ['space', 'a b.js'],
    ['non-ascii', 'caf\xe9.js'],
    ['control', 'a\x01b.js'],
    ['delete', 'a\x7fb.js'],
    ['256-bytes', 'q'.repeat(100), 'p'.repeat(155)],
  ]) {
    const path = prefix ? `${prefix}/${name}` : name;
    const shown = path.length > 40 ? `${path.length} bytes` : JSON.stringify(path);
    const label = `an unsafe path: ${shown}${prefix && path.length <= 40 ? ` from the prefix field ${JSON.stringify(prefix)}` : ''}`;
    tarCase(label, `name-${file}`, [index, { name, prefix, data: 'x' }], 'ENTRY_NAME');
  }
  tarCase(
    'the first refusal in archive order wins',
    'first-refusal',
    [
      { name: '../evil.js', data: 'x' },
      { name: 'hosts', type: '2' },
    ],
    'ENTRY_NAME',
  );
  tarCase('the same path twice', 'duplicate', [index, index], 'DUPLICATE');
  tarCase(
    'the same path as name and as prefix + name',
    'duplicate-prefix',
    [index, { name: 'a/b.js', data: '1' }, { name: 'b.js', prefix: 'a', data: '2' }],
    'DUPLICATE',
  );
  tarCase(
    'a file where another path needs a directory',
    'file-then-directory',
    [index, { name: 'assets', data: 'x' }, { name: 'assets/a.js', data: '1' }],
    'DUPLICATE',
  );
  tarCase(
    'a file where an earlier path needed a directory',
    'directory-then-file',
    [index, { name: 'assets/a.js', data: '1' }, { name: 'assets', data: 'x' }],
    'DUPLICATE',
  );
  tarCase('two paths that differ only in case', 'case-only', [index, { name: 'Index.html', data: INDEX }], 'DUPLICATE');
  tarCase(
    'a file and a directory that differ only in case',
    'case-file-directory',
    [index, { name: 'Assets', data: 'x' }, { name: 'assets/a.js', data: '1' }],
    'DUPLICATE',
  );
  tarCase(
    'directories that differ only in case, holding different files, collide on nothing',
    'case-directories',
    [index, { name: 'App/a.js', data: '1' }, { name: 'app/b.js', data: '2' }],
    null,
  );

  // which fault is reported when there are several: XZ, then TAR, then the first entry, then the rest
  const symlink = { name: 'hosts', type: '2' };
  tarCase(
    'an entry fault, then bytes after the end blocks: TAR outranks it',
    'tar-over-entry',
    [symlink, index],
    'TAR',
    Buffer.concat([END, Buffer.from('trailing')]),
  );
  tarCase(
    'an entry fault in a tar without its end blocks: TAR outranks it',
    'truncated-tar-over-entry',
    [symlink, index],
    'TAR',
    Buffer.alloc(0),
  );
  add(
    'an entry fault in the first of two xz streams: XZ outranks it',
    'two-streams-over-entry',
    Buffer.concat([xz(rawTar([symlink, index])), second]),
    { error: 'XZ' },
  );
  add(
    'an entry fault, then a block CRC64 that does not match: XZ outranks it',
    'bad-check-over-entry',
    withBadCheck(xz(rawTar([symlink, ...TYPICAL.slice(0, 1)]))),
    { error: 'XZ' },
  );
  tarCase('an entry fault outranks a missing index.html', 'entry-over-no-index', [symlink], 'ENTRY_TYPE');
  add(
    'a header checksum fault in a stream whose block CRC64 fails: XZ outranks TAR',
    'bad-check-over-tar',
    withBadCheck(xz(rawTar([{ ...index, checksumDelta: 1 }]))),
    { error: 'XZ' },
  );
  add(
    'bytes after the end blocks in the first of two xz streams: XZ outranks TAR',
    'two-streams-over-tar',
    Buffer.concat([xz(rawTar([index], Buffer.concat([END, Buffer.from('trailing')]))), second]),
    { error: 'XZ' },
  );
  tarCase('a collision before a later entry fault', 'duplicate-over-entry', [index, index, symlink], 'DUPLICATE');
  tarCase(
    'within one entry, the name is checked before collisions',
    'name-over-duplicate',
    [index, { name: 'a/b.js', data: '1' }, { name: 'a/b.js/', data: '2' }],
    'ENTRY_NAME',
  );
  const envIndex = { name: 'index.html', data: INDEX.replace('<head>', `<head>${env}`) };
  tarCase(
    'an entry fault outranks an index.html carrying window.__ENV',
    'entry-over-env',
    [envIndex, symlink],
    'ENTRY_TYPE',
  );
  tarCase(
    'bytes after the end blocks outrank an index.html carrying window.__ENV',
    'tar-over-env',
    [envIndex],
    'TAR',
    Buffer.concat([END, Buffer.from('trailing')]),
  );

  // the bundle as a whole
  tarCase('no entries at all', 'no-entries', [], 'NO_INDEX');
  tarCase('index.html only in a subdirectory', 'no-root-index', [{ name: 'app/index.html', data: INDEX }], 'NO_INDEX');
  tarCase(
    'only Index.html: the root page is matched in its exact case',
    'no-index-case',
    [{ name: 'Index.html', data: INDEX }],
    'NO_INDEX',
  );
  tarCase(
    'an index.html that carries window.__ENV',
    'has-env',
    [{ name: 'index.html', data: INDEX.replace('<head>', `<head>${env}`) }],
    'HAS_ENV',
  );
  tarCase(
    'an index.html with the start of a window.__ENV element and no </script>',
    'has-env-unterminated',
    [{ name: 'index.html', data: INDEX.replace('</body>', '<script>window.__ENV = {</body>') }],
    'HAS_ENV',
  );
  const headless = INDEX.replace('<head>', '<head data-x="1">');
  tarCase(
    'an index.html without a literal <head>, which no shell could give its env',
    'no-head',
    [{ name: 'index.html', data: headless }],
    'NO_HEAD',
  );
  tarCase(
    'an index.html carrying window.__ENV and without a literal <head>: HAS_ENV first',
    'env-over-no-head',
    [{ name: 'index.html', data: headless.replace('<title>', `${env}<title>`) }],
    'HAS_ENV',
  );

  return { cases, files };
}

/** Everything this script writes, unwritten: ota-fixtures.test.mjs compares it with the committed files. */
export function buildFixtures() {
  const { cases, files } = bundleCases();
  return {
    keys: Object.fromEntries(
      Object.entries(KEYS).map(([name, { publicKey }]) => [
        name,
        { keyId: keyId(name), publicKey: publicKey.export({ type: 'spki', format: 'pem' }) },
      ]),
    ),
    manifestCases: manifestCases(),
    bundleCases: cases,
    bundles: files,
  };
}

function main() {
  const built = buildFixtures();
  // env-cases.json and decision-cases.json are hand-written and stay.
  rmSync(join(FIXTURES_DIR, 'bundles'), { recursive: true, force: true });
  mkdirSync(join(FIXTURES_DIR, 'bundles'), { recursive: true });
  writeFileSync(join(FIXTURES_DIR, 'fixture-keys.json'), json({ keys: built.keys }));
  writeFileSync(join(FIXTURES_DIR, 'manifest-cases.json'), json({ cases: built.manifestCases }));
  for (const [file, archive] of Object.entries(built.bundles))
    writeFileSync(join(FIXTURES_DIR, 'bundles', `${file}.tar.xz`), archive);
  writeFileSync(join(FIXTURES_DIR, 'bundle-cases.json'), json({ cases: built.bundleCases }));
  console.log(
    `✓ ${FIXTURES_DIR}: ${built.manifestCases.length} manifest cases, ${built.bundleCases.length} bundle cases, ` +
      `${Object.keys(built.bundles).length} bundles`,
  );
}

if (import.meta.main) main();
