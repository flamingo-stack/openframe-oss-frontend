'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { SearchToolbar } from '@/app/components/shared/search-toolbar';
import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { MailboxReceivingState, SortDirection } from '@/generated/schema-enums';
import { knownValues } from '@/lib/exhaustive-map';
import { routes } from '@/lib/routes';
import { type MailboxesFilter, type MailboxesSort, MailboxesTable } from './mailboxes-table';

export const EMAIL_TO_TICKET_TITLE = 'Email to ticket';

const CONNECT_MAILBOX_ACTION: PageActionButton = {
  label: 'Connect mailbox',
  variant: 'outline',
  href: routes.settings.emailToTicket.new(),
  icon: <PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />,
};

/** The only sort the API takes (contract part A, `mailboxes`): the 30-day ticket counter. */
const TICKETS_SORT_FIELD = 'ticketsCreated';

function toFilter(statuses: readonly string[]): MailboxesFilter {
  const receivingStates = knownValues(MailboxReceivingState, statuses);
  return receivingStates.length > 0 ? { receivingStates } : null;
}

function toSort(direction: 'asc' | 'desc' | null): MailboxesSort {
  if (!direction) return null;
  return { field: TICKETS_SORT_FIELD, direction: direction === 'desc' ? SortDirection.DESC : SortDirection.ASC };
}

/**
 * `/settings/email-to-ticket` (Figma 4527-132165): the workspace's active mailboxes. Owns the URL state (search, the
 * STATUS funnel, the TICKETS sort) and the sticky toolbar; the rows suspend below it.
 *
 * Not drawn yet, waiting on the backend: the "emails are waiting for review" banner and its Review page (held emails,
 * contract part D).
 */
export function MailboxesView({ loading = false }: { loading?: boolean }) {
  const handleBack = useSafeBack(routes.settings.root());
  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
    status: { type: 'array', default: [] },
    ticketsSort: { type: 'string', default: '' },
  });
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);
  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const ticketsSort = params.ticketsSort === 'asc' || params.ticketsSort === 'desc' ? params.ticketsSort : null;
  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const query = useMemo(
    () => ({ filter: toFilter(params.status), sort: toSort(ticketsSort) }),
    [params.status, ticketsSort],
  );
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(query, debouncedSearch);

  return (
    <PageLayout
      title={EMAIL_TO_TICKET_TITLE}
      subtitle="Emails to these addresses become tickets. Replies go back from the same address."
      backButton={{ label: 'Back to Settings', onClick: handleBack }}
      actions={[CONNECT_MAILBOX_ACTION]}
      actionsVariant="icon-buttons"
    >
      <TableLayoutScope fill>
        <div className="flex flex-col" style={containerStyle}>
          {!isEmpty && (
            <SearchToolbar
              toolbarRef={toolbarRef}
              placeholder="Search for Mailbox"
              value={searchInput}
              onChange={setSearchInput}
              disabled={loading}
            />
          )}
          {/* The flag's own window draws the table in a loading scope: it draws its loading rows and does not fetch. */}
          <LoadingWhen loading={loading}>
            <MailboxesTable
              filter={deferredFilters.filter}
              sort={deferredFilters.sort}
              debouncedSearch={deferredSearch}
              statusSelection={params.status}
              onStatusSelectionChange={next => setParam('status', next)}
              ticketsSort={ticketsSort}
              // Most tickets first on the first click: the busiest mailbox is the one asked about.
              onToggleTicketsSort={() => setParam('ticketsSort', ticketsSort === 'desc' ? 'asc' : 'desc')}
              isPending={isPending}
              onEmptyChange={setIsEmpty}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          </LoadingWhen>
        </div>
      </TableLayoutScope>
    </PageLayout>
  );
}
