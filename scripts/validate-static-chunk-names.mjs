import { readdir } from 'node:fs/promises';
import { findWafBlockedChunkNames } from '../src/lib/static-chunk-name-policy.mjs';

const chunkDirectory = new URL('../dist/static/chunks/', import.meta.url);
const blockedChunkNames = findWafBlockedChunkNames(await readdir(chunkDirectory));

if (blockedChunkNames.length > 0) {
  throw new Error(`Cloud Armor blocks generated static chunks: ${blockedChunkNames.join(', ')}`);
}
