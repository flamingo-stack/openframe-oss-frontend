'use client';

import { OSTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { EntityImage, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type React from 'react';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatDate, formatTimeWithSeconds } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import type { Device } from '../types/device.types';
import { getDeviceName } from '../utils/device-name';

function formatDateWithTime(iso?: string): React.ReactNode {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return (
    <>
      {formatDate(d)} <span className="text-ods-text-secondary">{formatTimeWithSeconds(d)}</span>
    </>
  );
}

interface DeviceInfoSectionProps {
  device: Device | null;
}

export function DeviceInfoSection({ device }: DeviceInfoSectionProps) {
  const { copy: copyUuid, copied: uuidCopied } = useCopyToClipboard({
    successDescription: 'UUID copied to clipboard',
  });

  if (!device) {
    return (
      <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]">
        <div className="text-center text-ods-text-secondary">No device data available</div>
      </div>
    );
  }

  const deviceLabel = [device.manufacturer, device.model].filter(Boolean).join(', ') || 'Unknown';
  const serialNumber = device.serialNumber || device.serial_number || 'Unknown';
  const uuid = device.osUuid || device.machineId || device.id || 'Unknown';
  // TEMP: assigned-user block is hidden until the backend returns a user entity
  const assignedUser = { username: null, imageUrl: null };
  const assignedUserImageUrl = getFullImageUrl(assignedUser?.imageUrl);
  const customerImageUrl = getFullImageUrl(device.organizationImageUrl, device.organizationImageHash);
  const customerHref = device.organizationId ? routes.customers.details(device.organizationId) : undefined;

  // Cells defined once and reused across both responsive layouts below.
  // Icons: 16px on mobile, 24px on tablet+ (matches the responsive design).
  const iconSize = 'w-4 h-4 md:w-6 md:h-6';
  const typeIcon = renderDeviceTypeIcon(device.type, `${iconSize} text-ods-text-secondary`);

  // The original device name — with a nickname in the page title, this cell is
  // where the hostname stays visible alongside the custom name.
  const hostnameCell = <InfoCell value={device.hostname || getDeviceName(device)} label="Hostname" />;
  const typeCell = <InfoCell value={device.type || 'Unknown'} label="Type" icon={typeIcon} />;
  const deviceCell = (
    <InfoCell
      value={deviceLabel}
      label="Device"
      icon={<OSTypeIcon osType={device.osType || device.platform} size="w-5 h-5 md:w-7 md:h-7" />}
    />
  );
  const serialCell = <InfoCell value={serialNumber} label="Serial Number" />;
  const registeredCell = <InfoCell value={formatDateWithTime(device.registeredAt)} label="Registered" />;
  const updatedCell = <InfoCell value={formatDateWithTime(device.updatedAt || device.lastSeen)} label="Updated" />;

  const customerInner = device.organization && (
    <>
      <EntityImage src={customerImageUrl} alt={device.organization} className="size-10 md:size-10" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {customerHref ? (
          <Link href={customerHref} className="min-w-0">
            <TruncateText className="text-ods-accent underline hover:opacity-80">{device.organization}</TruncateText>
          </Link>
        ) : (
          <TruncateText>{device.organization}</TruncateText>
        )}
        <p className="truncate text-ods-text-secondary text-h6">Customer ID (Site)</p>
      </div>
    </>
  );

  const assignedInner = assignedUser?.username && (
    <>
      <EntityImage src={assignedUserImageUrl} alt={assignedUser.username} className="size-10 rounded-full md:size-10" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TruncateText className="text-ods-accent underline">{assignedUser.username}</TruncateText>
        <p className="truncate text-ods-text-secondary text-h6">Assigned User</p>
      </div>
    </>
  );

  const canCopyUuid = uuid !== 'Unknown';
  const uuidCell = (
    <InfoCell
      value={<span className="break-all">{uuid}</span>}
      label="UUID"
      icon={
        <button
          type="button"
          onClick={() => canCopyUuid && copyUuid(uuid)}
          disabled={!canCopyUuid}
          aria-label="Copy UUID"
          className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uuidCopied ? <CheckIcon className={`${iconSize} text-ods-accent`} /> : <Copy02Icon className={iconSize} />}
        </button>
      }
    />
  );

  const rowClass =
    'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 md:min-h-20 border-b border-ods-border';

  return (
    <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
      {/* ===== Mobile + Tablet (< lg) ===== */}
      <div className="flex flex-col lg:hidden">
        <div className={rowClass}>
          {hostnameCell}
          {deviceCell}
        </div>
        <div className={rowClass}>
          {typeCell}
          {serialCell}
        </div>

        {/* Mobile (< md): customer and assigned each as a full-width row so their
            dividers reach the card edges (no horizontal padding constraining
            the border). */}
        {customerInner && (
          <div className="flex min-h-14 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] md:hidden">
            {customerInner}
          </div>
        )}
        {assignedInner && (
          <div className="flex min-h-14 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] md:hidden">
            {assignedInner}
          </div>
        )}

        {/* Tablet (md to lg): customer + assigned in one horizontal row. */}
        {(customerInner || assignedInner) && (
          <div className="hidden min-h-20 border-b border-ods-border px-[var(--spacing-system-m)] md:flex md:items-center md:gap-[var(--spacing-system-m)]">
            {customerInner && (
              <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customerInner}</div>
            )}
            {assignedInner && (
              <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{assignedInner}</div>
            )}
          </div>
        )}

        <div className={rowClass}>
          {registeredCell}
          {updatedCell}
        </div>
        <div className="flex min-h-14 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] md:min-h-20">
          {uuidCell}
        </div>
      </div>

      {/* ===== Desktop (lg+) — 4 cells per row, matching Figma 9-57016 ===== */}
      <div className="hidden lg:flex lg:flex-col">
        {/* Row 1: Hostname · Device · Type · Customer ID (Site) */}
        <div className={rowClass}>
          {hostnameCell}
          {deviceCell}
          {typeCell}
          {customerInner ? (
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customerInner}</div>
          ) : (
            <div className="flex-1" aria-hidden="true" />
          )}
        </div>
        {/* Row 2: UUID · Serial Number · Registered · Updated */}
        <div className="flex min-h-20 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)]">
          {uuidCell}
          {serialCell}
          {registeredCell}
          {updatedCell}
        </div>
      </div>
    </div>
  );
}
