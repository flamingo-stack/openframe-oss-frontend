'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { renderDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertTriangleIcon,
  CodingForkIcon,
  Parcel02Icon,
  ShieldCheckIcon,
  TicketIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PanelRow, StackedRowsPanel, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { type ComponentType, useCallback, useState } from 'react';
import { useTicketsOverview } from '@/app/(app)/dashboard/hooks/use-dashboard-stats';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { loadErrorProps } from '@/lib/query-state';
import { NeedsYouApprovalsSource } from './needs-you-approvals-source';
import { NeedsYouInsightsSource } from './needs-you-insights-source';
import {
  type NeedsYouEntity,
  type NeedsYouFailure,
  needsYouFooter,
  type NeedsYouReports,
  type NeedsYouRow,
  type NeedsYouSource,
  type ReportSource,
  resolveNeedsYou,
  sameReport,
} from './needs-you-rows';
import { NeedsYouSoftwareSource } from './needs-you-software-source';
import { NeedsYouSourceBoundary } from './needs-you-source-boundary';
import { NeedsYouTenantsSource } from './needs-you-tenants-source';
import { useEscalatedTicketsReport } from './use-escalated-tickets-report';
import { useNeedsYouGates } from './use-needs-you-gates';

const CAPTION = 'Needs you';

// Module constants: each boundary reports a failure for these, from an effect keyed on them.
const APPROVALS: readonly NeedsYouSource[] = ['approvals'];
const INSIGHTS: readonly NeedsYouSource[] = ['incidents', 'disk'];
const TENANTS: readonly NeedsYouSource[] = ['tenants'];
const SOFTWARE: readonly NeedsYouSource[] = ['software'];

/**
 * "Needs you" on Mingo's home: up to 2 pending approvals, 2 NEW critical incidents, 2
 * escalated Tech Required tickets, 1 cloud tenant whose sync failed, 1 failed software
 * action and 1 device low on disk, in that order (`needs-you-rows.ts`), each opening its
 * entity's page; then a line of counts. Every source is gated like its sidebar entry
 * (`useNeedsYouGates`). Loading until every open source answered; gone when nothing needs
 * the user.
 *
 * The Relay sources render nothing and report what they found (the board's column
 * subscribers do the same): each fetches under its own boundary, so they run side by side
 * and a failing backend costs only its rows. The tickets source is react-query and is read
 * in place.
 */
export function NeedsYouCard() {
  const gates = useNeedsYouGates();
  const [reports, setReports] = useState<NeedsYouReports>({});
  // Stable: the sources report from effects keyed on it.
  const report = useCallback<ReportSource>((source, next) => {
    setReports(prev => (sameReport(prev[source], next) ? prev : { ...prev, [source]: next }));
  }, []);

  const tickets = useEscalatedTicketsReport(gates.tickets);
  // The Tickets section's counts (same query, same cache).
  const ticketStats = useTicketsOverview();
  const ticketsOn = gates.tickets === 'on';
  const incidentsReport = reports.incidents;

  const view = resolveNeedsYou(gates, { ...reports, tickets }, ticketsOn && ticketStats.isLoading);
  const footer = needsYouFooter({
    aiHandled: ticketsOn ? ticketStats.aiAssistance : null,
    needTechnician: ticketsOn ? ticketStats.techRequired : null,
    newIncidents:
      gates.incidents === 'on' && incidentsReport?.status === 'ready' ? (incidentsReport.count ?? null) : null,
  });

  return (
    <>
      {gates.approvals === 'on' && (
        <NeedsYouSourceBoundary sources={APPROVALS} onReport={report}>
          <NeedsYouApprovalsSource onReport={report} />
        </NeedsYouSourceBoundary>
      )}
      {gates.incidents === 'on' && (
        <NeedsYouSourceBoundary sources={INSIGHTS} onReport={report}>
          <NeedsYouInsightsSource onReport={report} />
        </NeedsYouSourceBoundary>
      )}
      {gates.tenants === 'on' && (
        <NeedsYouSourceBoundary sources={TENANTS} onReport={report}>
          <NeedsYouTenantsSource onReport={report} />
        </NeedsYouSourceBoundary>
      )}
      {gates.software === 'on' && (
        <NeedsYouSourceBoundary sources={SOFTWARE} onReport={report}>
          <NeedsYouSoftwareSource onReport={report} />
        </NeedsYouSourceBoundary>
      )}

      {view.status === 'loading' && <NeedsYouSkeleton />}
      {view.status === 'ready' && <NeedsYouPanel rows={view.rows} failures={view.failures} footer={footer} />}
    </>
  );
}

