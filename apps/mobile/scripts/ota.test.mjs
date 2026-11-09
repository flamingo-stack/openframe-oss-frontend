// node --test apps/mobile/scripts/ota.test.mjs   (needs the xz and tar tools)
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEFT_OUT, pack, readBridgeLevel } from './ota-pack.mjs';
import { readTar, writeTar, xzDecompress } from './ota-tar.mjs';
import { checkBundleContents, keyIdOf, loadKeys, verifyBundle, verifyManifest } from './ota-verify.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const VERSION = '1.2.3';
const URL_BASE = `https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/${VERSION}`;
// Longer than ustar's 100-byte name field, so it goes through the 155-byte prefix.
const LONG_PATH = `_next/static/chunks/app/(app)/${'d'.repeat(80)}/${'f'.repeat(60)}.js`;

const p256 = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = key => key.export(key.type === 'private' ? { type: 'pkcs8', format: 'pem' } : { type: 'spki', format: 'pem' });
const xzCompress = data => execFileSync('xz', ['-6', '-T1', '-c'], { input: data, maxBuffer: 2 ** 30 });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ota-test-'));
  const dist = join(dir, 'dist');
  const files = {
    'index.html': '<!doctype html><html><head><title>OpenFrame</title></head><body></body></html>',
    '404.html': '<!doctype html><html><head></head><body>404</body></html>',
    '_next/static/chunks/app/(app)/help-center/legal/[docType]/page-0a1b.js': 'console.log(1);'.repeat(500),
    '_next/static/media/logo.svg': '<svg/>',
    'devices/details/index.txt': '',
    [LONG_PATH]: 'export {};',
  };
  const leftOut = Object.fromEntries([...LEFT_OUT].map(name => [name, 'PNG']));
  for (const [name, content] of Object.entries({ ...files, ...leftOut })) {
    mkdirSync(dirname(join(dist, name)), { recursive: true });
    writeFileSync(join(dist, name), content);
  }
  const current = p256();
  const next = p256();
  const keysPath = join(dir, 'keys.json');
  writeFileSync(keysPath, JSON.stringify({ current: pem(current.publicKey), next: pem(next.publicKey) }));
  return { dir, dist, files, current, next, keysPath };
}

function packFixture(f, overrides = {}) {
  return pack({
    dist: f.dist,
    version: VERSION,
    urlBase: URL_BASE,
    outDir: join(f.dir, 'out'),
    privateKeyPem: pem(f.current.privateKey),
    bridgeLevel: 1,
    ...overrides,
  });
}

/** A mobile.json whose payload is `payload`, signed by `privateKey`. */
function envelope(payload, privateKey) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return JSON.stringify({
    keyId: keyIdOf(privateKey),
    payload: bytes.toString('base64'),
    signature: sign('sha256', bytes, { key: privateKey, dsaEncoding: 'der' }).toString('base64'),
  });
}

/** Rewrites a ustar header's checksum after a test has edited the header. */
function fixChecksum(tar, offset) {
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : tar[offset + i];
  tar.write(`${sum.toString(8).padStart(6, '0')}\0 `, offset + 148, 'ascii');
}

test('pack writes a bundle and a manifest that verify against keys.json', () => {
  const f = fixture();
  const { bundlePath, manifestPath, payload } = packFixture(f);
  const verified = verifyManifest(readFileSync(manifestPath, 'utf8'), loadKeys(f.keysPath));
  assert.deepEqual(verified, payload);
  assert.equal(verified.url, `${URL_BASE}/openframe-mobile-${VERSION}.tar.xz`);
  assert.equal(verified.bridgeLevel, 1);
  assert.equal(verifyBundle(readFileSync(bundlePath), verified), Object.keys(f.files).length);
});

test('the bundle holds every file of the export byte for byte, minus the social preview images', () => {
  const f = fixture();
  const entries = readTar(xzDecompress(readFileSync(packFixture(f).bundlePath)));
  assert.deepEqual(entries.map(e => e.name), Object.keys(f.files).sort());
  for (const entry of entries) assert.equal(entry.data.toString('utf8'), f.files[entry.name]);
});

test('the same export packs to the same bytes', () => {
  const f = fixture();
  const first = readFileSync(packFixture(f).bundlePath);
  const second = readFileSync(packFixture(f, { outDir: join(f.dir, 'again') }).bundlePath);
  assert.ok(first.equals(second));
});

