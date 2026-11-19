/**
 * The checkout footer per device plan (CU-17tkuw646a9): a prepaid year is due
 * today with the top-up on top; a pay-as-you-go month owes only the top-up
 * today, and names the day the devices are billed on.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { PlanTotalSummary } from './plan-total-summary';

const FIRST_BILLING_DATE = new Date(2026, 11, 6);

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
          firstBillingDate={FIRST_BILLING_DATE}
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
          firstBillingDate={FIRST_BILLING_DATE}
        />,
      ),
    );
    expect(text()).toContain(`Total due today: ${formatCurrency(2880)}`);
  });

  it('owes only the top-up today on pay-as-you-go, and names the billing day', () => {
    act(() =>
      root.render(
        <PlanTotalSummary mode="PAYG" total={null} topUpUsd={20} showAiNote firstBillingDate={FIRST_BILLING_DATE} />,
      ),
    );
    expect(text()).toContain(`Total due today: ${formatCurrency(20)} (AI balance only)`);
    expect(text()).toContain(`Devices are billed on ${formatDate(FIRST_BILLING_DATE)}.`);
    expect(text()).not.toContain('billed together at checkout');
  });

  it('holds both lines until the picker reports its mode', () => {
    act(() =>
      root.render(
        <PlanTotalSummary mode={null} total={null} topUpUsd={50} showAiNote firstBillingDate={FIRST_BILLING_DATE} />,
      ),
    );
    expect(text()).not.toContain('Total due today');
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('owes nothing today on pay-as-you-go without a top-up, and names nothing it is for', () => {
    act(() =>
      root.render(
        <PlanTotalSummary mode="PAYG" total={null} topUpUsd={null} showAiNote firstBillingDate={FIRST_BILLING_DATE} />,
      ),
    );
    expect(text()).toContain(`Total due today: ${formatCurrency(0)}`);
    expect(text()).not.toContain('AI balance only');
  });
});
