'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core';
import {
  LoadingFallback,
  OSTypeBadgeGroup,
  TextLineSkeleton,
  UnifiedSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scriptsRunPickerRelay_query$key } from '@/__generated__/scriptsRunPickerRelay_query.graphql';
import type { scriptsRunPickerRelayPaginationQuery } from '@/__generated__/scriptsRunPickerRelayPaginationQuery.graphql';
import type { scriptsRunPickerRelayQuery as ScriptsRunPickerQueryType } from '@/__generated__/scriptsRunPickerRelayQuery.graphql';
import { platformsToIds } from '@/app/(app)/scripts/shared/utils/script-mappers';
import { scriptsRunPickerRelayFragment, scriptsRunPickerRelayQuery } from '@/graphql/scripts/scripts-run-picker-relay';
import { ScriptsTagFilter } from '../../../scripts/script/components/scripts-tag-filter';

const PICKER_PAGE_SIZE = 20;

interface PickerListProps {
  search: string;
  tagIds: string[];
  onSelect: (scriptId: string) => void;
}

const PICKER_ROW_CLASS =
  'flex w-full items-center gap-[var(--spacing-system-mf)] border-b border-ods-border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] last:border-b-0';

/** A page of picker rows while it is read: name over description, the OS badge's box. */
function PickerRowsSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: PICKER_PAGE_SIZE }, (_, index) => (
        <div key={index} data-loading-item className={PICKER_ROW_CLASS}>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <TextLineSkeleton type="h4" className="w-40" />
            <TextLineSkeleton type="h6" className="w-56 max-w-full" />
          </div>
          <UnifiedSkeleton className="h-4 w-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

/** The scripts to pick from. In a loading scope (the Suspense fallback) it draws its own rows and runs no query. */
function PickerList(props: PickerListProps) {
  if (useLoadingScope()) {
    return <PickerRowsSkeleton />;
  }
  return <PickerListQuery {...props} />;
}

function PickerListQuery({ search, tagIds, onSelect }: PickerListProps) {
  const root = useLazyLoadQuery<ScriptsRunPickerQueryType>(
    scriptsRunPickerRelayQuery,
    { search: search || null, tagIds: tagIds.length > 0 ? tagIds : null, first: PICKER_PAGE_SIZE },
    { fetchPolicy: 'store-and-network' },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    scriptsRunPickerRelayPaginationQuery,
    scriptsRunPickerRelay_query$key
  >(scriptsRunPickerRelayFragment, root as scriptsRunPickerRelay_query$key);
  const scripts = useMemo(
    () => (data.scripts?.edges ?? []).flatMap(e => (e?.node ? [e.node] : [])),
    [data.scripts?.edges],
  );

  // Infinite scroll: load the next page when the bottom sentinel nears the
  // viewport of whichever ancestor scrolls (the modal body). `rootMargin`
  // pre-fetches slightly before it's reached.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNext) return undefined;
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isLoadingNext) loadNext(PICKER_PAGE_SIZE);
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, isLoadingNext, loadNext]);

  if (scripts.length === 0) {
    return (
      <div className="px-[var(--spacing-system-mf)] py-[var(--spacing-system-xl)] text-center text-ods-text-secondary text-h6">
        No scripts found
      </div>
    );
  }

  return (
    <div>
      {scripts.map(script => (
        <button
          key={script.id}
          type="button"
          onClick={() => onSelect(script.id)}
          data-loading-item
          className={`${PICKER_ROW_CLASS} text-left hover:bg-ods-bg-hover`}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <TruncateText variant="h4">{script.name}</TruncateText>
            {script.description && (
              <TruncateText variant="h6" tone="secondary">
                {script.description}
              </TruncateText>
            )}
          </div>
          <OSTypeBadgeGroup osTypes={platformsToIds(script.supportedPlatforms)} iconSize="w-4 h-4" />
        </button>
      ))}
      {hasNext && <div ref={sentinelRef} className="h-px w-full" />}
      {isLoadingNext && <PickerRowsSkeleton />}
    </div>
  );
}

interface RunScriptSelectStepProps {
  onSelect: (scriptId: string) => void;
}

/** Step 1 of the run-script modal — search + tag-filtered list of ACTIVE scripts. */
export function RunScriptSelectStep({ onSelect }: RunScriptSelectStepProps) {
  const [searchInput, setSearchInput] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const debouncedSearch = useDebounce(searchInput, 300);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-l)]">
      {/* Owns its Suspense boundary: while the tags load the bar draws its tag row as a skeleton. */}
      <ScriptsTagFilter
        search={searchInput}
        onSearchChange={setSearchInput}
        tagIds={tagIds}
        onTagIdsChange={setTagIds}
      />

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[6px] border border-ods-border">
        <Suspense
          fallback={
            <LoadingFallback label="Loading scripts">
              <PickerList search={debouncedSearch} tagIds={tagIds} onSelect={onSelect} />
            </LoadingFallback>
          }
        >
          <PickerList search={debouncedSearch} tagIds={tagIds} onSelect={onSelect} />
        </Suspense>
      </div>
    </div>
  );
}
