import { SoftwareCveSeverity } from '@/generated/schema-enums';

/**
 * A CVSS base score as the standard writes it: one decimal, so a 7 reads
 * "7.0" beside a "7.5" instead of looking like a different scale.
 */
export function formatCvssScore(score: number): string {
  return score.toFixed(1);
}

/** The CVSS v3.x qualitative rating of a base score — the band a score falls in by the standard itself. */
export function severityFromCvssScore(score: number): SoftwareCveSeverity {
  if (score >= 9) return SoftwareCveSeverity.CRITICAL;
  if (score >= 7) return SoftwareCveSeverity.HIGH;
  if (score >= 4) return SoftwareCveSeverity.MEDIUM;
  if (score > 0) return SoftwareCveSeverity.LOW;
  return SoftwareCveSeverity.NONE;
}
