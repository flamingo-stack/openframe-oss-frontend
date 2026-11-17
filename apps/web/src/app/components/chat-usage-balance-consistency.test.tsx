import { ChatUsagePanel } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { aiBalanceAlert_subscription$key } from '@/__generated__/aiBalanceAlert_subscription.graphql';
import type { freeAiTokensCard_subscription$key } from '@/__generated__/freeAiTokensCard_subscription.graphql';
import type { paidAiTokensCard_subscription$key } from '@/__generated__/paidAiTokensCard_subscription.graphql';
import { buildUsagePanel, companyUsageOf } from '@/app/(app)/mingo/hooks/mingo-usage-panel-data';
import { AiBalanceAlert } from '@/app/(app)/settings/billing-usage/components/billing/ai-balance-alert';
import { FreeAiTokensCard } from '@/app/(app)/settings/billing-usage/components/billing/free-ai-tokens-card';
import { PaidAiTokensCard } from '@/app/(app)/settings/billing-usage/components/billing/paid-ai-tokens-card';
import { useAiBalanceLowTokens } from '@/app/hooks/use-ai-balance-low-tokens';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { isBillingHidden } from '@/lib/billing-visibility';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { AiBalanceBar, BillingBarsHydrator, type BillingBarsState } from './billing-bars';

const scenario = vi.hoisted(() => ({
  status: 'ACTIVE' as SubscriptionStatus,
  paid: 0,
  freeUsed: 250_000,
  topUp: { enabled: false, thresholdTokens: 2_000_000 },
  platform: 'web',
  query: vi.fn(),
}));

function subscription() {
  return {
    id: 'subscription-usage',
    status: scenario.status,
    currentPeriodEnd: null,
    usage: {
      aiTokensFree: 1_000_000,
      aiTokensFreeUsed: scenario.freeUsed,
      purchasedTokensRemaining: scenario.paid,
      purchasedTokensRemainingUsd: scenario.paid / 100_000,
    },
  };
}

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, ref: unknown) => ref,
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
  useLazyLoadQuery: () => ({ subscription: subscription() }),
}));
vi.mock('@/app/hooks/use-non-suspending-query', () => ({
  useNonSuspendingQuery: (...args: unknown[]) => {
    scenario.query(...args);
    return { data: { autoTopUpSettings: scenario.topUp } };
  },
}));
vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<object>()),
  isMobileShell: () => scenario.platform === 'mobile',
  isDesktopShell: () => scenario.platform === 'desktop',
}));
vi.mock('@/app/(app)/settings/billing-usage/components/ai-balance/model-token-rates', () => ({
  ModelTokenRatesPopover: () => null,
}));

function AllSurfaces() {
  const enabled = useFeatureFlag('mingo-chat-usage') && !isBillingHidden();
  const lowTokens = useAiBalanceLowTokens();
  const data = subscription();
  const [bars, setBars] = useState<BillingBarsState>({ ai: { tone: 'default' } });
  return (
    <>
      {enabled ? <ChatUsagePanel data={buildUsagePanel(companyUsageOf(data, lowTokens, false), null)} /> : null}
      <section data-testid="paid-card">
        <PaidAiTokensCard subscription={data as unknown as paidAiTokensCard_subscription$key} autoTopUp={null} />
      </section>
      <section data-testid="free-card">
        <FreeAiTokensCard subscription={data as unknown as freeAiTokensCard_subscription$key} />
      </section>
      <section data-testid="existing-alert">
        <AiBalanceAlert subscription={data as unknown as aiBalanceAlert_subscription$key} />
      </section>
      <BillingBarsHydrator onResolved={setBars} />
      <section data-testid="balance-bar">
        {bars.ai.tone !== 'default' ? <AiBalanceBar tone={bars.ai.tone} onManage={vi.fn()} /> : null}
      </section>
    </>
  );
}

