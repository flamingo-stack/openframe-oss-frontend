'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Autocomplete,
  Button,
  CheckboxBlock,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import type { TicketListSort } from '../services/ticket-service.types';
import { DEFAULT_TICKET_LIST_SORT } from '../utils/ticket-list-sort';
import { AssigneeFilter } from './assignee-filter';
import { OrganizationFilter } from './organization-filter';
import { renderStatusOption, type StatusOption } from './status-autocomplete';

interface TicketsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationIds: string[];
  assigneeIds: string[];
  unreadOnly: boolean;
  /**
   * Renders the third, Status section (the table view — its status filter
   * lives in the column header on md+ and has no mobile surface otherwise).
   * The board omits it: there the columns themselves are the statuses.
   */
  status?: { value: string[]; options: StatusOption[] };
  /**
   * Renders the Sort section (the table view): the TICKET column's newest /
   * oldest first, which below `md` has no header to be toggled from.
   */
  sort?: { value: TicketListSort };
  /** Applies every filter in one call — sequential URL writes would clobber each other. */
  onApply: (filters: {
    organizationIds: string[];
    assigneeIds: string[];
    unreadOnly: boolean;
    status?: string[];
    sort?: TicketListSort;
  }) => void;
}

const SORT_OPTIONS: ReadonlyArray<{ value: TicketListSort['direction']; label: string }> = [
  { value: 'DESC', label: 'Newest First' },
  { value: 'ASC', label: 'Oldest First' },
];

/**
 * Modal hosting the customer/assignee/new-messages (and, for the table view,
 * status) filters. The board opens it on mobile only (its md+ filters are
 * inline); the table opens it on every breakpoint. Selection is buffered
 * locally and flushed on Apply (FilterModal behavior).
 */
export function TicketsFilterModal({
  isOpen,
  onClose,
  organizationIds,
  assigneeIds,
  unreadOnly,
  status,
  sort,
  onApply,
}: TicketsFilterModalProps) {
  const [localOrganizationIds, setLocalOrganizationIds] = useState(organizationIds);
  const [localAssigneeIds, setLocalAssigneeIds] = useState(assigneeIds);
  const [localUnreadOnly, setLocalUnreadOnly] = useState(unreadOnly);
  const [localStatus, setLocalStatus] = useState<string[]>(status?.value ?? []);
  const [localSort, setLocalSort] = useState<TicketListSort>(sort?.value ?? DEFAULT_TICKET_LIST_SORT);

  // Seeded on the open transition, during render rather than in an effect: an
  // effect paints the previous values once before correcting them, and keying off
  // the transition alone stops a background refresh from resetting the user's
  // in-progress selection while the modal is up.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setLocalOrganizationIds(organizationIds);
      setLocalAssigneeIds(assigneeIds);
      setLocalUnreadOnly(unreadOnly);
      setLocalStatus(status?.value ?? []);
      setLocalSort(sort?.value ?? DEFAULT_TICKET_LIST_SORT);
    }
  }

  const handleReset = () => {
    onApply({
      organizationIds: [],
      assigneeIds: [],
      unreadOnly: false,
      ...(status && { status: [] }),
      ...(sort && { sort: DEFAULT_TICKET_LIST_SORT }),
    });
    onClose();
  };

  const handleApply = () => {
    onApply({
      organizationIds: localOrganizationIds,
      assigneeIds: localAssigneeIds,
      unreadOnly: localUnreadOnly,
      ...(status && { status: localStatus }),
      ...(sort && { sort: localSort }),
    });
    onClose();
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Tickets"
      footer={
        <>
          <Button variant="outline" className="h-11 flex-1" onClick={handleReset}>
            Reset Filters
          </Button>
          <Button variant="accent" className="h-11 flex-1" onClick={handleApply}>
            Apply Filters
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label>Customer</Label>
        <OrganizationFilter value={localOrganizationIds} onChange={setLocalOrganizationIds} />
      </div>

      <div className="space-y-2">
        <Label>Assignee</Label>
        <AssigneeFilter value={localAssigneeIds} onChange={setLocalAssigneeIds} />
      </div>

      <CheckboxBlock checked={localUnreadOnly} onCheckedChange={setLocalUnreadOnly} label="New Messages Only" />

      {status && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Autocomplete
            multiple
            options={status.options}
            value={localStatus}
            onChange={setLocalStatus}
            placeholder="Show All Statuses"
            startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
            renderOption={renderStatusOption}
          />
        </div>
      )}

      {sort && (
        <div className="space-y-2">
          <Label>Sort by Ticket Number</Label>
          <Select
            value={localSort.direction}
            onValueChange={value => setLocalSort({ ...localSort, direction: value as TicketListSort['direction'] })}
          >
            <SelectTrigger className="w-full bg-ods-card" aria-label="Sort by ticket number">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </SimpleModal>
  );
}
