'use client';

import { InfoCard } from '@flamingo-stack/openframe-frontend-core';
import { TerminalMonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useState } from 'react';
import { formatDateTimeOnDevice } from '@/lib/format-date';
import type { Device } from '../../types/device.types';
import { EMPTY_CARD, labelsOf } from './info-card-loading';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface OsTabProps {
  device: Device | null;
}

type InfoRow = { label: string; value?: string | number | null; copyable?: boolean };

/** Keep only rows that carry a real value, normalized to a display string. */
function toItems(rows: InfoRow[]): Array<{ label: string; value: string; copyable?: boolean }> {
  return rows
    .filter(row => row.value !== undefined && row.value !== null && String(row.value).trim() !== '')
    .map(row => ({ label: row.label, value: String(row.value), copyable: row.copyable }));
}

function formatUptime(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="uppercase text-ods-text-secondary text-h5">{title}</h3>
      {children}
    </section>
  );
}

function OsEmptyState() {
  return (
    <TabEmptyState
      icon={<TerminalMonitorIcon />}
      title="No OS data found"
      description="Operating system details for this device will appear here."
    />
  );
}

const BOOT_TITLE = 'Boot & Time';
const MANAGEMENT_TITLE = 'Fleet';

export function OsTab({ device }: OsTabProps) {
  const loading = useLoadingScope();
  // `Date.now()` in render makes the component impure: two renders of the same
  // device disagree, and the compiler cannot memoize around it. Sampled once on
  // mount instead — the figure is a coarse "3 days", and it already only moved
  // when something else happened to re-render this tab. Declared before the
  // early return below, because hooks may not be called conditionally.
  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  if (!loading && !device) {
    return <OsEmptyState />;
  }

  // OPERATING SYSTEM — name/version/build/platform identity from Fleet + GraphQL.
  const osTitle = device?.os_version || device?.operating_system || device?.osType;
  const osSubtitle = device?.code_name || device?.platform_like;
  const osRows: InfoRow[] = [
    { label: 'Platform', value: device?.platform || device?.osType },
    { label: 'Version', value: device?.osVersion },
    { label: 'Build', value: device?.build || device?.osBuild },
    { label: 'Architecture', value: device?.cpu_type },
    { label: 'OS UUID', value: device?.osUuid, copyable: true },
  ];
  const osItems = toItems(osRows);
  const hasOs = Boolean(osTitle || osSubtitle || osItems.length > 0);

  // BOOT & TIME — boot/uptime + locale + current session. Boot and enrolment
  // happened on the device, so they read on the device's clock (its zone is the
  // row below), on the viewer's only when the device has not reported a zone.
  const uptimeSeconds = device?.boot_time ? Math.max(0, nowSeconds - device?.boot_time) : undefined;
  const lastBoot = device?.last_restarted_at
    ? formatDateTimeOnDevice(device?.last_restarted_at, device?.timezone)
    : device?.boot_time
      ? formatDateTimeOnDevice(device?.boot_time * 1000, device?.timezone)
      : undefined;
  const bootRows: InfoRow[] = [
    { label: 'Last Boot', value: lastBoot },
    { label: 'Uptime', value: formatUptime(uptimeSeconds) },
    { label: 'Timezone', value: device?.timezone },
    { label: 'Current User', value: device?.logged_in_username },
    {
      label: 'Enrolled',
      value: device?.last_enrolled_at ? formatDateTimeOnDevice(device?.last_enrolled_at, device?.timezone) : undefined,
    },
  ];
  const bootItems = toItems(bootRows);

  // MANAGEMENT — Fleet team + labels (host grouping from the Fleet host payload).
  const managementRows: InfoRow[] = [
    { label: 'Fleet Team', value: device?.fleetTeamName },
    { label: 'Labels', value: device?.fleetLabels?.length ? device.fleetLabels.join(', ') : undefined },
  ];
  const managementItems = toItems(managementRows);

  // While the device is read every section is drawn (Fleet devices carry a team), each card its own skeleton.
  const showOs = loading || hasOs;
  const showBoot = loading || bootItems.length > 0;
  const showManagement = loading || managementItems.length > 0;

  if (!loading && !hasOs && bootItems.length === 0 && managementItems.length === 0) {
    if (device?.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<TerminalMonitorIcon />} section="OS" />;
    }
    return <OsEmptyState />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] content-lg:grid-cols-3">
        {showOs && (
          <Section title="Operating System">
            <InfoCard
              className="flex-1"
              data={
                loading ? EMPTY_CARD : { title: osTitle || 'Operating System', subtitle: osSubtitle, items: osItems }
              }
              skeleton={{ rows: labelsOf(osRows), subtitle: true }}
            />
          </Section>
        )}

        {showBoot && (
          <Section title="Boot & Time">
            <InfoCard
              className="flex-1"
              data={loading ? EMPTY_CARD : { title: BOOT_TITLE, items: bootItems }}
              skeleton={{ rows: labelsOf(bootRows), title: BOOT_TITLE }}
            />
          </Section>
        )}
      </div>

      {showManagement && (
        <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] content-lg:grid-cols-3">
          <Section title="Management">
            <InfoCard
              data={loading ? EMPTY_CARD : { title: MANAGEMENT_TITLE, items: managementItems }}
              skeleton={{ rows: labelsOf(managementRows), title: MANAGEMENT_TITLE }}
            />
          </Section>
        </div>
      )}
    </div>
  );
}
