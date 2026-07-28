'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import {
  ArrowRightUpIcon,
  BracketCurlyIcon,
  ClockHistoryIcon,
  InboxArrowUpIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  Skeleton,
  type TabItem,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { memo, Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, useMutation } from 'react-relay';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import type { unarchiveScriptMutation as UnarchiveScriptMutationType } from '@/__generated__/unarchiveScriptMutation.graphql';
import { ScriptStatus } from '@/generated/schema-enums';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { unarchiveScriptMutation } from '@/graphql/scripts/unarchive-script-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { initiatorName } from '../utils/execution-helpers';
import { envVarsToStrings, platformsToIds, shellToId } from '../utils/script-mappers';
import { NotFoundSignal } from './not-found-boundary';
import { type ScriptDetailData, ScriptDetailGate } from './script-detail-gate';
import { ScriptDetailsTab } from './script-details-tab';
import { ScriptExecutionsTab } from './script-executions-tab';
import { ScriptPageChrome } from './script-page-chrome';
import { ScriptSummaryCard, ScriptSummaryCardSkeleton } from './script-summary-card';

// Two tabs only — Schedules is intentionally omitted from the v2 details page.
export const DETAIL_TABS: TabItem[] = [
  { id: 'details', label: 'Script Details', icon: BracketCurlyIcon },
  { id: 'executions', label: 'Execution History', icon: ClockHistoryIcon },
];

interface ScriptDetailsViewProps {
  scriptId: string;
}

// ----------------------------------------------------------------
// Header island — tags row + summary card
// ----------------------------------------------------------------

/**
 * Both data islands read the same `scriptDetail` query with identical variables:
 * Relay dedupes identical in-flight requests, so mounting them in one commit
 * still issues a single network call; afterwards both render from the store.
 */
function ScriptHeaderSection({ scriptId }: ScriptDetailsViewProps) {
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network' },
  );
  const script = data.script;

  // Mingo context carries the RAW db id (the route's `scriptId` is the Relay
  // global id) — matching the picker + the `@script:<id>` marker the backend
  // resolver expects. The mention chip re-encodes it to a global id for fetch.
  const scriptDbId = useMemo(() => decodeGlobalId(scriptId)?.rawId ?? scriptId, [scriptId]);
  useTrackOpenView(
    script ? { type: CONTEXT_ENTITY_KIND.SCRIPT, id: scriptDbId, label: script.name || scriptDbId } : null,
  );

  if (!script) {
    throw new NotFoundSignal();
  }

  const tags = script.tags ?? [];

  return (
    <>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-start gap-[var(--spacing-system-xs)]">
          {tags.map(tag => (
            <Tag key={tag.id} variant="outline" label={tag.key} />
          ))}
        </div>
      )}

      <ScriptSummaryCard
        name={script.name}
        description={script.description}
        shellId={shellToId(script.shell)}
        platforms={platformsToIds(script.supportedPlatforms)}
        timeoutSeconds={script.defaultTimeoutSeconds}
        author={script.author ? initiatorName(script.author) : null}
      />
    </>
  );
}

/** Row of clickable tag chips under the title (mirrors the `Tag` outline chips). */
const TAG_CHIP_WIDTHS = ['w-28', 'w-24', 'w-40', 'w-32'];

export function ScriptHeaderSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-start gap-[var(--spacing-system-xs)]">
        {TAG_CHIP_WIDTHS.map(width => (
          <Skeleton key={width} className={`h-8 ${width} rounded-md`} />
        ))}
      </div>
      <ScriptSummaryCardSkeleton />
    </>
  );
}

// ----------------------------------------------------------------
// "Script Details" tab island — args/env cards + source editor
// ----------------------------------------------------------------

function ScriptDetailsTabSection({ scriptId }: ScriptDetailsViewProps) {
  // `store-or-network` (not `-and-`): the header island (mounted for the whole
  // page visit) already revalidated this exact query on page load. This island
  // remounts on every tab switch — reading the store avoids refetching the whole
  // script each time the user returns to the Details tab.
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-or-network' },
  );
  const script = data.script;

  // Not-found is escalated (full-page) by the header island; render nothing here.
  if (!script) {
    return null;
  }

  return (
    <ScriptDetailsTab
      args={script.defaultArgs ? [...script.defaultArgs] : []}
      envVarStrings={envVarsToStrings(script.envVars)}
      scriptBody={script.scriptBody}
      shellId={shellToId(script.shell)}
    />
  );
}

/** Skeleton for a {@link ScriptArgumentsCard}: caption label + key——value rows. */
function InfoCardSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] w-full">
      <Skeleton className="h-5 w-44" />
      <div className="bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-sf)]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-[var(--spacing-system-xsf)]">
            <Skeleton className="h-5 w-20" />
            <div className="flex-1 h-px bg-ods-border" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Code editor block skeleton (Syntax label + editor surface). */
function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <Skeleton className="h-5 w-16" />
      <div className="bg-ods-card border border-ods-border rounded-lg p-[var(--spacing-system-mf)] h-[400px] flex flex-col gap-[var(--spacing-system-xsf)]">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${Math.max(20, 80 - i * 5 + ((i * 17) % 30))}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ScriptDetailsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)]">
        <InfoCardSkeleton />
        <InfoCardSkeleton />
      </div>
      <EditorSkeleton />
    </div>
  );
}

