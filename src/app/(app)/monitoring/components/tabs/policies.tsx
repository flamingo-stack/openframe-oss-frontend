'use client';

import { PlusCircleIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DashboardInfoCard,
  DataTable,
  Input,
  PageLayout,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { PoliciesTable, type PolicyTableRow, type PolicyTableStatus, SectionLoadError } from '@/app/components/shared';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { ConfirmDeleteMonitoringModal } from '../../components/confirm-delete-monitoring-modal';
import { usePolicies } from '../../hooks/use-policies';
import type { Policy } from '../../types/policies.types';
import { computePolicySummary, getPolicyStatus, POLICY_STATUS_CONFIG } from '../../utils/compute-policy-summary';
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
      visiblePolicies.map(policy => {
        const status = getPolicyStatus(policy);
        const config = POLICY_STATUS_CONFIG[status];
        const failing = policy.failing_host_count;
        const responded = policy.passing_host_count + failing;
        const missing = (policy.hosts_include_any?.length ?? 0) - responded;

        let note: PolicyTableStatus['note'];
        if (status === 'partial' && missing > 0) {
          note = { text: `${missing} ${missing === 1 ? 'device' : 'devices'} left`, tone: 'warning' };
        } else if (status === 'failing') {
          note = { text: `${failing} ${failing === 1 ? 'device' : 'devices'}`, tone: 'error' };
        }

        return {
          id: String(policy.id),
          name: policy.name,
          description: policy.description,
          critical: policy.critical,
          severityLabel: policy.critical ? 'Critical' : 'Low',
          status: { label: config.label, variant: config.variant, note },
          // Temporarily hidden along with the Platform column. Restore to re-enable.
          // platforms: parsePlatforms(policy.platform),
          actions: rowActions(policy),
          href: routes.monitoring.policy(policy.id),
        };
      }),
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
      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          // `h-16 md:h-[104px]` is `DashboardInfoCard`'s own height — a plain h-20
          // placeholder is taller on mobile and much shorter on desktop, so the
          // grid visibly jumped when the real cards replaced it.
          <>
            <Skeleton className="h-16 w-full md:h-[104px]" />
            <Skeleton className="h-16 w-full md:h-[104px]" />
            <Skeleton className="h-16 w-full md:h-[104px]" />
            <Skeleton className="h-16 w-full md:h-[104px]" />
          </>
        ) : (
          // `hasData` decides the VALUES, never whether the cards render: with no
          // data there is nothing to skeleton towards — the strip above already
          // says the load failed — and a placeholder that never resolves is the
          // exact lie this contract exists to remove. `—` for the same reason the
          // dashboard counters use it: `computePolicySummary` of an empty list
          // reports "Total Policies 0 / Failed 0", an all-clear a compliance
          // console has not earned.
          <>
            <DashboardInfoCard title="Total Policies" value={hasData ? summary.totalPolicies : '—'} />
            <DashboardInfoCard
              title="Compliance Rate"
              value={
                hasData ? `${summary.compliantPolicies}/${summary.compliantPolicies + summary.failingPolicies}` : '—'
              }
              percentage={hasData ? summary.compliantPoliciesPercentage : undefined}
              showProgress={hasData}
            />
            <DashboardInfoCard
              title="Failed Policies"
              value={hasData ? summary.failingPolicies : '—'}
              percentage={hasData ? summary.failingPoliciesPercentage : undefined}
              showProgress={hasData}
              progressVariant="error"
            />
            <DashboardInfoCard
              title="Updated"
              value={
                !hasData
                  ? '—'
                  : summary.lastUpdatedAt
                    ? formatDistanceToNow(new Date(summary.lastUpdatedAt), { addSuffix: true })
                    : 'N/A'
              }
              valueClassName="!text-h3"
              tooltip="Policy compliance stats are updated hourly. View a policy's devices for real-time status."
            />
          </>
        )}
      </div>

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
