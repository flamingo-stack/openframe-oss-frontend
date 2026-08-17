'use client';

import { type ReactNode, useMemo } from 'react';
import { TagFilterBar } from '@/app/components/shared';
import { useTicketTags } from '../hooks/use-ticket-tags';

interface TicketTagFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  tagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  /** Mobile filter button rendered next to the search input. */
  filterButton?: ReactNode;
}

/** Ticket tag filter — the shared `TagFilterBar` fed by the tenant ticket tags. */
export function TicketTagFilter({
  search,
  onSearchChange,
  tagIds,
  onTagIdsChange,
  filterButton,
}: TicketTagFilterProps) {
  const { data: allTags, isLoading } = useTicketTags();
  const tags = useMemo(() => (allTags ?? []).map(tag => ({ id: tag.id, key: tag.key })), [allTags]);

  return (
    <TagFilterBar
      tags={tags}
      loading={isLoading}
      search={search}
      onSearchChange={onSearchChange}
      selectedIds={tagIds}
      onSelectedIdsChange={onTagIdsChange}
      placeholder="Search for Ticket"
      filterButton={filterButton}
    />
  );
}
