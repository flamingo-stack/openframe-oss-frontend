'use client';

import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { useCheckMutations } from '../hooks/use-check-mutations';
import { NEXT_RUN_NOTE } from '../hooks/use-check-mutations';
import { formatDefaultThreshold, thresholdScopeLabel } from '../utils/check-labels';
import {
  type Check,
  type CheckOverride,
  GLOBAL_SCOPE,
  overrideScope,
  storedDefaultDraft,
} from '../utils/check-transform';
import { CheckOverridesReader } from './check-overrides-reader';
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

type CheckMutations = ReturnType<typeof useCheckMutations>;

/** The switch for every device: off asks first (the dialog names what keeps it running), on goes straight out. */
export function toggleCheck(
  check: Check,
  enabled: boolean,
  mutations: CheckMutations,
  openDialog: (dialog: CheckDialog) => void,
) {
  if (!enabled) {
    openDialog({ kind: 'turn-off' });
    return;
  }
  mutations.save(
    check.check,
    GLOBAL_SCOPE,
    { ...storedDefaultDraft(check), enabled: true },
    { title: `${check.name} is on` },
  );
}

/** Back to the built-in thresholds; the switch, when it was set for all devices, stays as it is. */
export function resetDefault(check: Check, mutations: CheckMutations) {
  mutations.save(
    check.check,
    GLOBAL_SCOPE,
    { enabled: storedDefaultDraft(check).enabled, parameters: {} },
    { title: 'Reset to built-in default' },
  );
}

interface CheckDialogsProps {
  check: Check;
  /** The check's exceptions when the caller has them (its page); read on demand otherwise (the list). */
  overrides?: readonly CheckOverride[];
  dialog: CheckDialog | null;
  onDialog: (dialog: CheckDialog | null) => void;
  mutations: CheckMutations;
}

/** Every dialog a check opens, over its list row or its page. */
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
          onSave={thresholds => {
            // Only what differs from the built-in value is stored: a value set back to it is not a change.
            const changed = Object.fromEntries(
              check.parameters.flatMap(parameter => {
                const value = thresholds[parameter.parameter];
                return value === undefined || value === parameter.defaultValue ? [] : [[parameter.parameter, value]];
              }),
            );
            mutations.save(
              check.check,
              GLOBAL_SCOPE,
              { enabled: storedDefaultDraft(check).enabled, parameters: changed },
              { title: 'Default threshold saved', onDone: close },
            );
          }}
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
              ...savedToast(check, dialog.editing === null && !draft.enabled ? scopeName : undefined),
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
        <ConfirmDialog
          open
          onOpenChange={open => {
            if (!open) close();
          }}
          title="Delete Exception?"
          description={
            <span className="flex flex-col gap-[var(--spacing-system-m)]">
              <span>{deleteExceptionSentence(check, dialog.override)}</span>
              <span className="text-ods-text-secondary">{NEXT_RUN_NOTE}</span>
            </span>
          }
          confirmLabel="Delete"
          variant="default"
          isPending={mutations.isSaving}
          onConfirm={() => {
            if (scope) mutations.reset(check.check, scope, { title: 'Exception deleted', onDone: close });
          }}
        />
      );
    }
    case 'delete-all':
      return withOverrides(loaded => (
        <ConfirmDialog
          open
          onOpenChange={open => {
            if (!open) close();
          }}
          title="Delete All Exceptions?"
          description={`${overridesSentence(loaded, check.overrideCount)} Every device goes back to the default: ${lowerFirst(formatDefaultThreshold(check))}.`}
          confirmLabel="Delete All"
          variant="default"
          isPending={mutations.isSaving}
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

/** The toast after an exception is saved; adding one that turns the check off names where it is off. */
function savedToast(check: Check, offFor: string | null | undefined): { title: string; description?: string } {
  if (offFor === undefined) return { title: 'Exception saved' };
  return {
    title: `${check.name} is off for ${offFor ?? 'this scope'}`,
    description: `Exception added for ${check.name}. ${NEXT_RUN_NOTE}`,
  };
}

/** Where an exception's devices go once it is deleted, by what it applied to. */
function deleteExceptionSentence(check: Check, override: CheckOverride): string {
  const deleted = `The ${thresholdScopeLabel(override.scopeType, override.name)} exception for ${check.name} is deleted.`;
  const fallback = `the default (${lowerFirst(formatDefaultThreshold(check))})`;
  switch (override.scopeType) {
    case 'CUSTOMER':
      return `${deleted} Its devices go back to ${fallback}. Devices with their own tag or device exception keep it.`;
    case 'TAG':
      return `${deleted} These devices go back to their customer’s exception or ${fallback}. Devices with their own device exception keep it.`;
    default:
      return `${deleted} The device goes back to its tag or customer exception, or ${fallback}.`;
  }
}

/** "3 exceptions (NW-FS01, server, kiosk) are deleted." */
function overridesSentence(overrides: readonly CheckOverride[] | null, count: number): string {
  const total = overrides?.length ?? count;
  const what = total === 1 ? '1 exception' : `${total} exceptions`;
  const names =
    overrides && overrides.length > 0 ? ` (${overrides.map(item => item.name ?? EMPTY_VALUE).join(', ')})` : '';
  return `${what}${names} ${total === 1 ? 'is' : 'are'} deleted.`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
