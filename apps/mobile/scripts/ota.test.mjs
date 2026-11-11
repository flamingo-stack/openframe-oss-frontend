// npm test   (in apps/mobile; needs the xz and tar tools)
//
// What the shared cases (ota-fixtures.test.mjs) cannot hold: packing a real export, keygen,
// keys.json, inject-env and the CLIs. Every format rule is a case there instead.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { copyEnvScript, envScript, insertEnvScript } from './ota-env.mjs';
import { LEFT_OUT, pack, readBridgeLevel } from './ota-pack.mjs';
import { MAX_XZ_DECODER_MEMORY, packTarXz, readTar, writeTar, xzDecompress } from './ota-tar.mjs';
import { checkBundleContents, keyIdOf, loadKeys, verifyBundle, verifyManifest } from './ota-verify.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const VERSION = '1.2.3';
const URL_BASE = `https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/${VERSION}`;
// Longer than ustar's 100-byte name field, so it goes through the 155-byte prefix.
const LONG_PATH = `_next/static/chunks/app/(app)/${'d'.repeat(80)}/${'f'.repeat(60)}.js`;

const p256 = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = key =>
  key.export(key.type === 'private' ? { type: 'pkcs8', format: 'pem' } : { type: 'spki', format: 'pem' });

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function fixture() {
  const dir = tempDir('ota-test-');
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

const run = (script, ...args) => spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8' });

test('pack writes a bundle and a manifest that verify against keys.json', () => {
  const f = fixture();
  const { bundlePath, manifestPath, payload } = packFixture(f);
  const verified = verifyManifest(readFileSync(manifestPath, 'utf8'), loadKeys(f.keysPath));
  assert.deepEqual(verified, payload);
  assert.equal(verified.url, `${URL_BASE}/openframe-mobile-${VERSION}.tar.xz`);
  assert.equal(verified.bridgeLevel, 1);
  assert.deepEqual(
    verifyBundle(readFileSync(bundlePath), verified).map(file => file.path),
    Object.keys(f.files).sort(),
  );
  const cli = run('ota-verify.mjs', '--keys', f.keysPath, '--manifest', manifestPath, '--bundle', bundlePath);
  assert.equal(cli.status, 0, cli.stderr);
});

test('the bundle holds every file of the export byte for byte, minus the social preview images', () => {
  const f = fixture();
  const entries = readTar(xzDecompress(readFileSync(packFixture(f).bundlePath)));
  assert.deepEqual(
    entries.map(e => e.name),
    Object.keys(f.files).sort(),
  );
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

test('a corrupt stream larger than the pipe buffer is refused as XZ, not taken for a broken host', () => {
  // Random bytes do not compress, so xz quits on the flipped byte with most of its input unread:
  // spawnSync reports EPIPE, which is the bundle's fault. The shared cases are too small for it.
  const archive = packTarXz([
    { name: 'index.html', data: Buffer.from('<html><head></head></html>') },
    { name: 'noise.bin', data: randomBytes(1 << 20) },
  ]);
  archive[200] ^= 0xff;
  assert.throws(() => checkBundleContents(archive), { code: 'XZ' });
});

test('pack refuses an export that carries window.__ENV', () => {
  const f = fixture();
  writeFileSync(join(f.dist, 'index.html'), `<html><head>${envScript({})}</head></html>`);
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
  assert.throws(() => packFixture(f, { privateKeyPem: pem(p384) }), { code: 'KEYS', message: /not a P-256 key/ });
  assert.throws(() => packFixture(f, { privateKeyPem: '' }), /MOBILE_OTA_SIGNING_KEY is empty/);
});

test('pack refuses a version the shells cannot compare', () => {
  const f = fixture();
  assert.throws(() => packFixture(f, { version: 'main-46fad6b' }), { code: 'PAYLOAD', message: /not x\.y\.z/ });
});

test('writeTar refuses names a shell must not write, and paths ustar cannot hold', () => {
  for (const name of [
    '../evil',
    '/etc/passwd',
    'a//b',
    'a/./b',
    'dir/',
    'a\\b',
    'with space',
    'ü.txt',
    'a/'.repeat(128) + 'b',
  ]) {
    assert.throws(() => writeTar([{ name, data: Buffer.from('x') }]), { code: 'ENTRY_NAME' }, name);
  }
  assert.throws(
    () => writeTar([{ name: 'x'.repeat(101), data: Buffer.from('x') }]),
    /too long for the bundle's ustar format/,
  );
  // A Next RSC payload file named after a long route: the path fits in 255 bytes, its name not in 100.
  assert.throws(() => writeTar([{ name: `route/__next.${'r'.repeat(90)}.txt`, data: Buffer.from('x') }]), /too long/);
});

test('loadKeys needs both slots, distinct, on P-256, public halves only, in JSON that parses', () => {
  const f = fixture();
  const write = json => {
    writeFileSync(f.keysPath, typeof json === 'string' ? json : JSON.stringify(json));
    return f.keysPath;
  };
  assert.throws(() => loadKeys(write({ current: pem(f.current.publicKey) })), /no "next" key/);
  assert.throws(
    () => loadKeys(write({ current: pem(f.current.publicKey), next: pem(f.current.publicKey) })),
    /same key/,
  );
  const ed25519 = generateKeyPairSync('ed25519').publicKey;
  assert.throws(() => loadKeys(write({ current: pem(ed25519), next: pem(f.next.publicKey) })), /not a P-256 key/);
  assert.throws(
    () => loadKeys(write({ current: pem(f.current.privateKey), next: pem(f.next.publicKey) })),
    /never commit a private key/,
  );
  assert.throws(() => loadKeys(write('{"current":')), { code: 'KEYS' });
  assert.throws(() => loadKeys(write('null')), { code: 'KEYS', message: /not a JSON object/ });
  const broken = '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n';
  assert.throws(() => loadKeys(write({ current: broken, next: pem(f.next.publicKey) })), {
    code: 'KEYS',
    message: /does not load/,
  });
});

test('loadKeys refuses a P-256 key in any SPKI encoding but the named-curve, uncompressed one', () => {
  const f = fixture();
  const spki = f.current.publicKey.export({ type: 'spki', format: 'der' });
  const [x, y] = [spki.subarray(27, 59), spki.subarray(59, 91)];
  // The same key with a compressed point: CryptoKit cannot load it, and its id would differ.
  const compressed = Buffer.concat([
    Buffer.from('3039301306072a8648ce3d020106082a8648ce3d030107032200', 'hex'),
    Buffer.from([2 + (y[31] & 1)]),
    x,
  ]);
  const compressedKey = createPublicKey({ key: compressed, format: 'der', type: 'spki' });
  assert.equal(compressedKey.export({ type: 'spki', format: 'der' }).length, 59);
  writeFileSync(f.keysPath, JSON.stringify({ current: pem(compressedKey), next: pem(f.next.publicKey) }));
  assert.throws(() => loadKeys(f.keysPath), { code: 'KEYS', message: /uncompressed SPKI/ });
});

test('inject-env writes the element where the shells copy it, once, and literally', () => {
  const page = '<!DOCTYPE html><html><head><meta charSet="utf-8"/></head><body></body></html>';
  const element = envScript({ A: "$& $' $1" });
  const injected = insertEnvScript(page, element);
  assert.equal(
    injected,
    page.replace('<head>', () => `<head>${element}`),
  );
  // A store build and an over-the-air bundle of the same page start out identical.
  assert.equal(copyEnvScript(injected, page), injected);
  // A second run replaces the element instead of adding one.
  const again = insertEnvScript(injected, envScript({}));
  assert.equal(
    again,
    page.replace('<head>', () => `<head>${envScript({})}`),
  );
  assert.throws(() => insertEnvScript('<html></html>', element), /no <head>/);
  assert.throws(() => insertEnvScript('<head><script>window.__ENV = {', element), /without its <\/script>/);
});

test('REQUIRED_BRIDGE_LEVEL is readable from native-shell.ts', () => {
  assert.ok(Number.isInteger(readBridgeLevel()) && readBridgeLevel() >= 1);
});

test('an xz the host cannot run is a plain Error, never XZ: it says nothing about the bundle', () => {
  const dir = tempDir('ota-noexec-');
  writeFileSync(join(dir, 'xz'), '#!/bin/sh\n', { mode: 0o644 });
  const probe = `
    import { xzDecompress } from ${JSON.stringify(pathToFileURL(join(SCRIPTS, 'ota-tar.mjs')).href)};
    try {
      xzDecompress(Buffer.from('fd377a585a000004', 'hex'));
    } catch (error) {
      console.log(JSON.stringify({ code: error.code ?? null, message: error.message }));
    }`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    encoding: 'utf8',
    env: { ...process.env, PATH: dir },
  });
  const { code, message } = JSON.parse(child.stdout);
  assert.equal(code, null, message);
  assert.match(message, /EACCES/);
});

test('ota-verify refuses --bundle without its manifest and empty paths, and names the code of a refusal', () => {
  const f = fixture();
  const cli = run('ota-verify.mjs', '--keys', f.keysPath, '--bundle', join(f.dir, 'nothing.tar.xz'));
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /--bundle needs --manifest/);
  for (const args of [
    ['--keys', f.keysPath, '--manifest', ''],
    ['--keys', f.keysPath, '--manifest', join(f.dir, 'mobile.json'), '--bundle', ''],
    ['--keys', ''],
  ]) {
    const empty = run('ota-verify.mjs', ...args);
    assert.equal(empty.status, 1, args.join(' '));
    assert.match(empty.stderr, /need a path/, args.join(' '));
  }
  writeFileSync(f.keysPath, 'null');
  const refused = run('ota-verify.mjs', '--keys', f.keysPath);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /^✗ KEYS: /);
});

