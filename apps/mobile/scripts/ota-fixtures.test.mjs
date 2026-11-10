// node --test apps/mobile/scripts/ota-fixtures.test.mjs   (needs the xz tool)
//
// The release scripts against the shared cases in apps/mobile/ota/fixtures, which the iOS and
// Android unit tests run too (docs/ota.md, "Shared test cases").
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { copyEnvScript } from './ota-env.mjs';
import { CODES, OtaError } from './ota-error.mjs';
import { buildFixtures } from './ota-fixtures.mjs';
import { keyIdOf, verifyBundle, verifyManifest } from './ota-verify.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'ota', 'fixtures');
const read = name => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

const { keys } = read('fixture-keys.json');
const { cases: manifestCases } = read('manifest-cases.json');
const { cases: bundleCases } = read('bundle-cases.json');
const { cases: envCases } = read('env-cases.json');
const { cases: decisionCases } = read('decision-cases.json');

/** `{error: code}` for a refusal, else `{[name]: what fn returned}`; anything but an OtaError is a bug. */
function outcome(name, fn) {
  try {
    return { [name]: fn() };
  } catch (error) {
    if (!(error instanceof OtaError)) throw error;
    return { error: error.code };
  }
}

const PAYLOAD_FIELDS = ['format', 'version', 'bridgeLevel', 'url', 'size', 'sha256'];
const knownFields = payload => Object.fromEntries(PAYLOAD_FIELDS.map(field => [field, payload[field]]));

for (const c of manifestCases) {
  test(`manifest: ${c.name}`, () => {
    const held = new Map(c.keys.map(name => [keys[name].keyId, createPublicKey(keys[name].publicKey)]));
    const result = outcome('payload', () => knownFields(verifyManifest(c.manifest, held)));
    assert.deepEqual(result, c.expect);
  });
}

for (const c of bundleCases) {
  test(`bundle: ${c.name}`, () => {
    const archive = readFileSync(join(FIXTURES, c.bundle));
    assert.deepEqual(
      outcome('files', () => verifyBundle(archive, { size: c.size, sha256: c.sha256 })),
      c.expect,
    );
  });
}

for (const c of envCases) {
  test(`env: ${c.name}`, () => {
    assert.deepEqual(
      outcome('html', () => copyEnvScript(c.builtin, c.staged)),
      c.expect,
    );
  });
}

// The shells decide what to do with a verified manifest (docs/ota.md, "The decision"); the release
// scripts never do, so this is the rule written once more, to keep decision-cases.json consistent with itself.
const compareVersions = (a, b) => {
  const [x, y] = [a, b].map(v => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
function decide({ shell, bundles, payload }) {
  if (compareVersions(payload.version, shell.builtinVersion) <= 0) return 'drop';
  if ([bundles.active, bundles.pending, ...bundles.bad].includes(payload.version)) return 'nothing';
  if (payload.bridgeLevel > shell.bridgeLevel) return 'nothing';
  return 'download';
}

for (const c of decisionCases) {
  test(`decision: ${c.name}`, () => assert.equal(decide(c), c.expect));
}

test('every error code but KEYS is the outcome of some case', () => {
  const reached = new Set([...manifestCases, ...bundleCases, ...envCases].map(c => c.expect.error).filter(Boolean));
  assert.deepEqual(
    CODES.filter(code => code !== 'KEYS' && !reached.has(code)),
    [],
  );
});

test('every bundle in fixtures/bundles is named by a case', () => {
  const named = new Set(bundleCases.map(c => c.bundle));
  assert.deepEqual(
    readdirSync(join(FIXTURES, 'bundles')).filter(file => !named.has(`bundles/${file}`)),
    [],
  );
});

test('the case names are unique within each file', () => {
  for (const cases of [manifestCases, bundleCases, envCases, decisionCases]) {
    const names = cases.map(c => c.name);
    assert.deepEqual(
      names.filter((name, i) => names.indexOf(name) !== i),
      [],
    );
  }
});

test('every fixture keyId is derived from its key as the shells derive theirs', () => {
  // SHA-256 over the 91-byte SPKI DER, first 16 lowercase hex digits, worked out here from the PEM's own
  // bytes rather than by keyIdOf; the shells' case runners assert the same.
  for (const [name, { keyId, publicKey }] of Object.entries(keys)) {
    const der = Buffer.from(publicKey.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, ''), 'base64');
    assert.equal(der.length, 91, name);
    assert.equal(createHash('sha256').update(der).digest('hex').slice(0, 16), keyId, name);
    assert.equal(keyIdOf(createPublicKey(publicKey)), keyId, name);
  }
});

test('the committed cases and bundles are what ota-fixtures.mjs writes', () => {
  const built = buildFixtures();
  // Keys, signatures and compressed bytes change on every run or xz build. The outcomes must not, nor
  // the payload each manifest carries, nor what each bundle decodes to.
  const outcomeOf = ({ name, keys: held, bundle, expect }) => ({ name, keys: held, bundle, expect });
  assert.deepEqual(manifestCases.map(outcomeOf), built.manifestCases.map(outcomeOf));
  assert.deepEqual(bundleCases.map(outcomeOf), built.bundleCases.map(outcomeOf));
  const payloadOf = text => {
    try {
      return JSON.parse(text)?.payload ?? null;
    } catch {
      return null;
    }
  };
  manifestCases.forEach((c, i) =>
    assert.equal(payloadOf(c.manifest), payloadOf(built.manifestCases[i].manifest), c.name),
  );
  assert.deepEqual(Object.keys(keys), Object.keys(built.keys));
  assert.deepEqual(
    readdirSync(join(FIXTURES, 'bundles')).sort(),
    Object.keys(built.bundles)
      .map(file => `${file}.tar.xz`)
      .sort(),
  );
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const contentOf = archive => {
    const result = spawnSync('xz', ['-dc'], { input: archive, maxBuffer: 2 ** 30 });
    if (result.status === 0) return `decodes to ${sha(result.stdout)}`;
    if (archive.subarray(0, 6).equals(Buffer.from('fd377a585a00', 'hex'))) return 'a corrupt xz stream';
    if (archive.subarray(0, 2).equals(Buffer.from('1f8b', 'hex'))) return 'gzip';
    // Neither xz's nor zlib's output, so the same bytes on every machine.
    return `bytes ${sha(archive)}`;
  };
  for (const [file, archive] of Object.entries(built.bundles)) {
    assert.equal(contentOf(readFileSync(join(FIXTURES, 'bundles', `${file}.tar.xz`))), contentOf(archive), file);
  }
});
