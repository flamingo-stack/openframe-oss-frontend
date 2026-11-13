'use client';

import { AgentMark, MediaSkeleton, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { renderDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertTriangleIcon,
  ArrowRightUpIcon,
  CheckCircleIcon,
  CloudIcon,
  MonitorIcon,
  Parcel02Icon,
  ShieldCheckIcon,
  TicketIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  FloatingTooltip,
  LoadingWhen,
  Tag,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ComponentType, type ReactNode, useCallback, useState } from 'react';
import { useTicketsOverview } from '@/app/(app)/dashboard/hooks/use-dashboard-stats';
import { usePendingApprovalCountState } from '@/app/components/mingo-shell/use-pending-approval-count';
import { useRevealHeld, useRevealPart } from '@/app/components/shared/reveal-together';
import { loadErrorProps } from '@/lib/query-state';
import { useMingoLauncherStore } from '../../stores/mingo-launcher-store';
import { NeedsYouApprovalsSource } from './needs-you-approvals-source';
import { NeedsYouInsightsSource } from './needs-you-insights-source';
import {
  categoryHref,
  NEEDS_YOU_CATEGORIES,
  NEEDS_YOU_ROWS,
  NEEDS_YOU_SOURCE_CATEGORY,
  NEEDS_YOU_SOURCES,
  type NeedsYouCategory,
  type NeedsYouCategoryCount,
  type NeedsYouEntity,
  needsYouMingoPrompt,
  type NeedsYouReports,
  type NeedsYouRow,
  type NeedsYouSource,
  type NeedsYouTone,
  type NeedsYouView,
  type ReportSource,
  resolveNeedsYou,
  sameReport,
  type SourceReport,
} from './needs-you-rows';
import { NeedsYouSoftwareSource } from './needs-you-software-source';
import { NeedsYouSourceBoundary } from './needs-you-source-boundary';
import { NeedsYouTenantsSource } from './needs-you-tenants-source';
import { useEscalatedTicketsReport, useTechRequiredStatusIds } from './use-escalated-tickets-report';
import { useNeedsYouDismissed } from './use-needs-you-dismissed';
import { useNeedsYouGates } from './use-needs-you-gates';

const CAPTION = 'Needs your attention:';

// Module constants: each boundary reports a failure for these, from an effect keyed on them.
const APPROVALS: readonly NeedsYouSource[] = ['approvals'];
const INSIGHTS: readonly NeedsYouSource[] = ['incidents', 'disk'];
const TENANTS: readonly NeedsYouSource[] = ['tenants'];
const SOFTWARE: readonly NeedsYouSource[] = ['software'];

interface NeedsYouState {
  view: NeedsYouView;
  /** The categories with a source that is not gated off: what the loading form draws a quick action for. */
  openCategories: readonly NeedsYouCategory[];
  /** Where the Tickets quick action leads. */
  techRequiredStatusIds: readonly string[];
  /** Takes a row out of the queue: the user acted on it. */
  dismiss: (row: NeedsYouRow) => void;
  sources: ReactNode;
}

/**
 * What "Needs you" holds: every row of the six sources (pending approvals, NEW critical
 * incidents, escalated Tech Required tickets, cloud tenants whose sync failed, failed software
 * actions, devices low on disk), newest first, without the ones the user dismissed; and one
 * count per category (`needs-you-rows.ts`). Every source is gated like its sidebar entry
 * (`useNeedsYouGates`). Loading until every open source answered; hidden only when no source
 * is open.
 *
 * `sources` must be rendered for the view to fill: the Relay sources render nothing and
 * report what they found (the board's column subscribers do the same). Each fetches under
 * its own boundary, so they run side by side and a failing backend costs only its rows.
 * The tickets source is react-query and is read in place.
 */
export function useNeedsYou(): NeedsYouState {
  const gates = useNeedsYouGates();
  const [reports, setReports] = useState<NeedsYouReports>({});
  // Stable: the sources report from effects keyed on it.
  const report = useCallback<ReportSource>((source, next) => {
    setReports(prev => (sameReport(prev[source], next) ? prev : { ...prev, [source]: next }));
  }, []);
  const [dismissed, dismiss] = useNeedsYouDismissed();

  const escalated = useEscalatedTicketsReport(gates.tickets);
  const techRequiredStatusIds = useTechRequiredStatusIds(gates.tickets);
  // The Tickets quick action counts every Tech Required ticket: the Tickets section's count (same query, same cache).
  const ticketStats = useTicketsOverview();
  const ticketsOn = gates.tickets === 'on';
  const tickets: SourceReport =
    escalated.status === 'ready' ? { ...escalated, count: ticketStats.techRequired ?? undefined } : escalated;
  // The Approval requests quick action counts every request waiting for a decision, as the server
  // counts them for the sidebar's "Needs approval" badge (same queries, same cache); the source's
  // rows are only the notifications' first page. Where the server does not count (an OSS tenant)
  // or its count failed, the rows count instead.
  const approvalsCount = usePendingApprovalCountState();
  const approvalsReport = reports.approvals;
  const approvals: SourceReport | undefined =
    approvalsReport?.status === 'ready' && approvalsCount.count !== null
      ? { ...approvalsReport, count: approvalsCount.count }
      : approvalsReport;

  const view = resolveNeedsYou(
    gates,
    { ...reports, approvals, tickets },
    {
      pending: (ticketsOn && ticketStats.isLoading) || (gates.approvals === 'on' && approvalsCount.loading),
      dismissed,
    },
  );
  const openCategories = NEEDS_YOU_CATEGORIES.filter(category =>
    NEEDS_YOU_SOURCES.some(source => NEEDS_YOU_SOURCE_CATEGORY[source] === category && gates[source] !== 'off'),
  );

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
  return { view, openCategories, techRequiredStatusIds, dismiss, sources };
}

/**
 * "Needs you" on Start Work and the dashboard (`useNeedsYou`). Drawn the same size loading and
 * loaded (`NeedsYouPanel`), so the page does not move when it answers.
 */
export function NeedsYouCard() {
  const { view, openCategories, techRequiredStatusIds, dismiss, sources } = useNeedsYou();
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
        <NeedsYouPanel
          loading={loading}
          queue={ready?.queue}
          categories={ready?.categories}
          loadingCategories={openCategories}
          techRequiredStatusIds={techRequiredStatusIds}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}

type IconComponent = ComponentType<{ className?: string; size?: number }>;

const ENTITY_ICON: Record<Exclude<NeedsYouEntity, 'device'>, IconComponent> = {
  approval: ShieldCheckIcon,
  incident: AlertTriangleIcon,
  ticket: TicketIcon,
  tenant: CloudIcon,
  software: Parcel02Icon,
};

const ROW_ICON_CLASS = 'size-6 shrink-0 text-ods-text-secondary';

function EntityIcon({ row }: { row: NeedsYouRow }) {
  if (row.entity === 'device') return renderDeviceTypeIcon(row.deviceType ?? undefined, ROW_ICON_CLASS);
  const Icon = ENTITY_ICON[row.entity];
  return <Icon className={ROW_ICON_CLASS} />;
}

/** The shell's attention tint (fill, border, text), with no hover of its own: these tags are not controls. */
const WARNING_TINT_CLASS =
  'border border-ods-warning-tint-border bg-ods-warning-tint text-ods-warning-tint-text hover:bg-ods-warning-tint active:bg-ods-warning-tint';

/** The status tag per tone: critical is the filled red, warning the attention tint, neutral the plain tag. */
const TONE_TAG: Record<NeedsYouTone, { variant: 'critical' | 'warning' | 'outline'; className?: string }> = {
  critical: { variant: 'critical' },
  warning: { variant: 'warning', className: WARNING_TINT_CLASS },
  neutral: { variant: 'outline' },
};

/** A queue row: 48px, its four cells (the item, its status, Mingo, open) in the design's proportions. */
const ROW_CLASS = 'flex h-12 items-stretch border-b border-ods-border';
const ITEM_CELL_CLASS =
  'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-sf)]';
const STATUS_CELL_CLASS = 'flex min-w-0 flex-1 items-center px-[var(--spacing-system-sf)]';
const ACTION_CELL_CLASS = 'w-12 border-l border-ods-border px-0';

/** The last of the three rows sits on the card's own border. */
const rowClass = (index: number) => cn(ROW_CLASS, index === NEEDS_YOU_ROWS - 1 && 'border-b-0');

function QueueRow({
  row,
  index,
  canAskMingo,
  onDismiss,
}: {
  row: NeedsYouRow;
  index: number;
  canAskMingo: boolean;
  onDismiss: (row: NeedsYouRow) => void;
}) {
  const tag = TONE_TAG[row.tone];
  return (
    <li className={rowClass(index)}>
      <div className={ITEM_CELL_CLASS}>
        <EntityIcon row={row} />
        <span className="min-w-0 truncate text-ods-text-primary text-h4" title={row.name}>
          {row.name}
        </span>
      </div>
      <div className={STATUS_CELL_CLASS}>
        <Tag label={row.reason} variant={tag.variant} size="compact" className={cn('max-w-full', tag.className)} />
      </div>
      <FloatingTooltip content="Fix with Mingo" side="top" triggerClassName="flex">
        <Button
          variant="cell"
          className={ACTION_CELL_CLASS}
          aria-label={`Fix with Mingo: ${row.name}`}
          disabled={!canAskMingo}
          onClick={() => {
            useMingoLauncherStore.getState().sendToMingo(needsYouMingoPrompt(row));
            onDismiss(row);
          }}
        >
          <AgentMark agent="mingo" className="size-6" />
        </Button>
      </FloatingTooltip>
      <Button
        variant="cell"
        href={row.href}
        className={ACTION_CELL_CLASS}
        aria-label={`Open ${row.name}`}
        onClick={() => onDismiss(row)}
      >
        <ArrowRightUpIcon />
      </Button>
    </li>
  );
}

/** A queue row while it is read: the loaded row's boxes, with a bar for each thing still coming. */
function LoadingQueueRow({ index }: { index: number }) {
  return (
    <li className={rowClass(index)} data-loading-item>
      <div className={ITEM_CELL_CLASS}>
        <MediaSkeleton.Icon className="shrink-0" />
        <TextLineSkeleton type="h4" as="span" className="w-1/2" />
      </div>
      <div className={STATUS_CELL_CLASS}>
        <Tag label="" loading size="compact" />
      </div>
      <div className={cn('flex items-center justify-center', ACTION_CELL_CLASS)}>
        <MediaSkeleton.Icon />
      </div>
      <div className={cn('flex items-center justify-center', ACTION_CELL_CLASS)}>
        <MediaSkeleton.Icon />
      </div>
    </li>
  );
}

/** Nothing needs the user: said once, in the middle of the queue's box. */
function AllClear() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-m)] text-center"
    >
      <CheckCircleIcon className="mb-[var(--spacing-system-xs)] size-6 text-ods-text-secondary" />
      <p className="text-ods-text-secondary text-h4">All Clear</p>
      <p className="text-ods-text-secondary text-h6">No items need your attention</p>
    </div>
  );
}

