import assert from 'node:assert/strict';
import test from 'node:test';
import { findWafBlockedChunkNames } from './static-chunk-name-policy.mjs';

test('finds chunk names that Cloud Armor treats as SQL comments', () => {
  assert.deepEqual(findWafBlockedChunkNames(['0867--ojgq9_l.js', '07g9hs~e7j0--.js', '0ajmn8glyy16y.js']), [
    '0867--ojgq9_l.js',
  ]);
});
