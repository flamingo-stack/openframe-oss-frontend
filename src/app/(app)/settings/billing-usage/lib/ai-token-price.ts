/**
 * What ONE AI token costs, from a catalog option's unit price.
 *
 * The catalog prices a UNIT, never a token: `price` is what one `unitSize` block
 * costs — $10.00 per 1,000,000 tokens — which is also how the plan states the
 * rate ("$10.00 / 1M tokens"). Multiplying a token count by `price` directly is
 * what printed "~$20,000,000.00" under a 2M-token limit.
 *
 * Returns `null` when either half is missing, and deliberately does NOT fall
 * back to a unit size of 1: that fallback IS the bug above, silently priced a
 * million times over. Callers read `null` as "rate unknown" and show no figure
 * rather than a wrong one.
 */
export function aiTokenPrice(unitPrice: number | null | undefined, unitSize: unknown): number | null {
  if (unitPrice == null) return null;
  // GraphQL `Long` arrives as a string or a number depending on its size.
  const size = Number(unitSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return null;
  return unitPrice / size;
}