const CATEGORY_LABEL: Record<NeedsYouCategory, string> = {
  incidents: 'Incidents',
  approvals: 'Approval requests',
  tickets: 'Tickets',
  tenants: 'Cloud tenants',
  software: 'Software',
  devices: 'Devices',
};

const CATEGORY_ICON: Record<NeedsYouCategory, IconComponent> = {
  incidents: AlertTriangleIcon,
  approvals: ShieldCheckIcon,
  tickets: TicketIcon,
  tenants: CloudIcon,
  software: Parcel02Icon,
  devices: MonitorIcon,
};

/**
 * A quick action's colour while its category holds something: incidents red, approvals and tickets the attention
 * tint; the rest, and any category at 0, the plain tag. A count of 0 (or none, when it failed) is grey. ODS has no red twin of the warning tint yet (Figma's red chip
 * fill), so the red chip is the error-secondary tag with a border.
 */
const CATEGORY_ACTIVE_TAG: Partial<Record<NeedsYouCategory, { variant: 'error' | 'warning'; className: string }>> = {
  incidents: { variant: 'error', className: 'border border-ods-error-secondary-active' },
  approvals: { variant: 'warning', className: WARNING_TINT_CLASS },
  tickets: { variant: 'warning', className: WARNING_TINT_CLASS },
};

