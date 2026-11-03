/**
 * The billing page's Auto Top-up section and the notice above it (CU-17tkuw5tdcv):
 * on, paused by the spend limit, without a limit, switched off by a declined charge.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoTopUpNotice } from '../ai-balance/auto-top-up-notice';
import type { AutoTopUpStatus } from '../ai-balance/auto-top-up-status';
import { AutoTopUpSection } from './auto-top-up-section';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: () => ({}) }));

const RESUMES_AT = '2026-11-04T10:00:00Z' as AutoTopUpStatus['resumesAt'];

function status(overrides: Partial<AutoTopUpStatus> = {}): AutoTopUpStatus {
  return {
    enabled: true,
    amountUsd: 50,
    thresholdUsd: 10,
    spendLimitUsd: 200,
    spentUsd: 100,
    paused: false,
    resumesAt: null,
    minimumAmountUsd: 10,
    minimumThresholdUsd: 2,
    paymentFailed: false,
    paymentMethodSetupUrl: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

const render = (node: React.ReactNode) => act(() => root.render(node));
const text = () => container.textContent ?? '';
const progress = () => container.querySelector('[role="progressbar"]');

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AutoTopUpSection', () => {
  it('states the arrangement while it is on', () => {
    render(<AutoTopUpSection status={status()} />);
    expect(text()).toContain('Auto Top-up');
    expect(text()).toContain('StatusOn');
    expect(text()).toContain('$10.00 / refill when balance drops below');
    expect(text()).toContain('$50.00 / per top-up');
    expect(text()).toContain('$100.00 / $200.00');
    expect(progress()?.getAttribute('aria-valuenow')).toBe('50');
    expect(progress()?.querySelector('.bg-ods-error')).toBeNull();
  });

  it('draws nothing while it is off', () => {
    render(<AutoTopUpSection status={status({ enabled: false })} />);
    expect(container.childElementCount).toBe(0);
  });

  it('says it is paused, until when, and marks the limit reached', () => {
    render(<AutoTopUpSection status={status({ paused: true, spentUsd: 200, resumesAt: RESUMES_AT })} />);
    expect(text()).toContain('Paused / resumes');
    expect(container.querySelector('.text-ods-error')?.textContent).toBe('$200.00');
    expect(progress()?.getAttribute('aria-valuenow')).toBe('100');
    expect(progress()?.querySelector('.bg-ods-error')).not.toBeNull();
  });

  it('says "Paused" alone when the backend gives no date', () => {
    render(<AutoTopUpSection status={status({ paused: true, spentUsd: 200 })} />);
    expect(text()).toContain('StatusPaused');
    expect(text()).not.toContain('resumes');
  });

  it('states the spend without a bar when there is no limit', () => {
    render(<AutoTopUpSection status={status({ spendLimitUsd: null, spentUsd: 40 })} />);
    expect(text()).toContain('No limit / $40.00 in the last 30 days');
    expect(progress()).toBeNull();
  });
});

describe('AutoTopUpNotice', () => {
  const onManage = vi.fn();

  it('says nothing while refills run', () => {
    render(<AutoTopUpNotice status={status()} onManage={onManage} />);
    expect(container.childElementCount).toBe(0);
  });

  it('says the limit paused refills, until when, and where to raise it', () => {
    render(<AutoTopUpNotice status={status({ paused: true, resumesAt: RESUMES_AT })} onManage={onManage} />);
    expect(text()).toContain('Auto top-up paused');
    expect(text()).toContain("You've reached your $200.00 spend limit for the last 30 days.");
    expect(text()).toContain('Auto top-ups resume on');
    expect(text()).toContain('Raise the limit in Manage AI Balance to resume sooner.');
  });

  it('does not send a build that changes nothing to Manage AI Balance', () => {
    render(<AutoTopUpNotice status={status({ paused: true })} onManage={null} />);
    expect(text()).toContain('Auto top-up paused');
    expect(text()).not.toContain('Manage AI Balance');
  });

  it('says the declined charge switched it off, with the way back', () => {
    render(<AutoTopUpNotice status={status({ enabled: false, paymentFailed: true })} onManage={onManage} />);
    expect(text()).toContain('Auto top-up is switched off.');
    act(() => container.querySelector('button')?.click());
    expect(onManage).toHaveBeenCalled();
  });
});