test('the system xz and tar read the bundle', () => {
  const f = fixture();
  const { bundlePath } = packFixture(f);
  execFileSync('xz', ['-t', bundlePath]);
  const out = join(f.dir, 'extracted');
  mkdirSync(out);
  execFileSync('tar', ['-xJf', bundlePath, '-C', out]);
  for (const [name, content] of Object.entries(f.files)) assert.equal(readFileSync(join(out, name), 'utf8'), content);
});

test('the manifest is refused when signed by a key keys.json does not hold', () => {
  const f = fixture();
  const { payload } = packFixture(f);
  assert.throws(() => verifyManifest(envelope(payload, p256().privateKey), loadKeys(f.keysPath)), /does not hold/);
});

test('the "next" key verifies too', () => {
  const f = fixture();
  const { payload } = packFixture(f);
  assert.deepEqual(verifyManifest(envelope(payload, f.next.privateKey), loadKeys(f.keysPath)), payload);
});

test('a payload changed after signing is refused', () => {
  const f = fixture();
  const manifest = JSON.parse(readFileSync(packFixture(f).manifestPath, 'utf8'));
  const payload = JSON.parse(Buffer.from(manifest.payload, 'base64').toString('utf8'));
  manifest.payload = Buffer.from(JSON.stringify({ ...payload, version: '9.9.9' })).toString('base64');
  assert.throws(() => verifyManifest(JSON.stringify(manifest), loadKeys(f.keysPath)), /signature does not verify/);
});

test('a payload with a bad field is refused even when signed', () => {
  const f = fixture();
  const keys = loadKeys(f.keysPath);
  const { payload } = packFixture(f);
  const cases = [
    [{ ...payload, version: '1.2' }, /not x\.y\.z/],
    [{ ...payload, version: '01.2.3' }, /not x\.y\.z/],
    [{ ...payload, format: 2 }, /format/],
    [{ ...payload, bridgeLevel: 0 }, /bridgeLevel/],
    [{ ...payload, url: payload.url.replace('https:', 'http:') }, /url/],
    [{ ...payload, url: payload.url.replace(`openframe-mobile-${VERSION}`, 'openframe-mobile-1.2.4') }, /url/],
    [{ ...payload, url: payload.url.replace('.tar.xz', '.zip') }, /url/],
    [{ ...payload, sha256: 'abc' }, /sha256/],
    [{ ...payload, size: undefined }, /payload has no size/],
  ];
  for (const [bad, error] of cases) assert.throws(() => verifyManifest(envelope(bad, f.current.privateKey), keys), error);
});

test('a payload field this version does not know is ignored, as the shells will ignore it', () => {
  const f = fixture();
  const { payload } = packFixture(f);
  const extended = { ...payload, deltas: { '1.2.2': { url: 'https://example.test/d.tar.xz' } } };
  assert.deepEqual(verifyManifest(envelope(extended, f.current.privateKey), loadKeys(f.keysPath)), extended);
});

test('a bundle that differs from its manifest is refused', () => {
  const f = fixture();
  const { bundlePath, payload } = packFixture(f);
  const archive = readFileSync(bundlePath);
  archive[100] ^= 0xff;
  assert.throws(() => verifyBundle(archive, payload), /SHA-256/);
  assert.throws(() => verifyBundle(Buffer.concat([archive, Buffer.from([0])]), payload), /bytes/);
});

