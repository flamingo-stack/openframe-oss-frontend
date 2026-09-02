import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sanitizeStaticChunkNames } from './static-chunk-name-sanitizer.mjs';

const BLOCKED_CHUNK_NAME = '0vm6432---23n.js';
const SAFE_CHUNK_NAME = '0vm6432__-23n.js';

async function createBuildFixture() {
  const distDirectory = await mkdtemp(path.join(os.tmpdir(), 'openframe-static-chunks-'));
  const chunkDirectory = path.join(distDirectory, 'static', 'chunks');
  const serverDirectory = path.join(distDirectory, 'server', 'app');
  const standaloneDirectory = path.join(distDirectory, 'standalone', 'dist', 'server');
  await Promise.all([
    mkdir(chunkDirectory, { recursive: true }),
    mkdir(serverDirectory, { recursive: true }),
    mkdir(standaloneDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(chunkDirectory, BLOCKED_CHUNK_NAME), `self=${BLOCKED_CHUNK_NAME}`),
    writeFile(path.join(chunkDirectory, `${BLOCKED_CHUNK_NAME}.map`), `source=${BLOCKED_CHUNK_NAME}`),
    writeFile(path.join(serverDirectory, 'page.html'), `<script src="${BLOCKED_CHUNK_NAME}"></script>`),
    writeFile(path.join(serverDirectory, 'page.rsc'), `chunk:${BLOCKED_CHUNK_NAME}`),
    writeFile(path.join(standaloneDirectory, 'manifest.json'), JSON.stringify({ chunk: BLOCKED_CHUNK_NAME })),
  ]);

  return distDirectory;
}

test('renames blocked chunks and rewrites every build reference', async () => {
  const distDirectory = await createBuildFixture();
  const result = await sanitizeStaticChunkNames(distDirectory);

  assert.equal(result.renamedFiles.length, 2);
  assert.equal(result.replacementCount, 5);
  assert.equal(
    await readFile(path.join(distDirectory, 'static', 'chunks', SAFE_CHUNK_NAME), 'utf8'),
    `self=${SAFE_CHUNK_NAME}`,
  );
  assert.equal(
    await readFile(path.join(distDirectory, 'server', 'app', 'page.html'), 'utf8'),
    `<script src="${SAFE_CHUNK_NAME}"></script>`,
  );
  assert.equal(
    await readFile(path.join(distDirectory, 'standalone', 'dist', 'server', 'manifest.json'), 'utf8'),
    JSON.stringify({ chunk: SAFE_CHUNK_NAME }),
  );
});

test('does not modify a build with safe chunk names', async () => {
  const distDirectory = await mkdtemp(path.join(os.tmpdir(), 'openframe-static-chunks-'));
  const chunkDirectory = path.join(distDirectory, 'static', 'chunks');
  await mkdir(chunkDirectory, { recursive: true });
  await writeFile(path.join(chunkDirectory, SAFE_CHUNK_NAME), 'safe');

  assert.deepEqual(await sanitizeStaticChunkNames(distDirectory), {
    renamedFiles: [],
    replacementCount: 0,
  });
});

test('fails before rewriting when a safe target already exists', async () => {
  const distDirectory = await createBuildFixture();
  await writeFile(path.join(distDirectory, 'static', 'chunks', SAFE_CHUNK_NAME), 'collision');

  await assert.rejects(
    sanitizeStaticChunkNames(distDirectory),
    /WAF-safe chunk target already exists: 0vm6432__-23n\.js/u,
  );
});
