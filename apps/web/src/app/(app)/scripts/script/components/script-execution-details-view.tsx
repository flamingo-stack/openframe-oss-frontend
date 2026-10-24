'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import {
  ExecutionSourceBadge,
  ExecutionStatusCell,
  getDeviceName,
  ScriptExecutionResult,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Copy01Icon, MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useEffect, useMemo } from 'react';
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { scriptExecutionDetailRelayQuery as ScriptExecutionDetailQueryType } from '@/__generated__/scriptExecutionDetailRelayQuery.graphql';
import { LiveSuspense, noop, useRetryKey } from '@/app/components/shared';
import { DETAIL_CELL_CLASS, DETAIL_CELL_GAP_CLASS } from '@/app/components/shared/detail-cell';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { scriptExecutionDetailRelayQuery } from '@/graphql/scripts/script-execution-detail-relay';
import { displayValue, EMPTY_VALUE, isEmptyValue } from '@/lib/empty-value';
import { formatDateTime, formatDateTimeInZone, formatTimeZone, viewerTimeZone } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { ensureGlobalIdForType } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { InitiatorIdentity, toInitiator } from '../../shared/components/initiator-identity';
import {
  executionOutput,
  executionStatusLabel,
  initiatorName,
  isExecutionInFlight,
  privilegeLevelLabel,
} from '../../shared/utils/execution-helpers';

interface ScriptExecutionDetailsViewProps {
  executionId: string;
}

/** How often an in-flight execution is re-fetched so its status/output stay live. */
const IN_FLIGHT_POLL_INTERVAL_MS = 5000;

type ExecutionNode = NonNullable<ScriptExecutionDetailQueryType['response']['node']>;

/**
 * A value-over-label cell: the shared {@link InfoCell}, which draws a text value as a bar in a loading scope and a
 * non-text value in its own scope, where it switches itself.
 */
function DetailCell({
  value,
  label,
  icon,
  labelSkeletonWidth,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  /** The label is read too: while loading it is a bar of this width. */
  labelSkeletonWidth?: string;
}) {
  return (
    <div className={DETAIL_CELL_CLASS}>
      <InfoCell
        value={value}
        label={label}
        icon={icon}
        labelSkeletonWidth={labelSkeletonWidth}
        className={DETAIL_CELL_GAP_CLASS}
      />
    </div>
  );
}

const ROW_CLASS = 'flex flex-wrap items-center gap-[var(--spacing-system-m)]';
const CARD_ROW_CLASS = `${ROW_CLASS} border-b border-ods-border p-[var(--spacing-system-m)]`;

/** Zone | Start | Finish — the two times share the second half, under Status | Execution Time. */
function TimingRow({
  zone,
  zoneLabel,
  start,
  finish,
}: {
  zone: string;
  zoneLabel: string;
  start: string;
  finish: string;
}) {
  return (
    <div className={CARD_ROW_CLASS}>
      <DetailCell value={zone} label={zoneLabel} />
      <div className={cn(ROW_CLASS, DETAIL_CELL_CLASS)}>
        <DetailCell value={start} label="Start Time" />
        <DetailCell value={finish} label="Finish Time" />
      </div>
    </div>
  );
}

/**
 * "Executed by": the person (linked to their page) and the chip of what dispatched the run. It switches itself: in a
 * loading scope the person draws its skeleton and the chip (shown only for a scheduled or assistant run) draws nothing.
 */
function ExecutedByValue({ execution }: { execution: ExecutionNode | null }) {
  const loading = useLoadingScope() || !execution;
  // The chip sits OUTSIDE the initiator link — inside it, clicking
  // "Mingo" would open the technician's employee page.
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <InitiatorIdentity initiator={toInitiator(execution?.initiator)} size="md" loading={loading} />
      {/* Only a scheduled or assistant run has a chip (a manual run, the common case, draws none). Drawn in the loading
          scope too, where it has no source and draws nothing: inline beside the name, so it moves nothing. */}
      <ExecutionSourceBadge source={execution?.source} />
    </div>
  );
}

