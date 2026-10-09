'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useNativeBackDismissible } from '@/lib/native-back';
import { dismissUpdateNudge, openStore, useAppUpdateStore } from '@/lib/version-check';
import { StoreUpdateRow } from './store-update-row';

/**
 * The "Update available" nudge: the store has a newer shell than this one.
 * Advisory only — "Not Now" snoozes it for a day for this version (see
 * `version-check.ts`), and a newer release brings it back. On a phone `ModalV2`
 * is the bottom-anchored card the update dialog is designed as.
 */
export function UpdateAvailableModal() {
  const version = useAppUpdateStore(s => s.available);
  useNativeBackDismissible(version !== null, dismissUpdateNudge);

  if (!version) return null;

  return (
    <SimpleModal
      isOpen
      onClose={dismissUpdateNudge}
      title="Update Available"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={dismissUpdateNudge}>
            Not Now
          </Button>
          <Button variant="accent" className="flex-1" onClick={openStore}>
            Update
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">
        OpenFrame v{version} is available, with the latest fixes and improvements.
      </p>
      <StoreUpdateRow />
    </SimpleModal>
  );
}
