#!/usr/bin/env node

/**
 * Source maps for error reporting (src/lib/error-reporting.ts), taken from the one build that
 * becomes the runtime image and never shipped in it.
 *
 *   node scripts/sentry-sourcemaps.mjs prepare <out-dir>
 *     Runs in the Docker builder right after `npm run build`. Injects a Debug ID into every
 *     browser and server script of the standalone output, moves each `.map` out of `dist/` into
 *     <out-dir> beside a copy of the exact script it maps, and writes <out-dir>/manifest.json:
 *     each script's path in the image, sha256 and Debug ID. The Dockerfile's `sentry-upload` stage
 *     uploads <out-dir>; the runner stage copies `dist/` with no map left in it.
 *
 *   node scripts/sentry-sourcemaps.mjs verify <image-root> <export-dir>
 *     Checks an export against the image it claims to describe (<image-root> is the image's /app,
 *     e.g. from `docker cp`): every script in the manifest is byte-identical in the image and in the
 *     export, its map carries the same Debug ID, every script under the image's `dist/static` and
 *     `dist/server` is in the manifest, and the image holds no `.map`. Run before any upload: a second build of the same
 *     commit is not guaranteed to produce these files, so the upload must name this build's.
 *
 * Paths are the image's (`dist/static/...` is served at `/_next/static/...`, `dist/server/...` is
 * what the Node server executes), so the export mirrors the image.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The two trees the runner copies scripts from: `dist/static` as is, `dist/standalone` to /app.
const TREES = [
  { built: 'dist/static', image: 'dist/static' },
  { built: 'dist/standalone/dist/server', image: 'dist/server' },
];

const SCRIPT = /\.(?:js|mjs|cjs)$/;
const DEBUG_ID_COMMENT = /\/\/# debugId=([0-9a-f-]{36})\s*$/m;
// Only the trailing comment (sentry-cli puts its `debugId` comment after it): line and column
// numbers of everything above it stay what the map says.
const SOURCE_MAPPING_URL = /\n\/\/# sourceMappingURL=([^\n]*)(?=(?:\n\/\/# debugId=[^\n]*)?\s*$)/;

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function mapDebugId(mapPath) {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  return map.debug_id ?? map.debugId ?? null;
}

/** The map a script names in its trailing `sourceMappingURL` comment (Turbopack names maps apart from their scripts). */
function referencedMap(scriptPath, source) {
  const url = SOURCE_MAPPING_URL.exec(source)?.[1];
  if (!url || url.startsWith('data:')) return null;
  return join(dirname(scriptPath), decodeURIComponent(url));
}

/** sentry-cli puts its snippet first when it could adjust the map, and after the code when it could not. */
function snippetPrepended(source) {
  return (source.split('\n').find(line => line.trim() !== '') ?? '').includes('_sentryDebugIds');
}