/**
 * The execution's card. Without the execution (the page's Suspense fallback, in its loading scope) it draws itself:
 * the same rows and labels, every value a bar, the device icon and the avatar kept, the status a tag-shaped bar and
 * the result a bar over its real label. Both timing rows are drawn while loading: the device-clock row is left out
 * only for a device with no known zone.
 */
function ExecutionDetailsCard({ execution, isInFlight }: { execution: ExecutionNode | null; isInFlight: boolean }) {
  const loading = useLoadingScope() || !execution;
  const result = execution ? executionOutput(execution) : null;
  const org = execution?.machine?.organization?.name;
  // The device's current zone: the execution keeps none of its own.
  const deviceZone = execution?.machine?.timezone;
  const deviceZoneLabel = execution ? formatTimeZone(deviceZone, execution.dispatchedAt) : '';

  return (
    <div className="overflow-hidden rounded-[8px] border border-ods-border bg-ods-card">
      {/* Row 1 — the script */}
      <div className={CARD_ROW_CLASS}>
        <DetailCell value={displayValue(execution?.scriptName)} label="Script Name" />
        <DetailCell value={execution ? privilegeLevelLabel(execution.privilegeLevel) : ''} label="Privilege Level" />
      </div>

      {/* Row 2 — identity */}
      <div className={CARD_ROW_CLASS}>
        <DetailCell
          value={execution ? getDeviceName(execution.machine) : ''}
          icon={<MonitorIcon className="size-6 shrink-0 text-ods-text-secondary" />}
          // The device's organization when it has one: read with the execution, so a bar while it loads.
          label={org || 'Device'}
          labelSkeletonWidth="w-24"
        />
        <DetailCell label="Executed by" value={<ExecutedByValue execution={execution} />} />
        <DetailCell
          label="Status"
          // No status while the execution is read: its tag draws its own skeleton in the cell's loading scope.
          value={<ExecutionStatusCell status={execution?.status} />}
        />
        <DetailCell value={formatCount(execution?.executionTimeMs)} label="Execution Time (ms)" />
      </div>

      {/* Rows 3–4 — timing, on the device's clock and on the viewer's */}
      {(loading || !isEmptyValue(deviceZoneLabel)) && (
        <TimingRow
          zone={deviceZoneLabel}
          zoneLabel="Device Timezone"
          start={execution ? formatDateTimeInZone(execution.dispatchedAt, deviceZone) : ''}
          finish={execution ? formatDateTimeInZone(execution.finishedAt, deviceZone) : ''}
        />
      )}
      <TimingRow
        zone={execution ? formatTimeZone(viewerTimeZone(), execution.dispatchedAt) : ''}
        zoneLabel="Your Timezone"
        start={execution ? formatDateTime(execution.dispatchedAt) : ''}
        finish={execution ? formatDateTime(execution.finishedAt) : ''}
      />

      {/* Result — an in-flight execution with no output yet says so (the page
          polls, so the output streams in) instead of a dead-end "—". */}
      <ScriptExecutionResult result={result} inFlight={isInFlight} loading={loading} empty={EMPTY_VALUE} />
    </div>
  );
}

/**
 * The page around the execution: the constant title real, the subtitle (the execution UUID, read) `''` without it,
 * which the title block draws as a bar in the loading scope, and the card.
 */
function ExecutionDetailsPage({
  execution,
  isInFlight,
  onBack,
  actions,
}: {
  execution: ExecutionNode | null;
  isInFlight: boolean;
  onBack: () => void;
  actions: PageActionButton[];
}) {
  return (
    <PageLayout
      title="Script Execution Details"
      subtitle={execution?.executionId ?? ''}
      backButton={{ label: 'Back', onClick: onBack }}
      actions={actions}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <ExecutionDetailsCard execution={execution} isInFlight={isInFlight} />
    </PageLayout>
  );
}

