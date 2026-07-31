'use client';

import { BoxArchiveIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ListPageSkeleton } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { SCHEDULES_TABLE_COLUMNS, SCRIPTS_TABLE_COLUMNS, SCRIPTS_V2_TAB_WIDTHS } from './scripts-table-columns';

/**
 * Route-level skeleton for `/scripts-v2` and `/scripts-v2/schedules` — the
 * top-level tab bar plus `ScriptsTable`/`ScriptSchedulesTable`'s own chrome and
 * column layout.
 *
 * The columns come from `scripts-table-columns` — the same declaration the live
 * tables and their inline `<Suspense>` fallbacks read. They used to be copied
 * here because importing the tables would drag their Relay artifacts into this
 * chunk; the layout module has no imports, so it doesn't.
 */

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

export function ScriptsPageSkeleton({ view = 'list' }: { view?: 'list' | 'schedules' }) {
  const isSchedules = view === 'schedules';

  // Same gate as `ScriptsV2TabNavigation`: with Schedules off the switcher has a
  // single view and renders nothing, so the skeleton must not draw a tab bar the
  // loaded page won't have. While the flag is unanswered BOTH reserve the bar (the
  // live one renders its own `TabBarSkeleton`), so handing over from this
  // placeholder to the real page never moves it.
  const schedules = useFeatureFlagGate('script-schedules');

  return (
    <ListPageSkeleton
      title={isSchedules ? 'Scripts Schedules' : 'Scripts'}
      actions={isSchedules ? SCHEDULE_ACTIONS : SCRIPT_ACTIONS}
      tabWidths={schedules === 'off' ? undefined : SCRIPTS_V2_TAB_WIDTHS}
      columns={isSchedules ? SCHEDULES_TABLE_COLUMNS : SCRIPTS_TABLE_COLUMNS}
      rows={20}
    />
  );
}
