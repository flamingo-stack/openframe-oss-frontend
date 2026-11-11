'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { renderDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CodingForkIcon,
  Parcel02Icon,
  ShieldCheckIcon,
  TicketIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  LoadingWhen,
  type PanelRow,
  StackedRowsPanel,
  Tag,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { type ComponentType, type ReactNode, useCallback, useState } from 'react';
import { useTicketsOverview } from '@/app/(app)/dashboard/hooks/use-dashboard-stats';
import { useRevealHeld, useRevealPart } from '@/app/components/shared/reveal-together';
import { SectionLoadError } from '@/app/components/shared/section-load-error';
import { loadErrorProps } from '@/lib/query-state';
import { NeedsYouApprovalsSource } from './needs-you-approvals-source';
import { NeedsYouInsightsSource } from './needs-you-insights-source';
import {
  NEEDS_YOU_PREVIEW_ROWS,
  type NeedsYouEntity,
  type NeedsYouFailure,
  type NeedsYouGates,
  needsYouFooter,
  type NeedsYouReports,
  type NeedsYouRow,
  type NeedsYouSource,
  type NeedsYouView,
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
/** No source runs: what `useNeedsYou(false)` resolves against. */
const NEEDS_YOU_GATES_LOADING: NeedsYouGates = {
  approvals: 'loading',
  incidents: 'loading',
  tickets: 'loading',
  tenants: 'loading',
  software: 'loading',
  disk: 'loading',
};

/**
 * What "Needs you" holds: up to 2 pending approvals, 2 NEW critical incidents, 2
 * escalated Tech Required tickets, 1 cloud tenant whose sync failed, 1 failed software
 * action and 1 device low on disk, in that order (`needs-you-rows.ts`); then a line of
 * counts. Every source is gated like its sidebar entry (`useNeedsYouGates`). Loading until
 * every open source answered; hidden only when no source is open.
 *
 * `sources` must be rendered for the view to fill: the Relay sources render nothing and
 * report what they found (the board's column subscribers do the same). Each fetches under
 * its own boundary, so they run side by side and a failing backend costs only its rows.
 * The tickets source is react-query and is read in place. The Relay sources read
 * `store-or-network` and the tickets query is shared, so a second reader (the v2 sidebar's
 * count) costs no request of its own.
 *
 * `enabled` off: no source runs and the view stays loading.
 */
export function useNeedsYou(enabled = true): { view: NeedsYouView; footer: string | null; sources: ReactNode } {
  const allGates = useNeedsYouGates();
  const gates: NeedsYouGates = enabled ? allGates : NEEDS_YOU_GATES_LOADING;
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

  const sources = (
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
    </>
  );
  return { view, footer, sources };
}

/** How many rows "Needs you" shows (0 while it loads, fails only or is hidden), and the sources that feed it. */
export function useNeedsYouCount(enabled = true): { count: number; sources: ReactNode } {
  const { view, sources } = useNeedsYou(enabled);
  return { count: view.status === 'ready' ? view.rows.length : 0, sources };
}

/**
 * "Needs you" on Start Work (`useNeedsYou`), each row opening its entity's page. Drawn the same
 * size loading and loaded (`NeedsYouPanel`), so the page does not move when it answers.
 */
export function NeedsYouCard() {
  const { view, footer, sources } = useNeedsYou();
  useRevealPart('needs-you', view.status !== 'loading');
  // The page's loading state draws the card's own, as its unanswered sources do, and so does
  // a page still holding its sections (`RevealTogether`).
  const scoped = useLoadingScope();
  const held = useRevealHeld();
  const loading = scoped || held || view.status === 'loading';
  const ready = view.status === 'ready' ? view : null;

  return (
    <>
      {sources}
      {(loading || ready) && (
        <NeedsYouPanel loading={loading} rows={ready?.rows} failures={ready?.failures} footer={footer} />
      )}
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

/** Nothing needs the user: one row in the shape of the others, so the card keeps its size. */
const ALL_CLEAR_ROW: PanelRow = {
  id: 'all-clear',
  columns: [
    {
      key: 'entity',
      leadingIcon: <CheckCircleIcon className={ICON_CLASS} />,
      value: 'Nothing needs you right now',
      label: 'Approvals, critical incidents and escalations will show up here',
    },
  ],
};

interface NeedsYouPanelProps {
  rows?: readonly NeedsYouRow[];
  failures?: readonly NeedsYouFailure[];
  footer?: string | null;
  /** Still being read: `NEEDS_YOU_PREVIEW_ROWS` rows of bars and the counts' bar, beside the real caption. */
  loading?: boolean;
}

/**
 * The card itself, without its sources: what the shell holds in the page's slot (`loading`)
 * needs no request. The caption with the counts beside it, then `NEEDS_YOU_PREVIEW_ROWS` rows,
 * the rest faded out under "Show N more": the same size loading and loaded, whatever the
 * sources answer.
 */
export function NeedsYouPanel({ rows = [], failures = [], footer = null, loading = false }: NeedsYouPanelProps) {
  const panelRows = rows.length > 0 || failures.length > 0 ? rows.map(toPanelRow) : [ALL_CLEAR_ROW];
  const isOffline = failures.some(failure => failure.isOffline);
  const loadingForm = useLoadingScope() || loading;

  return (
    <section aria-label={CAPTION}>
      <LoadingWhen
        loading={loading}
        label="Loading what needs you"
        className="flex flex-col gap-[var(--spacing-system-xxs)]"
      >
        <div className="flex items-center justify-between gap-[var(--spacing-system-m)]">
          <p className="shrink-0 text-ods-text-secondary text-h5">{CAPTION}</p>
          {loadingForm ? (
            <TextLineSkeleton type="h6" as="span" className="w-1/3" />
          ) : (
            footer && (
              <p className="min-w-0 truncate text-ods-text-secondary text-h6" title={footer}>
                {footer}
              </p>
            )
          )}
        </div>
        <StackedRowsPanel
          rows={panelRows}
          loading={loading}
          previewRows={NEEDS_YOU_PREVIEW_ROWS}
          skeleton={{ columns: 2 }}
          listItems
        />
        {!loadingForm && failures.length > 0 && (
          <SectionLoadError
            {...loadErrorProps(isOffline, "Couldn't load everything that needs you.", () => {
              for (const failure of failures) failure.retry();
            })}
          />
        )}
      </LoadingWhen>
    </section>
  );
}