test('a bundle that is not a single intact xz stream is refused', () => {
  const tar = writeTar([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  const archive = xzCompress(tar);
  archive[archive.length - 20] ^= 0xff;
  assert.throws(() => checkBundleContents(archive), /xz/);
  assert.throws(() => checkBundleContents(tar), /xz/);
});

test('pack refuses an export that carries window.__ENV', () => {
  const f = fixture();
  writeFileSync(join(f.dist, 'index.html'), '<html><head><script>window.__ENV = {};</script></head></html>');
  assert.throws(() => packFixture(f), /window\.__ENV/);
});

test('pack refuses an export without index.html', () => {
  const f = fixture();
  rmSync(join(f.dist, 'index.html'));
  assert.throws(() => packFixture(f), /no index\.html/);
});

test('pack refuses an export with a symlink', () => {
  const f = fixture();
  symlinkSync('/etc/hosts', join(f.dist, 'hosts'));
  assert.throws(() => packFixture(f), /not a regular file/);
});

test('pack refuses a key that is not P-256, and no key at all', () => {
  const f = fixture();
  const p384 = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey;
  assert.throws(() => packFixture(f, { privateKeyPem: pem(p384) }), /not a P-256 key/);
  assert.throws(() => packFixture(f, { privateKeyPem: '' }), /MOBILE_OTA_SIGNING_KEY is empty/);
});

test('pack refuses a version the shells cannot compare', () => {
  const f = fixture();
  assert.throws(() => packFixture(f, { version: 'main-46fad6b' }), /not x\.y\.z/);
});

test('writeTar refuses names a shell must not write, and paths ustar cannot hold', () => {
  for (const name of ['../evil', '/etc/passwd', 'a//b', 'a/./b', 'dir/', 'a\\b', 'with space', 'ü.txt', 'a/'.repeat(128) + 'b']) {
    assert.throws(() => writeTar([{ name, data: Buffer.from('x') }]), /unsafe file name/, name);
  }
  assert.throws(() => writeTar([{ name: 'x'.repeat(101), data: Buffer.from('x') }]), /too long for the bundle's ustar format/);
  // A Next RSC payload file named after a long route: the path fits in 255 bytes, its name not in 100.
  assert.throws(() => writeTar([{ name: `route/__next.${'r'.repeat(90)}.txt`, data: Buffer.from('x') }]), /too long/);
  assert.throws(
    () => writeTar([{ name: 'index.html', data: Buffer.alloc(0) }, { name: 'index.html', data: Buffer.alloc(0) }]),
    /duplicate/,
  );
});

test('a bundle entry that is not a regular file is refused', () => {
  const tar = writeTar([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  tar.write('2', 156, 'ascii');
  fixChecksum(tar, 0);
  assert.throws(() => checkBundleContents(xzCompress(tar)), /not a regular file/);
});

test('readTar refuses a bad header checksum and anything after the end blocks', () => {
  const tar = writeTar([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  const corrupt = Buffer.from(tar);
  corrupt.write('X', 0, 'ascii');
  assert.throws(() => readTar(corrupt), /checksum/);
  assert.throws(() => readTar(Buffer.concat([tar, Buffer.from('trailing')])), /after the last entry/);
  assert.throws(() => readTar(tar.subarray(0, 1024)), /end-of-archive|after the last entry/);
});

test('readTar refuses a size field that is not plain octal instead of looping on it', () => {
  for (const size of ['-0001750\0', '00000001x8\0', '\0']) {
    const tar = writeTar([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
    tar.fill(0, 124, 136);
    tar.write(size, 124, 'ascii');
    fixChecksum(tar, 0);
    assert.throws(() => readTar(tar), /not octal/, JSON.stringify(size));
  }
});

test('loadKeys needs both slots, distinct, on P-256, and public halves only', () => {
  const f = fixture();
  const write = json => {
    writeFileSync(f.keysPath, JSON.stringify(json));
    return f.keysPath;
  };
  assert.throws(() => loadKeys(write({ current: pem(f.current.publicKey) })), /no "next" key/);
  assert.throws(() => loadKeys(write({ current: pem(f.current.publicKey), next: pem(f.current.publicKey) })), /same key/);
  const ed25519 = generateKeyPairSync('ed25519').publicKey;
  assert.throws(() => loadKeys(write({ current: pem(ed25519), next: pem(f.next.publicKey) })), /not a P-256 key/);
  assert.throws(
    () => loadKeys(write({ current: pem(f.current.privateKey), next: pem(f.next.publicKey) })),
    /never commit a private key/,
  );
});

test('REQUIRED_BRIDGE_LEVEL is readable from native-shell.ts', () => {
  assert.ok(Number.isInteger(readBridgeLevel()) && readBridgeLevel() >= 1);
});

test('keygen fills a slot, keeps the private key outside the repository, and replaces nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ota-keygen-'));
  const keysPath = join(dir, 'ota', 'keys.json'); // a fresh clone has no apps/mobile/ota/ yet
  const keygen = (...args) =>
    spawnSync(process.execPath, [join(SCRIPTS, 'ota-keygen.mjs'), ...args, '--keys', keysPath], { encoding: 'utf8' });

  assert.equal(keygen('current', join(dir, 'current.pem')).status, 0);
  assert.equal(keygen('next', join(dir, 'next.pem')).status, 0);
  assert.equal(statSync(join(dir, 'current.pem')).mode & 0o777, 0o600);
  const keys = loadKeys(keysPath);
  assert.equal(keys.size, 2);
  assert.ok(keys.has(keyIdOf(readFileSync(join(dir, 'current.pem'), 'utf8'))));

  assert.match(keygen('current', join(dir, 'other.pem')).stderr, /already has a "current" key/);
  assert.match(keygen('next', join(SCRIPTS, 'leak.pem')).stderr, /inside the repository/);
  assert.match(keygen('later', join(dir, 'x.pem')).stderr, /usage/);
});
