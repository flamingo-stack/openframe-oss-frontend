'use client';

import { NotFoundError, Tag, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ArrowRightUpIcon,
  InboxArrowUpIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  type PageActionButton,
  LoadingItems,
  TabNavigation,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, useMutation } from 'react-relay';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import type { unarchiveScriptMutation as UnarchiveScriptMutationType } from '@/__generated__/unarchiveScriptMutation.graphql';
import { NO_ITEMS, useRetryKey, ValueText } from '@/app/components/shared';
import { LiveSuspense } from '@/app/components/shared/live-suspense';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { ScriptStatus } from '@/generated/schema-enums';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { unarchiveScriptMutation } from '@/graphql/scripts/unarchive-script-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { initiatorName } from '../../shared/utils/execution-helpers';
import { platformsToIds, shellToId } from '../../shared/utils/script-mappers';
import { DETAIL_TABS, SCRIPT_DEFAULT_TAB, scriptTabBody } from './script-detail-tabs';
import { ScriptSummaryCard } from './script-summary-card';

interface ScriptDetailsViewProps {
  scriptId: string;
}

/**
 * The header island. The page title is static ("Script Details"), but the
 * "Archived" tag and the ACTION SET are the record's own answer — an archived
 * script offers Unarchive where an active one offers Run + Edit — so this is
 * what waits for it.
 *
 * A missing script keeps the Back button and drops the actions: the way out has
 * to survive a bad id, and the summary below reports the miss once.
 */
function ScriptHeader({ scriptId }: ScriptDetailsViewProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return <ScriptHeaderView scriptId={scriptId} script={data.script} />;
}

type ScriptRecord = ScriptDetailQueryType['response']['script'];

/**
 * The header's action placeholders: the square "…" menu trigger an active
 * script carries (its Edit Script entry; most scripts are active), then one
 * label-width slot, which is what the header settles into either way: an
 * active script offers "Run Script", an archived one a single "Unarchive".
 * WHICH is the record's answer, so the slot is a neutral bar.
 */
const LOADING_ACTIONS: PageActionButton[] = [{ label: '' }, { label: 'Script action' }];

/**
 * The header over the record (`null`: not found). Before it (`script` undefined, or in a loading scope) the same
 * header draws itself: the static title real, Back working, the action slots placeholders.
 */
function ScriptHeaderView({ scriptId, script }: ScriptDetailsViewProps & { script?: ScriptRecord }) {
  const loading = useLoadingScope() || script === undefined;
  const { toast } = useToast();

  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScriptMutationType>(unarchiveScriptMutation);
  const isArchived = !loading && script?.status === ScriptStatus.ARCHIVED;

  // Back follows the list the script actually belongs to.
  const handleBack = useSafeBack(isArchived ? routes.scripts.archived : routes.scripts.list);

  // Mingo context carries the RAW db id (the route's `scriptId` is the Relay
  // global id) — matching the picker + the `@script:<id>` marker the backend
  // resolver expects. The mention chip re-encodes it to a global id for fetch.
  const scriptDbId = useMemo(() => decodeGlobalId(scriptId)?.rawId ?? scriptId, [scriptId]);
  useTrackOpenView(
    !loading && script ? { type: CONTEXT_ENTITY_KIND.SCRIPT, id: scriptDbId, label: script.name || scriptDbId } : null,
  );

  const handleUnarchive = useCallback(() => {
    if (!script) return;
    commitUnarchive({
      // Nothing to prune from here — the lists own their connections and refetch
      // on navigation. The payload's `status` is what updates this page.
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

  const runHref = routes.scripts.run(scriptId);

  // An archived script can't be run or meaningfully edited — the one thing worth
  // offering is putting it back (design node 1:24107).
  const actions = useMemo<PageActionButton[]>(() => {
    if (loading) return LOADING_ACTIONS;
    if (!script) return [];
    return isArchived
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
              icon: <ArrowRightUpIcon className="h-5 w-5" />,
              'aria-label': 'Open Run Script in new tab',
              href: runHref,
              openInNewTab: true,
            },
          },
        ];
  }, [loading, script, isArchived, handleUnarchive, isUnarchiving, runHref]);

  const menuActions = useMemo<ActionsMenuGroup[]>(
    () =>
      loading || !script || isArchived
        ? []
        : [
            {
              items: [
                {
                  id: 'edit-script',
                  label: 'Edit Script',
                  icon: <PenEditIcon className="h-6 w-6 text-ods-text-secondary" />,
                  href: routes.scripts.edit(scriptId),
                },
              ],
            },
          ],
    [loading, script, isArchived, scriptId],
  );

  return (
    <TitleBlock
      title="Script Details"
      titleAdornment={isArchived ? <Tag label="Archived" variant="grey" /> : undefined}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      loadingActions={loading}
      menuActions={menuActions}
      actionsVariant="menu-primary"
    />
  );
}

/**
 * The summary island: the tag chips and the summary card. Reads the SAME query as
 * the header with the same variables, so Relay dedupes them into one request and
 * both render from the store afterwards.
 *
 * It is also the page's single not-found report: it is the first block under the
 * header, and every other island stays quiet about a missing script so the page
 * says it once.
 */
function ScriptSummary({ scriptId }: ScriptDetailsViewProps) {
  // Shares the header's key deliberately. NOT for network dedupe — that is keyed
  // on `operation.request.identifier` (`loadQuery.js`), which does not contain
  // `fetchKey`, so mismatched keys still share one in-flight request. The reason
  // is `QueryResource`: it retains a REJECTION for 5 minutes keyed by
  // cacheIdentifier, which DOES contain `fetchKey`. A sibling left unkeyed
  // replays that retained error on remount and re-trips the boundary the Retry
  // just cleared.
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return <ScriptSummaryView script={data.script} />;
}

/** Tag chips drawn while the script loads: a typical script carries a couple of tags. */
const SCRIPT_TAGS_SKELETON_COUNT = 2;

/** The script's tag chips. In a loading scope they are tag-shaped bars; a script with none shows the empty mark. */
function ScriptTags({ tags }: { tags: ReadonlyArray<{ id: string; key: string }> | null }) {
  const loading = useLoadingScope() || tags === null;
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-[var(--spacing-system-xs)]">
      {loading ? (
        <LoadingItems count={SCRIPT_TAGS_SKELETON_COUNT}>
          {() => <Tag data-loading-item variant="outline" label="" loading />}
        </LoadingItems>
      ) : tags.length > 0 ? (
        tags.map(tag => <Tag key={tag.id} data-loading-item variant="outline" label={tag.key} />)
      ) : (
        <ValueText value={null} />
      )}
    </div>
  );
}

