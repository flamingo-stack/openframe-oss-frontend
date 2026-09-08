'use client';

import { NotFoundError, PageLayout, Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { Copy01Icon, MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, Skeleton, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, Suspense, useEffect, useMemo } from 'react';
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { scriptExecutionDetailRelayQuery as ScriptExecutionDetailQueryType } from '@/__generated__/scriptExecutionDetailRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { useRetryKey } from '@/app/components/shared';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { scriptExecutionDetailRelayQuery } from '@/graphql/scripts/script-execution-detail-relay';
import { getFullImageUrl } from '@/lib/image-url';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { ExecutionSourceBadge } from '../../shared/components/execution-source-badge';
import {
  executionResultText,
  executionStatusLabel,
  executionStatusVariant,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
  isExecutionInFlight,
  machineLabel,
  organizationLabel,
  privilegeLevelLabel,
} from '../../shared/utils/execution-helpers';

interface ScriptExecutionDetailsViewProps {
  executionId: string;
}

/** How often an in-flight execution is re-fetched so its status/output stay live. */
const IN_FLIGHT_POLL_INTERVAL_MS = 5000;

// Unlike the other script pages, this page's header IS data-dependent (subtitle +
// back target come from the execution), so the loaded view and the Suspense
// fallback each render their own `PageLayout` — the fallback with placeholders.

/** A value-over-label cell in the execution detail card (also the base of its skeleton — see {@link DetailCellSkeleton}). */
function DetailCell({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-[140px] flex-[1_0_0] flex-col justify-center gap-[var(--spacing-system-xxs)]">
      {typeof value === 'string' ? <TruncateText variant="h4">{value}</TruncateText> : value}
      <TruncateText variant="h6" tone="secondary">
        {label}
      </TruncateText>
    </div>
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
  const isInFlight = isExecutionInFlight(execution?.status);
  useEffect(() => {
    if (!isInFlight) return undefined;
    const interval = setInterval(() => {
      fetchQuery(
        environment,
        scriptExecutionDetailRelayQuery,
        { id: executionId },
        {
          fetchPolicy: 'network-only',
        },
      ).subscribe({});
    }, IN_FLIGHT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isInFlight, environment, executionId]);

  const handleBack = useSafeBack(
    execution?.scriptId ? routes.scripts.details(execution.scriptId, { tab: 'executions' }) : routes.scripts.list,
  );

  const actions = useMemo<PageActionButton[]>(() => {
    if (!execution) return [];
    const copyDetails = () => {
      const lines = [
        `Execution ID: ${execution.executionId}`,
        `Script Name: ${execution.scriptName ?? '—'}`,
        `Machine ID: ${execution.machine?.machineId ?? '—'}`,
        `Customer: ${organizationLabel(execution.machine) || '—'}`,
        `Executed by: ${initiatorName(execution.initiator)}`,
        `Status: ${executionStatusLabel(execution.status)}`,
        `Privilege Level: ${privilegeLevelLabel(execution.privilegeLevel)}`,
        `Start Time: ${formatExecutionTimestamp(execution.dispatchedAt)}`,
        `Finish Time: ${formatExecutionTimestamp(execution.finishedAt)}`,
        `Execution Time (ms): ${execution.executionTimeMs ?? '—'}`,
        `Result: ${executionResultText(execution) || '—'}`,
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

  const result = executionResultText(execution);
  const org = organizationLabel(execution.machine);

  // The initiator id is a User global id; decode to the raw id the REST-backed
  // employee page expects, then link "Executed by" to that user (new tab).
  const rawInitiatorId = execution.initiator?.id
    ? (decodeGlobalId(execution.initiator.id)?.rawId ?? execution.initiator.id)
    : '';
  const initiatorHref = rawInitiatorId ? employeeDetailHref(rawInitiatorId) : null;
  const isDeletedInitiator = isDeletedUserStatus(execution.initiator?.status);

  return (
    <PageLayout
      title="Script Execution Details"
      subtitle={execution.executionId}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="overflow-hidden rounded-[8px] border border-ods-border bg-ods-card">
        {/* Row 1 — identity */}
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
          <DetailCell value={execution.scriptName ?? '—'} label="Script Name" />
          <DetailCell
            value={
              <div className="flex min-w-0 items-center gap-1">
                <MonitorIcon className="size-6 shrink-0 text-ods-text-secondary" />
                {/* min-w-0 flex-1 wrapper so the name can shrink and ellipsize next to the icon. */}
                <div className="min-w-0 flex-1">
                  <TruncateText variant="h4">{machineLabel(execution.machine)}</TruncateText>
                </div>
              </div>
            }
            label={org || 'Device'}
          />
          <DetailCell
            value={(() => {
              const avatar = isDeletedInitiator ? (
                <DeletedUserAvatar size="md" />
              ) : (
                <SquareAvatar
                  variant="round"
                  size="md"
                  src={getFullImageUrl(execution.initiator?.image?.imageUrl, execution.initiator?.image?.hash)}
                  fallback={initiatorInitials(execution.initiator)}
                  alt={initiatorName(execution.initiator)}
                  initialsClassName="text-ods-text-secondary"
                />
              );
              // The chip sits OUTSIDE the initiator link — inside it, clicking
              // "Mingo" would open the technician's employee page.
              return (
                <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
                  {initiatorHref ? (
                    <a
                      href={initiatorHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 no-underline"
                    >
                      {avatar}
                      <TruncateText
                        variant="h4"
                        className={cn('underline', isDeletedInitiator ? 'text-ods-error' : 'text-ods-accent')}
                      >
                        {initiatorName(execution.initiator)}
                      </TruncateText>
                    </a>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      {avatar}
                      <TruncateText variant="h4" className={isDeletedInitiator ? 'text-ods-error' : undefined}>
                        {initiatorName(execution.initiator)}
                      </TruncateText>
                    </div>
                  )}
                  <ExecutionSourceBadge source={execution.source} />
                </div>
              );
            })()}
            label="Executed by"
          />
          <DetailCell
            value={
              <div className="flex">
                <Tag
                  label={executionStatusLabel(execution.status)}
                  variant={executionStatusVariant(execution.status)}
                />
              </div>
            }
            label="Status"
          />
        </div>

        {/* Row 2 — timing */}
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
          <DetailCell value={privilegeLevelLabel(execution.privilegeLevel)} label="Privilege Level" />
          <DetailCell value={formatExecutionTimestamp(execution.dispatchedAt)} label="Start Time" />
          <DetailCell value={formatExecutionTimestamp(execution.finishedAt)} label="Finish Time" />
          <DetailCell
            value={execution.executionTimeMs != null ? String(execution.executionTimeMs) : '—'}
            label="Execution Time (ms)"
          />
        </div>

        {/* Result — an in-flight execution with no output yet says so (the page
            polls, so the output streams in) instead of a dead-end "—". */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-m)]">
          {result ? (
            <div className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{result}</div>
          ) : (
            <div className="text-ods-text-secondary text-h4">{isInFlight ? 'Waiting for output…' : '—'}</div>
          )}
          <div className="text-ods-text-secondary text-h6">Result</div>
        </div>
      </div>
    </PageLayout>
  );
}

// ----------------------------------------------------------------
// Skeleton — body card only; the header is the page's own `PageLayout`
// ----------------------------------------------------------------

/**
 * A value-over-label cell skeleton in the execution-details card: the real
 * {@link DetailCell} (so wrapper + label markup can never drift) with a bar for
 * the value. The label is static text, so it renders for real — exact `text-h6`
 * line height, no jump on load.
 */
function DetailCellSkeleton({ valueWidth = 'w-28', label }: { valueWidth?: string; label: string }) {
  return <DetailCell value={<Skeleton className={`h-6 ${valueWidth}`} />} label={label} />;
}

/**
 * Card body skeleton: the identity row (Script Name / Device / Executed by /
 * Status), the timing row (Privilege / Start / Finish / Execution Time), then
 * the Result block — mirrors the card markup above, including the 40px avatar
 * that makes the "Executed by" cell (and thus the identity row) taller.
 */
function ExecutionDetailsCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[8px] border border-ods-border bg-ods-card">
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <DetailCellSkeleton valueWidth="w-40" label="Script Name" />
        <DetailCellSkeleton valueWidth="w-32" label="Device" />
        {/* Executed by — round avatar + name, same 40px avatar as the loaded cell */}
        <DetailCell
          value={
            <div className="flex items-center gap-[var(--spacing-system-xsf)]">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-6 w-28" />
            </div>
          }
          label="Executed by"
        />
        <DetailCellSkeleton valueWidth="w-24" label="Status" />
      </div>
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <DetailCellSkeleton valueWidth="w-20" label="Privilege Level" />
        <DetailCellSkeleton valueWidth="w-32" label="Start Time" />
        <DetailCellSkeleton valueWidth="w-32" label="Finish Time" />
        <DetailCellSkeleton valueWidth="w-16" label="Execution Time (ms)" />
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-m)]">
        <Skeleton className="h-6 w-3/4 max-w-full" />
        <div className="text-ods-text-secondary text-h6">Result</div>
      </div>
    </div>
  );
}

const noop = () => {};

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
    <Suspense
      fallback={
        // `loading` + `while-loading` draws a bar where the execution UUID will
        // land. `always` merely reserved the line and left it blank, which read
        // as a header that had finished with nothing to show.
        //
        // It costs the title: `loading` is a single flag on the frozen
        // `TitleBlock` and swaps title AND subtitle for bars, even though this
        // page's title is a constant. Splitting them needs a new prop there.
        <PageLayout
          title="Script Execution Details"
          loading
          subtitleRow="while-loading"
          backButton={{ label: 'Back', onClick: handleBack }}
          actions={LOADING_EXECUTION_ACTIONS}
          className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        >
          <ExecutionDetailsCardSkeleton />
        </PageLayout>
      }
    >
      <ScriptExecutionDetailsContent executionId={executionId} />
    </Suspense>
  );
}
