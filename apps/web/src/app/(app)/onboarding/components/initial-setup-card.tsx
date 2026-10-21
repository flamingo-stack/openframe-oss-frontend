'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { BuildingsIcon, IdCardIcon, MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingAccordion } from '../hooks/use-onboarding-accordion';
import { type DataDetectableStep, useTenantOnboardingAutoDetect } from '../hooks/use-tenant-onboarding-auto-detect';
import { MEET_MINGO_META } from '../meet-mingo-meta';
import { countCompleted, isStepDone, TENANT_ONBOARDING_STEPS } from '../onboarding-steps';
import { BookCallSection } from './book-call/book-call-section';
import { CustomerSetupStep } from './customer-setup-step';
import { DeviceSetupStep } from './device-setup-step';
import { MingoStep } from './mingo-step';
import { MspSetupStep } from './msp-setup-step';
import { OnboardingAccordionItem, type OnboardingStepStatus } from './onboarding-accordion';
import { OnboardingCompleteBanner } from './onboarding-complete-banner';

interface StepMeta {
  step: TenantOnboardingStep;
  icon: ReactNode;
  title: string;
  description: string;
  /**
   * Live-data precondition, with the line that says so. Renders the step locked
   * — no chevron, hint on the right, body not mounted.
   *
   * Asks the DATA, not whether the prerequisite step is checked off: "Mark as
   * Complete" is a claim, not proof the workspace has a customer. Typed to
   * {@link DataDetectableStep} so a gate can't name a step no rule can satisfy.
   */
  requiresData?: { step: DataDetectableStep; hint: string };
}

/**
 * The four steps' static presentation, shared with {@link InitialSetupSkeleton}
 * so the skeleton matches the card 1:1. Bodies are wired up in the card.
 */
/** The rows' container, shared by the loaded card and its skeleton. */
const STEP_LIST_CLASS =
  'flex w-full flex-col overflow-hidden rounded-md border border-ods-border [&>*:last-child]:border-b-0';

const STEP_META: readonly StepMeta[] = [
  {
    step: TenantOnboardingStep.MSP_SETUP,
    icon: <BuildingsIcon size={24} />,
    title: 'Complete MSP Setup',
    description:
      'Set your company name, upload a logo, and add your website so clients recognize your brand across all touchpoints.',
  },
  {
    step: TenantOnboardingStep.CUSTOMERS_SETUP,
    icon: <IdCardIcon size={24} />,
    title: 'Customers Setup',
    description: 'Add your first client - Customer name, service tier, and SLA. Devices need an org to belong to.',
  },
  {
    step: TenantOnboardingStep.DEVICE_MANAGEMENT,
    icon: <MonitorIcon size={24} />,
    title: 'Device Management',
    description: 'Run one command on a client machine to connect it to OpenFrame and start monitoring.',
    // A device belongs to a customer, so this step is dead until one exists.
    // The gate is whether a customer EXISTS, never the Customers Setup
    // checkbox — that can be ticked by hand on a workspace with no customer.
    requiresData: { step: TenantOnboardingStep.CUSTOMERS_SETUP, hint: 'Added Customer required' },
  },
  {
    // Same row as the Get Started tour's first step, from one definition.
    step: TenantOnboardingStep.MEET_MINGO,
    ...MEET_MINGO_META,
  },
];

/**
 * Tenant "Initial Setup" block on the Dashboard. Mount gate only: nothing until
 * onboarding progress has loaded, and permanently hidden once Initial Setup is
 * complete (a one-time surface). When active, it renders {@link InitialSetupCardContent},
 * which suspends on its step counts; the card owns that boundary and draws its own
 * {@link InitialSetupSkeleton} meanwhile, so the whole load (counts + the content's own
 * suspending queries) shows one skeleton, not two. In a loading scope it is that skeleton.
 */
export function InitialSetupCard() {
  const inScope = useLoadingScope();
  const isLoaded = useOnboardingStore(state => state.isLoaded);
  const tenant = useOnboardingStore(state => state.tenant);

  // Latch: the completed view commits Initial Setup in the background the instant it
  // shows, which flips `tenant.completed` and would otherwise hide the card mid-view.
  // A real exit remounts against `completed: true` and the card is correctly gone.
  const [shown, setShown] = useState(false);
  if (isLoaded && tenant && !tenant.completed && !shown) {
    setShown(true);
  }

  if (inScope) return <InitialSetupSkeleton />;

  // `!tenant` matters on its own: the store is marked loaded even on a failed fetch, and
  // the content fires its queries the instant it mounts.
  if (!isLoaded || !tenant) {
    return null;
  }
  if (tenant.completed && !shown) {
    return null;
  }

  return (
    <Suspense fallback={<InitialSetupSkeleton />}>
      <InitialSetupCardContent />
    </Suspense>
  );
}

/**
 * The card body. Suspends until every step signal has loaded, then renders once fully
 * settled. No manual finisher: with every step done the header flips, a banner appears
 * and Initial Setup auto-commits in the background, so any exit finalizes it.
 */