/**
 * The tag chips and the summary card over the record (`null`: not found). With the record unread (or in a loading
 * scope) both draw themselves.
 */
function ScriptSummaryView({ script }: { script?: ScriptRecord }) {
  if (useLoadingScope() || script === undefined) {
    return (
      <>
        <ScriptTags tags={null} />
        <ScriptSummaryCard name="" shellId="" platforms={NO_ITEMS} author={null} />
      </>
    );
  }
  if (!script) {
    return <NotFoundError message="Script not found" />;
  }

  return (
    <>
      <ScriptTags tags={script.tags ?? []} />
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

/**
 * Script details page.
 *
 * Deliberately NOT `PageLayout`: it takes its header content as props, so a page
 * whose header depends on the record would have to suspend as a whole and every
 * visit would start as a full-page placeholder. Here the page draws
 * `PageLayout`'s own two boxes and composes the frozen `TitleBlock` directly, so
 * only the pieces that actually read the record suspend — the container, the
 * page padding and the tab bar need no data and paint immediately.
 */
export const ScriptDetailsView = memo(function ScriptDetailsViewImpl({ scriptId }: ScriptDetailsViewProps) {
  return (
    // `PageLayout`'s own two boxes, with its own `gap-l` between the page's
    // sections — composing `TitleBlock` by hand changes which parts wait for
    // data, never the spacing.
    <div className="flex w-full flex-col px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <LiveSuspense label="Loading the script" view={<ScriptHeaderView scriptId={scriptId} />}>
        <ScriptHeader scriptId={scriptId} />
      </LiveSuspense>

      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <LoadingSuspense label="Loading script details" fallback={<ScriptSummaryView />}>
          <ScriptSummary scriptId={scriptId} />
        </LoadingSuspense>

        {/* `TabNavigation` renders as a fragment, so its bar and its body are
            siblings — left as direct children of the column above they would be
            pushed apart by its `gap`. Grouped here into ONE flex item instead:
            the bar sits flush on the body, and each tab body owns the top
            padding that separates it from the bar. */}
        <div className="flex flex-col">
          {/* Each tab brings its own body, its own boundary and its own
              skeleton (see `script-detail-tabs.ts`) — this page renders
              whichever one the strip is on and knows nothing else about them. */}
          <TabNavigation tabs={DETAIL_TABS} urlSync defaultTab={SCRIPT_DEFAULT_TAB}>
            {activeTab => {
              const TabBody = scriptTabBody(activeTab);
              return <TabBody scriptId={scriptId} />;
            }}
          </TabNavigation>
        </div>
      </div>
    </div>
  );
});
ScriptDetailsView.displayName = 'ScriptDetailsView';
