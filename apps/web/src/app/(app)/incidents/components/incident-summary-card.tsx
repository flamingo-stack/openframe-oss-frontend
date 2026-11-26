'use client';

import { renderDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CustomerInfoCell, TitleLines } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { InsightStatus } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { formatInterval } from '../utils/format-interval';
import { INCIDENT_TYPE_LABELS, labelOf } from '../utils/incident-labels';
import type { Incident } from '../utils/incident-transform';
import { IncidentCheckRow } from './incident-check-row';
import { SummaryCell } from './incident-summary-cell';
import { SummaryRow } from './incident-summary-row';
import { IncidentSeverityTag, IncidentStatusTag } from './incident-tags';

/** How many lines the detecting query's description typically runs to (a sentence or two at the card's width). */
const DESCRIPTION_SKELETON_LINES = 2;

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
 * device icon and customer logo their own placeholders. Every cell is drawn in
 * both forms but "Until": only a snoozed incident has it, an optional part, so
 * the two strips keep their four columns.
 */
export function IncidentSummaryCard({ incident, assigneeSlot }: IncidentSummaryCardProps) {
  const loading = useLoadingScope() || !incident;
  const snoozedUntil = incident?.status === InsightStatus.SNOOZED ? incident.snoozedUntil : null;

  return (
    <div className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      {/* The description is always drawn: what the detecting query looks for, which nearly every finding states; one
          without it shows the empty mark. It wraps, so while loading it draws its typical line count. */}
      <TitleLines
        title={incident?.title ?? ''}
        subline={incident?.description}
        wrapSubline
        sublineLines={DESCRIPTION_SKELETON_LINES}
        titleSkeletonWidth="w-64"
        sublineSkeletonWidth="w-full max-w-[720px]"
        loading={loading}
        className="gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]"
      />

      <SummaryRow>
        <SummaryCell>
          <InfoCell
            loading={loading}
            icon={renderDeviceTypeIcon(
              incident?.deviceType ?? undefined,
              `${DEVICE_ICON_CLASS} text-ods-text-secondary`,
            )}
            iconSkeleton={{ className: DEVICE_ICON_CLASS }}
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
        </SummaryCell>
        <SummaryCell>
          <CustomerInfoCell
            label="Customer"
            customer={
              incident
                ? {
                    id: incident.organizationId,
                    name: incident.organizationName || incident.organizationId,
                    logoUrl: incident.organizationImageUrl,
                  }
                : null
            }
          />
        </SummaryCell>
        <SummaryCell>
          <InfoCell loading={loading} value={incident ? formatDateTime(incident.detectedAt) : ''} label="Detected" />
        </SummaryCell>
        <SummaryCell>{assigneeSlot}</SummaryCell>
      </SummaryRow>

      <SummaryRow>
        <SummaryCell>
          <InfoCell loading={loading} value={<IncidentSeverityTag severity={incident?.severity} />} label="Severity" />
        </SummaryCell>
        <SummaryCell>
          <InfoCell
            loading={loading}
            value={incident ? labelOf(INCIDENT_TYPE_LABELS, incident.type) : ''}
            label="Category"
          />
        </SummaryCell>
        <SummaryCell>
          <InfoCell
            loading={loading}
            value={!incident || incident.interval === null ? EMPTY_VALUE : formatInterval(incident.interval)}
            label="Interval"
          />
        </SummaryCell>
        <SummaryCell>
          <InfoCell loading={loading} value={<IncidentStatusTag status={incident?.status} />} label="Status" />
        </SummaryCell>
        {snoozedUntil && (
          <SummaryCell optional>
            <InfoCell value={formatDateTime(snoozedUntil)} label="Until" />
          </SummaryCell>
        )}
      </SummaryRow>

      {/* What the finding was measured against and the check that made it: an optional strip, absent from an
          incident no built-in check opened and from one recorded before thresholds were kept. */}
      {incident && <IncidentCheckRow incident={incident} />}
    </div>
  );
}