const ENTITY_ICON: Record<Exclude<NeedsYouEntity, 'device'>, ComponentType<{ className?: string }>> = {
  approval: ShieldCheckIcon,
  incident: AlertTriangleIcon,
  ticket: TicketIcon,
  tenant: CodingForkIcon,
  software: Parcel02Icon,
};

const ICON_CLASS = 'size-6 text-ods-text-secondary';

function EntityIcon({ row }: { row: NeedsYouRow }) {
  if (row.entity === 'device') return renderDeviceTypeIcon(row.deviceType ?? undefined, ICON_CLASS);
  const Icon = ENTITY_ICON[row.entity];
  return <Icon className={ICON_CLASS} />;
}

/**
 * A row of the card. The name is the row's link, and its `after` box spans the whole row,
 * so the row is one click target and one tab stop, and the focus ring outlines the row.
 */
function toPanelRow(row: NeedsYouRow): PanelRow {
  return {
    id: row.key,
    className: 'relative transition-colors hover:bg-ods-bg-hover',
    columns: [
      {
        key: 'entity',
        leadingIcon: <EntityIcon row={row} />,
        value: (
          <Link
            href={row.href}
            title={row.name}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ods-accent"
          >
            {row.name}
          </Link>
        ),
        label: row.detail || undefined,
      },
      { key: 'reason', content: <Tag label={row.reason} variant={row.tone} />, width: 'shrink-0', align: 'right' },
    ],
  };
}

interface NeedsYouPanelProps {
  rows: readonly NeedsYouRow[];
  failures: readonly NeedsYouFailure[];
  footer: string | null;
}

function NeedsYouPanel({ rows, failures, footer }: NeedsYouPanelProps) {
  const panelRows = rows.map(toPanelRow);

  if (failures.length > 0) {
    const isOffline = failures.some(failure => failure.isOffline);
    panelRows.push({
      id: 'failures',
      className: 'px-[var(--spacing-system-m)] pt-[var(--spacing-system-xs)]',
      content: (
        <SectionLoadError
          {...loadErrorProps(isOffline, "Couldn't load everything that needs you.", () => {
            for (const failure of failures) failure.retry();
          })}
        />
      ),
    });
  }

  if (footer) {
    panelRows.push({
      id: 'footer',
      className: 'p-[var(--spacing-system-m)]',
      content: <p className="text-ods-text-secondary text-h6">{footer}</p>,
    });
  }

  return (
    <section aria-label={CAPTION}>
      <StackedRowsPanel title={CAPTION} rows={panelRows} />
    </section>
  );
}

const SKELETON_ROWS: PanelRow[] = ['row-1', 'row-2'].map(id => ({
  id,
  columns: [
    {
      key: 'entity',
      leadingIcon: <UnifiedSkeleton className="size-6" />,
      value: <UnifiedSkeleton as="span" className="inline-block h-5 w-56 max-w-full" />,
      label: <UnifiedSkeleton as="span" className="inline-block h-4 w-40 max-w-full" />,
    },
    { key: 'reason', content: <UnifiedSkeleton className="h-8 w-28" />, width: 'shrink-0', align: 'right' },
  ],
}));

/** The card while it loads: its real caption over two rows of bars (what they hold is unknown yet). */
function NeedsYouSkeleton() {
  return (
    <LoadingRegion label="Loading what needs you">
      <StackedRowsPanel title={CAPTION} rows={SKELETON_ROWS} />
    </LoadingRegion>
  );
}
