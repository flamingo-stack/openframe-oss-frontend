'use client';

import { BoxArchiveIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ActionsMenuDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface ArchivedArticleActionsCellProps {
  /** The table opens the dialog — see `useRowDialog` for why it is not the row's. */
  onUnarchive: () => void;
}

/**
 * The ⋯ menu of an archived article: restoring it is all there is to do.
 * `data-no-row-click` keeps the row's own link from firing underneath it.
 */
export function ArchivedArticleActionsCell({ onUnarchive }: ArchivedArticleActionsCellProps) {
  return (
    <div data-no-row-click className="pointer-events-auto flex justify-end">
      <ActionsMenuDropdown
        groups={[
          {
            items: [
              {
                id: 'unarchive',
                label: 'Unarchive',
                icon: <BoxArchiveIcon className="size-[var(--icon-size-icon-size)] text-ods-text-secondary" />,
                onClick: onUnarchive,
              },
            ],
          },
        ]}
      />
    </div>
  );
}
