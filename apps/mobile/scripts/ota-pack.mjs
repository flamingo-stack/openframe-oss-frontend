#!/usr/bin/env node
// Packs the web export into the over-the-air bundle and signs its manifest
// (docs/ota.md): <out>/openframe-mobile-<version>.tar.xz and <out>/mobile.json.
// The private key comes from MOBILE_OTA_SIGNING_KEY (PKCS#8 PEM, P-256); the
// bridge level from REQUIRED_BRIDGE_LEVEL in apps/web/src/lib/native-shell.ts.
//
//   node apps/mobile/scripts/ota-pack.mjs --dist apps/web/dist --version 1.2.3 \
//     --url-base https://github.com/<owner>/<repo>/releases/download/1.2.3 --out <dir>
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { packTarXz } from './ota-tar.mjs';
import {
  assertP256,
  bundleName,
  checkBundleContents,
  ENV_SCRIPT,
  FORMAT,
  keyIdOf,
  MANIFEST_NAME,
  verifyManifest,
} from './ota-verify.mjs';

export const NATIVE_SHELL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/src/lib/native-shell.ts',
);

// The social preview image, twice over (byte-identical copies). Only link-preview meta tags point at
// it, by an absolute URL on the web host, so a phone never loads it from the bundle.
export const LEFT_OUT = new Set(['assets/openframe/og-image.png', 'assets/openframe/twitter-image.png']);

export function readBridgeLevel(path = NATIVE_SHELL_PATH) {
  const match = readFileSync(path, 'utf8').match(/^export const REQUIRED_BRIDGE_LEVEL = (\d+);$/m);
  if (!match) throw new Error(`${path}: no "export const REQUIRED_BRIDGE_LEVEL = <n>;" line`);
  return Number(match[1]);
}

/** Every file under `dist`, `/`-separated and sorted; throws on a symlink or anything else that is not a file. */
function listFiles(dist, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(dist, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(dist, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`${join(dist, name)} is not a regular file or directory`);
  }
  return files;
}

/**
 * Writes the tar.xz and the signed mobile.json into `outDir` and returns their paths and the payload.
 * `privateKeyPem` is the P-256 key whose public half is in apps/mobile/ota/keys.json.
 */
export function pack({ dist, version, urlBase, outDir, privateKeyPem, bridgeLevel }) {
  if (!privateKeyPem) throw new Error('no signing key: MOBILE_OTA_SIGNING_KEY is empty');
  const privateKey = createPrivateKey(privateKeyPem);
  assertP256(privateKey, 'MOBILE_OTA_SIGNING_KEY');
  if (!lstatSync(dist).isDirectory()) throw new Error(`${dist} is not a directory`);
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`${dist} has no index.html`);
  if (ENV_SCRIPT.test(readFileSync(join(dist, 'index.html'), 'utf8'))) {
    throw new Error(`${dist}/index.html carries window.__ENV: build the export with no NEXT_PUBLIC_* set`);
  }

  const names = listFiles(dist)
    .filter(name => !LEFT_OUT.has(name))
    .sort();
  const archive = packTarXz(names.map(name => ({ name, data: readFileSync(join(dist, name)) })));
  const files = checkBundleContents(archive);

  const payload = {
    format: FORMAT,
    version,
    bridgeLevel,
    url: `${urlBase.replace(/\/+$/, '')}/${bundleName(version)}`,
    size: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex'),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const keyId = keyIdOf(privateKey);
  const manifest = `${JSON.stringify(
    {
      keyId,
      payload: payloadBytes.toString('base64'),
      signature: sign('sha256', payloadBytes, { key: privateKey, dsaEncoding: 'der' }).toString('base64'),
    },
    null,
    2,
  )}\n`;
  // The same checks ota-verify makes, against the signing key itself: a version or URL
  // the shells would refuse fails here rather than on a phone.
  verifyManifest(manifest, new Map([[keyId, privateKey]]));

  mkdirSync(outDir, { recursive: true });
  const bundlePath = join(outDir, bundleName(version));
  const manifestPath = join(outDir, MANIFEST_NAME);
  writeFileSync(bundlePath, archive);
  writeFileSync(manifestPath, manifest);
  return { bundlePath, manifestPath, payload, keyId, files };
}

function main() {
  const { values } = parseArgs({
    options: {
      dist: { type: 'string' },
      version: { type: 'string' },
      'url-base': { type: 'string' },
      out: { type: 'string' },
    },
  });
  for (const option of ['dist', 'version', 'url-base', 'out']) {
    if (!values[option]) throw new Error(`--${option} is required`);
  }
  const result = pack({
    dist: values.dist,
    version: values.version,
    urlBase: values['url-base'],
    outDir: values.out,
    privateKeyPem: process.env.MOBILE_OTA_SIGNING_KEY,
    bridgeLevel: readBridgeLevel(),
  });
  console.log(`✓ ${result.bundlePath}: ${result.files} files, ${result.payload.size} bytes`);
  console.log(`✓ ${result.manifestPath}: key ${result.keyId}, ${JSON.stringify(result.payload)}`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}
