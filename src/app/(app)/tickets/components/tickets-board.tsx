'use client';

import {
  Board,
  type BoardChange,
  type BoardColumnDef,
  type BoardTicket,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  PageError,
  PageLayout,
  type TakeOverTicketSelection,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { featureFlags } from '@/lib/feature-flags';
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
  SYSTEM_KIND_META,
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
import { ReopenTicketModal, type ReopenTicketTarget } from './reopen-ticket-modal';
import { TakeOverTicketModal, type TakeOverTicketTarget } from './take-over-ticket-modal';
import { TicketTagFilter } from './ticket-tag-filter';
import { TicketsEmptyState } from './tickets-empty-state';
import { TicketsFilterModal } from './tickets-filter-modal';

/** How long a CONFIRMED take-over drop may keep standing in for the refetched
 *  columns. Exists so a ticket the refetch never returns to the target lane
 *  (active filters, a server-side re-route) can't stay painted forever — the
 *  hold has no time limit while the modal is still open. */
const HELD_MOVE_SETTLE_TIMEOUT_MS = 5000;

/**
 * Re-seats a dropped ticket at its drop position on top of the raw columns.
 *
 * A drop intercepted by the Take Over modal persists nothing, so the data
 * still holds the card at its origin — without this overlay the Board's own
 * optimistic view times out (2s) and the card visibly snaps back BEHIND the
 * open modal. Pure view transform: remove the ticket from wherever the data
 * has it, insert it into the target lane at the drop anchor (after → before →
 * top, the same order the drop itself resolved).
 */
function applyHeldMove(columns: BoardColumnDef[], move: BoardChange): BoardColumnDef[] {
  const source = columns.find(column => column.tickets.some(t => t.id === move.ticketId));
  const ticket = source?.tickets.find(t => t.id === move.ticketId);
  const targetExists = columns.some(column => column.id === move.toColumnId);
  // Source gone (the refetch already moved it) or the target lane is not on
  // the board — nothing sensible to overlay.
  if (!source || !ticket || !targetExists) return columns;
  if (source.id === move.toColumnId && !move.afterTicketId && !move.beforeTicketId) return columns;

  return columns.map(column => {
    const without = column.tickets.filter(t => t.id !== move.ticketId);
    if (column.id !== move.toColumnId) {
      return without.length === column.tickets.length ? column : { ...column, tickets: without };
    }
    const tickets = [...without];
    const afterIndex = move.afterTicketId ? tickets.findIndex(t => t.id === move.afterTicketId) : -1;
    if (afterIndex >= 0) {
      tickets.splice(afterIndex + 1, 0, ticket);
    } else if (move.beforeTicketId) {
      const beforeIndex = tickets.findIndex(t => t.id === move.beforeTicketId);
      tickets.splice(beforeIndex >= 0 ? beforeIndex : tickets.length, 0, ticket);
    } else {
      // No anchor: the drop landed at the top of the lane — and a confirmed
      // take-over into a status other than the dropped lane also lands here.
      tickets.unshift(ticket);
    }
    return { ...column, tickets };
  });
}

/**
 * The layout-defining half of a lane — everything the column header renders
 * from, with no ticket data. Used both for the columns the board renders and
 * for the set written to the skeleton's cache, so a change to how a lane is
 * styled can't leave the cached lanes looking different from the live ones.
 *
 * AI_ASSISTANCE/RESOLVED style their header from the canonical status key
 * (icon/variant); TECH_REQUIRED and custom statuses render from the backend
 * `color`. `id` stays the statusId regardless.
 *
 * System lanes also carry the same status description the settings page shows
 * (`SYSTEM_KIND_META`), surfaced as an info-icon tooltip in the column header.
 */
function toLaneDefinition(status: TicketStatusDefinition): CachedBoardColumn {
  return {
    id: status.id,
    statusKey: usesCanonicalStatusStyle(status.kind) ? mapDefinitionToSystem(status).statusKey : undefined,
    label: status.name,
    color: status.color,
    system: status.isSystem,
    tooltip: status.kind === 'CUSTOM' ? undefined : SYSTEM_KIND_META[status.kind].tooltip,
  };
}

interface TicketsBoardProps {
  selector?: ReactNode;
  organizationIds?: string[];
  onOrganizationIdsChange?: (ids: string[]) => void;
  assigneeIds?: string[];
  onAssigneeIdsChange?: (ids: string[]) => void;
  tagIds?: string[];
  onTagIdsChange?: (ids: string[]) => void;
  /** Only tickets the caller has unread notifications about. */
  unreadOnly?: boolean;
  onUnreadOnlyChange?: (value: boolean) => void;
  /** Applies organization+assignee+new-messages filters atomically (mobile filter modal). */
  onFiltersChange?: (filters: { organizationIds: string[]; assigneeIds: string[]; unreadOnly: boolean }) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

function initialsOf(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join('') || undefined;
}

type IsUserDeleted = (id?: string | null) => boolean;

/**
 * Board tickets are rebuilt for every lane on every column tick — NATS updates,
 * the 15s refetch, each optimistic move. Handing the memoized cards a fresh
 * object each time would re-render the whole board (and every assignee picker
 * in it), so cache per dialog: react-query's structural sharing keeps unchanged
 * dialogs identical, and the one derived input is part of the cache key.
 */
const boardTicketCache = new WeakMap<Dialog, { isUserDeleted?: IsUserDeleted; ticket: BoardTicket }>();

function toBoardTicket(dialog: Dialog, isUserDeleted?: IsUserDeleted): BoardTicket {
  const cached = boardTicketCache.get(dialog);
  if (cached && cached.isUserDeleted === isUserDeleted) return cached.ticket;
  const ticket = dialogToBoardTicket(dialog, isUserDeleted);
  boardTicketCache.set(dialog, { isUserDeleted, ticket });
  return ticket;
}

function dialogToBoardTicket(dialog: Dialog, isUserDeleted?: IsUserDeleted): BoardTicket {
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
    tags: dialog.tags?.map(t => t.key),
    // The card's "N ago" label must track the LAST lifecycle change (a reopen
    // bumps `Ticket.updatedAt`), not the creation time — a ticket reopened
    // minutes ago otherwise still reads as untouched since it was created.
    createdAt: dialog.statusUpdatedAt ?? dialog.createdAt,
    // The card has no numeric affordance — `BoardTicket` carries a boolean, which
    // draws the column-coloured border and the "New Message" tag. The exact count
    // lives on the table row; here any unread at all is the signal.
    hasNewMessage: (dialog.unreadNotificationCount ?? 0) > 0,
    pendingApproval: dialog.pendingApproval,
    escalatedByUser: dialog.escalatedByUser === true,
  };
}

export function TicketsBoard({
  selector,
  organizationIds,
  onOrganizationIdsChange,
  assigneeIds,
  onAssigneeIdsChange,
  tagIds,
  onTagIdsChange,
  unreadOnly,
  onUnreadOnlyChange,
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

  const [columnUpdates, setColumnUpdates] = useState<Record<string, BoardColumnUpdate>>({});
  // Bumped when an intercepted drag is discarded (Take Over cancelled): nothing
  // was persisted, but the Board's internal drag state still shows the card in
  // the target column. A fresh `columns` array identity makes it resync from props.
  const [boardResetNonce, setBoardResetNonce] = useState(0);
  // A drop the Take Over modal intercepted: the view keeps the card at the
  // drop position (see `applyHeldMove`) until the modal decides. The ref
  // mirrors the state for the success/close handlers, which run back to back
  // in one event and must see each other's writes.
  const heldMoveRef = useRef<BoardChange | null>(null);
  const [heldMove, setHeldMoveState] = useState<BoardChange | null>(null);
  const setHeldMove = useCallback((move: BoardChange | null) => {
    heldMoveRef.current = move;
    setHeldMoveState(move);
  }, []);
  // Whether the modal is closing because the take-over COMMITTED — then the
  // hold survives the close and keeps the card in place until the refetch
  // shows it in the target lane.
  const takeOverConfirmedRef = useRef(false);
  const [reopenTarget, setReopenTarget] = useState<ReopenTicketTarget | null>(null);

  const statuses = useMemo(() => (statusesData?.snapshot ?? []).filter(s => s.kind !== 'ARCHIVED'), [statusesData]);

  // Every filter the lanes are fetched under, so "Archive Resolved" archives
  // exactly the tickets the Resolved lane shows (its count is the lane total).
  const archiveFilter = useMemo(
    () => ({ organizationIds, assigneeIds, tagIds, unreadOnly }),
    [organizationIds, assigneeIds, tagIds, unreadOnly],
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
    () => ({ search: debouncedSearch, organizationIds, assigneeIds, tagIds, unreadOnly }),
    [debouncedSearch, organizationIds, assigneeIds, tagIds, unreadOnly],
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
        tickets: (state?.tickets ?? []).map(ticket => toBoardTicket(ticket, isUserDeleted)),
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
    isUserDeleted,
    boardResetNonce,
  ]);

  // The columns the board actually renders: the raw data plus the held drop
  // (if any) re-seated at its drop position.
  const displayColumns = useMemo(
    () => (heldMove ? applyHeldMove(boardColumns, heldMove) : boardColumns),
    [boardColumns, heldMove],
  );

  // Release the hold once the data itself shows the ticket in the target lane
  // (the post-take-over refetch or a NATS tick caught up).
  // Released during render rather than in an effect: `displayColumns` above is
  // computed from `heldMove`, so an effect would draw the board once with the
  // ticket in BOTH lanes — the held one and the settled one.
  const heldMoveSettled =
    heldMove != null &&
    Boolean(
      boardColumns.find(column => column.id === heldMove.toColumnId)?.tickets.some(t => t.id === heldMove.ticketId),
    );
  if (heldMoveSettled) {
    // `setHeldMoveState`, not the `setHeldMove` wrapper: the wrapper also writes
    // `heldMoveRef`, and a ref write during render is what `react-hooks/refs`
    // forbids. The ref is read by the drag handlers, which re-read state anyway
    // on their next call — and the effect below keeps it in step.
    setHeldMoveState(null);
  }

  useEffect(() => {
    if (heldMove === null) heldMoveRef.current = null;
  }, [heldMove]);

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

  // Tickets whose card offers no assign control: everything in an AI Handling
  // lane (kind AI_ASSISTANCE), plus Resolved-lane tickets closed without a
  // technician — resolvedBy AI_AGENT (the AI closed it itself) or END_USER
  // (the client closed it in the Fae chat; the BE attributes AI-driven chat
  // closes this way). Null keeps the control: tickets resolved before the BE
  // tracked resolvedBy may well have been closed by a technician. Assignment
  // stays on the dialog page. Lanes are matched by kind, not by
  // `BoardTicket.status`: that field is the tenant-defined display name.
  const aiOwnedTicketIds = useMemo(() => {
    const ids = new Set<string>();
    for (const status of statuses) {
      if (status.kind === 'AI_ASSISTANCE') {
        for (const ticket of columnUpdates[status.id]?.state.tickets ?? []) ids.add(ticket.id);
      } else if (status.kind === 'RESOLVED') {
        for (const ticket of columnUpdates[status.id]?.state.tickets ?? []) {
          if (ticket.resolvedBy === 'AI_AGENT' || ticket.resolvedBy === 'END_USER') ids.add(ticket.id);
        }
      }
    }
    return ids;
  }, [statuses, columnUpdates]);

  // Stable identities for everything the board hands down to each card: an
  // inline arrow here re-renders every card (and its assignee picker) on every
  // drag frame, which is exactly what `TicketCard`'s memo is there to prevent.
  // The AI-owned set is read through a ref for the same reason — a new Set lands
  // on every column tick; written during render (not an effect) so a card
  // mounting into a lane sees the membership computed in the same pass.
  const aiOwnedTicketIdsRef = useRef(aiOwnedTicketIds);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    aiOwnedTicketIdsRef.current = aiOwnedTicketIds;
  });
  const handleApprove = useCallback(
    (ticketId: string, requestId?: string) => handleApprovalAction(ticketId, requestId, true),
    [handleApprovalAction],
  );
  const handleReject = useCallback(
    (ticketId: string, requestId?: string) => handleApprovalAction(ticketId, requestId, false),
    [handleApprovalAction],
  );

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

  const handleTakeOverSuccess = useCallback(
    (selection: TakeOverTicketSelection) => {
      takeOverConfirmedRef.current = true;
      const held = heldMoveRef.current;
      if (!held) return;
      // The user may have picked a different status in the modal than the lane
      // they dropped into — hold the card in the CONFIRMED lane instead.
      if (held.toColumnId !== selection.statusId) {
        setHeldMove({
          ticketId: held.ticketId,
          fromColumnId: held.fromColumnId,
          toColumnId: selection.statusId,
          afterTicketId: null,
          beforeTicketId: null,
        });
      }
    },
    [setHeldMove],
  );

  const handleTakeOverClose = useCallback(() => {
    setTakeOverTarget(null);
    if (takeOverConfirmedRef.current) {
      takeOverConfirmedRef.current = false;
    } else {
      // Cancelled/dismissed: nothing was persisted — release the card.
      setHeldMove(null);
    }
    setBoardResetNonce(nonce => nonce + 1);
  }, [setHeldMove]);

  // Backstop for a confirmed take-over whose refetch never lands the ticket in
  // the target lane (filters can legitimately exclude it there). Deliberately
  // NOT armed while the modal is open — the hold has no time limit there.
  useEffect(() => {
    if (!heldMove || takeOverTarget) return undefined;
    const timer = setTimeout(() => setHeldMove(null), HELD_MOVE_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [heldMove, takeOverTarget, setHeldMove]);

  // The dialog map is read through a ref like the AI-owned set above — its
  // identity changes on every column tick, and this callback sits in every card.
  const dialogByIdRef = useRef(dialogById);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    dialogByIdRef.current = dialogById;
  });

  // AI-owned cards (AI Handling lane, AI/user-closed Resolved) render no
  // assign control at all — assignment stays on the dialog page. The rest
  // keep the picker; AI-worked tickets get the Take Over interception
  // instead of the dropdown.
  const renderAssignSlot = useCallback((ticket: BoardTicket) => {
    if (aiOwnedTicketIdsRef.current.has(ticket.id)) return null;
    const dialog = dialogByIdRef.current.get(ticket.id);
    const aiActive = !!dialog && hasActiveAiDialog(dialog);
    return (
      <BoardAssigneePicker
        ticket={ticket}
        onTakeOver={aiActive ? () => setTakeOverTarget({ ticket: dialog }) : undefined}
      />
    );
  }, []);

  const handleChange = useCallback(
    (change: BoardChange) => {
      if (change.fromColumnId !== change.toColumnId) {
        // Dragging OUT of the Resolved lane is a REOPEN, not a plain move: it
        // goes through the confirmation modal (target status + assignee +
        // reason) instead of committing the drop. The optimistic move never
        // runs, so the card snaps back until the modal confirms. Gated on
        // `ai-resolution` — with the flag off the drop commits directly (legacy).
        if (featureFlags.aiResolution.enabled()) {
          const sourceKind = statuses.find(s => s.id === change.fromColumnId)?.kind;
          if (sourceKind === 'RESOLVED') {
            setReopenTarget({ ticketId: change.ticketId, initialStatusId: change.toColumnId });
            return;
          }
        }
        // Dragging an AI-worked ticket into another column is a take-over: ask
        // for confirmation (status pre-set to the target column) instead of
        // moving. The card is HELD at the drop position while the modal is
        // open — confirming keeps it there, cancelling releases it back;
        // reordering within a column never needs confirmation.
        const dialog = dialogById.get(change.ticketId);
        if (dialog && hasActiveAiDialog(dialog)) {
          setHeldMove(change);
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
    [moveTicket, statuses, dialogById, setHeldMove],
  );

  const showEmptyState =
    !isLoading &&
    !debouncedSearch &&
    (organizationIds?.length ?? 0) === 0 &&
    (assigneeIds?.length ?? 0) === 0 &&
    (tagIds?.length ?? 0) === 0 &&
    !unreadOnly &&
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
        contentClassName="flex min-h-0 flex-col"
      >
        {/* Default rich empty state (no data, no query): search + filters are hidden per the
            Figma data-placeholder-onboarding pattern — only the title bar chrome stays. */}
        {!showEmptyState && (
          <div className="flex flex-col gap-[var(--spacing-system-l)]">
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <TicketTagFilter
                search={search}
                onSearchChange={onSearchChange}
                tagIds={tagIds ?? []}
                onTagIdsChange={ids => onTagIdsChange?.(ids)}
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
            {/* Mobile keeps these filters in the modal next to the search input.
                Tablet lays them out two per row, desktop four (the mock's grid). */}
            <div className="hidden gap-[var(--spacing-system-l)] md:grid md:grid-cols-2 lg:grid-cols-4">
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
              <CheckboxBlock
                checked={unreadOnly ?? false}
                onCheckedChange={checked => onUnreadOnlyChange?.(checked)}
                label="New Messages Only"
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
          unreadOnly={unreadOnly ?? false}
          onApply={filters => onFiltersChange?.(filters)}
        />

        {showEmptyState ? (
          <TicketsEmptyState />
        ) : (
          <div aria-busy={isLoading || movingIds.size > 0} className="-mx-[var(--spacing-system-l)] min-h-0 flex-1">
            <Board
              columns={displayColumns}
              onChange={handleChange}
              onLoadMore={loadMore}
              onArchiveColumn={openArchiveResolvedConfirm}
              getTicketHref={getTicketHref}
              renderAssignSlot={renderAssignSlot}
              onApprove={handleApprove}
              onReject={handleReject}
              collapseStorageKey="tickets-board"
              className="h-full px-[var(--spacing-system-l)]"
            />
          </div>
        )}
      </PageLayout>
      {ticketsActionsDialog}
      <TakeOverTicketModal target={takeOverTarget} onClose={handleTakeOverClose} onSuccess={handleTakeOverSuccess} />
      <ReopenTicketModal target={reopenTarget} onClose={() => setReopenTarget(null)} />
    </>
  );
}
