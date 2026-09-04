'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, Button, CheckboxBlock, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import type { TicketActivityFilter } from '../types/dialog.types';
import { ActivityFilter } from './activity-filter';
import { AssigneeFilter } from './assignee-filter';
import { OrganizationFilter } from './organization-filter';
import { renderStatusOption, type StatusOption } from './status-autocomplete';

interface TicketsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationIds: string[];
  assigneeIds: string[];
  unreadOnly: boolean;
  /** Renders the Activity section (board view only — the table has no activity filter). */
  activity?: TicketActivityFilter[];
  /**
   * Renders the third, Status section (the table view — its status filter
   * lives in the column header on md+ and has no mobile surface otherwise).
   * The board omits it: there the columns themselves are the statuses.
   */
  status?: { value: string[]; options: StatusOption[] };
  /** Applies every filter in one call — sequential URL writes would clobber each other. */
  onApply: (filters: {
    organizationIds: string[];
    assigneeIds: string[];
    unreadOnly: boolean;
    activity?: TicketActivityFilter[];
    status?: string[];
  }) => void;
}

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
  activity,
  status,
  onApply,
}: TicketsFilterModalProps) {
  const [localOrganizationIds, setLocalOrganizationIds] = useState(organizationIds);
  const [localAssigneeIds, setLocalAssigneeIds] = useState(assigneeIds);
  const [localUnreadOnly, setLocalUnreadOnly] = useState(unreadOnly);
  const [localActivity, setLocalActivity] = useState<TicketActivityFilter[]>(activity ?? []);
  const [localStatus, setLocalStatus] = useState<string[]>(status?.value ?? []);

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
      setLocalActivity(activity ?? []);
      setLocalStatus(status?.value ?? []);
    }
  }

  const handleReset = () => {
    onApply({
      organizationIds: [],
      assigneeIds: [],
      unreadOnly: false,
      ...(activity && { activity: [] }),
      ...(status && { status: [] }),
    });
    onClose();
  };

  const handleApply = () => {
    onApply({
      organizationIds: localOrganizationIds,
      assigneeIds: localAssigneeIds,
      unreadOnly: localUnreadOnly,
      ...(activity && { activity: localActivity }),
      ...(status && { status: localStatus }),
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

      {activity && (
        <div className="space-y-2">
          <Label>Activity</Label>
          <ActivityFilter value={localActivity} onChange={setLocalActivity} />
        </div>
      )}

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
    </SimpleModal>
  );
}
