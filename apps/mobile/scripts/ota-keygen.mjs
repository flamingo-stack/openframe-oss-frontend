#!/usr/bin/env node
// Creates an over-the-air signing key (docs/ota.md): writes the private key to
// <private-key-file> (mode 600, never inside a git work tree) and its public half
// into the given slot of apps/mobile/ota/keys.json. Refuses to replace either.
//
//   node apps/mobile/scripts/ota-keygen.mjs <current|next> <private-key-file> [--keys <keys.json>]
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { runCli } from './ota-error.mjs';
import { KEY_SLOTS, KEYS_PATH, keyIdOf, parseObject } from './ota-verify.mjs';

/**
 * Whether `dir`, symlinks resolved, lies in any git work tree: this checkout, a checkout this one
 * is nested in, or another one, each of which could commit the key.
 */
function inGitWorkTree(dir) {
  for (let d = realpathSync(dir); ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return true;
    if (dirname(d) === d) return false;
  }
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { keys: { type: 'string', default: KEYS_PATH } },
  });
  const [slot, privateKeyFile] = positionals;
  if (!KEY_SLOTS.includes(slot) || !privateKeyFile || positionals.length !== 2) {
    throw new Error('usage: ota-keygen.mjs <current|next> <private-key-file> [--keys <keys.json>]');
  }
  const target = resolve(privateKeyFile);
  if (inGitWorkTree(dirname(target))) {
    throw new Error(`${target} is inside a git work tree; write the private key outside every repository`);
  }
  const keys = existsSync(values.keys) ? parseObject(readFileSync(values.keys, 'utf8'), 'KEYS', values.keys) : {};
  if (keys[slot]) throw new Error(`${values.keys} already has a "${slot}" key; remove it first to replace it`);

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  keys[slot] = publicKey.export({ type: 'spki', format: 'pem' });
  const keysJson = `${JSON.stringify(Object.fromEntries(KEY_SLOTS.filter(s => keys[s]).map(s => [s, keys[s]])), null, 2)}\n`;
  mkdirSync(dirname(values.keys), { recursive: true });
  writeFileSync(target, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  try {
    writeFileSync(values.keys, keysJson);
  } catch (error) {
    // A private key whose public half is recorded nowhere would only get uploaded by mistake.
    unlinkSync(target);
    throw error;
  }
  console.log(`✓ "${slot}" key ${keyIdOf(publicKey)}: public half in ${values.keys}, private key in ${target}`);
}

runCli(main);
