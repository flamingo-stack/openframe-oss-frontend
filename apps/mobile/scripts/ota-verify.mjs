#!/usr/bin/env node
// Checks an over-the-air bundle the way the shells will (docs/ota.md): the
// signature of mobile.json against apps/mobile/ota/keys.json, its payload, and
// the tar.xz it names. With no --manifest, checks keys.json alone.
//
//   node apps/mobile/scripts/ota-verify.mjs [--keys <keys.json>]
//   node apps/mobile/scripts/ota-verify.mjs --manifest <mobile.json> [--bundle <bundle.tar.xz>] [--keys <keys.json>]
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { isRegularFile, isSafeEntryName, readTar, xzDecompress } from './ota-tar.mjs';

export const KEYS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'ota', 'keys.json');
export const KEY_SLOTS = ['current', 'next'];
export const MANIFEST_NAME = 'mobile.json';
export const FORMAT = 1;
// The element inject-env.mjs writes, matched the same way. A bundle that already has
// one would keep it over the env the shell copies in from its own built-in bundle.
export const ENV_SCRIPT = /<script>window\.__ENV/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PAYLOAD_KEYS = ['bridgeLevel', 'format', 'sha256', 'size', 'url', 'version'];

export const bundleName = version => `openframe-mobile-${version}.tar.xz`;

/** The id a manifest names its key by: the first 16 hex digits of SHA-256 over the key's SPKI DER. */
export function keyIdOf(key) {
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(spki).digest('hex').slice(0, 16);
}

/** Throws unless `key` (public or private) is an EC key on P-256, the only curve the shells verify. */
export function assertP256(key, what) {
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error(`${what} is not a P-256 key (${key.asymmetricKeyType} ${key.asymmetricKeyDetails?.namedCurve ?? ''})`);
  }
}

/** keys.json as `keyId -> public key`; both slots must hold distinct P-256 public keys. */
export function loadKeys(path = KEYS_PATH) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const keys = new Map();
  for (const slot of KEY_SLOTS) {
    if (typeof json[slot] !== 'string') throw new Error(`${path}: no "${slot}" key`);
    // createPublicKey also takes a private key and derives its public half, so a private key
    // pasted in by mistake would pass and be published with the repository.
    if (!json[slot].trimStart().startsWith('-----BEGIN PUBLIC KEY-----') || json[slot].includes('PRIVATE')) {
      throw new Error(`${path}: "${slot}" is not a PEM public key; never commit a private key`);
    }
    const key = createPublicKey(json[slot]);
    assertP256(key, `${path} "${slot}"`);
    keys.set(keyIdOf(key), key);
  }
  if (keys.size !== KEY_SLOTS.length) throw new Error(`${path}: "current" and "next" are the same key`);
  return keys;
}

function strictBase64(value, what) {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`${what} is not canonical base64`);
  return bytes;
}

/** The verified payload of a mobile.json envelope `{keyId, payload, signature}`. */
export function verifyManifest(text, keys) {
  const envelope = JSON.parse(text);
  for (const field of ['keyId', 'payload', 'signature']) {
    if (typeof envelope?.[field] !== 'string') throw new Error(`manifest has no "${field}"`);
  }
  const key = keys.get(envelope.keyId);
  if (!key) throw new Error(`manifest is signed by key ${envelope.keyId}, which keys.json does not hold`);
  const payloadBytes = strictBase64(envelope.payload, 'payload');
  const signature = strictBase64(envelope.signature, 'signature');
  if (!verify('sha256', payloadBytes, { key, dsaEncoding: 'der' }, signature)) {
    throw new Error(`signature does not verify with key ${envelope.keyId}`);
  }
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('payload is not an object');
  // Fields this version does not know are ignored, as the shells ignore them: optional additions
  // (delta archives, for one) can then join format 1 without breaking installed shells.
  const missing = PAYLOAD_KEYS.filter(key => !Object.hasOwn(payload, key));
  if (missing.length) throw new Error(`payload has no ${missing.join(', ')}`);
  if (payload.format !== FORMAT) throw new Error(`payload format ${payload.format}`);
  if (typeof payload.version !== 'string' || !VERSION.test(payload.version)) {
    throw new Error(`payload version ${JSON.stringify(payload.version)} is not x.y.z`);
  }
  if (!Number.isInteger(payload.bridgeLevel) || payload.bridgeLevel < 1) {
    throw new Error(`payload bridgeLevel ${payload.bridgeLevel}`);
  }
  if (!Number.isInteger(payload.size) || payload.size < 1) throw new Error(`payload size ${payload.size}`);
  if (typeof payload.sha256 !== 'string' || !SHA256.test(payload.sha256)) throw new Error('payload sha256');
  if (
    typeof payload.url !== 'string' ||
    !payload.url.startsWith('https://') ||
    !payload.url.endsWith(`/${bundleName(payload.version)}`)
  ) {
    throw new Error(`payload url ${JSON.stringify(payload.url)} does not name ${bundleName(payload.version)}`);
  }
  return payload;
}

/**
 * The checks a shell makes on a downloaded bundle once its bytes match the manifest:
 * a single xz stream holding a well-formed ustar archive of regular files with safe names,
 * an `index.html` at the root, and no `window.__ENV` in it. Returns the number of files.
 */
export function checkBundleContents(archive) {
  const names = new Set();
  let index = null;
  for (const entry of readTar(xzDecompress(archive))) {
    if (!isSafeEntryName(entry.name)) throw new Error(`unsafe file name ${JSON.stringify(entry.name)}`);
    if (!isRegularFile(entry)) throw new Error(`${entry.name} is not a regular file`);
    if (names.has(entry.name)) throw new Error(`${entry.name} appears twice`);
    names.add(entry.name);
    if (entry.name === 'index.html') index = entry.data.toString('utf8');
  }
  if (index === null) throw new Error('no index.html at the root of the bundle');
  if (ENV_SCRIPT.test(index)) throw new Error('index.html carries window.__ENV; the bundle must carry no env');
  return names.size;
}

/** Size and SHA-256 against the payload, then `checkBundleContents`. */
export function verifyBundle(archive, payload) {
  if (archive.length !== payload.size) {
    throw new Error(`bundle is ${archive.length} bytes, the manifest says ${payload.size}`);
  }
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (sha256 !== payload.sha256) throw new Error(`bundle SHA-256 is ${sha256}, the manifest says ${payload.sha256}`);
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
  const payload = verifyManifest(readFileSync(values.manifest, 'utf8'), keys);
  console.log(`✓ ${values.manifest}: ${JSON.stringify(payload)}`);
  if (values.bundle) {
    const files = verifyBundle(readFileSync(values.bundle), payload);
    console.log(`✓ ${values.bundle}: ${files} files`);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}
