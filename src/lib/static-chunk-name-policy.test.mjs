import assert from 'node:assert/strict';
import test from 'node:test';
import { findWafBlockedChunkNames, toWafSafeChunkName } from './static-chunk-name-policy.mjs';

test('finds chunk names that Cloud Armor treats as SQL comments', () => {
  assert.deepEqual(findWafBlockedChunkNames(['0867--ojgq9_l.js', '07g9hs~e7j0--.js', '0ajmn8glyy16y.js']), [
    '0867--ojgq9_l.js',
  ]);
});

test('creates a same-length WAF-safe chunk name', () => {
  const blockedName = '0vm6432---23n.js';
  const safeName = toWafSafeChunkName(blockedName);

  assert.equal(safeName, '0vm6432__-23n.js');
  assert.equal(safeName.length, blockedName.length);
  assert.deepEqual(findWafBlockedChunkNames([safeName]), []);
});
