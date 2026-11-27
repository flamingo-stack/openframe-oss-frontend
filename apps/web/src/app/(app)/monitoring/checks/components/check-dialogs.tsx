'use client';

import type { ReactNode } from 'react';
import type { CheckMutations } from '../hooks/use-check-mutations';
import { exceptionSavedToast } from '../utils/check-messages';
import {
  type Check,
  type CheckOverride,
  changedDefaults,
  GLOBAL_SCOPE,
  overrideScope,
  storedDefaultDraft,
} from '../utils/check-transform';
import { CheckOverridesReader } from './check-overrides-reader';
import { DeleteAllExceptionsDialog } from './delete-all-exceptions-dialog';
import { DeleteExceptionDialog } from './delete-exception-dialog';
import { EditDefaultModal } from './edit-default-modal';
import { OverrideModal } from './override-modal';
import { TurnOffCheckModal } from './turn-off-check-modal';

/** The dialog open over a check, if any. */
export type CheckDialog =
  | { kind: 'edit-default' }
  | { kind: 'override'; editing: CheckOverride | null }
  | { kind: 'turn-off' }
  | { kind: 'delete-override'; override: CheckOverride }
  | { kind: 'delete-all' };

interface CheckDialogsProps {
  check: Check;
  /** The check's exceptions when the caller has them (its page); read on demand otherwise (the list). */
  overrides?: readonly CheckOverride[];
  dialog: CheckDialog | null;
  onDialog: (dialog: CheckDialog | null) => void;
  mutations: CheckMutations;
}

/** Every dialog a check opens, over its list row or its page, each wired to the write it confirms. */
export function CheckDialogs({ check, overrides, dialog, onDialog, mutations }: CheckDialogsProps) {
  if (!dialog) return null;
  const close = () => onDialog(null);
  const withOverrides = (draw: (overrides: readonly CheckOverride[] | null) => ReactNode) =>
    overrides ? draw(overrides) : <CheckOverridesReader check={check.check}>{draw}</CheckOverridesReader>;

  switch (dialog.kind) {
    case 'edit-default':
      return withOverrides(loaded => (
        <EditDefaultModal
          check={check}
          overrides={loaded}
          isSaving={mutations.isSaving}
          onClose={close}
          onSave={thresholds =>
            mutations.save(
              check.check,
              GLOBAL_SCOPE,
              { enabled: storedDefaultDraft(check).enabled, parameters: changedDefaults(check, thresholds) },
              { title: 'Default threshold saved', onDone: close },
            )
          }
        />
      ));
    case 'override':
      return withOverrides(loaded => (
        <OverrideModal
          key={dialog.editing?.id ?? 'new'}
          check={check}
          overrides={loaded}
          editing={dialog.editing}
          isSaving={mutations.isSaving}
          onClose={close}
          onEditExisting={override => onDialog({ kind: 'override', editing: override })}
          onSave={(scope, draft, scopeName) =>
            mutations.save(check.check, scope, draft, {
              ...exceptionSavedToast(check, dialog.editing === null && !draft.enabled ? scopeName : undefined),
              onDone: close,
            })
          }
        />
      ));
    case 'turn-off':
      return withOverrides(loaded => (
        <TurnOffCheckModal
          check={check}
          overrides={loaded}
          isPending={mutations.isSaving}
          onClose={close}
          onConfirm={() =>
            mutations.save(
              check.check,
              GLOBAL_SCOPE,
              { ...storedDefaultDraft(check), enabled: false },
              { title: `${check.name} is off`, onDone: close },
            )
          }
        />
      ));
    case 'delete-override': {
      const scope = overrideScope(dialog.override);
      return (
        <DeleteExceptionDialog
          check={check}
          override={dialog.override}
          isPending={mutations.isSaving}
          onClose={close}
          onConfirm={() => {
            if (scope) mutations.reset(check.check, scope, { title: 'Exception deleted', onDone: close });
          }}
        />
      );
    }
    case 'delete-all':
      return withOverrides(loaded => (
        <DeleteAllExceptionsDialog
          check={check}
          overrides={loaded}
          isPending={mutations.isSaving}
          onClose={close}
          onConfirm={() =>
            mutations.deleteAllOverrides(check.check, {
              title: 'Exceptions deleted',
              description: 'Every device goes back to the default on the next run.',
              onDone: close,
            })
          }
        />
      ));
  }
}
