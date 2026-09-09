'use client';

import { NotFoundError, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { TabNavigation } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { memo, Suspense } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { softwareDetailRelayQuery as SoftwareDetailQueryType } from '@/__generated__/softwareDetailRelayQuery.graphql';
import { InlineSkeleton, useRetryKey } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { softwareDetailRelayQuery } from '@/graphql/software/software-detail-relay';
import { routes } from '@/lib/routes';
import { SOFTWARE_DEFAULT_TAB, SOFTWARE_DETAIL_TABS, softwareTabBody } from './software-detail-tabs';

/** Summary-card cell metrics, shared by the card and its skeleton. */
const CELL = 'flex items-center gap-2 min-h-14 md:min-h-20 px-3 md:px-4 py-3 md:py-4';
const CARD = 'grid grid-cols-1 rounded-md border border-ods-border bg-ods-card md:grid-cols-3';

interface SoftwareDetailViewProps {
  softwareId: string;
}

/**
 * Header + summary card + the name the tabs need.
 *
 * One query, read by both islands below with the same variables, so Relay
 * dedupes them into a single request and each renders from the store afterwards.
 */
function useSoftware(softwareId: string) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareDetailQueryType>(
    softwareDetailRelayQuery,
    { id: softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return data.software;
}

/**
 * The header island. The title IS the record, so this is what waits for it; the
 * Back button is drawn either way, because the way out has to survive a bad id.
 */
function SoftwareHeader({ softwareId }: SoftwareDetailViewProps) {
  const software = useSoftware(softwareId);
  const handleBack = useSafeBack(routes.software.list);

  return (
    <TitleBlock title={software?.name ?? 'Software'} backButton={{ label: 'Back to Software', onClick: handleBack }} />
  );
}

/**
 * The summary island: publisher, type and latest version — and the page's single
 * not-found report, so a bad id is stated once instead of by every tab.
 */
function SoftwareSummary({ softwareId }: SoftwareDetailViewProps) {
  const software = useSoftware(softwareId);

  if (!software) {
    return <NotFoundError message="Software not found" />;
  }

  const cells = [
    <InfoCell key="publisher" value={software.publisher ?? '—'} label="Publisher" />,
    // `type` is APPLICATION | DRIVER — sentence case reads as a value, not a shout.
    <InfoCell
      key="type"
      value={software.type ? software.type.charAt(0) + software.type.slice(1).toLowerCase() : '—'}
      label="Type"
    />,
    <InfoCell key="latest-version" value={software.latestVersion ?? '—'} label="Latest Version" />,
  ];

  return (
    <div className={CARD}>
      {cells.map((cell, idx) => (
        <div key={cell.key} className={cn(CELL, idx < cells.length - 1 && 'border-b border-ods-border md:border-b-0')}>
          {cell}
        </div>
      ))}
    </div>
  );
}

function SoftwareHeaderSkeleton() {
  return <TitleBlock title="Software" loading backButton={{ label: 'Back to Software', onClick: () => {} }} />;
}

function SoftwareSummarySkeleton() {
  return (
    <div className={CARD}>
      {[0, 1, 2].map(idx => (
        <div key={idx} className={cn(CELL, idx < 2 && 'border-b border-ods-border md:border-b-0')}>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <InlineSkeleton className="h-6 w-32" />
            <InlineSkeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Software details page.
 *
 * Deliberately NOT `PageLayout`: it takes its header content as props, so a page
 * whose title is the record itself would suspend as a whole and every visit
 * would start as a full-page placeholder. This draws `PageLayout`'s own two
 * boxes and composes the frozen `TitleBlock` directly, so only the islands that
 * read the record wait — the container, the padding and the tab bar paint at once.
 *
 * The tab BODIES need the software name (the uninstall confirmation says which
 * title it is removing), so they mount under the summary's data — see the inner
 * `SoftwareTabs`, which reads the same deduped query.
 */
export const SoftwareDetailView = memo(function SoftwareDetailViewImpl({ softwareId }: SoftwareDetailViewProps) {
  return (
    // The page padding lives on the wrapper around `ContentErrorBoundary` (see
    // `details/page.tsx`), so a thrown query keeps the chrome indented.
    <div className="flex w-full flex-col">
      <Suspense fallback={<SoftwareHeaderSkeleton />}>
        <SoftwareHeader softwareId={softwareId} />
      </Suspense>

      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <Suspense fallback={<SoftwareSummarySkeleton />}>
          <SoftwareSummary softwareId={softwareId} />
        </Suspense>

        {/* `TabNavigation` renders as a fragment, so its bar and its body are
            siblings — grouped into ONE flex item here so the column's gap can't
            push them apart. Each tab body owns the padding under the bar. */}
        <div className="flex flex-col">
          <Suspense fallback={null}>
            <SoftwareTabs softwareId={softwareId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
});
SoftwareDetailView.displayName = 'SoftwareDetailView';

/**
 * The tab strip and whichever body it is on. Reads the same deduped detail query
 * purely for the software NAME, which the Devices tab quotes in its uninstall
 * confirmation — the tables themselves fetch by id.
 */
function SoftwareTabs({ softwareId }: SoftwareDetailViewProps) {
  const software = useSoftware(softwareId);

  if (!software) {
    return null;
  }

  return (
    <TabNavigation tabs={SOFTWARE_DETAIL_TABS} urlSync defaultTab={SOFTWARE_DEFAULT_TAB}>
      {activeTab => {
        const TabBody = softwareTabBody(activeTab);
        return <TabBody softwareId={softwareId} softwareName={software.name} />;
      }}
    </TabNavigation>
  );
}
