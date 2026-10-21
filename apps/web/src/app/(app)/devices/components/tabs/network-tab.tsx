'use client';

import { InfoCard } from '@flamingo-stack/openframe-frontend-core';
import { Hierarchy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { EMPTY_CARD, labelsOf } from '@/app/components/shared/info-card-loading';
import type { Device } from '../../types/device.types';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface NetworkTabProps {
  device: Device | null;
}

type InfoRow = { label: string; value?: string | null; copyable?: boolean };

function toItems(rows: InfoRow[]): Array<{ label: string; value: string; copyable?: boolean }> {
  return rows
    .filter(row => row.value !== undefined && row.value !== null && String(row.value).trim() !== '')
    .map(row => ({ label: row.label, value: String(row.value), copyable: row.copyable }));
}

/** Numeric-aware sort for dotted IPv4 / CIDR strings. */
function sortIpv4(addresses: string[]): string[] {
  return [...addresses].sort((a, b) => {
    const aParts = a.split(/[./]/).map(Number);
    const bParts = b.split(/[./]/).map(Number);
    for (let i = 0; i < 4; i++) {
      if (aParts[i] !== bParts[i]) return (aParts[i] || 0) - (bParts[i] || 0);
    }
    return 0;
  });
}

function Labeled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="uppercase text-ods-text-secondary text-h5">{title}</h3>
      {children}
    </div>
  );
}

/** IP rows a card draws while the device is read: a typical device's addresses (the list has no limit). */
const TYPICAL_IP_ROWS = 2;

export function NetworkTab({ device }: NetworkTabProps) {
  const loading = useLoadingScope();

  if (!loading && !device) {
    return (
      <TabEmptyState
        icon={<Hierarchy02Icon />}
        title="No network data found"
        description="Network details for this device will appear here."
      />
    );
  }

  const allIps = device?.local_ips || [];
  const fleetPrimaryIp = device?.primary_ip;

  const ipv4Addresses: string[] = [];
  const ipv6Addresses: string[] = [];
  for (const ip of allIps) {
    (ip.includes(':') ? ipv6Addresses : ipv4Addresses).push(ip);
  }

  // Keep the Fleet primary IPv4 pinned at the top; sort the rest numerically.
  let sortedIpv4 = sortIpv4(ipv4Addresses);
  if (fleetPrimaryIp && sortedIpv4.includes(fleetPrimaryIp)) {
    sortedIpv4 = [fleetPrimaryIp, ...sortedIpv4.filter(ip => ip !== fleetPrimaryIp)];
  }
  const sortedIpv6 = [...ipv6Addresses].sort();

  // Interface identity — Public/Primary IP + MAC (MAC was previously not surfaced here).
  const interfaceRows: InfoRow[] = [
    { label: 'Public IP', value: device?.public_ip, copyable: true },
    { label: 'Primary IPv4', value: device?.primary_ip, copyable: true },
    { label: 'MAC Address', value: device?.primary_mac || device?.macAddress, copyable: true },
  ];
  const interfaceItems = toItems(interfaceRows);

  // Location — Fleet built-in GeoIP on the public IP (city/country when available).
  const locationRows: InfoRow[] = [
    { label: 'City', value: device?.geolocation?.city },
    { label: 'Country', value: device?.geolocation?.country },
  ];
  const locationItems = toItems(locationRows);

  const hasIpv4 = sortedIpv4.length > 0;
  const hasIpv6 = sortedIpv6.length > 0;

  // While the device is read every section is drawn, each card its own skeleton.
  const showInterface = loading || interfaceItems.length > 0;
  const showLocation = loading || locationItems.length > 0;
  const showIpv4 = loading || hasIpv4;
  const showIpv6 = loading || hasIpv6;

  if (!loading && interfaceItems.length === 0 && locationItems.length === 0 && !hasIpv4 && !hasIpv6) {
    if (device?.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<Hierarchy02Icon />} section="Network" />;
    }
    return (
      <TabEmptyState
        icon={<Hierarchy02Icon />}
        title="No network data found"
        description="Network details for this device will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {showInterface && (
        <Labeled title="Network">
          <InfoCard
            data={loading ? EMPTY_CARD : { items: interfaceItems }}
            skeleton={{ rows: labelsOf(interfaceRows), title: false }}
          />
        </Labeled>
      )}

      {showLocation && (
        <Labeled title="Location">
          <InfoCard
            data={loading ? EMPTY_CARD : { items: locationItems }}
            skeleton={{ rows: labelsOf(locationRows), title: false }}
          />
        </Labeled>
      )}

      {(showIpv4 || showIpv6) && (
        <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] content-lg:grid-cols-2">
          {showIpv4 && (
            <Labeled title="IPv4 Addresses">
              <InfoCard
                data={loading ? EMPTY_CARD : { items: [{ value: sortedIpv4, copyable: true }] }}
                skeleton={{ rows: TYPICAL_IP_ROWS, unlabelledRows: true, title: false }}
              />
            </Labeled>
          )}
          {showIpv6 && (
            <Labeled title="IPv6 Addresses">
              <InfoCard
                data={loading ? EMPTY_CARD : { items: [{ value: sortedIpv6, copyable: true }] }}
                skeleton={{ rows: TYPICAL_IP_ROWS, unlabelledRows: true, title: false }}
              />
            </Labeled>
          )}
        </div>
      )}
    </div>
  );
}