function InitialSetupCardContent() {
  const router = useRouter();
  const tenant = useOnboardingStore(state => state.tenant);
  const { completeTenantStep, completeTenantStepInBackground, completeTenantInBackground } = useOnboardingMutations();

  // ⚠️ TEMPORARY client-side stopgap — drop this union and read `completedSteps` from
  // the store once the backend computes step completion. Suspends until it settles.
  const completedByData = useTenantOnboardingAutoDetect();

  // Which step's "Mark as Complete" is committing — drives that button's spinner.
  const [completingStep, setCompletingStep] = useState<TenantOnboardingStep | null>(null);

  const completeStep = (step: TenantOnboardingStep) => {
    setCompletingStep(step);
    completeTenantStep(step, () => setCompletingStep(null));
  };

  // Persisted ∪ satisfied-by-data, so a step reads as done without waiting for its
  // background mutation to round-trip. Overlap is harmless — both readers dedupe.
  const completedSteps = [...(tenant?.completedSteps ?? []), ...completedByData];

  // Every step starts collapsed; only a click opens one.
  const { expandedOf, onExpandedChangeOf, refOf } = useOnboardingAccordion<TenantOnboardingStep>();

  const total = TENANT_ONBOARDING_STEPS.length;
  const done = countCompleted(TENANT_ONBOARDING_STEPS, completedSteps);
  // First step still to do, in display order: the one row that says "Next".
  const nextStep = TENANT_ONBOARDING_STEPS.find(step => !isStepDone(step, completedSteps)) ?? null;
  const allDone = done >= total;

  // Commit once, the instant every step is done — that is what makes ANY exit from the
  // completed view finalize it. The ref guards the re-renders that follow, since the
  // parent latches this card mounted while `completed` flips.
  const committedRef = useRef(false);
  useEffect(() => {
    if (allDone && !committedRef.current) {
      committedRef.current = true;
      completeTenantInBackground();
    }
  }, [allDone, completeTenantInBackground]);

  const statusOf = (meta: StepMeta): OnboardingStepStatus => {
    if (isStepDone(meta.step, completedSteps)) return 'completed';
    // Gates read the live data, NOT `completedSteps` — see `requiresData`.
    if (meta.requiresData && !completedByData.has(meta.requiresData.step)) return 'disabled';
    return 'active';
  };

  const renderStepBody = (step: TenantOnboardingStep): ReactNode => {
    const completed = isStepDone(step, completedSteps);
    const completing = completingStep === step;
    const onComplete = () => completeStep(step);
    switch (step) {
      case TenantOnboardingStep.MSP_SETUP:
        return <MspSetupStep completed={completed} completing={completing} onComplete={onComplete} />;
      case TenantOnboardingStep.CUSTOMERS_SETUP:
        return <CustomerSetupStep completed={completed} completing={completing} onComplete={onComplete} />;
      case TenantOnboardingStep.DEVICE_MANAGEMENT:
        return (
          <DeviceSetupStep
            completed={completed}
            completing={completing}
            onComplete={onComplete}
            onCompleteBackground={() => completeTenantStepInBackground(TenantOnboardingStep.DEVICE_MANAGEMENT)}
          />
        );
      case TenantOnboardingStep.MEET_MINGO:
        return (
          <MingoStep
            completed={completed}
            completing={completing}
            onComplete={onComplete}
            onCompleteBackground={() => completeTenantStepInBackground(TenantOnboardingStep.MEET_MINGO)}
            expanded={expandedOf(step)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <InitialSetupFrame subtitle={allDone ? 'All steps complete' : `${total} steps to complete · ${done}/${total} done`}>
      <div className={STEP_LIST_CLASS}>
        {STEP_META.map(meta => (
          <OnboardingAccordionItem
            key={meta.step}
            ref={refOf(meta.step)}
            icon={meta.icon}
            status={statusOf(meta)}
            next={meta.step === nextStep}
            requirementHint={meta.requiresData?.hint}
            title={meta.title}
            description={meta.description}
            expanded={expandedOf(meta.step)}
            onExpandedChange={onExpandedChangeOf(meta.step)}
          >
            {renderStepBody(meta.step)}
          </OnboardingAccordionItem>
        ))}
      </div>

      {allDone && (
        <OnboardingCompleteBanner
          className="bg-ods-bg"
          emoji="🎉"
          title="Setup Complete"
          description="Full onboarding is available from the menu if you need to revisit a step or set up something new."
          actionLabel="Take the Product Tour"
          onAction={() => router.push(routes.onboarding)}
        />
      )}
    </InitialSetupFrame>
  );
}

/** The card's frame: the section, its real header, and the booking offer above the steps. */
function InitialSetupFrame({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-ods-text-primary text-h2">Initial Setup</h2>
        <p className="text-ods-text-secondary text-h6">{subtitle}</p>
      </div>

      {/* The "walk me through it instead" offer, above the steps it replaces. It reads
          its own data (scheduling links, walkthrough video), none of which is onboarding
          progress, so it settles independently in both states. */}
      <BookCallSection />

      {children}
    </section>
  );
}

/**
 * The card while its step signals load, from the same frame and `STEP_META` as
 * {@link InitialSetupCardContent}: the real header (its copy is static), the booking
 * offer and the four rows with their real icons, titles and descriptions; only each
 * row's status control is a skeleton (`OnboardingAccordionItem`'s `loading` mode).
 */
function InitialSetupSkeleton() {
  return (
    <InitialSetupFrame subtitle={`${TENANT_ONBOARDING_STEPS.length} steps to complete`}>
      <LoadingRegion label="Loading setup steps" className={STEP_LIST_CLASS}>
        {STEP_META.map(meta => (
          <OnboardingAccordionItem
            key={meta.step}
            loading
            icon={meta.icon}
            title={meta.title}
            description={meta.description}
          />
        ))}
      </LoadingRegion>
    </InitialSetupFrame>
  );
}
