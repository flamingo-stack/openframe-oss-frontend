'use client';

import { MediaSkeleton, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
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

/** A row of the card: two cells below lg, four at lg+. */
const ROW_CLASS =
  'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 content-md:min-h-20 border-b border-ods-border';
/** The UUID row closes the card: the row without its divider. */
const LAST_ROW_CLASS =
  'flex min-h-14 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] content-md:min-h-20';
/** Mobile (< md): one full-width cell per row, so its divider reaches the card edges. */
const MOBILE_SINGLE_ROW_CLASS =
  'flex min-h-14 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] content-md:hidden';
/** Tablet (md to lg): customer + added-by in one horizontal row. */
const TABLET_PAIR_ROW_CLASS =
  'hidden min-h-20 border-b border-ods-border px-[var(--spacing-system-m)] content-md:flex content-md:items-center content-md:gap-[var(--spacing-system-m)]';
const CUSTOMER_CELL_CLASS = 'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]';
const CARD_CLASS = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
/** Icons: 16px on mobile, 24px on tablet+ (matches the responsive design). */
const ICON_SIZE = 'w-4 h-4 content-md:w-6 content-md:h-6';
const OS_ICON_SIZE = 'w-5 h-5 content-md:w-7 content-md:h-7';
const CUSTOMER_LOGO_CLASS = 'size-10 content-md:size-10';
const CUSTOMER_LABEL = 'Customer ID (Site)';

/** The customer cell: the logo beside the name and its label. While the device is read, the logo and name are bars. */
function CustomerCell({ device, loading }: { device: Device | null; loading: boolean }) {
  const href = device?.organizationId ? routes.customers.details(device.organizationId) : undefined;
  return (
    <>
      <EntityImage
        src={device ? getFullImageUrl(device.organizationImageUrl, device.organizationImageHash) : undefined}
        alt={device?.organization ?? ''}
        className={CUSTOMER_LOGO_CLASS}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {loading ? (
          <TextLineSkeleton type="h4" className="w-28" />
        ) : href ? (
          <Link href={href} className="min-w-0">
            <TruncateText className="text-ods-accent underline hover:opacity-80">
              {device?.organization ?? ''}
            </TruncateText>
          </Link>
        ) : (
          <TruncateText>{device?.organization ?? ''}</TruncateText>
        )}
        <p className="truncate text-ods-text-secondary text-h6">{CUSTOMER_LABEL}</p>
      </div>
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
  // In the page's loading scope every cell draws its own value bar; the layout is the loaded one.
  const loading = useLoadingScope();

  if (!loading && !device) {
    return (
      <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]">
        <div className="text-center text-ods-text-secondary">No device data available</div>
      </div>
    );
  }

  const deviceLabel = [device?.manufacturer, device?.model].filter(Boolean).join(', ');
  const serialNumber = device?.serialNumber || device?.serial_number;
  const uuid = device?.osUuid || device?.machineId || device?.id;

  // Cells defined once and reused across both responsive layouts below.
  const typeIcon = device ? (
    renderDeviceTypeIcon(device.type, `${ICON_SIZE} text-ods-text-secondary`)
  ) : (
    <MediaSkeleton.Icon className={ICON_SIZE} />
  );
  const osIcon = device ? (
    <OSTypeIcon osType={device.osType || device.platform} size={OS_ICON_SIZE} />
  ) : (
    <MediaSkeleton.Icon className={OS_ICON_SIZE} />
  );

  // The original device name — with a nickname in the page title, this cell is
  // where the hostname stays visible alongside the custom name.
  const hostnameCell = (
    <InfoCell value={device ? device.hostname || getDeviceName(device) : null} label="Hostname" skeletonWidth="w-28" />
  );
  const typeCell = <InfoCell value={device?.type} label="Type" icon={typeIcon} skeletonWidth="w-24" />;
  const deviceCell = <InfoCell value={deviceLabel} label="Device" icon={osIcon} skeletonWidth="w-44" />;
  const serialCell = <InfoCell value={serialNumber} label="Serial Number" skeletonWidth="w-52" />;
  const registeredCell = (
    <InfoCell value={formatDateWithTime(device?.registeredAt)} label="Registered" skeletonWidth="w-40" />
  );
  const updatedCell = (
    <InfoCell value={formatDateWithTime(device?.updatedAt || device?.lastSeen)} label="Updated" skeletonWidth="w-40" />
  );

  // Most devices belong to a customer, so the cell is drawn while the device is read.
  const customerInner = (loading || device?.organization) && <CustomerCell device={device} loading={loading} />;

  // Draws its own loading state in the scope.
  const addedByCell = <DeviceAddedByCell userId={device?.addedByUserId} />;
  // Holds a column of the desktop grid that has no cell yet, so the cells
  // around it keep their column.
  const emptyCell = <div className="flex-1" aria-hidden="true" />;

  const canCopyUuid = Boolean(uuid);
  const uuidCell = (
    <InfoCell
      value={uuid ? <span className="break-all">{uuid}</span> : null}
      label="UUID"
      skeletonWidth="w-48"
      icon={
        <button
          type="button"
          onClick={() => uuid && copyUuid(uuid)}
          disabled={!canCopyUuid}
          aria-label="Copy UUID"
          className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uuidCopied ? <CheckIcon className={`${ICON_SIZE} text-ods-accent`} /> : <Copy02Icon className={ICON_SIZE} />}
        </button>
      }
    />
  );

  return (
    <div className={CARD_CLASS}>
      {/* ===== Mobile + Tablet (< lg) ===== */}
      <div className="flex flex-col content-lg:hidden">
        <div className={ROW_CLASS}>
          {hostnameCell}
          {deviceCell}
        </div>
        <div className={ROW_CLASS}>
          {typeCell}
          {serialCell}
        </div>

        {/* Mobile (< md): customer and added-by each as a full-width row. */}
        {customerInner && <div className={MOBILE_SINGLE_ROW_CLASS}>{customerInner}</div>}
        <div className={MOBILE_SINGLE_ROW_CLASS}>{addedByCell}</div>

        {/* Tablet (md to lg): customer + added-by in one horizontal row. */}
        <div className={TABLET_PAIR_ROW_CLASS}>
          {customerInner && <div className={CUSTOMER_CELL_CLASS}>{customerInner}</div>}
          {addedByCell}
        </div>

        <div className={ROW_CLASS}>
          {registeredCell}
          {updatedCell}
        </div>
        <div className={LAST_ROW_CLASS}>{uuidCell}</div>
      </div>

      {/* ===== Desktop (lg+) — a grid of 4 columns ===== */}
      <div className="hidden content-lg:flex content-lg:flex-col">
        {/* Row 1: Hostname · Device · Type · Serial Number */}
        <div className={ROW_CLASS}>
          {hostnameCell}
          {deviceCell}
          {typeCell}
          {serialCell}
        </div>
        {/* Row 2: Customer ID (Site) · — · — · Added by */}
        <div className={ROW_CLASS}>
          {customerInner ? <div className={CUSTOMER_CELL_CLASS}>{customerInner}</div> : emptyCell}
          {emptyCell}
          {emptyCell}
          {addedByCell}
        </div>
        {/* Row 3: Registered · Updated · — · — */}
        <div className={ROW_CLASS}>
          {registeredCell}
          {updatedCell}
          {emptyCell}
          {emptyCell}
        </div>
        {/* Row 4: UUID */}
        <div className={LAST_ROW_CLASS}>{uuidCell}</div>
      </div>
    </div>
  );
}
