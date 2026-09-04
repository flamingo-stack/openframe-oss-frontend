import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findWafBlockedChunkNames, toWafSafeChunkName } from './static-chunk-name-policy.mjs';

const CHUNK_DIRECTORY = path.join('static', 'chunks');
const EXCLUDED_DIRECTORIES = new Set(['cache', 'node_modules', 'turbopack']);
const SOURCE_MAP_SUFFIX = '.map';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries
      .filter(entry => !EXCLUDED_DIRECTORIES.has(entry.name))
      .map(entry => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
      }),
  );

  return nestedFiles.flat();
}

function replaceExactBytes(content, replacements) {
  let replacementCount = 0;

  for (const [oldName, newName] of replacements) {
    const oldBytes = Buffer.from(oldName);
    const newBytes = Buffer.from(newName);
    let offset = content.indexOf(oldBytes);

    while (offset >= 0) {
      newBytes.copy(content, offset);
      replacementCount += 1;
      offset = content.indexOf(oldBytes, offset + newBytes.length);
    }
  }

  return replacementCount;
}

function createReplacements(blockedChunkNames) {
  return blockedChunkNames.map(oldName => [oldName, toWafSafeChunkName(oldName)]);
}

function assertUniqueTargets(replacements) {
  const targetNames = replacements.map(([, newName]) => newName);
  const duplicateTargets = targetNames.filter((name, index) => targetNames.indexOf(name) !== index);

  if (duplicateTargets.length > 0) {
    throw new Error(`WAF-safe chunk name collision: ${[...new Set(duplicateTargets)].join(', ')}`);
  }
}

async function assertTargetsAvailable(files, replacements) {
  const fileNames = new Set(files.map(file => path.basename(file)));
  const existingTargets = replacements
    .flatMap(([, newName]) => [newName, `${newName}${SOURCE_MAP_SUFFIX}`])
    .filter(targetName => fileNames.has(targetName));

  if (existingTargets.length > 0) {
    throw new Error(`WAF-safe chunk target already exists: ${existingTargets.join(', ')}`);
  }
}

async function rewriteReferences(files, replacements) {
  let replacementCount = 0;

  for (const file of files) {
    const content = await readFile(file);
    const fileReplacementCount = replaceExactBytes(content, replacements);

    if (fileReplacementCount > 0) {
      await writeFile(file, content);
      replacementCount += fileReplacementCount;
    }
  }

  return replacementCount;
}

async function renameChunks(files, replacements) {
  const replacementByName = new Map(replacements);
  const renamedFiles = [];

  for (const file of files) {
    const fileName = path.basename(file);
    const isSourceMap = fileName.endsWith(SOURCE_MAP_SUFFIX);
    const chunkName = isSourceMap ? fileName.slice(0, -SOURCE_MAP_SUFFIX.length) : fileName;
    const safeChunkName = replacementByName.get(chunkName);

    if (!safeChunkName) continue;

    const safeFileName = isSourceMap ? `${safeChunkName}${SOURCE_MAP_SUFFIX}` : safeChunkName;
    const safeFile = path.join(path.dirname(file), safeFileName);
    await rename(file, safeFile);
    renamedFiles.push(safeFile);
  }

  return renamedFiles;
}

async function assertSanitized(distDirectory, replacements) {
  const files = await listFiles(distDirectory);
  const oldNames = replacements.map(([oldName]) => oldName);

  for (const file of files) {
    const content = await readFile(file);
    const staleName = oldNames.find(oldName => content.includes(Buffer.from(oldName)));

    if (staleName) {
      throw new Error(`Stale blocked chunk reference ${staleName} remains in ${file}`);
    }
  }

  const chunkFiles = await listFiles(path.join(distDirectory, CHUNK_DIRECTORY));
  const blockedChunkNames = findWafBlockedChunkNames(chunkFiles.map(file => path.basename(file)));

  if (blockedChunkNames.length > 0) {
    throw new Error(`Cloud Armor still blocks generated static chunks: ${blockedChunkNames.join(', ')}`);
  }
}

export async function sanitizeStaticChunkNames(distDirectory) {
  const directoryStats = await stat(distDirectory);
  if (!directoryStats.isDirectory()) throw new Error(`Build output is not a directory: ${distDirectory}`);

  const chunkDirectory = path.join(distDirectory, CHUNK_DIRECTORY);
  const chunkFiles = await listFiles(chunkDirectory);
  const blockedChunkNames = findWafBlockedChunkNames(chunkFiles.map(file => path.basename(file)));
  const replacements = createReplacements(blockedChunkNames);

  if (replacements.length === 0) return { renamedFiles: [], replacementCount: 0 };

  assertUniqueTargets(replacements);
  const buildFiles = await listFiles(distDirectory);
  await assertTargetsAvailable(buildFiles, replacements);
  const replacementCount = await rewriteReferences(buildFiles, replacements);
  const renamedFiles = await renameChunks(buildFiles, replacements);
  await assertSanitized(distDirectory, replacements);

  return { renamedFiles, replacementCount };
}
