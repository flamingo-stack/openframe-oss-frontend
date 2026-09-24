'use client';

import { AlertCircleIcon, DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { dataLossBox_query$key } from '@/__generated__/dataLossBox_query.graphql';
import { formatCount } from '@/lib/format-number';
import { DataLossBoxSkeleton } from './data-loss-box-skeleton';
import { useCancellationImpact } from './use-cancellation-impact';

/**
 * What the workspace loses, counted from the main schema.
 *
 * Articles and the folders they are filed in come in one round trip — the
 * dialog states them as one sentence ("N articles across M folders"), so
 * fetching them apart would let it print half of it.
 *
 * NOT `knowledgeBaseItems(filter: { type: … }).filteredCount`, which answered
 * "0 articles, 21 folders" on a tenant full of both: that connection is scoped
 * to ONE level, so everything filed inside a folder was invisible to it. The
 * two tree queries are the API's own answer — already flat, the whole set in
 * one response, and the count is its length. Only the typename is selected, so
 * the response stays a list of markers; the article bodies never leave the
 * server.
 *
 * Scripts and schedules: ACTIVE only — the default also counts ARCHIVED ones,
 * which are not "data you'll lose" in the same sense, and an archived schedule
 * is not going to run again either way.
 */
const dataLossBoxFragment = graphql`
  fragment dataLossBox_query on Query {
    subscription {
      id
      usage {
        activeDevices
      }
    }
    articles: knowledgeBaseArticleTree {
      __typename
    }
    folders: knowledgeBaseFolderTree {
      __typename
    }
    scripts(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
    scriptSchedules(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
  }
`;

/** "1,200+": a count rounded down to the hundred once it reaches a thousand — what the user is about to lose, not an audit. */
function formatApproximateCount(value: number): string {
  return value >= 1000 ? `${formatCount(Math.floor(value / 100) * 100)}+` : formatCount(value);
}

function DataLossItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start text-ods-text-primary text-h3">
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <span className="flex-1">{children}</span>
    </li>
  );
}

function Stat({ value }: { value: number }) {
  return <span className="text-ods-warning text-h4">{formatApproximateCount(value)}</span>;
}

/**
 * Rows with a zero metric are hidden. The policies/queries row is dropped only
 * when both are zero; otherwise it shows just the non-zero parts. If nothing is
 * left to warn about, the whole box is omitted.
 *
 * Two rows name a second figure — the schedules that would have kept running, the
 * folders the articles are filed in. Both are qualifiers on the row they sit in
 * rather than rows of their own: a schedule with no script and a folder with no
 * articles are not things a customer loses separately, and the design states them
 * in the same sentence. Each is dropped on its own when it is zero, so a workspace
 * with scripts but no schedules reads "12 scripts", not "12 scripts (with 0 …)".
 *
 * One category from the design is still missing: events across monitoring
 * policies. Nothing in the schema or in Fleet counts them, so it is left unsaid
 * rather than guessed at.
 */
export function DataLossBox({ query }: { query: dataLossBox_query$key }) {
  const data = useFragment(dataLossBoxFragment, query);
  // The counts the main schema does not have: tickets live on the ai-agent
  // endpoint, policies and queries on Fleet. The box holds its shape until
  // they land rather than growing rows one source at a time.
  const external = useCancellationImpact();

  if (external == null) return <DataLossBoxSkeleton />;

  const activeDevices = data.subscription?.usage?.activeDevices ?? 0;
  const kbArticles = data.articles.length;
  const kbFolders = data.folders.length;
  const scripts = data.scripts.filteredCount;
  const activeSchedules = data.scriptSchedules.filteredCount;
  const showPolicies = external.monitoringPolicies > 0;
  const showQueries = external.savedQueries > 0;

  const rows = [
    activeDevices > 0 && (
      <DataLossItem key="devices">
        <Stat value={activeDevices} />
        {` active devices monitored`}
      </DataLossItem>
    ),
    external.tickets > 0 && (
      <DataLossItem key="tickets">
        <Stat value={external.tickets} />
        {` tickets and all client communication`}
      </DataLossItem>
    ),
    kbArticles > 0 && (
      <DataLossItem key="kb">
        <Stat value={kbArticles} />
        {` knowledge base articles`}
        {kbFolders > 0 && (
          <>
            {` across `}
            <Stat value={kbFolders} />
            {` folders`}
          </>
        )}
      </DataLossItem>
    ),
    scripts > 0 && (
      <DataLossItem key="scripts">
        <Stat value={scripts} />
        {` scripts`}
        {activeSchedules > 0 && (
          <>
            {` with `}
            <Stat value={activeSchedules} />
            {` active schedules`}
          </>
        )}
      </DataLossItem>
    ),
    (showPolicies || showQueries) && (
      <DataLossItem key="fleet">
        {showPolicies && (
          <>
            <Stat value={external.monitoringPolicies} />
            {` monitoring policies`}
          </>
        )}
        {showPolicies && showQueries && ` and `}
        {showQueries && (
          <>
            <Stat value={external.savedQueries} />
            {` saved queries`}
          </>
        )}
      </DataLossItem>
    ),
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    // `shrink-0` is load-bearing, not defensive. The modal body is a flex column
    // that scrolls, and a flex item's automatic minimum size — the thing that
    // normally stops one shrinking below its content — applies only while its
    // overflow is `visible`. `overflow-hidden` (here, to clip the header band
    // against the rounded border) opts this box out of that protection, so it was
    // the ONE child the column could crush: it collapsed to a sliver instead of
    // pushing the body into a scroll.
    <div className="shrink-0 overflow-hidden rounded-md border border-ods-warning bg-ods-bg">
      <div className="flex items-center gap-[var(--spacing-system-xs)] border-b border-ods-warning bg-[var(--ods-open-yellow-secondary)] p-[var(--spacing-system-xsf)]">
        <AlertCircleIcon className="size-6 shrink-0 text-ods-warning" />
        <p className="flex-1 text-ods-warning text-h6">
          Once your subscription ends, this data will no longer be accessible.
        </p>
      </div>
      <ul className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-s)]">{rows}</ul>
    </div>
  );
}
