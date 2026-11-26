'use client';

import { GRID_ACTION_BUTTON_CLASS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Ellipsis01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * A row's "…" menu. In card rows the menu's own outlined trigger; in a grid table's action column the bare 40px
 * button (the column is the box), as the grid's other row actions are.
 */
export function RowMenuCell({ groups, grid = false }: { groups: ActionsMenuGroup[]; grid?: boolean }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <ActionsMenuDropdown
        groups={groups}
        customTrigger={
          grid ? (
            <Button
              variant="transparent"
              size="icon"
              className={GRID_ACTION_BUTTON_CLASS}
              aria-label="More actions"
              leftIcon={<Ellipsis01Icon className="size-5" />}
            />
          ) : undefined
        }
      />
    </div>
  );
}