function ScriptExecutionDetailsContent({ executionId }: ScriptExecutionDetailsViewProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptExecutionDetailQueryType>(
    scriptExecutionDetailRelayQuery,
    { id: executionId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const execution = data.node;

  // Live view of an in-flight run: while the execution is QUEUED or RUNNING, poll
  // the node so the status flips and the output streams in without a manual
  // reload. The refetched payload lands in the Relay store, so this component
  // re-renders from it; the interval stops itself once the status is final.
  // While the document is hidden (tab backgrounded / app minimized), the poll
  // is paused rather than firing every 5s against an unwatched tab; it resumes
  // (with an immediate refresh) on visibilitychange once visible again.
  const isInFlight = isExecutionInFlight(execution?.status);
  useEffect(() => {
    if (!isInFlight) return undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = () => {
      fetchQuery(
        environment,
        scriptExecutionDetailRelayQuery,
        { id: executionId },
        {
          fetchPolicy: 'network-only',
        },
      ).subscribe({});
    };

    const start = () => {
      if (interval) return;
      interval = setInterval(poll, IN_FLIGHT_POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = undefined;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        poll();
        start();
      }
    };

    if (!document.hidden) {
      start();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stop();
    };
  }, [isInFlight, environment, executionId]);

  // `scriptId` is the raw DB id, but Script Details resolves its `?id=` through `node(id:)`.
  const handleBack = useSafeBack(
    execution?.scriptId
      ? routes.scripts.details(ensureGlobalIdForType('Script', execution.scriptId), { tab: 'executions' })
      : routes.scripts.list,
  );

  const actions = useMemo<PageActionButton[]>(() => {
    if (!execution) return [];
    const copyDetails = () => {
      const zone = execution.machine?.timezone;
      const zoneLabel = formatTimeZone(zone, execution.dispatchedAt);
      const lines = [
        `Execution ID: ${execution.executionId}`,
        `Script Name: ${displayValue(execution.scriptName)}`,
        `Machine ID: ${displayValue(execution.machine?.machineId)}`,
        `Customer: ${displayValue(execution.machine?.organization?.name)}`,
        `Executed by: ${initiatorName(execution.initiator)}`,
        `Status: ${executionStatusLabel(execution.status)}`,
        `Privilege Level: ${privilegeLevelLabel(execution.privilegeLevel)}`,
        ...(isEmptyValue(zoneLabel)
          ? []
          : [
              `Device Timezone: ${zoneLabel}`,
              `Device Start Time: ${formatDateTimeInZone(execution.dispatchedAt, zone)}`,
              `Device Finish Time: ${formatDateTimeInZone(execution.finishedAt, zone)}`,
            ]),
        `Your Timezone: ${formatTimeZone(viewerTimeZone(), execution.dispatchedAt)}`,
        `Start Time: ${formatDateTime(execution.dispatchedAt)}`,
        `Finish Time: ${formatDateTime(execution.finishedAt)}`,
        `Execution Time (ms): ${displayValue(execution.executionTimeMs)}`,
        `Result: ${displayValue(executionOutput(execution))}`,
      ];
      navigator.clipboard
        ?.writeText(lines.join('\n'))
        .then(() => toast({ title: 'Copied', description: 'Execution details copied', variant: 'success' }))
        .catch(() => toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' }));
    };
    return [
      {
        label: 'Copy Execution Details',
        variant: 'outline' as const,
        icon: <Copy01Icon className="h-6 w-6 text-ods-text-secondary" />,
        onClick: copyDetails,
      },
    ];
  }, [execution, toast]);

  if (!execution) {
    return <NotFoundError message="Execution not found" />;
  }

  return <ExecutionDetailsPage execution={execution} isInFlight={isInFlight} onBack={handleBack} actions={actions} />;
}

/** Disabled Copy placeholder shown in the chrome while the execution loads. */
const LOADING_EXECUTION_ACTIONS: PageActionButton[] = [
  {
    label: 'Copy Execution Details',
    variant: 'outline',
    icon: <Copy01Icon className="h-6 w-6 text-ods-text-secondary" />,
    disabled: true,
    onClick: noop,
  },
];

export function ScriptExecutionDetailsView({ executionId }: ScriptExecutionDetailsViewProps) {
  const handleBack = useSafeBack(routes.scripts.list);

  return (
    <LiveSuspense
      label="Loading execution details"
      // The page before its execution: the same page, drawing itself in the loading scope.
      view={
        <ExecutionDetailsPage
          execution={null}
          isInFlight={false}
          onBack={handleBack}
          actions={LOADING_EXECUTION_ACTIONS}
        />
      }
    >
      <ScriptExecutionDetailsContent executionId={executionId} />
    </LiveSuspense>
  );
}
