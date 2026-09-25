'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SoftwareListFrame } from '../shared/software-list-frame';
import {
  SOFTWARE_LIST_FILTER_COLUMN_IDS,
  SOFTWARE_LIST_PAGE_SIZE,
  SOFTWARE_LIST_SORTABLE_COLUMN_IDS,
  SOFTWARE_LIST_TABLE_COLUMNS,
} from './software-list-columns';
import { SoftwareListTable } from './software-list-table';

export interface SoftwareListViewProps {
  /** Page title, e.g. "All Software". */
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  /** The module's flag has not answered yet: the frame draws, the rows do not fetch. */
  loading?: boolean;
}

/**
 * The Software inventory page — one row per software title, aggregated across
 * the fleet. The reference for every other list of `Software` nodes: a device's
 * Software tab is this frame and this table over its own connection.
 */
export function SoftwareListView({ title, emptyTitle, emptyDescription, loading = false }: SoftwareListViewProps) {
  return (
    // No page padding here: it lives in `SoftwarePageShell`, around the error
    // boundary, so a thrown query keeps the title indented.
    <PageLayout title={title}>
      <SoftwareListFrame
        placeholder="Search for Software"
        sortableIds={SOFTWARE_LIST_SORTABLE_COLUMN_IDS}
        filterKeys={SOFTWARE_LIST_FILTER_COLUMN_IDS}
        skeletonColumns={SOFTWARE_LIST_TABLE_COLUMNS}
        skeletonRows={SOFTWARE_LIST_PAGE_SIZE}
        loading={loading}
      >
        {list => <SoftwareListTable {...list} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />}
      </SoftwareListFrame>
    </PageLayout>
  );
}
