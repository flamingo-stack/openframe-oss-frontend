'use client';

import { MediaSkeleton, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { renderDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { EntityImage, Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { InsightStatus } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
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

/** A cell of the strip. */
function Cell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-16 min-w-[140px] flex-[1_0_0] items-center">{children}</div>;
}

/** A tag cell's value before the incident is read: a tag with no label yet, drawn as its skeleton in the scope. */
const TAG_LOADING = <Tag label="" />;

/** The device-type icon's box, shared by the icon and its loading placeholder. */
const DEVICE_ICON_CLASS = 'size-6';

interface IncidentSummaryCardProps {
  /** Absent while the record loads: the card draws itself, every value a bar. */
  incident?: Incident;
  /** The "Assigned" cell, which owns its own mutations and its own loading state — see `IncidentAssignee`. */
  assigneeSlot: ReactNode;
}

/**
 * The summary card of the incident page: the finding's title and what the
 * detecting query looks for, then two strips — device / customer / detected /
 * assignee, and severity / category / interval / status (+ until, while snoozed).
 *
 * In a loading scope (or without the incident) it draws itself: the same cells
 * and labels, the values bars (`InfoCell`), the tags tag-shaped bars, the
 * device icon and customer logo their own placeholders.
 */
export function IncidentSummaryCard({ incident, assigneeSlot }: IncidentSummaryCardProps) {
  const loading = useLoadingScope() || !incident;
  const snoozedUntil = incident?.status === InsightStatus.SNOOZED ? incident.snoozedUntil : null;

  return (
    <div className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        {loading ? (
          <>
            <TextLineSkeleton type="h4" className="w-64 max-w-full" />
            <TextLineSkeleton type="h6" className="w-full max-w-[720px]" />
          </>
        ) : (
          <>
            <TruncateText variant="h4">{incident.title}</TruncateText>
            {incident.description && <p className="text-ods-text-secondary text-h6">{incident.description}</p>}
          </>
        )}
      </div>

      <Row>
        <Cell>
          <InfoCell
            loading={loading}
            icon={
              loading ? (
                <MediaSkeleton.Icon className={DEVICE_ICON_CLASS} />
              ) : (
                renderDeviceTypeIcon(incident.deviceType ?? undefined, `${DEVICE_ICON_CLASS} text-ods-text-primary`)
              )
            }
            value={
              // Only a device that resolved gets a link — a QA seed or a retired
              // machine has no page to land on.
              incident?.hasDevice ? (
                <Link
                  href={routes.devices.details(incident.machineId)}
                  className="text-ods-accent underline hover:text-ods-accent-hover"
                >
                  {incident.deviceName}
                </Link>
              ) : (
                incident?.deviceName
              )
            }
            label="Device"
          />
        </Cell>
        <Cell>
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
            {/* Draws its own size-10 skeleton in the loading scope. */}
            <EntityImage
              src={incident?.organizationImageUrl}
              alt={incident?.organizationName || 'Customer'}
              sizeClassName="size-10"
            />
            <InfoCell
              loading={loading}
              value={
                incident ? (
                  <Link
                    href={routes.customers.details(incident.organizationId)}
                    className="text-ods-accent underline hover:text-ods-accent-hover"
                  >
                    {incident.organizationName || incident.organizationId}
                  </Link>
                ) : null
              }
              label="Customer"
            />
          </div>
        </Cell>
        <Cell>
          <InfoCell loading={loading} value={incident ? formatDateTime(incident.detectedAt) : ''} label="Detected" />
        </Cell>
        <Cell>{assigneeSlot}</Cell>
      </Row>

      <Row>
        <Cell>
          <InfoCell
            loading={loading}
            valueSkeleton={TAG_LOADING}
            value={incident ? <IncidentSeverityTag severity={incident.severity} /> : null}
            label="Severity"
          />
        </Cell>
        <Cell>
          <InfoCell
            loading={loading}
            value={incident ? labelOf(INCIDENT_TYPE_LABELS, incident.type) : ''}
            label="Category"
          />
        </Cell>
        <Cell>
          <InfoCell
            loading={loading}
            value={!incident || incident.interval === null ? EMPTY_VALUE : formatInterval(incident.interval)}
            label="Interval"
          />
        </Cell>
        <Cell>
          <InfoCell
            loading={loading}
            valueSkeleton={TAG_LOADING}
            value={incident ? <IncidentStatusTag status={incident.status} /> : null}
            label="Status"
          />
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
