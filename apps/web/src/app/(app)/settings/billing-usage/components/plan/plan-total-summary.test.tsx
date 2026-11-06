/**
 * The checkout footer per device plan (CU-17tkuw646a9): a prepaid year is due
 * today with the top-up on top; pay-as-you-go draws no footer.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/format-currency';
import { PlanTotalSummary } from './plan-total-summary';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

const text = () => container.textContent ?? '';

describe('PlanTotalSummary', () => {
  it('states a prepaid year and the top-up as one total due today', () => {
    act(() =>
      root.render(
        <PlanTotalSummary
          mode="ANNUAL"
          total={{ amount: 2880, period: 'year', prepaid: true }}
          topUpUsd={50}
          showAiNote
        />,
      ),
    );
    expect(text()).toContain('Devices and AI balance are billed together at checkout.');
    expect(text()).toContain(`Total due today: ${formatCurrency(2930)}`);
  });

  it('states the devices alone on "Don\'t top up"', () => {
    act(() =>
      root.render(
        <PlanTotalSummary
          mode="ANNUAL"
          total={{ amount: 2880, period: 'year', prepaid: true }}
          topUpUsd={null}
          showAiNote
        />,
      ),
    );
    expect(text()).toContain(`Total due today: ${formatCurrency(2880)}`);
  });

  it.each(['PAYG', null] as const)('draws nothing for pay-as-you-go or before the picker reports (%s)', mode => {
    act(() => root.render(<PlanTotalSummary mode={mode} total={null} topUpUsd={20} showAiNote />));
    expect(text()).toBe('');
  });
});
