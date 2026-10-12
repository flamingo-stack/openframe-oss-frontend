/**
 * The paywall's CTA under the `billing-activation` flag: the checkout flow
 * locks while the flag is off, the in-place plan update does not.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenframeProduct, UpdateAction } from '@/generated/schema-enums';
import { SubscriptionSubmitButton } from './subscription-submit-button';

const spies = vi.hoisted(() => ({
  activationEnabled: true,
  createCheckout: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock('@/app/hooks/use-feature-flag', () => ({
  useFeatureFlag: (name: string) => name === 'billing-activation' && spies.activationEnabled,
}));
// Both mutations are Relay-backed: their `graphql` tags need the Relay transform,
// which vitest has no equivalent of. Neither is under test.
vi.mock('./use-create-checkout-session', () => ({
  useCreateCheckoutSession: () => ({ mutate: spies.createCheckout, isPending: false }),
}));
vi.mock('./use-update-subscription', () => ({
  useUpdateSubscription: () => ({ mutate: spies.updateSubscription, isPending: false }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

// The lib measures text for truncation tooltips; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const CHECKOUT_PRODUCTS = [{ productName: OpenframeProduct.MANAGED_DEVICES, packageOptionId: 'devices-25' }];
const PACKAGE_UPDATES = [
  { action: UpdateAction.ADD, packageOptionId: 'devices-50', productName: OpenframeProduct.MANAGED_DEVICES },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  spies.activationEnabled = true;
  vi.clearAllMocks();
});

function render(element: ReactElement): HTMLButtonElement {
  act(() => root.render(element));
  const button = container.querySelector('button');
  if (!button) throw new Error('no button rendered');
  return button;
}

describe('SubscriptionSubmitButton under the billing-activation flag', () => {
  it('starts a checkout while the flag is on', () => {
    const button = render(
      <SubscriptionSubmitButton
        needsCheckout
        packageUpdates={[]}
        checkoutProducts={CHECKOUT_PRODUCTS}
        hasInvalidCustom={false}
      />,
    );
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(spies.createCheckout).toHaveBeenCalledTimes(1);
  });

  it('locks the checkout while the flag is off, with the plan still on screen', () => {
    spies.activationEnabled = false;
    const button = render(
      <SubscriptionSubmitButton
        needsCheckout
        packageUpdates={[]}
        checkoutProducts={CHECKOUT_PRODUCTS}
        hasInvalidCustom={false}
      />,
    );
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Proceed to Payment');
    act(() => button.click());
    expect(spies.createCheckout).not.toHaveBeenCalled();
  });

  it('leaves an in-place plan update alone: a paid subscription is not an activation', () => {
    spies.activationEnabled = false;
    const button = render(
      <SubscriptionSubmitButton
        needsCheckout={false}
        packageUpdates={PACKAGE_UPDATES}
        checkoutProducts={[]}
        hasInvalidCustom={false}
      />,
    );
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(spies.updateSubscription).toHaveBeenCalledTimes(1);
  });
});
