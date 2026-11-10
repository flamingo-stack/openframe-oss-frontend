#!/usr/bin/env node
// Checks an over-the-air bundle the way the shells will (docs/ota.md): the
// signature of mobile.json against apps/mobile/ota/keys.json, its payload, and
// the tar.xz it names. With no --manifest, checks keys.json alone. Every refusal
// carries an OtaError code, the same one the shells give on fixtures/*-cases.json.
//
//   node apps/mobile/scripts/ota-verify.mjs [--keys <keys.json>]
//   node apps/mobile/scripts/ota-verify.mjs --manifest <mobile.json> [--bundle <bundle.tar.xz>] [--keys <keys.json>]
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { ENV_SCRIPT_START, HEAD } from './ota-env.mjs';
import { OtaError } from './ota-error.mjs';
import { isRegularFile, isSafeEntryName, readTar, xzDecompress } from './ota-tar.mjs';

export const KEYS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'ota', 'keys.json');
export const KEY_SLOTS = ['current', 'next'];
export const MANIFEST_NAME = 'mobile.json';
export const FORMAT = 1;
// Three parts of at most nine digits, so each fits a 32-bit int in every shell.
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PAYLOAD_KEYS = ['bridgeLevel', 'format', 'sha256', 'size', 'url', 'version'];

export const bundleName = version => `openframe-mobile-${version}.tar.xz`;

// The one SPKI encoding of a P-256 key every shell hashes alike (91 bytes): id-ecPublicKey with the named
// curve prime256v1, then an uncompressed point. An encoding with explicit curve parameters or a compressed
// point gets another id in CryptoKit, which re-encodes it, or does not load at all.
const P256_SPKI_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
const P256_SPKI_LENGTH = P256_SPKI_PREFIX.length + 65;

/** The id a manifest names its key by: the first 16 hex digits of SHA-256 over the key's SPKI DER. */
export function keyIdOf(key) {
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(spki).digest('hex').slice(0, 16);
}

/**
 * Throws unless `key` (public or private) is an EC key on P-256, the only curve the shells verify, whose
 * public half is in the 91-byte SPKI encoding.
 */
export function assertP256(key, what) {
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new OtaError(
      'KEYS',
      `${what} is not a P-256 key (${key.asymmetricKeyType} ${key.asymmetricKeyDetails?.namedCurve ?? ''})`,
    );
  }
  const spki = (key.type === 'public' ? key : createPublicKey(key)).export({ type: 'spki', format: 'der' });
  if (spki.length !== P256_SPKI_LENGTH || !spki.subarray(0, P256_SPKI_PREFIX.length).equals(P256_SPKI_PREFIX)) {
    throw new OtaError(
      'KEYS',
      `${what} is not in the named-curve, uncompressed SPKI encoding: make it with ota-keygen.mjs`,
    );
  }
}

/** keys.json as `keyId -> public key`; both slots must hold distinct P-256 public keys. */
export function loadKeys(path = KEYS_PATH) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const keys = new Map();
  for (const slot of KEY_SLOTS) {
    if (typeof json[slot] !== 'string') throw new OtaError('KEYS', `${path}: no "${slot}" key`);
    // createPublicKey also takes a private key and derives its public half, so a private key
    // pasted in by mistake would pass and be published with the repository.
    if (!json[slot].trimStart().startsWith('-----BEGIN PUBLIC KEY-----') || json[slot].includes('PRIVATE')) {
      throw new OtaError('KEYS', `${path}: "${slot}" is not a PEM public key; never commit a private key`);
    }
    const key = createPublicKey(json[slot]);
    assertP256(key, `${path} "${slot}"`);
    keys.set(keyIdOf(key), key);
  }
  if (keys.size !== KEY_SLOTS.length) throw new OtaError('KEYS', `${path}: "current" and "next" are the same key`);
  return keys;
}

