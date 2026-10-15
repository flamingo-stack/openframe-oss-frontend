'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * Whether there is a finished Get Started tour to replay: progress has loaded
 * and the user completed or skipped it. While the tour is still in progress it
 * is already on screen, so there is nothing to reset.
 */
export function useCanResetOnboarding(): boolean {
  const progress = useOnboardingStore(state => state.user);
  const loaded = useOnboardingStore(state => state.isLoaded);
  return loaded && !!(progress?.completed || progress?.skipped);
}

interface ResetOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Confirms "Reset Onboarding" and replays the user's Get Started tour. */
export function ResetOnboardingDialog({ open, onOpenChange }: ResetOnboardingDialogProps) {
  const { resetUser, isMutating } = useOnboardingMutations();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset onboarding?"
      description="This replays your Get Started tour from the beginning. Your chats, devices, customers and settings are not affected."
      confirmLabel="Reset Onboarding"
      cancelLabel="Cancel"
      variant="warning"
      isPending={isMutating}
      onConfirm={() => resetUser(() => onOpenChange(false))}
    />
  );
}
