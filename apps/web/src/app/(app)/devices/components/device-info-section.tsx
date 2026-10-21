'use client';

import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  getDeviceName,
  OSTypeIcon,
  renderDeviceTypeIcon,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { EntityImage, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type React from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatDate, formatTimeWithSeconds, toValidDate } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import type { Device } from '../types/device.types';
import { DeviceAddedByCell } from './device-added-by-cell';

function formatDateWithTime(iso?: string): React.ReactNode {
  const d = toValidDate(iso);
  if (!d) return null;
  return (
    <>
      {formatDate(d)} <span className="text-ods-text-secondary">{formatTimeWithSeconds(d)}</span>
    </>
  );
}

const ROW_CLASS =
  'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 content-md:min-h-20 border-b border-ods-border';
const CARD_CLASS = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
/** Icons: 16px on mobile, 24px on tablet+ (matches the responsive design). */
const ICON_SIZE = 'w-4 h-4 content-md:w-6 content-md:h-6';
const OS_ICON_SIZE = 'w-5 h-5 content-md:w-7 content-md:h-7';

/** An `InfoCell` while the device is read: the real label under a value bar (beside the icon's box, if any). */
function InfoCellSkeleton({ label, valueWidth, iconClass }: { label: string; valueWidth: string; iconClass?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {iconClass && <UnifiedSkeleton className={`${iconClass} shrink-0 rounded-[6px]`} />}
        <TextLineSkeleton type="h4" className={valueWidth} />
      </div>
      <p className="truncate text-ods-text-secondary text-h6">{label}</p>
    </div>
  );
}

/** The customer cell while the device is read: the logo's box beside the name bar and the real label. */
function CustomerCellSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      <UnifiedSkeleton className="size-10 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TextLineSkeleton type="h4" className="w-28" />
        <p className="truncate text-ods-text-secondary text-h6">Customer ID (Site)</p>
      </div>
    </div>
  );
}

/** The section while the device is read: the same responsive rows, the real labels, each value a bar. */
function DeviceInfoSectionSkeleton() {
  const hostname = <InfoCellSkeleton label="Hostname" valueWidth="w-28" />;
  const deviceCell = <InfoCellSkeleton label="Device" valueWidth="w-44" iconClass={OS_ICON_SIZE} />;
  const type = <InfoCellSkeleton label="Type" valueWidth="w-24" iconClass={ICON_SIZE} />;
  const serial = <InfoCellSkeleton label="Serial Number" valueWidth="w-52" />;
  const registered = <InfoCellSkeleton label="Registered" valueWidth="w-40" />;
  const updated = <InfoCellSkeleton label="Updated" valueWidth="w-40" />;
  const uuid = <InfoCellSkeleton label="UUID" valueWidth="w-48" iconClass={ICON_SIZE} />;
  const customer = <CustomerCellSkeleton />;
  // Draws its own skeleton in the scope.
  const addedBy = <DeviceAddedByCell />;
  const emptyCell = <div className="flex-1" aria-hidden="true" />;

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col content-lg:hidden">
        <div className={ROW_CLASS}>
          {hostname}
          {deviceCell}
        </div>
        <div className={ROW_CLASS}>
          {type}
          {serial}
        </div>
        <div className="flex min-h-14 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] content-md:hidden">
          {customer}
        </div>
        <div className="flex min-h-14 items-center border-b border-ods-border px-[var(--spacing-system-m)] content-md:hidden">
          {addedBy}
        </div>
        <div className="hidden min-h-20 border-b border-ods-border px-[var(--spacing-system-m)] content-md:flex content-md:items-center content-md:gap-[var(--spacing-system-m)]">
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customer}</div>
          {addedBy}
        </div>
        <div className={ROW_CLASS}>
          {registered}
          {updated}
        </div>
        <div className="flex min-h-14 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] content-md:min-h-20">
          {uuid}
        </div>
      </div>

      <div className="hidden content-lg:flex content-lg:flex-col">
        <div className={ROW_CLASS}>
          {hostname}
          {deviceCell}
          {type}
          {serial}
        </div>
        <div className={ROW_CLASS}>
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customer}</div>
          {emptyCell}
          {emptyCell}
          {addedBy}
        </div>
        <div className={ROW_CLASS}>
          {registered}
          {updated}
          {emptyCell}
          {emptyCell}
        </div>
        <div className="flex min-h-20 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)]">
          {uuid}
        </div>
      </div>
    </div>
  );
}

interface DeviceInfoSectionProps {
  device: Device | null;
}

