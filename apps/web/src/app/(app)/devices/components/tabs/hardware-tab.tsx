'use client';

import { InfoCard } from '@flamingo-stack/openframe-frontend-core';
import { HardDrivesIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useState } from 'react';
import { EMPTY_CARD, labelsOf } from '@/app/components/shared/info-card-loading';
import { formatDateTimeOnDevice } from '@/lib/format-date';
import type { Device } from '../../types/device.types';
import { type DeviceInfoRow, deviceInfoItems, hasDeviceInfo } from '../../utils/device-info-rows';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface HardwareTabProps {
  device: Device | null;
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

/** A row of hardware blocks — a 3-column grid where every block stretches to an equal width. */
/** `optional`: a row only some devices report (left out while the device is read, never in the first screen). */
function Row({ optional, children }: { optional?: boolean; children: ReactNode }) {
  return (
    <div
      data-loading-optional={optional || undefined}
      className="grid grid-cols-1 gap-[var(--spacing-system-l)] content-lg:grid-cols-3"
    >
      {children}
    </div>
  );
}

/**
 * A single hardware block: its own heading above one InfoCard (per the Figma Hardware tab,
 * each block is independently titled). `heading` is omitted for the trailing cards of a
 * multi-card group (e.g. extra disks/batteries) — an invisible placeholder keeps every card
 * top aligned across the grid.
 */
function Block({ heading, item, children }: { heading?: string; item?: boolean; children: ReactNode }) {
  return (
    // `h-full` + `[&>*:last-child]:flex-1` make the card fill the grid cell (which stretches to
    // the tallest block in the row), so all cards in a row share one height. `item`: one entry of a read list.
    <div
      data-loading-item={item || undefined}
      className="flex h-full flex-col gap-[var(--spacing-system-xxs)] [&>*:last-child]:flex-1"
    >
      {heading ? (
        <h3 className="uppercase text-ods-text-secondary text-h5">{heading}</h3>
      ) : (
        <h3 className="invisible text-h5" aria-hidden>
          &nbsp;
        </h3>
      )}
      {children}
    </div>
  );
}

function HardwareEmptyState() {
  return (
    <TabEmptyState
      icon={<HardDrivesIcon />}
      title="No hardware data found"
      description="Hardware details for this device will appear here."
    />
  );
}

const STORAGE_TITLE = 'Disk';
const STORAGE_SUBTITLE = 'Total storage';

export function HardwareTab({ device }: HardwareTabProps) {
  const loading = useLoadingScope();
  // `Date.now()` in render makes the component impure: two renders of the same
  // device disagree, and the compiler cannot memoize around it. Sampled once on
  // mount instead — the figure is a coarse "3 days", and it already only moved
  // when something else happened to re-render this tab. Declared before the
  // early return below, because hooks may not be called conditionally.
  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  if (!loading && !device) {
    return <HardwareEmptyState />;
  }

  // SYSTEM — hardware identity from Fleet (currently unused on this tab).
  const systemRows: DeviceInfoRow[] = [
    { label: 'Serial Number', value: device?.hardware_serial || device?.serial_number, copyable: true },
    { label: 'Hardware Version', value: device?.hardware_version },
    { label: 'Operating System', value: device?.os_version },
    { label: 'UUID', value: device?.osUuid, copyable: true },
  ];
  const systemTitle = device?.hardware_model || device?.make_model || device?.model;
  const systemSubtitle = device?.hardware_vendor || device?.manufacturer;
  const hasSystem = Boolean(systemTitle || systemSubtitle || hasDeviceInfo(systemRows));

  // BOOT — last restart / boot time / derived uptime, on the device's own clock
  // (these events happened there), on the viewer's when it reported no zone.
  const uptimeSeconds = device?.boot_time ? Math.max(0, nowSeconds - device?.boot_time) : undefined;
  const onDevice = (at: string | number | undefined) => (at ? formatDateTimeOnDevice(at, device?.timezone) : undefined);
  const bootRows: DeviceInfoRow[] = [
    { label: 'Uptime', value: formatUptime(uptimeSeconds) },
    { label: 'Last Restarted', value: onDevice(device?.last_restarted_at) },
    { label: 'Boot Time', value: onDevice(device?.boot_time ? device?.boot_time * 1000 : undefined) },
    { label: 'Enrolled', value: onDevice(device?.last_enrolled_at) },
  ];
  const hasBoot = hasDeviceInfo(bootRows);

  // CPU — model + architecture/cores/threads. The CPU subtype is left out: only Apple hosts report it, so it is a
  // row most devices would draw empty.
  const cpuModel = device?.cpu_brand;
  const cpuRows: DeviceInfoRow[] = [
    { label: 'Architecture', value: device?.cpu_type },
    { label: 'Physical Cores', value: device?.cpu_physical_cores },
    { label: 'Logical Cores', value: device?.cpu_logical_cores },
  ];
  const hasCpu = Boolean(cpuModel || hasDeviceInfo(cpuRows));

  // MEMORY — total only (per-DIMM/slot detail is not in our payload).
  const memoryRows: DeviceInfoRow[] = [{ label: 'Total Memory', value: device?.totalRam }];
  const hasMemory = hasDeviceInfo(memoryRows);

  // STORAGE — Fleet whole-disk totals.
  const fleetTotalGb = device?.gigs_total_disk_space;
  const fleetAvailableGb = device?.gigs_disk_space_available;
  const hasFleetStorage = typeof fleetTotalGb === 'number' && fleetTotalGb > 0;
  const fleetUsedPercent =
    device?.percent_disk_space_available !== undefined
      ? Math.max(0, Math.min(100, Math.round(100 - device?.percent_disk_space_available)))
      : undefined;
  const fleetUsedGb =
    typeof fleetTotalGb === 'number' && typeof fleetAvailableGb === 'number'
      ? Math.max(0, fleetTotalGb - fleetAvailableGb)
      : undefined;

  const storageRows: DeviceInfoRow[] = [
    {
      label: 'Current Usage',
      value: fleetUsedPercent !== undefined ? `${fleetUsedPercent}%` : undefined,
    },
    {
      label: 'Used Space',
      value: fleetUsedGb !== undefined ? `${fleetUsedGb.toFixed(2)} GB` : undefined,
    },
    {
      label: 'Free Space',
      value: typeof fleetAvailableGb === 'number' ? `${fleetAvailableGb.toFixed(2)} GB` : undefined,
    },
    { label: 'Total Capacity', value: typeof fleetTotalGb === 'number' ? `${fleetTotalGb.toFixed(2)} GB` : undefined },
  ];

  // BATTERY — macOS battery health from Fleet.
  const batteries = device?.batteries || [];

  // While the device is read every block that most devices report is drawn, each card its own skeleton.
  const showSystem = loading || hasSystem;
  const showBoot = loading || hasBoot;
  const showCpu = loading || hasCpu;
  const showMemory = loading || hasMemory;
  const showStorage = loading || hasFleetStorage;

  const hasAnyData = hasSystem || hasBoot || hasCpu || hasMemory || hasFleetStorage || batteries.length > 0;
  if (!loading && !hasAnyData) {
    if (device?.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<HardDrivesIcon />} section="Hardware" />;
    }
    return <HardwareEmptyState />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {/* System, Boot, CPU share one row — three equal, stretched columns. */}
      {(showSystem || showBoot || showCpu) && (
        <Row>
          {showSystem && (
            <Block heading="System">
              <InfoCard
                data={
                  loading
                    ? EMPTY_CARD
                    : { title: systemTitle || undefined, subtitle: systemSubtitle, items: deviceInfoItems(systemRows) }
                }
                skeleton={{ rows: labelsOf(systemRows), subtitle: true }}
              />
            </Block>
          )}

          {showBoot && (
            <Block heading="Boot">
              <InfoCard
                data={loading ? EMPTY_CARD : { items: deviceInfoItems(bootRows) }}
                skeleton={{ rows: labelsOf(bootRows), title: false }}
              />
            </Block>
          )}

          {showCpu && (
            <Block heading="CPU">
              <InfoCard
                data={loading ? EMPTY_CARD : { title: cpuModel || undefined, items: deviceInfoItems(cpuRows) }}
                skeleton={{ rows: labelsOf(cpuRows) }}
              />
            </Block>
          )}
        </Row>
      )}

      {/* Memory — its own row. */}
      {showMemory && (
        <Row>
          <Block heading="Memory">
            <InfoCard
              data={loading ? EMPTY_CARD : { items: deviceInfoItems(memoryRows) }}
              skeleton={{ rows: labelsOf(memoryRows), title: false }}
            />
          </Block>
        </Row>
      )}

      {/* Storage — Fleet whole-disk totals. */}
      {showStorage && (
        <Row>
          <Block heading="Storage">
            <InfoCard
              skeleton={{
                rows: labelsOf(storageRows),
                title: STORAGE_TITLE,
                subtitle: STORAGE_SUBTITLE,
                progress: true,
              }}
              data={
                loading
                  ? EMPTY_CARD
                  : {
                      title: STORAGE_TITLE,
                      subtitle: STORAGE_SUBTITLE,
                      items: deviceInfoItems(storageRows),
                      ...(fleetUsedPercent !== undefined && { progress: { value: fleetUsedPercent } }),
                    }
              }
            />
          </Block>
        </Row>
      )}

      {/* Batteries: only laptops report them, so the row is not drawn while the device is read (it sits last). */}
      {batteries.length > 0 && (
        <Row optional>
          {batteries.map((battery, index) => {
            const healthStatus = battery.health || 'Unknown';
            const cycleCount = battery.cycle_count || 0;

            let healthPercentage = 0;
            const percentMatch = healthStatus.match(/\((\d+)%\)/);
            if (percentMatch) {
              healthPercentage = parseInt(percentMatch[1]);
            } else {
              const healthLower = healthStatus.toLowerCase();
              if (healthLower.includes('normal') || healthLower.includes('good')) healthPercentage = 100;
              else if (healthLower.includes('fair')) healthPercentage = 60;
              else if (healthLower.includes('poor')) healthPercentage = 30;
            }

            return (
              <Block key={`battery-${index}`} heading={index === 0 ? 'Battery Health' : undefined} item>
                <InfoCard
                  data={{
                    title: `Battery ${index + 1}`,
                    subtitle: healthStatus,
                    items: [
                      { label: 'Cycle Count', value: cycleCount.toString() },
                      { label: 'Health', value: `${healthPercentage}%` },
                    ],
                    progress: {
                      value: healthPercentage,
                      warningThreshold: 60,
                      criticalThreshold: 80,
                      inverted: true,
                    },
                  }}
                />
              </Block>
            );
          })}
        </Row>
      )}
    </div>
  );
}