function prepare(outDir) {
  const out = resolve(outDir);
  rmSync(out, { recursive: true, force: true });

  // The standalone server tree holds only the maps its file tracing picked up; the rest sit in
  // `dist/server`, beside the identical scripts. Bring them over first, so every server script is
  // injected together with its map.
  const serverBuilt = join(ROOT, 'dist/server');
  const serverStandalone = join(ROOT, 'dist/standalone/dist/server');
  for (const script of walk(serverStandalone).filter(path => SCRIPT.test(path))) {
    const map = referencedMap(script, readFileSync(script, 'utf8'));
    if (!map || existsSync(map)) continue;
    const built = join(serverBuilt, relative(serverStandalone, script));
    const builtMap = join(serverBuilt, relative(serverStandalone, map));
    if (existsSync(builtMap) && existsSync(built) && sha256(built) === sha256(script)) {
      copyFileSync(builtMap, map);
    }
  }

  const trees = TREES.map(tree => join(ROOT, tree.built));
  execFileSync(join(ROOT, 'node_modules/.bin/sentry-cli'), ['sourcemaps', 'inject', ...trees], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const files = {};
  for (const tree of TREES) {
    const builtRoot = join(ROOT, tree.built);
    for (const path of walk(builtRoot).filter(file => SCRIPT.test(file))) {
      const source = readFileSync(path, 'utf8');
      const debugId = DEBUG_ID_COMMENT.exec(source)?.[1];
      if (!debugId) throw new Error(`${relative(ROOT, path)}: no Debug ID after injection`);
      const imagePath = join(tree.image, relative(builtRoot, path));
      const map = referencedMap(path, source);
      if (!map || !existsSync(map)) {
        // Manifests and route stubs: injected too, but nothing to symbolicate. Listed all the same,
        // so `verify` accounts for every script the image runs or serves.
        files[imagePath] = { sha256: sha256(path), debugId, map: false };
        continue;
      }
      const mapId = mapDebugId(map);
      if (!mapId) {
        // sentry-cli does not decode a URL-encoded map reference (Turbopack's `[root-of-the-server]__*`,
        // `[externals]_*` and `(app)` server chunks), so it injects the script alone, appending its
        // snippet after the code: every position in the map still holds, the map only lacks the ID.
        // A prepended snippet would have moved every line, so that is refused.
        if (snippetPrepended(source)) throw new Error(`${relative(ROOT, path)}: snippet prepended without its map`);
        writeFileSync(map, JSON.stringify({ ...JSON.parse(readFileSync(map, 'utf8')), debug_id: debugId, debugId }));
      } else if (mapId !== debugId) {
        throw new Error(`${relative(ROOT, path)}: Debug ID differs from its map's`);
      }
      writeFileSync(path, source.replace(SOURCE_MAPPING_URL, ''));

      // Exported beside the script as `<script>.map`, the pairing `sentry-cli sourcemaps upload` reads.
      mkdirSync(dirname(join(out, imagePath)), { recursive: true });
      copyFileSync(path, join(out, imagePath));
      copyFileSync(map, join(out, `${imagePath}.map`));
      files[imagePath] = { sha256: sha256(path), debugId, map: true };
    }
  }

  // Every map leaves the image, exported or not.
  for (const path of walk(join(ROOT, 'dist/static')).concat(walk(join(ROOT, 'dist/standalone')))) {
    if (path.endsWith('.map')) rmSync(path);
  }

  const manifest = { bundleVersion: process.env.OPENFRAME_BUNDLE_VERSION ?? '', files };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const mapped = Object.values(files).filter(file => file.map).length;
  console.log(
    `sentry-sourcemaps: ${mapped} scripts with maps exported to ${out} ` +
      `(${Object.keys(files).length - mapped} more have no map), bundle ${manifest.bundleVersion || '-'}`,
  );
}

function verify(imageRoot, exportDir) {
  const image = resolve(imageRoot);
  const exported = resolve(exportDir);
  const manifest = JSON.parse(readFileSync(join(exported, 'manifest.json'), 'utf8'));
  const problems = [];

  for (const [path, { sha256: expected, debugId, map }] of Object.entries(manifest.files)) {
    const inImage = join(image, path);
    if (!existsSync(inImage)) {
      problems.push(`${path}: not in the image`);
      continue;
    }
    if (sha256(inImage) !== expected) problems.push(`${path}: differs from the image`);
    if (DEBUG_ID_COMMENT.exec(readFileSync(inImage, 'utf8'))?.[1] !== debugId) {
      problems.push(`${path}: Debug ID in the image differs`);
    }
    if (!map) continue;
    if (sha256(join(exported, path)) !== expected) problems.push(`${path}: exported copy differs`);
    if (mapDebugId(join(exported, `${path}.map`)) !== debugId) problems.push(`${path}: map Debug ID differs`);
  }

  for (const path of walk(image)) {
    if (path.endsWith('.map')) problems.push(`${relative(image, path)}: source map in the image`);
  }
  for (const tree of TREES) {
    for (const path of walk(join(image, tree.image)).filter(file => SCRIPT.test(file))) {
      const imagePath = relative(image, path);
      if (!manifest.files[imagePath]) problems.push(`${imagePath}: script missing from the manifest`);
    }
  }

  if (problems.length > 0) {
    console.error(`sentry-sourcemaps: ${problems.length} problem(s)\n${problems.slice(0, 50).join('\n')}`);
    process.exit(1);
  }
  const mapped = Object.entries(manifest.files).filter(([, file]) => file.map);
  const bytes = mapped.reduce((sum, [path]) => sum + statSync(join(image, path)).size, 0);
  console.log(
    `sentry-sourcemaps: export matches the image: ${Object.keys(manifest.files).length} scripts ` +
      `byte-identical with matching Debug IDs, ${mapped.length} of them (${(bytes / 1e6).toFixed(1)} MB) ` +
      `with maps; bundle ${manifest.bundleVersion || '-'}; no maps in the image`,
  );
}

const [command, ...args] = process.argv.slice(2);
if (command === 'prepare' && args.length === 1) prepare(args[0]);
else if (command === 'verify' && args.length === 2) verify(args[0], args[1]);
else {
  console.error('usage: sentry-sourcemaps.mjs prepare <out-dir> | verify <image-root> <export-dir>');
  process.exit(2);
}
