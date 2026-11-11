#!/usr/bin/env node
// Stamps the staged web bundle (www/) with the release it was built from, for the shells'
// over-the-air updater: its "built-in version" (docs/ota.md, "The decision"). The stamp is a file
// of the bundle, not a build setting of the binary, so a lane that reuses www/ (SKIP_WEB=1) ships
// the stamp that belongs to that bundle and the two cannot drift.
//
//   node apps/mobile/scripts/ota-stamp.mjs <bundle version> [www dir]
//
// Only an exact release, x.y.z, is stamped. A bundle built from anything else (a commit past a
// tag, a dirty tree, a placeholder) gets no stamp, and a shell without one takes no updates: it
// could not say whether a release is above or below what it carries.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCli } from './ota-error.mjs';
import { VERSION } from './ota-verify.mjs';

export const STAMP_NAME = 'ota-builtin.json';

/** Writes the stamp for a release version and returns true; removes it for anything else. */
export function stampBundle(version, wwwDir) {
  const path = join(wwwDir, STAMP_NAME);
  if (!VERSION.test(version)) {
    rmSync(path, { force: true });
    return false;
  }
  mkdirSync(wwwDir, { recursive: true });
  writeFileSync(path, `${JSON.stringify({ version })}\n`);
  return true;
}

function main() {
  const [version = '', wwwDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'www')] = process.argv.slice(2);
  if (stampBundle(version, wwwDir)) {
    console.log(`▸ built-in bundle version ${version}: this build takes over-the-air updates above it`);
  } else {
    console.log(
      `▸ bundle version ${JSON.stringify(version)} is not a release (x.y.z): no ${STAMP_NAME}, ` +
        'so this build takes no over-the-air updates',
    );
  }
}

if (import.meta.main) runCli(main);
