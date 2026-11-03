/**
 * The header's "Undo Downgrade": offered exactly when the backend's `cancelPendingDowngrade` has something to undo —
 * the package in force carries an end date (`hasScheduledEnd` in SubscriptionUpdateService) — and never for a
 * staged package alone, which is also how a checkout's upgrade waits on its invoice (CU-17tkuw60vqu).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useBillingPageActions_subscription$key } from '@/__generated__/useBillingPageActions_subscription.graphql';
import { OpenframeProduct, SubscriptionProductStatus, SubscriptionStatus } from '@/generated/schema-enums';
import { type BillingPageActions, useBillingPageActions } from './use-billing-page-actions';

const commit = vi.fn();

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of;
// a fragment read hands back the record it was given.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, ref: unknown) => ref,
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  useMutation: () => [commit, false],
  useRelayEnvironment: () => ({}),
  commitLocalUpdate: () => {},
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const option = (status: SubscriptionProductStatus, endDate: string | null) => ({
  id: `devices:${status}`,
  billingPeriod: 'MONTHLY',
  price: null,
  status,
  startDate: '2026-10-01',
  endDate,
});

const subscription = (status: SubscriptionStatus, packageOptions: ReturnType<typeof option>[]) =>
  ({
    status,
    pendingInvoices: [],
    products: [{ name: OpenframeProduct.MANAGED_DEVICES, packageOptions, payAsYouGoOption: null }],
  }) as unknown as useBillingPageActions_subscription$key;

let container: HTMLDivElement;
let root: Root;

function render(ref: useBillingPageActions_subscription$key): BillingPageActions {
  let result: BillingPageActions | undefined;
  function Probe() {
    result = useBillingPageActions({
      subscription: ref,
      readOnly: false,
      onChangePlan: () => {},
      onActivate: () => {},
      onManageAiBalance: null,
      onCancel: () => {},
      onRenewed: () => {},
      onDowngradeUndone: () => {},
    });
    return null;
  }
  act(() => root.render(<Probe />));
  if (!result) throw new Error('the hook did not render');
  return result;
}

const labels = (actions: BillingPageActions) => actions.actions.map(action => action.label);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  commit.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useBillingPageActions: Undo Downgrade', () => {
  it('is offered for a scheduled smaller package, and undoes it on click', () => {
    const actions = render(
      subscription(SubscriptionStatus.ACTIVE, [
        option(SubscriptionProductStatus.ACTIVE, '2026-10-31'),
        option(SubscriptionProductStatus.PENDING_ACTIVATION, null),
      ]),
    );

    expect(labels(actions)).toEqual(['Undo Downgrade']);
    act(() => actions.actions[0].onClick?.());
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('is offered for a commitment lapsing to pay-as-you-go, which stages no package', () => {
    const actions = render(
      subscription(SubscriptionStatus.ACTIVE, [option(SubscriptionProductStatus.ACTIVE, '2026-10-31')]),
    );

    expect(labels(actions)).toEqual(['Undo Downgrade']);
  });

  it('is not offered for a staged package beside a plan that renews (an upgrade waiting on its invoice)', () => {
    const actions = render(
      subscription(SubscriptionStatus.ACTIVE, [
        option(SubscriptionProductStatus.ACTIVE, null),
        option(SubscriptionProductStatus.PENDING_ACTIVATION, null),
      ]),
    );

    expect(labels(actions)).toEqual([]);
  });

  it('is gone once the downgrade has taken effect', () => {
    const actions = render(subscription(SubscriptionStatus.ACTIVE, [option(SubscriptionProductStatus.ACTIVE, null)]));

    expect(labels(actions)).toEqual([]);
  });

  it('gives way to Renew Subscription on a scheduled cancellation', () => {
    const actions = render(
      subscription(SubscriptionStatus.PENDING_CANCELLATION, [option(SubscriptionProductStatus.ACTIVE, '2026-10-31')]),
    );

    expect(labels(actions)).toEqual(['Renew Subscription']);
  });
});
