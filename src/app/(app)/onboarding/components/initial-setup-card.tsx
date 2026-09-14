'use client';

import { BuildingsIcon, IdCardIcon, MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { routes } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingAutoAdvance } from '../hooks/use-onboarding-auto-advance';
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
 * which suspends on its step counts — the loading skeleton is the dashboard
 * `<Suspense fallback={<InitialSetupSkeleton />}>` that wraps this card, so the whole
 * load (counts + the content's own suspending queries) shows one skeleton, not two.
 */
export function InitialSetupCard() {
  const isLoaded = useOnboardingStore(state => state.isLoaded);
  const tenant = useOnboardingStore(state => state.tenant);

  // Latch: the completed view commits Initial Setup in the background the instant it
  // shows, which flips `tenant.completed` and would otherwise hide the card mid-view.
  // A real exit remounts against `completed: true` and the card is correctly gone.
  const [shown, setShown] = useState(false);
  if (isLoaded && tenant && !tenant.completed && !shown) {
    setShown(true);
  }

  // `!tenant` matters on its own: the store is marked loaded even on a failed fetch, and
  // the content fires its queries the instant it mounts.
  if (!isLoaded || !tenant) {
    return null;
  }
  if (tenant.completed && !shown) {
    return null;
  }

  return <InitialSetupCardContent />;
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

  // Guided flow: the first incomplete step opens and, as steps complete, the finished
  // one folds while the next opens and scrolls into view. `scrollOnMount` anchors that
  // on entry too. Runs after the suspend, so the first open step comes from settled data.
  const { expandedOf, onExpandedChangeOf, refOf } = useOnboardingAutoAdvance(TENANT_ONBOARDING_STEPS, completedSteps, {
    scrollOnMount: true,
  });

  const total = TENANT_ONBOARDING_STEPS.length;
  const done = countCompleted(TENANT_ONBOARDING_STEPS, completedSteps);
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
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-ods-text-primary text-h2">Initial Setup</h2>
        <p className="text-ods-text-secondary text-h6">
          {allDone ? 'All steps complete' : `${total} steps to complete · ${done}/${total} done`}
        </p>
      </div>

      {/* The "walk me through it instead" offer, above the steps it replaces. */}
      <BookCallSection />

      <div className="flex w-full flex-col overflow-hidden rounded-md border border-ods-border [&>*:last-child]:border-b-0">
        {STEP_META.map(meta => (
          <OnboardingAccordionItem
            key={meta.step}
            ref={refOf(meta.step)}
            icon={meta.icon}
            status={statusOf(meta)}
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
    </section>
  );
}

/**
 * Loading placeholder for the card, rendered 1:1 from the same frame and `STEP_META`
 * as {@link InitialSetupCardContent}: identical section, header and four accordion rows.
 * A FULL skeleton — the header title/subtitle and each row's title/description are all
 * skeleton bars (via `OnboardingAccordionItem`'s `loading` mode), only the leading step
 * icons stay real. Kept pixel-identical in height to the loaded card.
 *
 * Used as the `<Suspense>` fallback around the card (see dashboard-content): the card
 * body renders `DeviceSetupStep`, whose `useDeviceOrganizations` suspends, so reusing
 * this same skeleton keeps the loading → content transition seamless (no empty gap).
 */
export function InitialSetupSkeleton() {
  return (
    <section className="flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="flex min-w-0 flex-col">
        {/* Title + subtitle as core `Skeleton` bars, kept inside the real `text-h2`/
            `text-h6` line boxes so the header height matches the loaded card exactly.
            Decorative `div` wrappers (not `h2`/`p`) since `Skeleton` renders a `div`,
            which is invalid inside `<p>`/`<h2>`; the type utilities carry the height. */}
        <div className="text-ods-text-primary text-h2">
          <Skeleton className="inline-block h-6 w-40 align-middle" />
        </div>
        <div className="text-ods-text-secondary text-h6">
          <Skeleton className="inline-block h-3 w-52 max-w-full align-middle" />
        </div>
      </div>

      {/* The REAL block, not a placeholder: it reads its own data (scheduling links,
          walkthrough video), none of which is onboarding progress — so it settles
          independently, and rendering it here is what keeps the rows from jumping
          down when the card loads. */}
      <BookCallSection />

      <div className="flex w-full flex-col overflow-hidden rounded-md border border-ods-border [&>*:last-child]:border-b-0">
        {STEP_META.map(meta => (
          <OnboardingAccordionItem
            key={meta.step}
            loading
            icon={meta.icon}
            title={meta.title}
            description={meta.description}
          />
        ))}
      </div>
    </section>
  );
}
