'use client';

import { EntityImage, Skeleton, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import { InfoCell } from '@/app/components/shared/info-cell';
import { InsightStatus } from '@/generated/schema-enums';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { formatInterval } from '../utils/format-interval';
import { INCIDENT_TYPE_LABELS, labelOf } from '../utils/incident-labels';
import type { Incident } from '../utils/incident-transform';
import { IncidentSeverityTag, IncidentStatusTag } from './incident-tags';

/** One strip of the card: cells wrap below the 4-up desktop layout instead of overflowing. */
function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] last:border-b-0">
      {children}
    </div>
  );
}

/** A cell of the strip — the same footprint for the loaded card and its skeleton. */
function Cell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-16 min-w-[140px] flex-[1_0_0] items-center">{children}</div>;
}

interface IncidentSummaryCardProps {
  incident: Incident;
  /** The "Assigned" cell, which owns its own mutations — see `IncidentAssignee`. */
  assigneeSlot: ReactNode;
}

/**
 * The summary card of the incident page: the finding's title and what the
 * detecting query looks for, then two strips — device / customer / detected /
 * assignee, and severity / category / interval / status (+ until, while snoozed).
 */
export function IncidentSummaryCard({ incident, assigneeSlot }: IncidentSummaryCardProps) {
  const snoozedUntil = incident.status === InsightStatus.SNOOZED ? incident.snoozedUntil : null;

  return (
    <div className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <TruncateText variant="h4">{incident.title}</TruncateText>
        {incident.description && <p className="text-ods-text-secondary text-h6">{incident.description}</p>}
      </div>

      <Row>
        <Cell>
          <InfoCell
            icon={renderDeviceTypeIcon(incident.deviceType ?? undefined, 'size-6 text-ods-text-primary')}
            value={
              // Only a device that resolved gets a link — a QA seed or a retired
              // machine has no page to land on.
              incident.hasDevice ? (
                <Link
                  href={routes.devices.details(incident.machineId)}
                  className="text-ods-accent underline hover:text-ods-accent-hover"
                >
                  {incident.deviceName}
                </Link>
              ) : (
                incident.deviceName
              )
            }
            label="Device"
          />
        </Cell>
        <Cell>
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
            <EntityImage
              src={incident.organizationImageUrl}
              alt={incident.organizationName || 'Customer'}
              sizeClassName="size-10"
            />
            <InfoCell
              value={
                <Link
                  href={routes.customers.details(incident.organizationId)}
                  className="text-ods-accent underline hover:text-ods-accent-hover"
                >
                  {incident.organizationName || incident.organizationId}
                </Link>
              }
              label="Customer"
            />
          </div>
        </Cell>
        <Cell>
          <InfoCell value={formatDateTime(incident.detectedAt)} label="Detected" />
        </Cell>
        <Cell>{assigneeSlot}</Cell>
      </Row>

      <Row>
        <Cell>
          <InfoCell value={<IncidentSeverityTag severity={incident.severity} />} label="Severity" />
        </Cell>
        <Cell>
          <InfoCell value={labelOf(INCIDENT_TYPE_LABELS, incident.type)} label="Category" />
        </Cell>
        <Cell>
          <InfoCell value={incident.interval === null ? '—' : formatInterval(incident.interval)} label="Interval" />
        </Cell>
        <Cell>
          <InfoCell value={<IncidentStatusTag status={incident.status} />} label="Status" />
        </Cell>
        {snoozedUntil && (
          <Cell>
            <InfoCell value={formatDateTime(snoozedUntil)} label="Until" />
          </Cell>
        )}
      </Row>
    </div>
  );
}

/** Same header + two strips, every value a bar, so the card keeps its height while the record loads. */
export function IncidentSummaryCardSkeleton() {
  const cell = (label: string, index: number) => (
    <Cell key={index}>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)]">
        <Skeleton className="h-6 w-32" />
        <p className="text-ods-text-secondary text-h6">{label}</p>
      </div>
    </Cell>
  );
  return (
    <div className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-5 w-full max-w-[720px]" />
      </div>
      <Row>{['Device', 'Customer', 'Detected', 'Assigned'].map(cell)}</Row>
      <Row>{['Severity', 'Category', 'Interval', 'Status'].map(cell)}</Row>
    </div>
  );
}