export function DeviceInfoSection({ device }: DeviceInfoSectionProps) {
  const { copy: copyUuid, copied: uuidCopied } = useCopyToClipboard({
    successDescription: 'UUID copied to clipboard',
  });

  if (useLoadingScope()) {
    return <DeviceInfoSectionSkeleton />;
  }

  if (!device) {
    return (
      <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]">
        <div className="text-center text-ods-text-secondary">No device data available</div>
      </div>
    );
  }

  const deviceLabel = [device.manufacturer, device.model].filter(Boolean).join(', ');
  const serialNumber = device.serialNumber || device.serial_number;
  const uuid = device.osUuid || device.machineId || device.id;
  const customerImageUrl = getFullImageUrl(device.organizationImageUrl, device.organizationImageHash);
  const customerHref = device.organizationId ? routes.customers.details(device.organizationId) : undefined;

  // Cells defined once and reused across both responsive layouts below.
  const iconSize = ICON_SIZE;
  const typeIcon = renderDeviceTypeIcon(device.type, `${iconSize} text-ods-text-secondary`);

  // The original device name — with a nickname in the page title, this cell is
  // where the hostname stays visible alongside the custom name.
  const hostnameCell = <InfoCell value={device.hostname || getDeviceName(device)} label="Hostname" />;
  const typeCell = <InfoCell value={device.type} label="Type" icon={typeIcon} />;
  const deviceCell = (
    <InfoCell
      value={deviceLabel}
      label="Device"
      icon={<OSTypeIcon osType={device.osType || device.platform} size={OS_ICON_SIZE} />}
    />
  );
  const serialCell = <InfoCell value={serialNumber} label="Serial Number" />;
  const registeredCell = <InfoCell value={formatDateWithTime(device.registeredAt)} label="Registered" />;
  const updatedCell = <InfoCell value={formatDateWithTime(device.updatedAt || device.lastSeen)} label="Updated" />;

  const customerInner = device.organization && (
    <>
      <EntityImage src={customerImageUrl} alt={device.organization} className="size-10 content-md:size-10" />
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

  const addedByCell = <DeviceAddedByCell userId={device.addedByUserId} />;
  // Holds a column of the desktop grid that has no cell yet, so the cells
  // around it keep their column.
  const emptyCell = <div className="flex-1" aria-hidden="true" />;

  const canCopyUuid = Boolean(uuid);
  const uuidCell = (
    <InfoCell
      value={uuid ? <span className="break-all">{uuid}</span> : null}
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

  const rowClass = ROW_CLASS;

  return (
    <div className={CARD_CLASS}>
      {/* ===== Mobile + Tablet (< lg) ===== */}
      <div className="flex flex-col content-lg:hidden">
        <div className={rowClass}>
          {hostnameCell}
          {deviceCell}
        </div>
        <div className={rowClass}>
          {typeCell}
          {serialCell}
        </div>

        {/* Mobile (< md): customer and added-by each as a full-width row so their
            dividers reach the card edges (no horizontal padding constraining
            the border). */}
        {customerInner && (
          <div className="flex min-h-14 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] content-md:hidden">
            {customerInner}
          </div>
        )}
        <div className="flex min-h-14 items-center border-b border-ods-border px-[var(--spacing-system-m)] content-md:hidden">
          {addedByCell}
        </div>

        {/* Tablet (md to lg): customer + added-by in one horizontal row. */}
        <div className="hidden min-h-20 border-b border-ods-border px-[var(--spacing-system-m)] content-md:flex content-md:items-center content-md:gap-[var(--spacing-system-m)]">
          {customerInner && (
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customerInner}</div>
          )}
          {addedByCell}
        </div>

        <div className={rowClass}>
          {registeredCell}
          {updatedCell}
        </div>
        <div className="flex min-h-14 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] content-md:min-h-20">
          {uuidCell}
        </div>
      </div>

      {/* ===== Desktop (lg+) — a grid of 4 columns ===== */}
      <div className="hidden content-lg:flex content-lg:flex-col">
        {/* Row 1: Hostname · Device · Type · Serial Number */}
        <div className={rowClass}>
          {hostnameCell}
          {deviceCell}
          {typeCell}
          {serialCell}
        </div>
        {/* Row 2: Customer ID (Site) · — · — · Added by */}
        <div className={rowClass}>
          {customerInner ? (
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">{customerInner}</div>
          ) : (
            emptyCell
          )}
          {emptyCell}
          {emptyCell}
          {addedByCell}
        </div>
        {/* Row 3: Registered · Updated · — · — */}
        <div className={rowClass}>
          {registeredCell}
          {updatedCell}
          {emptyCell}
          {emptyCell}
        </div>
        {/* Row 4: UUID */}
        <div className="flex min-h-20 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)]">
          {uuidCell}
        </div>
      </div>
    </div>
  );
}
