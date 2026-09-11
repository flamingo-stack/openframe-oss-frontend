'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SoftwareCveSeverity, SoftwareOnDeviceStatus } from '@/generated/schema-enums';

/** Severity → the `Tag` variant that carries its colour. */
const SEVERITY_VARIANT: Record<SoftwareCveSeverity, 'critical' | 'error' | 'warning' | 'grey'> = {
  CRITICAL: 'critical',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'grey',
  NONE: 'grey',
};

export function severityVariant(severity: SoftwareCveSeverity): 'critical' | 'error' | 'warning' | 'grey' {
  return SEVERITY_VARIANT[severity];
}

/**
 * Narrow a payload severity to one this build knows. Relay widens every enum
 * with `'%future added value'` — a band added server-side lands here as "no
 * severity we can colour" rather than as a `Tag` with an unmapped variant.
 */
export function toSeverity(value: string | null | undefined): SoftwareCveSeverity | null {
  const known = Object.values(SoftwareCveSeverity) as string[];
  return value && known.includes(value) ? (value as SoftwareCveSeverity) : null;
}

/**
 * Where a CVE is read in full when the backend hands no link of its own: NVD is
 * the canonical record every CVE id resolves against.
 */
export function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`;
}

/** Same narrowing for the per-device lifecycle status. */
export function toDeviceSoftwareStatus(value: string | null | undefined): SoftwareOnDeviceStatus | null {
  const known = Object.values(SoftwareOnDeviceStatus) as string[];
  return value && known.includes(value) ? (value as SoftwareOnDeviceStatus) : null;
}

/**
 * The chip beside a device's installed version.
 *
 * `UP_TO_DATE` deliberately renders nothing: the design marks only the states
 * that need attention, and a green "up to date" on every healthy row is noise.
 * `UNINSTALLING` is the one in-flight state, so it carries the loader glyph and
 * the neutral outline rather than a severity colour.
 */
export function SoftwareOnDeviceStatusTag({ status }: { status: SoftwareOnDeviceStatus | null }) {
  switch (status) {
    case SoftwareOnDeviceStatus.OUTDATED:
      return <Tag label="OUTDATED" variant="error" />;
    case SoftwareOnDeviceStatus.SCHEDULED_UPDATE:
      return <Tag label="SCHEDULED UPDATE" variant="warning" />;
    case SoftwareOnDeviceStatus.SCHEDULED_UNINSTALL:
      return <Tag label="SCHEDULED UNINSTALL" variant="warning" />;
    case SoftwareOnDeviceStatus.UNINSTALLING:
      return <Tag label="UNINSTALLING" variant="outline" icon={<DotsLoaderIcon className="h-4 w-4" />} />;
    default:
      return null;
  }
}
