'use client';

import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * Whether there is a Get Started tour to replay: progress has loaded and the
 * user completed or skipped it, or started it (its conversation is recorded).
 * A tour in progress is offered too: its conversation is an ordinary chat that
 * can be archived out of sight, and this is the way back from there.
 */
export function useCanResetOnboarding(): boolean {
  const progress = useOnboardingStore(state => state.user);
  const loaded = useOnboardingStore(state => state.isLoaded);
  return loaded && !!(progress?.completed || progress?.skipped || progress?.tourDialogId);
}

interface ResetOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The reset landed. The tour starts over from the setup wizard's "Start
   * with Mingo", which only the dashboard redirects to by itself: a host
   * offering this away from the dashboard takes the user there.
   */
  onReset?: () => void;
}

/** Confirms "Reset Onboarding" and replays the user's Get Started tour. */
export function ResetOnboardingDialog({ open, onOpenChange, onReset }: ResetOnboardingDialogProps) {
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
      onConfirm={() =>
        resetUser(() => {
          onOpenChange(false);
          onReset?.();
        })
      }
    />
  );
}
