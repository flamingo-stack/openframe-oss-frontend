import type { CheckDialog } from '../components/check-dialogs';
import { type Check, GLOBAL_SCOPE, storedDefaultDraft } from '../utils/check-transform';
import type { CheckMutations } from './use-check-mutations';

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
