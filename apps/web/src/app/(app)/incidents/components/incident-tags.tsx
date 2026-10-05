import { Tag, type TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { InsightSeverity, InsightStatus } from '@/generated/schema-enums';

type TagVariant = NonNullable<TagProps['variant']>;

// Figma: CRITICAL is the filled error tag, HIGH the muted error one, MEDIUM the
// muted warning, LOW/INFO the grey stamp.
const SEVERITY_VARIANT: Record<InsightSeverity, TagVariant> = {
  CRITICAL: 'critical',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'grey',
  INFO: 'grey',
};

// Figma: NEW is the accent stamp, ACKNOWLEDGED outlined, SNOOZED/ARCHIVED grey,
// RESOLVED the muted success tag.
const STATUS_VARIANT: Record<InsightStatus, TagVariant> = {
  NEW: 'primary',
  ACKNOWLEDGED: 'outline',
  SNOOZED: 'grey',
  RESOLVED: 'success',
  ARCHIVED: 'grey',
};

// `value` is a Relay enum, which may be `"%future added value"` — an unknown
// member gets the neutral stamp with its raw name rather than nothing.
const variantOf = (map: Record<string, TagVariant>, value: string): TagVariant => map[value] ?? 'grey';

export function IncidentSeverityTag({ severity }: { severity: string }) {
  return <Tag label={severity} variant={variantOf(SEVERITY_VARIANT, severity)} />;
}

export function IncidentStatusTag({ status }: { status: string }) {
  return <Tag label={status} variant={variantOf(STATUS_VARIANT, status)} />;
}