test('keygen fills a slot, keeps the private key out of every git work tree, and replaces nothing', () => {
  const dir = tempDir('ota-keygen-');
  const keysPath = join(dir, 'ota', 'keys.json'); // keygen makes the directory keys.json goes in
  const keygen = (...args) => run('ota-keygen.mjs', ...args, '--keys', keysPath);

  assert.equal(keygen('current', join(dir, 'current.pem')).status, 0);
  assert.equal(keygen('next', join(dir, 'next.pem')).status, 0);
  assert.equal(statSync(join(dir, 'current.pem')).mode & 0o777, 0o600);
  const keys = loadKeys(keysPath);
  assert.equal(keys.size, 2);
  assert.ok(keys.has(keyIdOf(readFileSync(join(dir, 'current.pem'), 'utf8'))));
  const keysJson = readFileSync(keysPath, 'utf8');

  assert.match(keygen('current', join(dir, 'other.pem')).stderr, /already has a "current" key/);
  assert.match(keygen('next', join(SCRIPTS, 'leak.pem')).stderr, /inside a git work tree/);
  symlinkSync(SCRIPTS, join(dir, 'into-the-repo'));
  assert.match(keygen('next', join(dir, 'into-the-repo', 'leak.pem')).stderr, /inside a git work tree/);
  assert.match(keygen('later', join(dir, 'x.pem')).stderr, /usage/);
  assert.equal(readFileSync(keysPath, 'utf8'), keysJson);
  // A file already at the private key's path is never overwritten, and no public half is recorded.
  const currentPem = readFileSync(join(dir, 'current.pem'), 'utf8');
  const freshKeys = join(dir, 'fresh', 'keys.json');
  const existing = run('ota-keygen.mjs', 'current', join(dir, 'current.pem'), '--keys', freshKeys);
  assert.equal(existing.status, 1);
  assert.match(existing.stderr, /EEXIST/);
  assert.equal(readFileSync(join(dir, 'current.pem'), 'utf8'), currentPem);
  assert.ok(!existsSync(freshKeys));
});

// The Android shell decodes with a memory limit and marks what it cannot decode as bad for good, so
// a bundle the release verified but a phone cannot afford would stop that platform updating.
test('a bundle packed with a dictionary the shells cannot afford is refused at release time', () => {
  const tar = writeTar([{ name: 'index.html', data: Buffer.from('<html><head></head></html>') }]);
  const packed = preset => {
    const result = spawnSync('xz', [preset, '-T1', '--check=crc64', '-c'], { input: tar });
    assert.equal(result.status, 0);
    return result.stdout;
  };
  assert.deepEqual(xzDecompress(packed('-6')), tar);
  assert.throws(() => xzDecompress(packed('-9')), { code: 'XZ', message: new RegExp(String(MAX_XZ_DECODER_MEMORY)) });
});
