'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useTenantOnboardingAutoDetect } from '@/app/(app)/onboarding/hooks/use-tenant-onboarding-auto-detect';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { FirstDevice } from '../hooks/use-first-device-enrollment';
import { markTourStarted } from '../lib/tour-start';
import { nextSetupScreen, type SetupStep, TENANT_STEP_OF } from '../setup-steps';
import { AllSetStep } from '../steps/all-set-step';
import { CustomerStep } from '../steps/customer-step';
import { DeployDeviceStep } from '../steps/deploy-device-step';
import { OrganizationStep } from '../steps/organization-step';
import { ReadyStep } from '../steps/ready-step';
import { WelcomeStep } from '../steps/welcome-step';
import { SetupFrame } from './setup-frame';
import { SetupSkeleton } from './setup-skeleton';

/**
 * How long "Start with Mingo" waits for the backend to mark the setup complete
 * before leaving anyway. The next load re-evaluates from the server, so a slow
 * or failed completion costs a return to this screen, not a trapped user.
 */
const START_FAIL_OPEN_MS = 8_000;

/**
 * The wizard's state machine. Which screen shows comes from the tenant's
 * progress (persisted steps plus the data auto-detect, which also writes back):
 * a workspace already set up opens on "Everything is set up"; otherwise the
 * welcome screen leads to the first step not yet done, each step persists
 * itself through the onboarding mutations and the walk ends on "You are ready
 * to go". "Start with Mingo" marks the tenant setup complete, records that the
 * tour has started and leaves for the dashboard with a fresh Mingo chat.
 */
export function SetupWizard() {
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
    router.replace(routes.dashboard);
    // The tour lives in the Mingo panel, a SaaS-tenant surface; elsewhere the
    // dashboard is the destination on its own.
    if (isSaasTenantMode()) useMingoLauncherStore.getState().startNewChat();
  }, [router]);

  const handleStart = useCallback(() => {
    setStarting(true);
    markTourStarted(userId);
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

  // No progress record means the redirect is already sending this session away.
  if (!tenant) return <SetupSkeleton />;

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
      {step === 'device' && <DeployDeviceStep organizationId={customerId} onEnrolled={handleEnrolled} />}
      {step === 'ready' && <ReadyStep device={device} onStart={handleStart} starting={starting} />}
      {step === 'all-set' && <AllSetStep onStart={handleStart} starting={starting} />}
    </SetupFrame>
  );
}
