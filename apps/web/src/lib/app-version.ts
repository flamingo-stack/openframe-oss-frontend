/**
 * Version comparison for the mobile force-update, by the same rule the tenant
 * gateway applies to `X-OpenFrame-Client`: only the numeric `MAJOR.MINOR.PATCH`
 * prefix counts, so a local `git describe` build such as
 * `1.0.125-4-geae0416-dirty` compares as `1.0.125`. Anything without that
 * prefix — `-`, a bare commit hash, an empty string — is unknown, and unknown
 * never prompts: the two sides must agree on which clients are too old, and the
 * gateway lets an unparseable version through.
 */

type Triple = readonly [number, number, number];

const PREFIX = /^(\d+)\.(\d+)\.(\d+)/;

export function parseVersion(value: string | null | undefined): Triple | null {
  const match = value ? PREFIX.exec(value) : null;
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** `current < target`, numerically. False when either side does not parse. */
export function isVersionBelow(current: string | null | undefined, target: string | null | undefined): boolean {
  const a = parseVersion(current);
  const b = parseVersion(target);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
