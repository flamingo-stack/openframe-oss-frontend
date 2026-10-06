'use client';

import {
  computePolicySummary,
  getPolicyTableStatus,
  PoliciesTable,
  type PolicyTableRow,
  PolicySummaryCards,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DataTable, Input, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { SectionLoadError } from '@/app/components/shared';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { ConfirmDeleteMonitoringModal } from '../../components/confirm-delete-monitoring-modal';
import { usePolicies } from '../../hooks/use-policies';
import type { Policy } from '../../types/policies.types';
import { PoliciesEmptyState } from '../policies-empty-state';

const PAGE_SIZE = 20;

// Temporarily hidden along with the Platform column. Restore to re-enable.
// An empty platform string means the policy applies to every OS, so we render
// the full set of OS icons rather than a plain-text "All" label.
// const ALL_PLATFORMS = ['windows', 'darwin', 'linux'];

// function parsePlatforms(platform: string | undefined): string[] {
//   if (!platform) return [];
//   return platform
//     .split(',')
//     .map(p => p.trim())
//     .filter(Boolean);
// }

// One literal for both the strip above the table and the table's own empty
// slot — they say the same thing and must not drift apart.
const LOAD_ERROR_MESSAGE = "Couldn't load policies.";

export function Policies() {
  const router = useRouter();

  const { params, setParams } = useApiParams({
    search: { type: 'string', default: '' },
  });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Local search keeps typing responsive; the shared hook debounces the write to
  // the URL param so we don't navigate the router (and re-filter) on every keystroke.
  const { search, setSearch, debouncedSearch } = useSearchParam(
    params.search,
    value => setParams({ search: value }),
    300,
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setVisibleCount(PAGE_SIZE);
    },
    [setSearch],
  );

  const { policies, isLoading, isOffline, hasData, canClaimEmpty, error, refetch, deletePolicy } = usePolicies();
  const summary = useMemo(() => computePolicySummary(policies), [policies]);

  // `canClaimEmpty` is the shared precondition (see `lib/query-state.ts`): data
  // arrived and nothing is obscuring it. Without it a failed or offline load —
  // both of which leave the list at length zero — renders "no policies yet"
  // underneath the error strip.
  const showEmptyState = canClaimEmpty && !debouncedSearch.trim() && policies.length === 0;
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

  const filteredPolicies = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.trim() === '') return policies;

    const searchLower = debouncedSearch.toLowerCase().trim();
    return policies.filter(
      policy =>
        policy.name.toLowerCase().includes(searchLower) || policy.description.toLowerCase().includes(searchLower),
    );
  }, [policies, debouncedSearch]);

  const visiblePolicies = useMemo(() => filteredPolicies.slice(0, visibleCount), [filteredPolicies, visibleCount]);

  const rowActions = useCallback(
    (policy: Policy) => [
      {
        label: 'Policy Details',
        onClick: () => router.push(routes.monitoring.policy(policy.id)),
      },
      {
        label: 'Delete Policy',
        onClick: () => setPolicyToDelete(policy),
      },
    ],
    [router],
  );

  // Map the fleet-wide Policy model into the shared table's normalized view-model.
  const rows = useMemo<PolicyTableRow[]>(
    () =>
      visiblePolicies.map(policy => ({
        id: String(policy.id),
        name: policy.name,
        description: policy.description,
        critical: policy.critical,
        severityLabel: policy.critical ? 'Critical' : 'Low',
        status: getPolicyTableStatus(policy),
        // Temporarily hidden along with the Platform column. Restore to re-enable.
        // platforms: parsePlatforms(policy.platform),
        actions: rowActions(policy),
        href: routes.monitoring.policy(policy.id),
      })),
    [visiblePolicies, rowActions],
  );

  const handleLoadMore = useCallback(() => setVisibleCount(prev => prev + PAGE_SIZE), []);

  const handleAddPolicy = useCallback(() => {
    router.push(routes.monitoring.policyNew);
  }, [router]);

  const actions = useMemo(
    () => [
      {
        label: 'Add Policy',
        variant: (showEmptyState ? 'accent' : 'outline') as 'accent' | 'outline',
        icon: (
          <PlusCircleIcon
            size={24}
            className={showEmptyState ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'}
          />
        ),
        onClick: handleAddPolicy,
      },
    ],
    [handleAddPolicy, showEmptyState],
  );

  return (
    <PageLayout
      title="Policies"
      actions={actions}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {(error || isOffline) && <SectionLoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => refetch())} />}
      {/* Summary Stats. `hasData` decides the VALUES, never whether the cards render: with no
          data there is nothing to skeleton towards (the strip above already says the load
          failed), and "Total Policies 0 / Failed 0" is an all-clear a compliance console has
          not earned. */}
      <PolicySummaryCards summary={summary} isLoading={isLoading} hasData={hasData} />

      {showEmptyState ? (
        <PoliciesEmptyState />
      ) : (
        <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
          {/* Sticky Search Bar */}
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Policies"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              startAdornment={<SearchIcon />}
            />
          </div>

          {/* Table */}
          {/* Platform column temporarily hidden from users — omit `showPlatform` to restore. */}
          <PoliciesTable
            rows={rows}
            isLoading={isLoading}
            rowAsLink
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount />}
            skeletonRows={PAGE_SIZE}
            // The table has its own emptiness claim, and zero rows after a failed
            // or offline load would print "No policies found." under the strip
            // above. Same rule, one component down.
            emptyMessage={
              canClaimEmpty
                ? debouncedSearch
                  ? `No policies found matching "${debouncedSearch}". Try adjusting your search.`
                  : 'No policies found.'
                : loadErrorProps(isOffline, LOAD_ERROR_MESSAGE).message
            }
            hasMore={visibleCount < filteredPolicies.length}
            onLoadMore={handleLoadMore}
          />
        </div>
      )}
      <ConfirmDeleteMonitoringModal
        open={!!policyToDelete}
        onOpenChange={open => {
          if (!open) setPolicyToDelete(null);
        }}
        itemName={policyToDelete?.name ?? ''}
        itemType="policy"
        onConfirm={() => {
          if (policyToDelete) {
            deletePolicy(policyToDelete.id, {
              onSuccess: () => setPolicyToDelete(null),
            });
          }
        }}
      />
    </PageLayout>
  );
}
