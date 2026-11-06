// node --test apps/mobile/scripts/ota.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { pack, readBridgeLevel } from './ota-pack.mjs';
import { checkBundleContents, keyIdOf, loadKeys, verifyBundle, verifyManifest } from './ota-verify.mjs';
import { readZip, writeZip } from './ota-zip.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const VERSION = '1.2.3';
const URL_BASE = `https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/${VERSION}`;

const p256 = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = key => key.export(key.type === 'private' ? { type: 'pkcs8', format: 'pem' } : { type: 'spki', format: 'pem' });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ota-test-'));
  const dist = join(dir, 'dist');
  const files = {
    'index.html': '<!doctype html><html><head><title>OpenFrame</title></head><body></body></html>',
    '404.html': '<!doctype html><html><head></head><body>404</body></html>',
    '_next/static/chunks/app/(app)/help-center/legal/[docType]/page-0a1b.js': 'console.log(1);'.repeat(500),
    '_next/static/media/logo.svg': '<svg/>',
    'devices/details/index.txt': '',
  };
  for (const [name, content] of Object.entries(files)) {
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

test('pack writes a bundle and a manifest that verify against keys.json', () => {
  const f = fixture();
  const { zipPath, manifestPath, payload } = packFixture(f);
  const verified = verifyManifest(readFileSync(manifestPath, 'utf8'), loadKeys(f.keysPath));
  assert.deepEqual(verified, payload);
  assert.equal(verified.url, `${URL_BASE}/openframe-mobile-${VERSION}.zip`);
  assert.equal(verified.bridgeLevel, 1);
  assert.equal(verifyBundle(readFileSync(zipPath), verified), Object.keys(f.files).length);
});

test('the bundle holds every file of the export, byte for byte, and nothing else', () => {
  const f = fixture();
  const entries = readZip(readFileSync(packFixture(f).zipPath));
  assert.deepEqual(entries.map(e => e.name), Object.keys(f.files).sort());
  for (const entry of entries) assert.equal(entry.data.toString('utf8'), f.files[entry.name]);
});

test('the same export packs to the same bytes', () => {
  const f = fixture();
  const first = readFileSync(packFixture(f).zipPath);
  const second = readFileSync(packFixture(f, { outDir: join(f.dir, 'again') }).zipPath);
  assert.ok(first.equals(second));
});

test('a standard unzip reads the bundle', { skip: spawnSync('unzip', ['-v']).error && 'no unzip on this machine' }, () => {
  const f = fixture();
  const { zipPath } = packFixture(f);
  execFileSync('unzip', ['-tq', zipPath]);
  const out = join(f.dir, 'unzipped');
  execFileSync('unzip', ['-q', zipPath, '-d', out]);
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
    [{ ...payload, sha256: 'abc' }, /sha256/],
    [{ ...payload, extra: true }, /fields/],
  ];
  for (const [bad, error] of cases) assert.throws(() => verifyManifest(envelope(bad, f.current.privateKey), keys), error);
});

test('a bundle that differs from its manifest is refused', () => {
  const f = fixture();
  const { zipPath, payload } = packFixture(f);
  const zip = readFileSync(zipPath);
  zip[100] ^= 0xff;
  assert.throws(() => verifyBundle(zip, payload), /SHA-256/);
  assert.throws(() => verifyBundle(Buffer.concat([zip, Buffer.from([0])]), payload), /bytes/);
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

test('writeZip refuses names a shell must not write', () => {
  for (const name of ['../evil', '/etc/passwd', 'a//b', 'a/./b', 'dir/', 'a\\b', 'with space', 'ü.txt']) {
    assert.throws(() => writeZip([{ name, data: Buffer.from('x') }]), /unsafe file name/, name);
  }
  assert.throws(() => writeZip([{ name: 'index.html', data: Buffer.alloc(0) }, { name: 'index.html', data: Buffer.alloc(0) }]), /duplicate/);
});

test('a bundle entry that is not a regular file is refused', () => {
  const zip = writeZip([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  zip.writeUInt32LE((0o120777 << 16) >>> 0, central + 38);
  assert.throws(() => checkBundleContents(zip), /not a regular file/);
});

test('a local header naming another file than the central directory is refused', () => {
  const zip = writeZip([{ name: 'index.html', data: Buffer.from('<html></html>') }]);
  zip.write('INDEX', 30, 'ascii');
  assert.throws(() => readZip(zip), /local header names another file/);
});

test('loadKeys needs both slots, distinct, on P-256', () => {
  const f = fixture();
  const write = json => {
    writeFileSync(f.keysPath, JSON.stringify(json));
    return f.keysPath;
  };
  assert.throws(() => loadKeys(write({ current: pem(f.current.publicKey) })), /no "next" key/);
  assert.throws(() => loadKeys(write({ current: pem(f.current.publicKey), next: pem(f.current.publicKey) })), /same key/);
  const ed25519 = generateKeyPairSync('ed25519').publicKey;
  assert.throws(() => loadKeys(write({ current: pem(ed25519), next: pem(f.next.publicKey) })), /not a P-256 key/);
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