/** `bytes` as UTF-8, refusing (`code`) what is not valid UTF-8 rather than replacing it. */
export function strictUtf8(bytes, code, what) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new OtaError(code, `${what} is not UTF-8`);
  }
}

function strictBase64(value, what) {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new OtaError('ENVELOPE', `${what} is not canonical base64`);
  return bytes;
}

function parseObject(text, code, what) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new OtaError(code, `${what} is not JSON`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OtaError(code, `${what} is not a JSON object`);
  }
  return value;
}

/**
 * The verified payload of a mobile.json envelope `{keyId, payload, signature}`. The checks run in
 * this order, and fixtures/manifest-cases.json holds the shells to it: the envelope (ENVELOPE), the
 * key id (UNKNOWN_KEY), the signature over the exact payload bytes (SIGNATURE), the payload (PAYLOAD).
 */
export function verifyManifest(text, keys) {
  const envelope = parseObject(text, 'ENVELOPE', 'manifest');
  for (const field of ['keyId', 'payload', 'signature']) {
    if (typeof envelope[field] !== 'string') throw new OtaError('ENVELOPE', `manifest has no "${field}"`);
  }
  const payloadBytes = strictBase64(envelope.payload, 'payload');
  const signature = strictBase64(envelope.signature, 'signature');
  const key = keys.get(envelope.keyId);
  if (!key)
    throw new OtaError('UNKNOWN_KEY', `manifest is signed by key ${envelope.keyId}, which keys.json does not hold`);
  let valid = false;
  try {
    valid = verify('sha256', payloadBytes, { key, dsaEncoding: 'der' }, signature);
  } catch {
    // A signature that is not DER at all may throw rather than fail; it does not verify either way.
  }
  if (!valid) throw new OtaError('SIGNATURE', `signature does not verify with key ${envelope.keyId}`);
  const payload = parseObject(strictUtf8(payloadBytes, 'PAYLOAD', 'payload'), 'PAYLOAD', 'payload');
  // Fields this version does not know are ignored, as the shells ignore them: optional additions
  // (delta archives, for one) can then join format 1 without breaking installed shells.
  const missing = PAYLOAD_KEYS.filter(key => !Object.hasOwn(payload, key));
  if (missing.length) throw new OtaError('PAYLOAD', `payload has no ${missing.join(', ')}`);
  if (payload.format !== FORMAT) throw new OtaError('PAYLOAD', `payload format ${payload.format}`);
  if (typeof payload.version !== 'string' || !VERSION.test(payload.version)) {
    throw new OtaError('PAYLOAD', `payload version ${JSON.stringify(payload.version)} is not x.y.z`);
  }
  if (!Number.isInteger(payload.bridgeLevel) || payload.bridgeLevel < 1) {
    throw new OtaError('PAYLOAD', `payload bridgeLevel ${payload.bridgeLevel}`);
  }
  if (!Number.isInteger(payload.size) || payload.size < 1)
    throw new OtaError('PAYLOAD', `payload size ${payload.size}`);
  if (typeof payload.sha256 !== 'string' || !SHA256.test(payload.sha256))
    throw new OtaError('PAYLOAD', 'payload sha256');
  if (
    typeof payload.url !== 'string' ||
    !payload.url.startsWith('https://') ||
    // Compared as text, never parsed: no query or fragment can carry the file name instead.
    /[?#]/.test(payload.url) ||
    !payload.url.endsWith(`/${bundleName(payload.version)}`)
  ) {
    throw new OtaError(
      'PAYLOAD',
      `payload url ${JSON.stringify(payload.url)} does not name ${bundleName(payload.version)}`,
    );
  }
  return payload;
}

/**
 * The checks a shell makes on a downloaded bundle once its bytes match the manifest
 * (fixtures/bundle-cases.json): exactly one xz stream (XZ) holding a well-formed ustar archive
 * (TAR); then entry by entry a regular file (ENTRY_TYPE) at a safe (ENTRY_NAME) path that collides
 * with no other (DUPLICATE); last an `index.html` at the root (NO_INDEX) without the literal
 * `<script>window.__ENV` (HAS_ENV) and with the literal `<head>` the env goes after (NO_HEAD), so
 * the release refuses what the shells' env copy would. When a bundle has several faults the code is
 * of the first of those groups that has one, and among entries of the first entry in archive order:
 * a shell that decodes and reads as it goes stops checking entries after its first entry fault but
 * reads the tar on to its end, since a TAR fault further on outranks it; after a TAR fault it stops
 * reading the tar; either way it drains the xz stream to its end, since an XZ fault outranks both.
 * Returns the files as
 * `{path, size, sha256}`, in archive order.
 */
export function checkBundleContents(archive) {
  const files = [];
  // Lower-cased: the iOS Simulator's volume ignores case, so Index.html would land on index.html.
  const paths = new Set();
  const dirs = new Set();
  let index = null;
  for (const entry of readTar(xzDecompress(archive))) {
    if (!isRegularFile(entry)) throw new OtaError('ENTRY_TYPE', `${entry.name} is not a regular file`);
    if (!isSafeEntryName(entry.name))
      throw new OtaError('ENTRY_NAME', `unsafe file name ${JSON.stringify(entry.name)}`);
    const key = entry.name.toLowerCase();
    const parents = key
      .split('/')
      .slice(0, -1)
      .map((_, i, segments) => segments.slice(0, i + 1).join('/'));
    if (paths.has(key) || dirs.has(key) || parents.some(dir => paths.has(dir))) {
      throw new OtaError('DUPLICATE', `${entry.name} collides with another path`);
    }
    paths.add(key);
    for (const dir of parents) dirs.add(dir);
    if (entry.name === 'index.html') index = entry.data.toString('utf8');
    files.push({
      path: entry.name,
      size: entry.data.length,
      sha256: createHash('sha256').update(entry.data).digest('hex'),
    });
  }
  if (index === null) throw new OtaError('NO_INDEX', 'no index.html at the root of the bundle');
  if (ENV_SCRIPT_START.test(index)) {
    throw new OtaError('HAS_ENV', 'index.html carries window.__ENV; the bundle must carry no env');
  }
  if (!index.includes(HEAD))
    throw new OtaError('NO_HEAD', 'index.html has no <head> for the shells to put the env after');
  return files;
}

/** Size (SIZE) and SHA-256 (SHA256) against the payload, then `checkBundleContents`. */
export function verifyBundle(archive, payload) {
  if (archive.length !== payload.size) {
    throw new OtaError('SIZE', `bundle is ${archive.length} bytes, the manifest says ${payload.size}`);
  }
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (sha256 !== payload.sha256) {
    throw new OtaError('SHA256', `bundle SHA-256 is ${sha256}, the manifest says ${payload.sha256}`);
  }
  return checkBundleContents(archive);
}

function main() {
  const { values } = parseArgs({
    options: { manifest: { type: 'string' }, bundle: { type: 'string' }, keys: { type: 'string', default: KEYS_PATH } },
  });
  const keys = loadKeys(values.keys);
  if (!values.manifest) {
    console.log(`✓ ${values.keys}: ${[...keys.keys()].map((id, i) => `${KEY_SLOTS[i]} ${id}`).join(', ')}`);
    return;
  }
  const payload = verifyManifest(strictUtf8(readFileSync(values.manifest), 'ENVELOPE', 'manifest'), keys);
  console.log(`✓ ${values.manifest}: ${JSON.stringify(payload)}`);
  if (values.bundle) {
    const files = verifyBundle(readFileSync(values.bundle), payload);
    console.log(`✓ ${values.bundle}: ${files.length} files`);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`✗ ${error instanceof OtaError ? `${error.code}: ` : ''}${error.message}`);
    process.exit(1);
  }
}
