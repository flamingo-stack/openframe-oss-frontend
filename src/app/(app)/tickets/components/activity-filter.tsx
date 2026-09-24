'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { TicketActivityFilter } from '../types/dialog.types';

/**
 * Options mirror the server's `TicketActivityFilter` enum: ACTIVE / STALE are
 * evaluated per column against the status's `staleAfterMinutes` cutoff,
 * AWAITING_EXTERNAL matches tickets waiting on a client reply. OR within the
 * selection, AND against the other board filters.
 */
export const ACTIVITY_FILTER_OPTIONS: Array<{ value: TicketActivityFilter; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'STALE', label: 'Stale' },
  { value: 'AWAITING_EXTERNAL', label: 'Awaiting Client' },
];

interface ActivityFilterProps {
  value: TicketActivityFilter[];
  onChange: (value: TicketActivityFilter[]) => void;
  className?: string;
}

export function ActivityFilter({ value, onChange, className }: ActivityFilterProps) {
  return (
    <Autocomplete
      multiple
      options={ACTIVITY_FILTER_OPTIONS}
      value={value}
      onChange={selected => onChange(selected as TicketActivityFilter[])}
      placeholder="All Activity"
      startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
      className={className}
    />
  );
}
