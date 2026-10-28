/**
 * The overage block promises a bill only while pay-as-you-go is on. A cancellation
 * switches it off and keeps the package, so the devices over it are blocked, not
 * billed (CU-17tkuw60p2y).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { deviceOverageBlock_subscription$key } from '@/__generated__/deviceOverageBlock_subscription.graphql';
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

function subscription(
  usage: typeof OVER,
  paygStatus: string,
  cancellationEffectiveAt: string | null = null,
): deviceOverageBlock_subscription$key {
  return {
    currentPeriodEnd: '2027-02-23',
    cancellationEffectiveAt,
    currentInvoice: { estimatedOverage: 6200 },
    usage,
    products: [
      {
        name: 'MANAGED_DEVICES',
        payAsYouGoOption: { id: 'payg', status: paygStatus },
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

  it('pay-as-you-go on: promises the overage at PAYG rates, with its cost and the upgrade', () => {
    const text = render(subscription(OVER, 'ACTIVE'));

    expect(text).toContain('billed at pay-as-you-go rates');
    expect(text).toContain('Overage Payment');
    expect(upgradeButton()).toBeDefined();
  });

  it('pay-as-you-go expired by a cancellation: says nothing is billed and access is restricted', () => {
    const text = render(subscription(OVER, 'EXPIRED', '2027-01-23'));

    expect(text).toContain("You're over your device package limit");
    expect(text).not.toContain('pay-as-you-go rates');
    expect(text).toContain("Pay-as-you-go is off, so devices over your package aren't billed.");
    expect(text).toContain("Access is restricted until you're back within the limit.");
    expect(text).toContain(`Your subscription ends on ${formatDate('2027-01-23')}.`);
    expect(text).not.toContain('Overage Payment');
    expect(upgradeButton()).toBeUndefined();
  });

  it('pay-as-you-go off without a cancellation date: no end date is stated', () => {
    const text = render(subscription(OVER, 'EXPIRED'));

    expect(text).toContain("Pay-as-you-go is off, so devices over your package aren't billed.");
    expect(text).not.toContain('ends on');
  });

  it('within the package: renders nothing', () => {
    render(subscription(WITHIN, 'EXPIRED', '2027-01-23'));

    expect(container.childElementCount).toBe(0);
  });
});
