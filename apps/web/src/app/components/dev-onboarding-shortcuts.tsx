'use client';

import { FastForwardIcon, Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * The tester's onboarding shortcuts for the Mingo chat's ⋯ menu (flag
 * `onboarding-skip`, dev and QA only), after "Reset Onboarding":
 *
 * - "Skip onboarding (dev)" while this user's Get Started is neither finished
 *   nor skipped: finishes the tenant Initial Setup too, so a tester who reached
 *   the tour on a workspace another admin has not set up is through both.
 * - "Reset Initial Setup (dev)" once the tenant has any setup progress: opens
 *   the confirm that clears it (`ResetInitialSetupDialog`).
 *
 * A late flag only adds the items, so the flag is read without a loading state.
 */
export function useDevOnboardingMenuItems(onResetInitialSetup: () => void): ActionsMenuItem[] {
  const enabled = useFeatureFlag('onboarding-skip');
  const tenant = useOnboardingStore(state => state.tenant);
  const user = useOnboardingStore(state => state.user);
  const { skipOnboarding, isMutating } = useOnboardingMutations();

  if (!enabled) return [];

  const items: ActionsMenuItem[] = [];
  if (user && !user.completed && !user.skipped) {
    items.push({
      id: 'dev-skip-onboarding',
      label: 'Skip onboarding (dev)',
      icon: <FastForwardIcon className="h-5 w-5 text-ods-text-secondary" />,
      disabled: isMutating,
      onClick: () => skipOnboarding(),
    });
  }
  if (tenant && (tenant.completed || tenant.completedSteps.length > 0)) {
    items.push({
      id: 'dev-reset-initial-setup',
      label: 'Reset Initial Setup (dev)',
      icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
      onClick: onResetInitialSetup,
    });
  }
  return items;
}

interface ResetInitialSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The reset landed: the host takes the user to the wizard, which nothing else does from a page. */
  onReset?: () => void;
}

/** Confirms "Reset Initial Setup (dev)" and clears the tenant's Initial Setup. */
export function ResetInitialSetupDialog({ open, onOpenChange, onReset }: ResetInitialSetupDialogProps) {
  const { resetTenant, isMutating } = useOnboardingMutations();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset Initial Setup?"
      description="Dev and QA only. Clears the workspace's Initial Setup so the setup wizard can be walked again. Steps whose data already exists (company details, a customer, a device) are ticked again as the wizard opens. Your Get Started tour is not affected."
      confirmLabel="Reset Initial Setup"
      cancelLabel="Cancel"
      variant="warning"
      isPending={isMutating}
      onConfirm={() =>
        resetTenant(() => {
          onOpenChange(false);
          onReset?.();
        })
      }
    />
  );
}
