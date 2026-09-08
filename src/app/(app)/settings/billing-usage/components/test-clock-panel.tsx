'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useId, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { testClockPanelQuery as TestClockPanelQueryType } from '@/__generated__/testClockPanelQuery.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { type BillingMetricType, BillingProvisioningState } from '@/generated/schema-enums';
import { formatDateTime } from '@/lib/format-date';
import { useBillingProvisioningStatus } from '../hooks/use-billing-provisioning-status';
import { type SeedTestUsageResult, useSeedTestUsage } from '../hooks/use-seed-test-usage';
import { useAdvanceTestClock, useResetTestClock } from '../hooks/use-test-clock';

interface TestClockPanelProps {
  /**
   * Called after the clock moves, so the host page can bump its Relay `fetchKey`.
   * The mutations invalidate the store, but a query that is already mounted still
   * needs a new fetchKey to re-request — same pattern as resume/cancel here.
   */
  onClockChanged: () => void;
}

/**
 * Dev-only panel for driving the tenant's Stripe test clock (virtual billing time)
 * so trials, renewals and invoices can be exercised without waiting for real time.
 *
 * Hidden — and, critically, silent — unless the server-driven `test-clock` feature
 * flag is on. The backend keeps that flag in sync with `openframe.billing.test-clock.enabled`,
 * which strips these fields from the schema when off, so an ungated render would fire
 * requests that fail GraphQL validation on prod.
 */
export function TestClockPanel({ onClockChanged }: TestClockPanelProps) {
  const testClockEnabled = useFeatureFlag('test-clock');

  if (!testClockEnabled) return null;

  return (
    <Suspense fallback={<Skeleton className="h-[104px] w-full rounded-md" />}>
      <TestClockPanelContent onClockChanged={onClockChanged} />
    </Suspense>
  );
}

const testClockPanelQuery = graphql`
  query testClockPanelQuery {
    testClockTime {
      frozenTime
    }
  }
`;

