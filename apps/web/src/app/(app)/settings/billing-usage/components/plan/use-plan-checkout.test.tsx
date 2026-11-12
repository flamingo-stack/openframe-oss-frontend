/**
 * The paywall's AI top-up follows `activationTokenPurchaseRequired` (CU-17tkuw63m09): waived, it is optional on
 * both plans, opens on "Don't top up" and states the purchased balance; required, the form is as it was.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { usePlanCheckout_query$key } from '@/__generated__/usePlanCheckout_query.graphql';
import { NO_TOP_UP } from '../ai-balance/use-ai-top-up';
import { type PlanCheckout, usePlanCheckout } from './use-plan-checkout';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of;
// a fragment read hands back the record it was given.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, ref: unknown) => ref,
  readInlineData: () => ({ packageOptions: [], payAsYouGoOption: { price: 10 }, unitSize: 1_000_000 }),
}));

const query = (activationTokenPurchaseRequired: boolean) =>
  ({
    billingPlan: { id: 'plan', products: [{ id: 'ai', name: 'AI_ASSISTANCE' }] },
    subscription: {
      id: 'sub',
      activationTokenPurchaseRequired,
      usage: { activeDevices: 3, purchasedTokensRemaining: 1_200_000, purchasedTokensRemainingUsd: 12 },
    },
  }) as unknown as usePlanCheckout_query$key;

let container: HTMLDivElement;
let root: Root;
let latest: PlanCheckout;
const capture = (form: PlanCheckout) => {
  latest = form;
};

function Probe({ data, onRender }: { data: usePlanCheckout_query$key; onRender: (form: PlanCheckout) => void }) {
  onRender(usePlanCheckout(data));
  return null;
}

const render = (data: usePlanCheckout_query$key) => act(() => root.render(<Probe data={data} onRender={capture} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

describe('usePlanCheckout AI top-up', () => {
  it('makes the top-up optional and opens on "Don\'t top up" when the purchase is waived', () => {
    render(query(false));
    expect(latest.topUp.allowNone).toBe(true);
    expect(latest.topUp.selection).toBe(NO_TOP_UP);
    expect(latest.tokenAmountUsd).toBeNull();
    expect(latest.canAutoTopUp).toBe(false);
    expect(latest.purchasedBalance).toEqual({ tokens: 1_200_000, usd: 12 });
  });

  it('charges an amount chosen anyway', () => {
    render(query(false));
    act(() => latest.topUp.selectPreset(20));
    expect(latest.tokenAmountUsd).toBe(20);
    expect(latest.canAutoTopUp).toBe(true);
  });

  it('keeps the top-up required, on $50, when the purchase is not waived', () => {
    render(query(true));
    expect(latest.topUp.allowNone).toBe(false);
    expect(latest.topUp.selection).toBe(50);
    expect(latest.tokenAmountUsd).toBe(50);
    expect(latest.purchasedBalance).toBeNull();
  });
});