const CHIP_BUTTON_CLASS = 'flex w-auto shrink-0';

function CategoryChip({ entry, href }: { entry: NeedsYouCategoryCount; href: string }) {
  const label = CATEGORY_LABEL[entry.category];
  const Icon = CATEGORY_ICON[entry.category];
  const { count } = entry;
  const active = count !== null && count > 0 ? CATEGORY_ACTIVE_TAG[entry.category] : undefined;
  const tag = (
    <Tag
      variant={active?.variant ?? 'outline'}
      size="compact"
      className={active?.className}
      icon={<Icon size={16} />}
      label={
        <>
          {label} <span className={cn(!count && 'text-ods-text-secondary')}>({count === null ? '—' : count})</span>
        </>
      }
    />
  );

  if (count === null) {
    const { message, onRetry } = loadErrorProps(
      entry.failures.some(failure => failure.isOffline),
      `Couldn't load ${label.toLowerCase()}`,
      () => {
        for (const failure of entry.failures) failure.retry();
      },
    );
    return (
      <FloatingTooltip content={onRetry ? `${message}. Retry` : message} side="top" triggerClassName="flex">
        {onRetry ? (
          <Button variant="card" className={CHIP_BUTTON_CLASS} aria-label={`${message}. Retry`} onClick={onRetry}>
            {tag}
          </Button>
        ) : (
          <Button variant="card" href={href} className={CHIP_BUTTON_CLASS} aria-label={`${label}: ${message}`}>
            {tag}
          </Button>
        )}
      </FloatingTooltip>
    );
  }
  return (
    <Button variant="card" href={href} className={CHIP_BUTTON_CLASS} aria-label={`${label} (${count})`}>
      {tag}
    </Button>
  );
}

