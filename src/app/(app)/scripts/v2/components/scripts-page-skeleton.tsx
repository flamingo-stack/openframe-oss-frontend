'use client';

import { BoxArchiveIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ListPageSkeleton, type TableSkeletonColumn } from '@/app/components/shared';
import { skeletonFlagEnabled } from '@/lib/feature-flags';

/**
 * Route-level skeleton for `/scripts-v2` and `/scripts-v2/schedules` — the
 * top-level tab bar plus `ScriptsTable`/`ScriptSchedulesTable`'s own chrome and
 * column layout.
 */

const TAB_WIDTHS = ['w-[160px]', 'w-[200px]'] as const;

const SCRIPT_ACTIONS: PageActionButton[] = [
  {
    label: 'Archive',
    variant: 'outline',
    disabled: true,
    icon: <BoxArchiveIcon className="w-6 h-6 text-ods-text-secondary" />,
  },
  {
    label: 'Add Script',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
  },
];

const SCHEDULE_ACTIONS: PageActionButton[] = [
  {
    label: 'Archive',
    variant: 'outline',
    disabled: true,
    icon: <BoxArchiveIcon className="w-6 h-6 text-ods-text-secondary" />,
  },
  {
    label: 'Add Schedule',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
  },
];

// Mirrors the column meta in `scripts-table.tsx` / `script-schedules-table.tsx`.
const SCRIPT_COLUMNS: readonly TableSkeletonColumn[] = [
  { id: 'name', header: 'Name', width: 'flex-1 min-w-0' },
  { id: 'shellType', header: 'Shell Type', width: 'w-[100px] md:w-[160px]' },
  { id: 'supportedPlatforms', header: 'OS', width: 'w-[80px]', hideAt: 'lg' },
  { id: 'authorId', header: 'Added by', width: 'w-[250px]', hideAt: 'lg' },
  { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
];

const SCHEDULE_COLUMNS: readonly TableSkeletonColumn[] = [
  { id: 'name', header: 'Script', width: 'flex-1 min-w-0' },
  { id: 'supportedPlatforms', header: 'OS', width: 'w-[90px]', hideAt: 'lg' },
  { id: 'dateTime', header: 'Date & Time', width: 'w-[100px] md:w-[160px]', hideAt: 'md' },
  { id: 'repeat', header: 'Repeat', width: 'w-[120px]', hideAt: 'md' },
  { id: 'deviceCount', header: 'Devices', width: 'w-[100px] md:w-[140px]', hideAt: 'lg' },
  { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
];

export function ScriptsPageSkeleton({ view = 'list' }: { view?: 'list' | 'schedules' }) {
  const isSchedules = view === 'schedules';

  // Same gate as `ScriptsV2TabNavigation`: with Schedules off the switcher has a
  // single view and renders nothing, so the skeleton must not draw a tab bar the
  // loaded page won't have. `skeletonFlagEnabled` (not a raw store read) so the
  // last cached server answer is consulted — before the flags query resolves a
  // raw read is always false, which drew the wrong bar on every cold start for a
  // tenant that has the flag on.
  const schedulesEnabled = skeletonFlagEnabled('script-schedules');

  return (
    <ListPageSkeleton
      title={isSchedules ? 'Scripts Schedules' : 'Scripts'}
      actions={isSchedules ? SCHEDULE_ACTIONS : SCRIPT_ACTIONS}
      tabWidths={schedulesEnabled ? TAB_WIDTHS : undefined}
      columns={isSchedules ? SCHEDULE_COLUMNS : SCRIPT_COLUMNS}
      rows={20}
    />
  );
}
