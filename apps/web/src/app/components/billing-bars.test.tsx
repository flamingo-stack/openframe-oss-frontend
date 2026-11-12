/**
 * The bars the backend's billing notices raise (CU-17tkuw64a3x): the trial bar from TRIAL_ENDING, the auto top-up
 * bar from AUTO_TOP_UP_DISABLED, each with the event its dismissal names; nothing for an empty list, which is what
 * the backend serves while its notifications flag is off.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoTopUpDisabledReason, BillingNoticeSeverity, BillingNoticeType } from '@/generated/schema-enums';
import { asInstant } from '@/lib/graphql-scalars';
import { AutoTopUpDisabledBar, BillingNoticesHydrator, type NoticeBarsState } from './billing-bars';
import type { BillingNotice } from './billing-notices/use-billing-notices';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: () => ({}) }));

const notices = vi.hoisted(() => ({ current: [] as BillingNotice[] }));
vi.mock('./billing-notices/use-billing-notices', () => ({
  useBillingNotices: () => notices.current,
  findNotice: (list: readonly BillingNotice[], type: string) => list.find(notice => notice.type === type) ?? null,
}));

const DAY_MS = 24 * 60 * 60 * 1000;

const notice = (overrides: Partial<BillingNotice>): BillingNotice => ({
  type: BillingNoticeType.TRIAL_ENDING,
  eventKey: 'event',
  severity: BillingNoticeSeverity.WARNING,
  amountDue: null,
  suspensionDate: null,
  deletionDate: null,
  trialEndDate: null,
  reason: null,
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

function hydrate(list: BillingNotice[]): NoticeBarsState {
  notices.current = list;
  let state: NoticeBarsState | null = null;
  act(() =>
    root.render(
      <BillingNoticesHydrator
        onResolved={next => {
          state = next;
        }}
      />,
    ),
  );
  if (!state) throw new Error('the hydrator reported nothing');
  return state;
}

describe('BillingNoticesHydrator', () => {
  it('raises no bar for an empty list', () => {
    expect(hydrate([])).toEqual({ trial: null, autoTopUpDisabled: null });
  });

  it('counts the trial bar from the notice, rounded up, with its event', () => {
    const trialEndDate = asInstant(new Date(Date.now() + 2.5 * DAY_MS).toISOString());
    expect(hydrate([notice({ eventKey: 'trial-1', trialEndDate })]).trial).toEqual({
      daysLeft: 3,
      eventKey: 'trial-1',
    });
  });

  it('raises no trial bar once the trial end has gone by', () => {
    const trialEndDate = asInstant(new Date(Date.now() - DAY_MS).toISOString());
    expect(hydrate([notice({ trialEndDate })]).trial).toBeNull();
  });

  it('raises the auto top-up bar with its reason and event', () => {
    const state = hydrate([
      notice({
        type: BillingNoticeType.AUTO_TOP_UP_DISABLED,
        eventKey: 'charge-9',
        reason: AutoTopUpDisabledReason.AUTHENTICATION_ABANDONED,
      }),
    ]);
    expect(state.autoTopUpDisabled).toEqual({
      reason: AutoTopUpDisabledReason.AUTHENTICATION_ABANDONED,
      eventKey: 'charge-9',
    });
    expect(state.trial).toBeNull();
  });
});

describe('AutoTopUpDisabledBar', () => {
  it('says why the system switched it off, and dismisses', () => {
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        <AutoTopUpDisabledBar
          reason={AutoTopUpDisabledReason.PAYMENT_FAILED}
          onManage={vi.fn()}
          onDismiss={onDismiss}
        />,
      ),
    );
    expect(container.textContent).toContain('the last automatic charge was declined');
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Dismiss auto top-up notice"]')?.click());
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