/** A quick action while its count is read: the real icon and label, a bar in place of the count. */
function LoadingCategoryChip({ category }: { category: NeedsYouCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <Tag
      variant="outline"
      size="compact"
      data-loading-item
      icon={<Icon size={16} />}
      label={
        <>
          {CATEGORY_LABEL[category]}{' '}
          <TextLineSkeleton type="inherit" as="span" className="inline-block w-[3ch] align-middle" />
        </>
      }
    />
  );
}

interface NeedsYouPanelProps {
  /** Every row still needing the user, newest first; the first `NEEDS_YOU_ROWS` are drawn. */
  queue?: readonly NeedsYouRow[];
  categories?: readonly NeedsYouCategoryCount[];
  /** The quick actions the loading form draws: the categories not gated off (all of them by default). */
  loadingCategories?: readonly NeedsYouCategory[];
  techRequiredStatusIds?: readonly string[];
  onDismiss?: (row: NeedsYouRow) => void;
  /** Still being read: the queue's three rows and the quick actions, in their loaded boxes. */
  loading?: boolean;
}

/** The loading form draws the queue's full height: every row it can show. */
const NEEDS_YOU_SKELETON_ROWS = NEEDS_YOU_ROWS;

const NO_ROWS: readonly NeedsYouRow[] = [];
const NO_COUNTS: readonly NeedsYouCategoryCount[] = [];
const NO_IDS: readonly string[] = [];
const noop = () => {};

/**
 * The block itself, without its sources: what the shell holds in the page's slot (`loading`)
 * needs no request. The caption, the queue (always `NEEDS_YOU_ROWS` rows high, whatever it holds,
 * loading included, so the page never moves when it answers), and the category quick actions
 * under it, which wrap onto more lines on a narrow column.
 */
export function NeedsYouPanel({
  queue = NO_ROWS,
  categories = NO_COUNTS,
  loadingCategories = NEEDS_YOU_CATEGORIES,
  techRequiredStatusIds = NO_IDS,
  onDismiss = noop,
  loading = false,
}: NeedsYouPanelProps) {
  const loadingForm = useLoadingScope() || loading;
  const canAskMingo = useMingoLauncherStore(state => state.dockMounted);
  const shown = queue.slice(0, NEEDS_YOU_ROWS);

  let body: ReactNode;
  if (loadingForm) {
    body = (
      <ul aria-hidden className="h-full">
        {Array.from({ length: NEEDS_YOU_SKELETON_ROWS }, (_slot, index) => (
          <LoadingQueueRow key={index} index={index} />
        ))}
      </ul>
    );
  } else if (shown.length === 0) {
    body = <AllClear />;
  } else {
    body = (
      <ul className="h-full">
        {shown.map((row, index) => (
          <QueueRow key={row.key} row={row} index={index} canAskMingo={canAskMingo} onDismiss={onDismiss} />
        ))}
      </ul>
    );
  }

  return (
    <section aria-label="Needs your attention">
      <LoadingWhen
        loading={loadingForm}
        label="Loading what needs your attention"
        className="flex flex-col gap-[var(--spacing-system-mf)]"
      >
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <p className="text-ods-text-secondary text-h5">{CAPTION}</p>
          {/* Three 48px rows inside a 1px border, whatever the queue holds. */}
          <div
            data-testid="needs-you-queue"
            className="box-content h-36 overflow-clip rounded-md border border-ods-border bg-ods-card"
          >
            {body}
          </div>
        </div>
        <div className="flex flex-wrap gap-[var(--spacing-system-xsf)]">
          {loadingForm
            ? loadingCategories.map(category => <LoadingCategoryChip key={category} category={category} />)
            : categories.map(entry => (
                <CategoryChip
                  key={entry.category}
                  entry={entry}
                  href={categoryHref(entry.category, { techRequiredStatusIds })}
                />
              ))}
        </div>
      </LoadingWhen>
    </section>
  );
}
