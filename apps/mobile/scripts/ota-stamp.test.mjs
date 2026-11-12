// npm test   (in apps/mobile)
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { STAMP_NAME, stampBundle } from './ota-stamp.mjs';

const dir = mkdtempSync(join(tmpdir(), 'ota-stamp-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const stamp = join(dir, STAMP_NAME);

test('a release version is stamped as the shells read it', () => {
  assert.equal(stampBundle('1.0.221', dir), true);
  assert.deepEqual(JSON.parse(readFileSync(stamp, 'utf8')), { version: '1.0.221' });
});

// A shell that cannot place its bundle among the releases must take no update, so a stamp left by
// an earlier release build of the same www/ has to go.
for (const version of ['1.0.221-4-g0d081e3', '1.0.221-dirty', 'pr-808-0d081e3', '1.0', '01.0.221', '']) {
  test(`${JSON.stringify(version)} is no release: the stamp is removed`, () => {
    stampBundle('1.0.221', dir);
    assert.equal(stampBundle(version, dir), false);
    assert.equal(existsSync(stamp), false);
  });
}
