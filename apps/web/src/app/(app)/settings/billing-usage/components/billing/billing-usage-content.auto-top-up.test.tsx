/**
 * Where the billing page shows auto top-up, per shell and plan (CU-17tkuw5tdcv):
 * the web build shows and changes it, the desktop build shows it and changes
 * nothing, a trial and a plan without AI have none, and the mobile build never
 * loads the page at all. The page's parts are stubs; the decisions are real.
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { billingUsageContentQuery$data } from '@/__generated__/billingUsageContentQuery.graphql';
import type { AutoTopUpStatus } from '../ai-balance/auto-top-up-status';
import { BillingUsageScreen } from './billing-usage-content';
import { BillingUsageView } from './billing-usage-view';

const { PAUSED, nothing } = vi.hoisted(() => {
  const paused: AutoTopUpStatus = {
    enabled: true,
    amountUsd: 50,
    thresholdUsd: 10,
    spendLimitUsd: 200,
    spentUsd: 200,
    paused: true,
    resumesAt: null,
    minimumAmountUsd: 10,
    minimumThresholdUsd: 2,
    switchedOff: null,
    paymentMethodSetupUrl: null,
  };
  return { PAUSED: paused, nothing: () => null };
});

const state = vi.hoisted(() => ({
  readOnly: false,
  hidden: false,
  action: '',
  onManageAiBalance: undefined as (() => void) | null | undefined,
}));

vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: () => ({}), useLazyLoadQuery: vi.fn() }));
vi.mock('@/lib/billing-visibility', () => ({
  isBillingReadOnly: () => state.readOnly,
  isBillingHidden: () => state.hidden,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useApiParams: () => ({ params: { action: state.action }, setParam: vi.fn() }),
}));
// The arrangement as if its own query had answered.
vi.mock('../ai-balance/auto-top-up-island', () => ({
  AutoTopUpIsland: ({ children }: { children: (s: AutoTopUpStatus) => ReactNode }) => <>{children(PAUSED)}</>,
}));
vi.mock('../ai-balance/manage-ai-balance-modal', () => ({
  ManageAiBalanceModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="ai-modal" /> : null),
}));
vi.mock('./use-billing-page-actions', () => ({
  useBillingPageActions: (o: { onManageAiBalance: (() => void) | null }) => {
    state.onManageAiBalance = o.onManageAiBalance;
    return { actions: null, menuActions: null };
  },
}));
vi.mock('./billing-page-frame', () => ({
  BillingPageFrame: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./billing-sections', () => ({
  BillingSections: (p: { notices?: ReactNode; autoTopUpSection?: ReactNode }) => (
    <>
      {p.notices}
      {p.autoTopUpSection}
    </>
  ),
}));
vi.mock('./paid-ai-tokens-card', () => ({ PaidAiTokensCard: nothing }));
vi.mock('./ai-balance-alert', () => ({ AiBalanceAlert: nothing }));
vi.mock('./purchased-token-packs', () => ({ PurchasedTokenPacks: nothing }));
vi.mock('./device-overage-block', () => ({ DeviceOverageBlock: nothing }));
vi.mock('../cancel/cancel-subscription-flow', () => ({ CancelSubscriptionFlow: nothing }));
vi.mock('../plan/activate-subscription-modal', () => ({ ActivateSubscriptionModal: nothing }));
vi.mock('../plan/upgrade-plan-modal', () => ({ UpgradePlanModal: nothing }));
vi.mock('../usage/usage-view', () => ({ UsageView: () => <div data-testid="usage-view" /> }));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="billing-page" /> }));

function data(status: string, products = ['AI_ASSISTANCE', 'MANAGED_DEVICES']) {
  return {
    billingPlan: { id: 'plan' },
    subscription: { id: 'sub', status, products: products.map(name => ({ name })) },
  } as unknown as billingUsageContentQuery$data;
}

let container: HTMLDivElement;
let root: Root;
const render = (node: ReactNode) => act(() => root.render(node));
const text = () => container.textContent ?? '';
const modalOpen = () => container.querySelector('[data-testid="ai-modal"]') != null;

beforeEach(() => {
  Object.assign(state, { readOnly: false, hidden: false, action: '', onManageAiBalance: undefined });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('web', () => {
  it('shows the section and the notice, and offers the modal', () => {
    state.action = 'manageAiBalance';
    render(<BillingUsageScreen data={data('ACTIVE')} onRefetch={vi.fn()} />);
    expect(text()).toContain('Auto Top-up');
    expect(text()).toContain('Auto top-up paused');
    expect(text()).toContain('Raise the limit in Manage AI Balance to resume sooner.');
    expect(typeof state.onManageAiBalance).toBe('function');
    expect(modalOpen()).toBe(true);
  });
});

describe('desktop (read-only)', () => {
  it('shows the figures and changes nothing', () => {
    state.readOnly = true;
    state.action = 'manageAiBalance';
    render(<BillingUsageScreen data={data('ACTIVE')} onRefetch={vi.fn()} />);
    expect(text()).toContain('Spend Limit');
    expect(text()).toContain('Auto top-up paused');
    expect(text()).not.toContain('Manage AI Balance');
    expect(state.onManageAiBalance).toBeNull();
    expect(modalOpen()).toBe(false);
  });
});

describe('plans with no balance to refill', () => {
  it('a trial has no auto top-up', () => {
    state.action = 'manageAiBalance';
    render(<BillingUsageScreen data={data('TRIAL')} onRefetch={vi.fn()} />);
    expect(text()).not.toContain('Auto Top-up');
    expect(text()).not.toContain('Auto top-up paused');
    expect(modalOpen()).toBe(false);
  });

  it('a plan without the AI product has none', () => {
    render(<BillingUsageScreen data={data('ACTIVE', ['MANAGED_DEVICES'])} onRefetch={vi.fn()} />);
    expect(text()).not.toContain('Auto Top-up');
    expect(state.onManageAiBalance).toBeNull();
  });
});

describe('mobile', () => {
  it('never loads the billing page: usage only', () => {
    state.hidden = true;
    render(<BillingUsageView />);
    expect(container.querySelector('[data-testid="usage-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="billing-page"]')).toBeNull();
  });

  it('the web build loads the billing page', () => {
    render(<BillingUsageView />);
    expect(container.querySelector('[data-testid="billing-page"]')).not.toBeNull();
  });
});
