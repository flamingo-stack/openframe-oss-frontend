'use client';

import { FastForwardIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';

const LABEL = 'Skip onboarding (dev)';

/**
 * The tester shortcut in the wizard's footer (flag `onboarding-skip`, dev and
 * QA only): finishes the tenant Initial Setup and skips this user's Get
 * Started, then leaves for the dashboard. Unlike "Start with Mingo" it does
 * not open the Mingo panel - there is no tour to show.
 *
 * Absent until the flag and the progress have answered, and in the loading
 * scope the wizard draws while it reads (`data-loading-optional`: where the
 * flag is off a skeleton would only flash). Labelled "(dev)" and drawn as an
 * outline button so nobody takes it for a product action; on a phone it is
 * the glyph alone, like "Need Help?" opposite it.
 */
export function DevSkipOnboardingButton() {
  const router = useRouter();
  const gate = useFeatureFlagGate('onboarding-skip');
  const hasProgress = useOnboardingStore(state => state.tenant !== null);
  const { skipOnboarding, isMutating } = useOnboardingMutations();

  if (useLoadingScope()) return null;
  if (gate !== 'on' || !hasProgress) return null;

  const skip = () => skipOnboarding(() => router.replace(routes.dashboard));

  return (
    <div data-loading-optional className="contents">
      <div className="sm:hidden">
        <Button variant="glyph" size="icon" aria-label={LABEL} disabled={isMutating} onClick={skip}>
          <FastForwardIcon className="size-6" />
        </Button>
      </div>
      <div className="hidden sm:block">
        <Button
          variant="outline"
          leftIcon={<FastForwardIcon />}
          loading={isMutating}
          disabled={isMutating}
          onClick={skip}
        >
          {LABEL}
        </Button>
      </div>
    </div>
  );
}