// ----------------------------------------------------------------
// Page shell — chrome renders immediately, data islands suspend
// ----------------------------------------------------------------

/**
 * The page chrome (title, Back, Run/Edit actions, tab bar) depends only on the
 * route's `scriptId`, so it renders immediately — only the data islands (header,
 * tab body) suspend into small colocated skeletons. A missing script is escalated
 * from the header island via {@link NotFoundSignal} and swaps the whole page for
 * the full-page not-found state. The boundary is keyed by `scriptId` so a
 * client-side hop to another script (the router reuses the `[id]` segment)
 * resets a tripped not-found instead of latching it.
 */
function ScriptDetailsChrome({ scriptId, script }: ScriptDetailsViewProps & { script: ScriptDetailData | undefined }) {
  const { toast } = useToast();
  const editHref = routes.scriptsV2.edit(scriptId);
  const runHref = routes.scriptsV2.run(scriptId);

  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScriptMutationType>(unarchiveScriptMutation);
  const archived = script?.status === ScriptStatus.ARCHIVED;

  const handleUnarchive = useCallback(() => {
    if (!script) return;
    commitUnarchive({
      // Nothing to prune from here — the lists own their connections and
      // refetch on navigation. The payload's `status` is what updates this page.
      variables: { id: script.id, connections: [] },
      onCompleted: () => {
        toast({
          title: 'Script unarchived',
          description: `"${script.name}" was moved back to Scripts.`,
          variant: 'success',
        });
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to unarchive script'),
          variant: 'destructive',
        });
      },
    });
  }, [script, commitUnarchive, toast]);

  // An archived script can't be run or meaningfully edited — the one thing
  // worth offering is putting it back (design node 1:24107).
  const actions = useMemo(
    () =>
      archived
        ? [
            {
              label: 'Unarchive',
              variant: 'outline' as const,
              onClick: handleUnarchive,
              icon: <InboxArrowUpIcon className="text-ods-text-secondary" />,
              disabled: isUnarchiving,
              loading: isUnarchiving,
            },
          ]
        : [
            {
              label: 'Run Script',
              href: runHref,
              variant: 'accent' as const,
              // Split button: the divider + arrow half opens the run page in a new tab.
              iconAction: {
                icon: <ArrowRightUpIcon className="w-5 h-5" />,
                'aria-label': 'Open Run Script in new tab',
                href: runHref,
                openInNewTab: true,
              },
            },
          ],
    [archived, handleUnarchive, isUnarchiving, runHref],
  );

  const menuActions = useMemo<ActionsMenuGroup[]>(
    () =>
      archived
        ? []
        : [
            {
              items: [
                {
                  id: 'edit-script',
                  label: 'Edit Script',
                  icon: <PenEditIcon className="w-6 h-6 text-ods-text-secondary" />,
                  href: editHref,
                },
              ],
            },
          ],
    [archived, editHref],
  );

  return (
    <>
      <ScriptPageChrome
        title="Script Details"
        titleAdornment={archived ? <Tag label="Archived" variant="grey" /> : undefined}
        // The action SET depends on the record (archived → Unarchive only), so
        // the buttons wait for it as placeholders instead of guessing.
        loadingActions={!script}
        // Back follows the list the script actually belongs to.
        backFallback={archived ? routes.scriptsV2.archived : routes.scriptsV2.list}
        actions={actions}
        menuActions={menuActions}
        actionsVariant="menu-primary"
      >
        <div className="flex flex-col gap-[var(--spacing-system-lf)]">
          <Suspense fallback={<ScriptHeaderSkeleton />}>
            <ScriptHeaderSection scriptId={scriptId} />
          </Suspense>

          <TabNavigation tabs={DETAIL_TABS} urlSync defaultTab="details">
            {/* One boundary at a fixed position for both tabs, plus the stale
                dimming — same reasoning as the schedule details page, written
                out on `ScheduleDetailsChrome`. */}
            {(activeTab, { isStale }) => (
              <div className={cn('transition-opacity duration-200', isStale && 'opacity-60')}>
                <Suspense fallback={<ScriptDetailsTabSkeleton />}>
                  {activeTab === 'executions' ? (
                    <ScriptExecutionsTab scriptId={scriptId} />
                  ) : (
                    <ScriptDetailsTabSection scriptId={scriptId} />
                  )}
                </Suspense>
              </div>
            )}
          </TabNavigation>
        </div>
      </ScriptPageChrome>
    </>
  );
}

/**
 * Script details page. The gate supplies the record the header needs to know it
 * is archived (and owns the not-found boundary) without making the page wait for
 * it — see {@link ScriptDetailsChrome}.
 */
export const ScriptDetailsView = memo(function ScriptDetailsView({ scriptId }: ScriptDetailsViewProps) {
  return (
    <ScriptDetailGate scriptId={scriptId}>
      {script => <ScriptDetailsChrome scriptId={scriptId} script={script} />}
    </ScriptDetailGate>
  );
});
