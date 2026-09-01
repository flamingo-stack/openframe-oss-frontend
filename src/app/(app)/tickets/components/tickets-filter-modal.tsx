'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, Button, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { AssigneeFilter } from './assignee-filter';
import { OrganizationFilter } from './organization-filter';
import { renderStatusOption, type StatusOption } from './status-autocomplete';

interface TicketsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationIds: string[];
  assigneeIds: string[];
  /**
   * Renders the third, Status section (the table view — its status filter
   * lives in the column header on md+ and has no mobile surface otherwise).
   * The board omits it: there the columns themselves are the statuses.
   */
  status?: { value: string[]; options: StatusOption[] };
  /** Applies every filter in one call — sequential URL writes would clobber each other. */
  onApply: (filters: { organizationIds: string[]; assigneeIds: string[]; status?: string[] }) => void;
}

/**
 * Mobile-only modal hosting the customer/assignee (and, for the table view,
 * status) filters. Selection is buffered locally and flushed on Apply
 * (FilterModal behavior).
 */
export function TicketsFilterModal({
  isOpen,
  onClose,
  organizationIds,
  assigneeIds,
  status,
  onApply,
}: TicketsFilterModalProps) {
  const [localOrganizationIds, setLocalOrganizationIds] = useState(organizationIds);
  const [localAssigneeIds, setLocalAssigneeIds] = useState(assigneeIds);
  const [localStatus, setLocalStatus] = useState<string[]>(status?.value ?? []);

  useEffect(() => {
    if (isOpen) {
      setLocalOrganizationIds(organizationIds);
      setLocalAssigneeIds(assigneeIds);
      setLocalStatus(status?.value ?? []);
    }
  }, [isOpen, organizationIds, assigneeIds, status?.value]);

  const handleReset = () => {
    onApply({ organizationIds: [], assigneeIds: [], ...(status && { status: [] }) });
    onClose();
  };

  const handleApply = () => {
    onApply({
      organizationIds: localOrganizationIds,
      assigneeIds: localAssigneeIds,
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
          <Button variant="outline" className="flex-1 h-11" onClick={handleReset}>
            Reset Filters
          </Button>
          <Button variant="accent" className="flex-1 h-11" onClick={handleApply}>
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
