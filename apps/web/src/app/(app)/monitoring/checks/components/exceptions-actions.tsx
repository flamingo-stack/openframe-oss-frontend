'use client';

import { ActionsMenuDropdown, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { CheckDialog } from './check-dialogs';

/** Add Exception, and once there are exceptions, a menu that deletes them all. */
export function ExceptionsActions({
  hasExceptions,
  onDialog,
}: {
  hasExceptions: boolean;
  onDialog: (dialog: CheckDialog) => void;
}) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      <Button variant="outline" onClick={() => onDialog({ kind: 'override', editing: null })}>
        Add Exception
      </Button>
      {hasExceptions && (
        <ActionsMenuDropdown
          groups={[
            {
              items: [
                { id: 'delete-all', label: 'Delete All Exceptions', onClick: () => onDialog({ kind: 'delete-all' }) },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