let container: HTMLDivElement;
let root: Root;
function renderSurfaces() {
  act(() => root.render(<AllSurfaces />));
}
function section(id: string) {
  const element = container.querySelector(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}
function panelBalance() {
  return Array.from(container.querySelectorAll('span')).find(element => element.textContent === 'Current AI Balance')
    ?.parentElement?.parentElement;
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement('div');
  root = createRoot(container);
  scenario.status = SubscriptionStatus.ACTIVE;
  scenario.paid = 0;
  scenario.freeUsed = 250_000;
  scenario.topUp = { enabled: false, thresholdTokens: 2_000_000 };
  scenario.platform = 'web';
  scenario.query.mockClear();
  useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: true }]);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  useFeatureFlagsStore.getState().reset();
});

const rows = [
  { paid: 0, topUp: false, tone: 'error' },
  { paid: 500_000, topUp: false, tone: 'warning' },
  { paid: 1_000_000, topUp: false, tone: 'warning' },
  { paid: 1_000_001, topUp: false, tone: 'default' },
  { paid: 1_500_000, topUp: true, tone: 'warning' },
  { paid: 2_000_000, topUp: true, tone: 'warning' },
  { paid: 2_000_001, topUp: true, tone: 'default' },
] as const;

for (const status of [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]) {
  describe(`${status} purchased balance presentation`, () => {
    it.each(rows)('matches all three tones for paid$paid, topUp$topUp', ({ paid, topUp, tone }) => {
      scenario.status = status;
      scenario.paid = paid;
      scenario.topUp.enabled = topUp;
      renderSurfaces();
      expect(
        panelBalance()?.classList.contains(tone === 'default' ? 'text-ods-text-primary' : `text-ods-${tone}`),
      ).toBe(true);
      const paidCard = section('paid-card').querySelector('[data-tone]');
      expect.soft(paidCard?.getAttribute('data-tone')).toBe(tone);
      expect(section('free-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('default');
      expect(section('existing-alert')).toHaveProperty('textContent', '');
      const bar = section('balance-bar');
      expect(bar.querySelector('.app-top-bar') != null).toBe(tone !== 'default');
      expect(bar.querySelector('.app-top-bar')?.className ?? '').toContain(tone === 'default' ? '' : `bg-ods-${tone}`);
      expect(bar.textContent).toContain(
        tone === 'default'
          ? ''
          : tone === 'error'
            ? 'purchased AI balance is empty'
            : 'purchased AI balance is running low',
      );
      expect(bar.textContent).not.toMatch(/agents.*paus/i);
    });
  });
}

it.each(['mobile', 'desktop'])('preserves shell compatibility on %s', platform => {
  scenario.platform = platform;
  renderSurfaces();
  const mobile = platform === 'mobile';
  expect(panelBalance() == null).toBe(mobile);
  expect(section('paid-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe(
    mobile ? 'default' : 'error',
  );
  expect(section('balance-bar').textContent === '').toBe(mobile);
  expect(scenario.query.mock.calls.every(call => call[2] === false)).toBe(mobile);
});

it('keeps the original card/bar behaviour and copy when the feature is off', () => {
  useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: false }]);
  renderSurfaces();
  expect(panelBalance()).toBeUndefined();
  expect(section('paid-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('default');
  expect(section('balance-bar')).toHaveProperty('textContent', '');
  expect(scenario.query.mock.calls.every(call => call[2] === false)).toBe(true);
  scenario.freeUsed = 1_000_000;
  renderSurfaces();
  expect(section('paid-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('error');
  expect(section('balance-bar').textContent).toContain('AI agents are paused');
});

it.each([false, true])('preserves trial exhaustion alerts and free-card tone with feature$0', enabled => {
  scenario.status = SubscriptionStatus.TRIAL;
  scenario.freeUsed = 1_000_000;
  useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled }]);
  renderSurfaces();
  expect(section('free-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('warning');
  expect(section('existing-alert').textContent).toContain('Activate your subscription');
});

it.each(['loading', 'missing', 'initial-error'])('preserves original surfaces while the flag is %s', state => {
  useFeatureFlagsStore.getState().reset();
  if (state === 'missing') useFeatureFlagsStore.getState().setFlags([]);
  if (state === 'initial-error') useFeatureFlagsStore.getState().setLoaded();
  renderSurfaces();
  expect(panelBalance()).toBeUndefined();
  expect(section('paid-card').querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('default');
  expect(section('balance-bar').textContent).toBe('');
  expect(scenario.query.mock.calls.every(call => call[2] === false)).toBe(true);
});
