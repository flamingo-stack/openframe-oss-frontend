'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core';
import {
  Board,
  type BoardChange,
  type BoardColumnDef,
  type BoardTicket,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, PageError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { appendImageHash } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { useApprovalRequests } from '../hooks/use-approval-requests';
import { useMoveTicket, useMovingTicketIds } from '../hooks/use-move-ticket';
import { useTicketStatusTransitionRules } from '../hooks/use-ticket-status-transition-rules';
import { emphasizeNewTicketAction, useTicketsActions } from '../hooks/use-tickets-actions';
import type { TicketsPage } from '../services/ticket-service.types';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import {
  mapDefinitionToSystem,
  type TicketStatusDefinition,
  usesCanonicalStatusStyle,
} from '../statuses/types/ticket-statuses.types';
import type { Dialog } from '../types/dialog.types';
import { hasActiveAiDialog } from '../utils/ai-dialog';
import { dialogsQueryKeys, ticketsQueryKeys } from '../utils/query-keys';
import { AssigneeFilter } from './assignee-filter';
import { BoardAssigneePicker } from './board-assignee-picker';
import { BoardColumnSubscriber, type BoardColumnUpdate } from './board-column-subscriber';
import { type CachedBoardColumn, usePlaceholderBoardColumns, writeCachedBoardColumns } from './board-columns-cache';
import { OrganizationFilter } from './organization-filter';
import { TakeOverTicketModal, type TakeOverTicketTarget } from './take-over-ticket-modal';
import { TicketTagFilter } from './ticket-label-filter';
import { TicketsEmptyState } from './tickets-empty-state';
import { TicketsFilterModal } from './tickets-filter-modal';

// TODO(unread-from-entity): re-enable per-ticket unread highlighting once the backend exposes
// unread counts on the ticket entity itself. Matching unread notifications to tickets by id is a
// temporary workaround — disabled for now; flip this flag to restore it.
const HIGHLIGHT_UNREAD_FROM_NOTIFICATIONS: boolean = false;

/**
 * The layout-defining half of a lane — everything the column header renders
 * from, with no ticket data. Used both for the columns the board renders and
 * for the set written to the skeleton's cache, so a change to how a lane is
 * styled can't leave the cached lanes looking different from the live ones.
 *
 * AI_ASSISTANCE/RESOLVED style their header from the canonical status key
 * (icon/variant); TECH_REQUIRED and custom statuses render from the backend
 * `color`. `id` stays the statusId regardless.
 */
function toLaneDefinition(status: TicketStatusDefinition): CachedBoardColumn {
  return {
    id: status.id,
    statusKey: usesCanonicalStatusStyle(status.kind) ? mapDefinitionToSystem(status).statusKey : undefined,
    label: status.name,
    color: status.color,
    system: status.isSystem,
  };
}

interface TicketsBoardProps {
  selector?: ReactNode;
  organizationIds?: string[];
  onOrganizationIdsChange?: (ids: string[]) => void;
  assigneeIds?: string[];
  onAssigneeIdsChange?: (ids: string[]) => void;
  labelIds?: string[];
  onLabelIdsChange?: (ids: string[]) => void;
  /** Applies organization+assignee filters atomically (mobile filter modal). */
  onFiltersChange?: (filters: { organizationIds: string[]; assigneeIds: string[] }) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

function initialsOf(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join('') || undefined;
}

function dialogToBoardTicket(
  dialog: Dialog,
  hasNewMessage = false,
  isUserDeleted?: (id?: string | null) => boolean,
): BoardTicket {
  return {
    id: dialog.id,
    title: dialog.title,
    ticketNumber: dialog.ticketNumber !== undefined ? String(dialog.ticketNumber) : '',
    status: dialog.statusName ?? dialog.status,
    deviceHostnames: dialog.deviceHostname ? [dialog.deviceHostname] : undefined,
    organizationName: dialog.organizationName,
    assignees: dialog.assignedTo
      ? [
          {
            id: dialog.assignedTo,
            name: dialog.assignedName,
            initials: initialsOf(dialog.assignedName),
            avatarUrl: appendImageHash(dialog.assigneeImageUrl, dialog.assigneeImageHash),
            deleted: isUserDeleted?.(dialog.assignedTo) || undefined,
          },
        ]
      : undefined,
    tags: dialog.labels?.map(l => l.key),
    createdAt: dialog.createdAt,
    hasNewMessage,
    pendingApproval: dialog.pendingApproval,
  };
}

export function TicketsBoard({
  selector,
  organizationIds,
  onOrganizationIdsChange,
  assigneeIds,
  onAssigneeIdsChange,
  labelIds,
  onLabelIdsChange,
  onFiltersChange,
  search,
  onSearchChange,
}: TicketsBoardProps) {
  const debouncedSearch = useDebounce(search, 300);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: statusesData, isLoading: statusesLoading, error: statusesError } = useTicketStatusesQuery();
  const { data: transitionRules } = useTicketStatusTransitionRules();
  const { mutate: moveTicket } = useMoveTicket();
  const movingIds = useMovingTicketIds();
  const notifications = useOptionalNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isUserDeleted } = useUserStatusMap();
  const { handleApproveRequest, handleRejectRequest } = useApprovalRequests();

  const handleApprovalAction = useCallback(
    async (ticketId: string, requestId: string | undefined, approve: boolean) => {
      if (!requestId) return;
      try {
        if (approve) await handleApproveRequest(requestId);
        else await handleRejectRequest(requestId);
        toast({
          title: approve ? 'Request approved' : 'Request rejected',
          description: approve ? 'The pending request has been approved.' : 'The pending request has been rejected.',
          variant: 'success',
        });
        queryClient.setQueriesData<InfiniteData<TicketsPage>>({ queryKey: dialogsQueryKeys.boardColumns() }, prev => {
          if (!prev?.pages.some(p => p.dialogs.some(d => d.id === ticketId && d.pendingApproval))) return prev;
          return {
            ...prev,
            pages: prev.pages.map(page => ({
              ...page,
              dialogs: page.dialogs.map(d => (d.id === ticketId ? { ...d, pendingApproval: undefined } : d)),
            })),
          };
        });
        queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(ticketId) });
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update approval request',
          variant: 'destructive',
        });
      }
    },
    [handleApproveRequest, handleRejectRequest, toast, queryClient],
  );

  // Tickets have no unread field of their own; unread state comes from notifications (a separate
  // entity) matched by ticket id.
  const ticketIdsWithUnread = useMemo(() => {
    const ids = new Set<string>();
    if (!HIGHLIGHT_UNREAD_FROM_NOTIFICATIONS) return ids;
    for (const notification of notifications?.notifications ?? []) {
      if (notification.read) continue;
      const ticketId = notification.meta?.ticketId;
      if (typeof ticketId === 'string') ids.add(ticketId);
    }
    return ids;
  }, [notifications?.notifications]);
  const [columnUpdates, setColumnUpdates] = useState<Record<string, BoardColumnUpdate>>({});
  // Bumped when an intercepted drag is discarded (Take Over cancelled): nothing
  // was persisted, but the Board's internal drag state still shows the card in
  // the target column. A fresh `columns` array identity makes it resync from props.
  const [boardResetNonce, setBoardResetNonce] = useState(0);

  const statuses = useMemo(() => (statusesData?.snapshot ?? []).filter(s => s.kind !== 'ARCHIVED'), [statusesData]);

  const archiveFilter = useMemo(
    () => ({ organizationIds, assigneeIds, labelIds }),
    [organizationIds, assigneeIds, labelIds],
  );
  const filteredResolvedTotal = useMemo(() => {
    const resolvedId = statuses.find(s => s.kind === 'RESOLVED')?.id;
    return resolvedId ? columnUpdates[resolvedId]?.state.total : undefined;
  }, [statuses, columnUpdates]);
  const {
    actions: baseActions,
    menuActions,
    dialog: ticketsActionsDialog,
    canArchiveResolved,
    openArchiveResolvedConfirm,
  } = useTicketsActions({
    isLoading: statusesLoading,
    filter: archiveFilter,
    resolvedCountOverride: filteredResolvedTotal,
  });

  const loadMoreRef = useRef<Record<string, () => void>>({});

  const onUpdate = useCallback((statusId: string, update: BoardColumnUpdate) => {
    setColumnUpdates(prev => ({ ...prev, [statusId]: update }));
  }, []);

  const registerLoadMore = useCallback((statusId: string, loadMore: () => void) => {
    loadMoreRef.current[statusId] = loadMore;
  }, []);

  const params = useMemo(
    () => ({ search: debouncedSearch, organizationIds, assigneeIds, labelIds }),
    [debouncedSearch, organizationIds, assigneeIds, labelIds],
  );

  const allowedFromByStatusId = useMemo<Record<string, string[]>>(() => {
    if (!transitionRules) return {};
    const map: Record<string, string[]> = {};
    for (const { from, to } of transitionRules) {
      for (const target of to) {
        (map[target] ??= []).push(from);
      }
    }
    return map;
  }, [transitionRules]);

  const isLoading = statusesLoading || statuses.some(s => columnUpdates[s.id]?.isLoading ?? true);
  const columnError = statuses.map(s => columnUpdates[s.id]?.error).find(Boolean) ?? null;

  // Lanes to show until the statuses query resolves. Read once per mount so the
  // set can't shift underneath the board mid-load — and past hydration, since the
  // cache behind it is browser-only (see `usePlaceholderBoardColumns`).
  const placeholderColumns = usePlaceholderBoardColumns();

  const boardColumns = useMemo<BoardColumnDef[]>(() => {
    // No statuses yet means no lanes to map, and an empty `Board` is a blank
    // strip — which is what flashed between the route skeleton and the loaded
    // board. Stand in with the same placeholders the skeleton renders, so the
    // handoff (and a plain client-side navigation into /tickets, where no shell
    // skeleton is involved at all) has nothing to redraw.
    if (statusesLoading && statuses.length === 0) return placeholderColumns;

    // Referenced so a nonce bump rebuilds the array identity (see boardResetNonce).
    void boardResetNonce;

    return statuses.map(status => {
      const state = columnUpdates[status.id]?.state;
      return {
        ...toLaneDefinition(status),
        tickets: (state?.tickets ?? []).map(ticket =>
          dialogToBoardTicket(ticket, ticketIdsWithUnread.has(ticket.id), isUserDeleted),
        ),
        total: state?.total,
        hasMore: state?.hasMore,
        isLoading,
        isLoadingMore: state?.isLoadingMore,
        allowedFromColumns: transitionRules ? (allowedFromByStatusId[status.id] ?? []) : undefined,
        archivable: status.kind === 'RESOLVED' && canArchiveResolved,
      };
    });
  }, [
    statuses,
    statusesLoading,
    placeholderColumns,
    columnUpdates,
    transitionRules,
    allowedFromByStatusId,
    isLoading,
    canArchiveResolved,
    ticketIdsWithUnread,
    isUserDeleted,
    boardResetNonce,
  ]);

  // Remember the lane set so the route skeleton can lay out the same board on
  // the next cold start (see `board-columns-cache`). Only the layout-defining
  // fields; ticket data is deliberately not cached.
  useEffect(() => {
    // Never cache the placeholder set back over itself.
    if (statusesLoading || statuses.length === 0) return;
    // Built from `statuses`, not `boardColumns`: the latter's memo identity
    // changes on every NATS column tick, so depending on it re-ran a
    // JSON.stringify + synchronous localStorage read per update just to learn
    // nothing had changed. Lane definitions only move when the query data does.
    writeCachedBoardColumns(statuses.map(toLaneDefinition));
  }, [statuses, statusesLoading]);

  const getTicketHref = useCallback((id: string) => routes.tickets.dialog(id), []);

  const loadMore = useCallback((columnId: string) => {
    loadMoreRef.current[columnId]?.();
  }, []);

  // Full Dialog per card (board tickets carry only display fields) — used to
  // detect AI-worked tickets and to feed the Take Over modal.
  const dialogById = useMemo(() => {
    const map = new Map<string, Dialog>();
    for (const update of Object.values(columnUpdates)) {
      for (const ticket of update.state?.tickets ?? []) {
        map.set(ticket.id, ticket);
      }
    }
    return map;
  }, [columnUpdates]);

  const [takeOverTarget, setTakeOverTarget] = useState<TakeOverTicketTarget | null>(null);

  const handleTakeOverClose = useCallback(() => {
    setTakeOverTarget(null);
    setBoardResetNonce(nonce => nonce + 1);
  }, []);

  const handleChange = useCallback(
    (change: BoardChange) => {
      // Dragging an AI-worked ticket into another column is a take-over: ask
      // for confirmation (status pre-set to the target column) instead of
      // moving. Cancelling leaves the card where it was; reordering within a
      // column never needs confirmation.
      if (change.fromColumnId !== change.toColumnId) {
        const dialog = dialogById.get(change.ticketId);
        if (dialog && hasActiveAiDialog(dialog)) {
          setTakeOverTarget({ ticket: dialog, initialStatusId: change.toColumnId });
          return;
        }
      }
      moveTicket({
        ticketId: change.ticketId,
        sourceStatusId: change.fromColumnId,
        targetStatusId: change.toColumnId,
        afterTicketId: change.afterTicketId,
        beforeTicketId: change.beforeTicketId,
      });
    },
    [moveTicket, dialogById],
  );

  const showEmptyState =
    !isLoading &&
    !debouncedSearch &&
    (organizationIds?.length ?? 0) === 0 &&
    (assigneeIds?.length ?? 0) === 0 &&
    (labelIds?.length ?? 0) === 0 &&
    boardColumns.length > 0 &&
    boardColumns.every(column => column.tickets.length === 0);

  const actions = useMemo(() => emphasizeNewTicketAction(baseActions, showEmptyState), [baseActions, showEmptyState]);

  if (statusesError) {
    return <PageError message={statusesError.message} />;
  }
  if (columnError) {
    return <PageError message={columnError.message} />;
  }

  return (
    <>
      {statuses.map(status => (
        <BoardColumnSubscriber
          key={status.id}
          statusId={status.id}
          params={params}
          onUpdate={onUpdate}
          registerLoadMore={registerLoadMore}
        />
      ))}

      <PageLayout
        title="Tickets"
        actions={actions.length > 0 ? actions : undefined}
        menuActions={menuActions.length > 0 ? menuActions : undefined}
        actionsVariant="menu-primary"
        selector={selector}
        className="h-full px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        contentClassName="flex flex-col min-h-0"
      >
        {/* Default rich empty state (no data, no query): search + filters are hidden per the
            Figma data-placeholder-onboarding pattern — only the title bar chrome stays. */}
        {!showEmptyState && (
          <div className="flex flex-col gap-[var(--spacing-system-l)]">
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <TicketTagFilter
                search={search}
                onSearchChange={onSearchChange}
                labelIds={labelIds ?? []}
                onLabelIdsChange={ids => onLabelIdsChange?.(ids)}
                filterButton={
                  <Button
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setMobileFiltersOpen(true)}
                    aria-label="Open filters"
                    leftIcon={<Filter02Icon className="text-ods-text-primary" />}
                  />
                }
              />
            </div>
            {/* Mobile keeps these filters in the modal next to the search input. */}
            <div className="hidden md:grid grid-cols-4 gap-[var(--spacing-system-l)]">
              <OrganizationFilter
                value={organizationIds ?? []}
                onChange={ids => onOrganizationIdsChange?.(ids)}
                className="col-span-1"
              />
              <AssigneeFilter
                value={assigneeIds ?? []}
                onChange={ids => onAssigneeIdsChange?.(ids)}
                className="col-span-1"
              />
            </div>
          </div>
        )}

        <TicketsFilterModal
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          organizationIds={organizationIds ?? []}
          assigneeIds={assigneeIds ?? []}
          onApply={filters => onFiltersChange?.(filters)}
        />

        {showEmptyState ? (
          <TicketsEmptyState />
        ) : (
          <div aria-busy={isLoading || movingIds.size > 0} className="flex-1 min-h-0 -mx-[var(--spacing-system-l)]">
            <Board
              columns={boardColumns}
              onChange={handleChange}
              onLoadMore={loadMore}
              onArchiveColumn={openArchiveResolvedConfirm}
              getTicketHref={getTicketHref}
              renderAssignSlot={ticket => {
                const dialog = dialogById.get(ticket.id);
                const aiActive = !!dialog && hasActiveAiDialog(dialog);
                return (
                  <BoardAssigneePicker
                    ticket={ticket}
                    onTakeOver={aiActive ? () => setTakeOverTarget({ ticket: dialog }) : undefined}
                  />
                );
              }}
              onApprove={(ticketId, requestId) => handleApprovalAction(ticketId, requestId, true)}
              onReject={(ticketId, requestId) => handleApprovalAction(ticketId, requestId, false)}
              collapseStorageKey="tickets-board"
              className="h-full px-[var(--spacing-system-l)]"
            />
          </div>
        )}
      </PageLayout>
      {ticketsActionsDialog}
      <TakeOverTicketModal target={takeOverTarget} onClose={handleTakeOverClose} />
    </>
  );
}
