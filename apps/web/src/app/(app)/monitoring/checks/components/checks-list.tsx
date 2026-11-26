'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, PageLayout, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { insightChecksListQuery as ChecksListQueryType } from '@/__generated__/insightChecksListQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { insightChecksListQuery } from '@/graphql/insights/insight-checks-list-query';
import { routes } from '@/lib/routes';
import { useCheckMutations } from '../hooks/use-check-mutations';
import { type Check, toCheck } from '../utils/check-transform';
import { type CheckDialog, CheckDialogs, toggleCheck } from './check-dialogs';
import { ChecksTable, type CheckTableRow } from './checks-table';

/**
 * Queries → Checks: every built-in health check with its default for all devices and how many
 * exceptions change it. A row opens the check's page; admins and owners switch a check on or off,
 * edit its default and add an exception from the row.
 */
export function ChecksList() {
  const [search, setSearch] = useState('');
  return (
    <PageLayout title="Checks" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <Input
          userValue
          placeholder="Search for Checks"
          value={search}
          onChange={event => setSearch(event.target.value)}
          startAdornment={<SearchIcon />}
        />
        <ContentErrorBoundary message="Couldn't load the checks.">
          <ChecksListIsland search={search} />
        </ContentErrorBoundary>
      </div>
    </PageLayout>
  );
}

function ChecksListIsland({ search }: { search: string }) {
  return (
    <LoadingSuspense label="Loading checks">
      <ChecksListReader search={search} />
    </LoadingSuspense>
  );
}

function ChecksListReader({ search }: { search: string }) {
  if (useLoadingScope()) return <ChecksTable />;
  return <ChecksListLive search={search} />;
}

function matches(check: Check, search: string): boolean {
  const words = search.trim().toLowerCase();
  return !words || check.name.toLowerCase().includes(words) || check.description.toLowerCase().includes(words);
}

function ChecksListLive({ search }: { search: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ChecksListQueryType>(
    insightChecksListQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const checks = data.insightChecks.map(toCheck);
  const canEdit = useAdminGate() === 'admin';
  const [open, setOpen] = useState<{ check: Check; dialog: CheckDialog } | null>(null);
  const mutations = useCheckMutations();

  const rows: CheckTableRow[] = checks
    .filter(check => matches(check, search))
    .map(check => ({
      id: check.id,
      check,
      open: () => router.push(routes.monitoring.check(check.check)),
      actions: canEdit
        ? {
            busy: mutations.isSaving,
            toggle: (enabled: boolean) => toggleCheck(check, enabled, mutations, dialog => setOpen({ check, dialog })),
            editDefault: () => setOpen({ check, dialog: { kind: 'edit-default' } }),
            addOverride: () => setOpen({ check, dialog: { kind: 'override', editing: null } }),
          }
        : null,
    }));

  return (
    <>
      <ChecksTable rows={rows} />
      {open && (
        <CheckDialogs
          check={checks.find(check => check.check === open.check.check) ?? open.check}
          dialog={open.dialog}
          onDialog={dialog => setOpen(dialog ? { check: open.check, dialog } : null)}
          mutations={mutations}
        />
      )}
    </>
  );
}
