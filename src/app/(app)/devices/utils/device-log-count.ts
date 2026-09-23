/**
 * FE-7's rule, and the `Long` coercion with it: the scalar is unmapped (`any`
 * in the Relay artifact) and a 64-bit int may arrive as a string. Below 2 is
 * null, so a `×1` chip can never render.
 */
export function toRepeatCount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n > 1 ? n : null;
}