function TestClockPanelContent({ onClockChanged }: TestClockPanelProps) {
  const daysInputId = useId();
  const data = useLazyLoadQuery<TestClockPanelQueryType>(testClockPanelQuery, {}, { fetchPolicy: 'store-and-network' });
  const advance = useAdvanceTestClock();
  const reset = useResetTestClock();
  const provisioning = useBillingProvisioningStatus();

  const [daysInput, setDaysInput] = useState('1');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // Mutation responses are the freshest truth for the frozen time, so they win over
  // the initial query result. `undefined` means "nothing committed yet — use the query".
  const [frozenTimeOverride, setFrozenTimeOverride] = useState<string | null | undefined>(undefined);

  const frozenTime = frozenTimeOverride !== undefined ? frozenTimeOverride : (data.testClockTime?.frozenTime ?? null);

  const parsedDays = Number.parseInt(daysInput, 10);
  const isDaysValid = Number.isInteger(parsedDays) && parsedDays >= 1;
  const isBusy = advance.isPending || reset.isPending;

  const handleAdvance = () => {
    if (!isDaysValid || isBusy) return;
    advance.mutate(parsedDays, nextFrozenTime => {
      setFrozenTimeOverride(nextFrozenTime);
      onClockChanged();
    });
  };

  const handleReset = () => {
    reset.mutate(() => {
      setFrozenTimeOverride(null);
      setConfirmResetOpen(false);
      onClockChanged();
      // The reset drops the Stripe customer; the schedulers rebuild it over the
      // next minutes, so start watching provisioning again.
      provisioning.restart();
    });
  };

  const isProvisioningReady = provisioning.status?.state === BillingProvisioningState.READY;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-m)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <p className="font-bold text-ods-warning text-h3">Stripe Test Clock</p>
        <span className="rounded-sm bg-ods-warning px-[var(--spacing-system-xxs)] text-ods-bg text-h5">Dev only</span>
      </div>

      <p className="text-ods-text-primary text-h4">
        {frozenTime ? (
          <>
            Virtual time: <span className="text-ods-warning">{formatDateTime(frozenTime)}</span>
          </>
        ) : (
          <span className="text-ods-text-secondary">Real time (no test clock)</span>
        )}
      </p>

      {/* Provisioning is only trustworthy at READY — after a reset (or a fresh
          registration) the schedulers spend a few minutes rebuilding the Stripe
          customer, and the billing data on this page is stale until they finish. */}
      {provisioning.status && (
        <p className="text-ods-text-primary text-h4">
          Provisioning:{' '}
          <span className={isProvisioningReady ? 'text-ods-success' : 'text-ods-warning'}>
            {provisioning.status.message}
          </span>
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-[var(--spacing-system-s)]"
        onSubmit={event => {
          event.preventDefault();
          handleAdvance();
        }}
      >
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <label htmlFor={daysInputId} className="text-ods-text-secondary text-h6">
            Days
          </label>
          <Input
            id={daysInputId}
            type="number"
            min={1}
            step={1}
            value={daysInput}
            disabled={isBusy}
            onChange={event => setDaysInput(event.target.value)}
            className="w-24"
          />
        </div>
        {/* The first advance also creates the clock and flushes metered usage to
            Stripe, so this can sit in flight for several seconds. */}
        <Button type="submit" variant="accent" loading={advance.isPending} disabled={!isDaysValid || isBusy}>
          Advance
        </Button>
        {/* Always available: the backend now handles the no-clock case itself
            (creating one if needed), so it's the tenant's reset switch regardless of
            whether a clock is currently attached. `isBusy` only guards a concurrent
            in-flight mutation. */}
        <Button type="button" variant="outline" disabled={isBusy} onClick={() => setConfirmResetOpen(true)}>
          Reset
        </Button>
      </form>

      <div className="flex flex-col gap-[var(--spacing-system-xs)] border-t border-ods-border pt-[var(--spacing-system-s)]">
        <p className="font-bold text-ods-text-primary text-h5">Seed usage</p>
        <div className="flex flex-wrap items-end gap-[var(--spacing-system-l)]">
          {/* Devices SET the day's peak count — a value below the real device count changes nothing. */}
          <SeedUsageField
            label="Devices"
            metricType="MANAGED_DEVICES"
            successMessage={(value, r) => `Device peak for ${r.billingDate} set to ${r.dayValue}`}
            onSeeded={onClockChanged}
          />
          {/* Tokens are ADDED to the day's sum. */}
          <SeedUsageField
            label="AI tokens"
            metricType="AI_TOKENS"
            successMessage={(value, r) => `Added ${value} tokens — ${r.billingDate} total is ${r.dayValue}`}
            onSeeded={onClockChanged}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset test clock?"
        description="This deletes the test clock together with the tenant's Stripe customer. The subscription rolls back to trial and the virtual date returns to real time. This cannot be undone."
        confirmLabel="Reset"
        variant="destructive"
        isPending={reset.isPending}
        onConfirm={handleReset}
      />
    </div>
  );
}

interface SeedUsageFieldProps {
  label: string;
  metricType: BillingMetricType;
  successMessage: (value: number, result: SeedTestUsageResult) => string;
  /** Bumps the host page's Relay `fetchKey` so the usage cards re-request the seeded totals. */
  onSeeded: () => void;
}

/** Numeric input + Apply for one seedTestUsage metric (dev/stage only, like the rest of the panel). */
function SeedUsageField({ label, metricType, successMessage, onSeeded }: SeedUsageFieldProps) {
  const inputId = useId();
  const { toast } = useToast();
  const seed = useSeedTestUsage();
  const [valueInput, setValueInput] = useState('');

  const parsedValue = Number.parseInt(valueInput, 10);
  const isValueValid = Number.isInteger(parsedValue) && parsedValue >= 1;

  const handleApply = () => {
    if (!isValueValid || seed.isPending) return;
    seed.mutate(metricType, parsedValue, result => {
      toast({ title: `${label} Seeded`, description: successMessage(parsedValue, result), variant: 'success' });
      onSeeded();
    });
  };

  return (
    <form
      className="flex items-end gap-[var(--spacing-system-s)]"
      onSubmit={event => {
        event.preventDefault();
        handleApply();
      }}
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <label htmlFor={inputId} className="text-ods-text-secondary text-h6">
          {label}
        </label>
        <Input
          id={inputId}
          type="number"
          min={1}
          step={1}
          value={valueInput}
          disabled={seed.isPending}
          onChange={event => setValueInput(event.target.value)}
          className="w-32"
        />
      </div>
      <Button type="submit" variant="outline" loading={seed.isPending} disabled={!isValueValid || seed.isPending}>
        Apply
      </Button>
    </form>
  );
}
