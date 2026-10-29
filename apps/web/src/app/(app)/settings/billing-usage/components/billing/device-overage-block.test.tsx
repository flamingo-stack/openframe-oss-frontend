/**
 * The overage block promises a bill only while pay-as-you-go is on. A cancellation
 * switches it off and keeps the package, so the devices added over it from then on
 * are blocked, not billed; what was metered before the cancel is still invoiced
 * (CU-17tkuw61mq0).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { deviceOverageBlock_subscription$key } from '@/__generated__/deviceOverageBlock_subscription.graphql';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { DeviceOverageBlock } from './device-overage-block';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of;
// a fragment read hands back the record it was given.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, ref: unknown) => ref,
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

const OVER = {
  devicesUsed: 162,
  devicesUsedAgainstLimit: 162,
  devicesCommittedOverage: 0,
  devicesLimit: 100,
  devicesOverage: 62,
};
const WITHIN = {
  devicesUsed: 80,
  devicesUsedAgainstLimit: 80,
  devicesCommittedOverage: 0,
  devicesLimit: 100,
  devicesOverage: 0,
};
const PERIOD_END = '2027-02-23';
const OFF_TEXT = "Pay-as-you-go is off, so devices added over your package from now on aren't billed.";

function subscription(
  usage: typeof OVER,
  paygStatus: string | null,
  {
    cancellationEffectiveAt = null,
    estimatedOverage = 6200,
  }: { cancellationEffectiveAt?: string | null; estimatedOverage?: number } = {},
): deviceOverageBlock_subscription$key {
  return {
    currentPeriodEnd: PERIOD_END,
    cancellationEffectiveAt,
    currentInvoice: { estimatedOverage },
    usage,
    products: [
      {
        name: 'MANAGED_DEVICES',
        payAsYouGoOption: paygStatus == null ? null : { status: paygStatus },
        packageOptions: [{ id: 'p', packageOptionId: 'yearly', quantity: 100, status: 'ACTIVE' }],
      },
    ],
  } as unknown as deviceOverageBlock_subscription$key;
}

let container: HTMLDivElement;
let root: Root;

function render(ref: deviceOverageBlock_subscription$key) {
  act(() => {
    root.render(<DeviceOverageBlock subscription={ref} onUpgrade={() => {}} />);
  });
  return container.textContent ?? '';
}

function upgradeButton() {
  return Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Upgrade Plan'));
}

describe('DeviceOverageBlock', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('pay-as-you-go on: promises the overage at PAYG rates, with its cost, its date and the upgrade', () => {
    const text = render(subscription(OVER, 'ACTIVE'));

    expect(text).toContain('billed at pay-as-you-go rates');
    expect(text).toContain(`Overage Payment${formatCurrency(62)}`);
    expect(text).toContain(`Next Billing${formatDate(PERIOD_END)}`);
    expect(upgradeButton()).toBeDefined();
  });

  it('pay-as-you-go expired by a cancellation: no PAYG promise, access restricted, end date, no upgrade', () => {
    const text = render(subscription(OVER, 'EXPIRED', { cancellationEffectiveAt: '2027-01-23', estimatedOverage: 0 }));

    expect(text).toContain("You're over your device package limit");
    expect(text).not.toContain('pay-as-you-go rates');
    expect(text).toContain(OFF_TEXT);
    expect(text).toContain("Access is restricted while you're over the limit.");
    expect(text).toContain(`Your subscription ends on ${formatDate('2027-01-23')}.`);
    expect(text).not.toContain('Overage Payment');
    expect(text).not.toContain('Next Billing');
    expect(upgradeButton()).toBeUndefined();
  });

  it('cancelled mid-period with overage metered before the cancel: that invoice is still stated', () => {
    const text = render(
      subscription(OVER, 'EXPIRED', { cancellationEffectiveAt: '2027-01-23', estimatedOverage: 3100 }),
    );

    expect(text).toContain(OFF_TEXT);
    expect(text).toContain(`Overage Payment${formatCurrency(31)}`);
    expect(text).toContain(`Next Billing${formatDate(PERIOD_END)}`);
    expect(upgradeButton()).toBeUndefined();
  });

  it('no pay-as-you-go option at all and no cancellation date: off copy, no end date', () => {
    const text = render(subscription(OVER, null, { estimatedOverage: 0 }));

    expect(text).toContain(OFF_TEXT);
    expect(text).not.toContain('ends on');
    expect(upgradeButton()).toBeUndefined();
  });

  it('within the package: renders nothing', () => {
    render(subscription(WITHIN, 'EXPIRED', { cancellationEffectiveAt: '2027-01-23' }));

    expect(container.childElementCount).toBe(0);
  });
});
