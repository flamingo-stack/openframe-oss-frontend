'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ensureGettingStartedView } from '@/app/(app)/mingo/tour/getting-started-view';
import { useTenantOnboardingAutoDetect } from '@/app/(app)/onboarding/hooks/use-tenant-onboarding-auto-detect';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { noop } from '@/app/components/shared/no-next-page';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { FirstDevice } from '../hooks/use-first-device-enrollment';
import { markTourStarted } from '../lib/tour-state';
import { nextSetupScreen, type SetupStep, TENANT_STEP_OF } from '../setup-steps';
import { AllSetStep } from '../steps/all-set-step';
import { CustomerStep } from '../steps/customer-step';
import { DeployDeviceStep } from '../steps/deploy-device-step';
import { OrganizationStep } from '../steps/organization-step';
import { ReadyStep } from '../steps/ready-step';
import { WelcomeStep } from '../steps/welcome-step';
import { SetupFrame } from './setup-frame';

/**
 * How long "Start with Mingo" waits for the backend to mark the setup complete
 * before leaving anyway. The next load re-evaluates from the server, so a slow
 * or failed completion costs a return to this screen, not a trapped user.
 */
const START_FAIL_OPEN_MS = 8_000;

/**
 * The wizard's first screen while its progress is read: static copy, its Continue inert. Rendered in a loading
 * scope both by the wizard's boundary and by the wizard itself, so the two waits are one screen.
 */
function SetupWelcomeFrame() {
  return (
    <SetupFrame step="welcome">
      <WelcomeStep onContinue={noop} />
    </SetupFrame>
  );
}

/**
 * The wizard's state machine. Which screen shows comes from the tenant's
 * progress (persisted steps plus the data auto-detect, which also writes back):
 * a workspace already set up opens on "Everything is set up"; otherwise the
 * welcome screen leads to the first step not yet done, each step persists
 * itself through the onboarding mutations and the walk ends on "You are ready
 * to go". "Start with Mingo" marks the tenant setup complete, records that the
 * tour has started and leaves for the dashboard with a fresh Mingo chat.
 *
 * With its own boundary: in its scope the reader draws the welcome screen. The boundary is the one element between
 * the bare shell's column and the frame: it has to be a filling column too, or the frame's `flex-1` has nothing to
 * fill and the welcome screen sits at the top until the wizard loads.
 */
export function SetupWizard() {
  return (
    <LoadingSuspense label="Loading setup" className="flex flex-1 flex-col">
      <SetupWizardReader />
    </LoadingSuspense>
  );
}

function SetupWizardReader() {
  if (useLoadingScope()) return <SetupWelcomeFrame />;
  return <SetupWizardLive />;
}

function SetupWizardLive() {
  const router = useRouter();
  const tenant = useOnboardingStore(state => state.tenant);
  const userId = useAuthStore(state => state.user?.id);
  const completedByData = useTenantOnboardingAutoDetect();
  const { completeTenantStep, completeTenantInBackground } = useOnboardingMutations();

  const [step, setStep] = useState<SetupStep>(() => (tenant?.completed ? 'all-set' : 'welcome'));
  const [persisting, setPersisting] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [device, setDevice] = useState<FirstDevice | null>(null);
  const [starting, setStarting] = useState(false);

  const isDone = useCallback(
    (tenantStep: TenantOnboardingStep) =>
      (tenant?.completedSteps.includes(tenantStep) ?? false) || completedByData.has(tenantStep),
    [tenant, completedByData],
  );

  const advanceFrom = useCallback((from: SetupStep) => setStep(nextSetupScreen(from, isDone)), [isDone]);

  /**
   * Persist a screen's tenant step, then move on - but only if it actually
   * landed: the mutation's callback fires on failure too, and a step the server
   * refused would otherwise be walked past and come back on the next visit.
   */
  const persistAndAdvance = useCallback(
    (from: SetupStep, tenantStep: TenantOnboardingStep) => {
      setPersisting(true);
      completeTenantStep(tenantStep, () => {
        setPersisting(false);
        if (useOnboardingStore.getState().tenant?.completedSteps.includes(tenantStep)) {
          advanceFrom(from);
        }
      });
    },
    [completeTenantStep, advanceFrom],
  );

  const leave = useCallback(() => {
    // The tour lives in Mingo, a SaaS-tenant surface: Mingo's home, whose docked
    // composer creates the tour's conversation once it sees the tour started
    // (`useMingoTour`) and follows it to the chat page. Elsewhere the dashboard is
    // the destination on its own.
    router.replace(isSaasTenantMode() ? routes.mingo.home : routes.dashboard);
  }, [router]);

  const handleStart = useCallback(() => {
    setStarting(true);
    markTourStarted(userId);
    ensureGettingStartedView(userId);
    if (tenant?.completed) {
      leave();
      return;
    }
    // Meeting Mingo is the last tenant step; with it done the setup is complete.
    completeTenantStep(TenantOnboardingStep.MEET_MINGO, () => completeTenantInBackground());
  }, [userId, tenant?.completed, leave, completeTenantStep, completeTenantInBackground]);

  // Leave once the server agrees the setup is complete - the dashboard redirect
  // reads the same store, and leaving earlier would bounce straight back here.
  const tenantCompleted = tenant?.completed ?? false;
  useEffect(() => {
    if (starting && tenantCompleted) leave();
  }, [starting, tenantCompleted, leave]);

  useEffect(() => {
    if (!starting) return undefined;
    const timer = setTimeout(leave, START_FAIL_OPEN_MS);
    return () => clearTimeout(timer);
  }, [starting, leave]);

  const handleEnrolled = useCallback(
    (enrolled: FirstDevice) => {
      setDevice(enrolled);
      persistAndAdvance('device', TENANT_STEP_OF.device);
    },
    [persistAndAdvance],
  );

  // No progress record yet (or the redirect is already sending this session away): the
  // first screen, static copy, in a loading scope.
  if (!tenant) {
    return (
      <LoadingWhen loading>
        <SetupWelcomeFrame />
      </LoadingWhen>
    );
  }

  return (
    <SetupFrame step={step}>
      {step === 'welcome' && <WelcomeStep onContinue={() => advanceFrom('welcome')} />}
      {step === 'organization' && (
        <OrganizationStep
          onSkip={() => persistAndAdvance('organization', TENANT_STEP_OF.organization)}
          onSaved={() => persistAndAdvance('organization', TENANT_STEP_OF.organization)}
          persisting={persisting}
        />
      )}
      {step === 'customer' && (
        <CustomerStep
          onCreated={created => {
            setCustomerId(created);
            persistAndAdvance('customer', TENANT_STEP_OF.customer);
          }}
          onTestCustomer={() => persistAndAdvance('customer', TENANT_STEP_OF.customer)}
          persisting={persisting}
        />
      )}
      {step === 'device' && (
        <DeployDeviceStep organizationId={customerId} onContinue={handleEnrolled} persisting={persisting} />
      )}
      {step === 'ready' && <ReadyStep device={device} onStart={handleStart} starting={starting} />}
      {step === 'all-set' && <AllSetStep onStart={handleStart} starting={starting} />}
    </SetupFrame>
  );
}
