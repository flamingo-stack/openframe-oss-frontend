'use client';

import { ActionsMenuDropdown, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { resetDefault } from '../hooks/check-actions';
import type { CheckMutations } from '../hooks/use-check-mutations';
import type { Check } from '../utils/check-transform';
import type { CheckDialog } from './check-dialogs';

/** Edit the default; once it differs from the built-in one, a menu that can also reset it. */
export function DefaultThresholdActions({
  check,
  onDialog,
  mutations,
}: {
  check: Check;
  onDialog: (dialog: CheckDialog) => void;
  mutations: CheckMutations;
}) {
  const changed = check.parameters.some(parameter => parameter.setForAllDevices);
  if (!changed) {
    return (
      <Button variant="outline" onClick={() => onDialog({ kind: 'edit-default' })}>
        Edit
      </Button>
    );
  }
  return (
    <ActionsMenuDropdown
      groups={[
        {
          items: [
            {
              id: 'edit',
              label: 'Edit',
              disabled: mutations.isSaving,
              onClick: () => onDialog({ kind: 'edit-default' }),
            },
            {
              id: 'reset',
              label: 'Reset to default',
              disabled: mutations.isSaving,
              onClick: () => resetDefault(check, mutations),
            },
          ],
        },
      ]}
    />
  );
}
