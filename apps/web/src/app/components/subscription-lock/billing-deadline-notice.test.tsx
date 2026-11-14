/**
 * The debt screens' deadline (CU-17tkuw64a3x): the overdue screen states the amount and the suspension date, the
 * suspended one the deletion date, red in the last seven days; nothing without a notice, as with the backend's
 * notifications flag off.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingNotice } from '@/app/components/billing-notices/use-billing-notices';
import { BillingNoticeSeverity, BillingNoticeType, SubscriptionStatus } from '@/generated/schema-enums';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { asInstant } from '@/lib/graphql-scalars';
import { BillingDeadlineNotice } from './billing-deadline-notice';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: () => ({}) }));

const notices = vi.hoisted(() => ({ current: [] as BillingNotice[] }));
vi.mock('@/app/components/billing-notices/use-billing-notices', () => ({
  useBillingNotices: () => notices.current,
  findNotice: (list: readonly BillingNotice[], type: string) => list.find(notice => notice.type === type) ?? null,
}));

const SUSPENSION = asInstant('2026-12-01T00:00:00Z');
const DELETION = asInstant('2027-01-01T00:00:00Z');

const OVERDUE: BillingNotice = {
  type: BillingNoticeType.PAYMENT_OVERDUE,
  eventKey: 'inv-1',
  severity: BillingNoticeSeverity.WARNING,
  amountDue: 249.5,
  suspensionDate: SUSPENSION,
  deletionDate: null,
  trialEndDate: null,
  reason: null,
};

const SUSPENDED: BillingNotice = {
  ...OVERDUE,
  type: BillingNoticeType.ACCOUNT_SUSPENDED,
  severity: BillingNoticeSeverity.CRITICAL,
  amountDue: null,
  suspensionDate: null,
  deletionDate: DELETION,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

async function render(
  list: BillingNotice[],
  status: typeof SubscriptionStatus.PAST_DUE | typeof SubscriptionStatus.SUSPENDED,
) {
  notices.current = list;
  await act(async () => root.render(<BillingDeadlineNotice status={status} gated={false} />));
  return container.textContent ?? '';
}

describe('BillingDeadlineNotice', () => {
  it('states the amount and the suspension date on the overdue screen', async () => {
    const text = await render([OVERDUE, SUSPENDED], SubscriptionStatus.PAST_DUE);
    expect(text).toContain(`${formatCurrency(249.5)} is overdue.`);
    expect(text).toContain(`suspended on ${formatDate(SUSPENSION)}`);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-ods-warning');
  });

  it('states the deletion date on the suspended screen, in red when it is critical', async () => {
    const text = await render([OVERDUE, SUSPENDED], SubscriptionStatus.SUSPENDED);
    expect(text).toContain(`The workspace is deleted on ${formatDate(DELETION)}.`);
    expect(text).not.toContain('is overdue');
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-ods-error');
  });

  it('draws nothing without its notice', async () => {
    expect(await render([], SubscriptionStatus.PAST_DUE)).toBe('');
    expect(await render([OVERDUE], SubscriptionStatus.SUSPENDED)).toBe('');
  });
});
