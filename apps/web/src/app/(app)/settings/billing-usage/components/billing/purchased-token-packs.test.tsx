/**
 * The billing page's list of token packs: what Payment Terms 5.4 promises the customer can read. The date printed is
 * the API's `validUntil`, never one worked out from `expiresAt`, which is a day later (CU-17tkuw61pae).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { purchasedTokenPacks_subscription$key } from '@/__generated__/purchasedTokenPacks_subscription.graphql';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { PurchasedTokenPacks } from './purchased-token-packs';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of;
// a fragment read hands back the record it was given.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, ref: unknown) => ref,
}));

const OLDER = {
  purchasedAt: '2026-10-28T14:35:00Z',
  tokensPurchased: 5_000_000,
  tokensRemaining: 1_200_000,
  validUntil: '2027-10-28',
  // Selected by nothing: a printed date taken from here would be a day late.
  expiresAt: '2027-10-29T00:00:00Z',
};
const NEWER = {
  purchasedAt: '2026-10-30T09:00:00Z',
  tokensPurchased: 1_000_000,
  tokensRemaining: 1_000_000,
  validUntil: '2027-10-30',
  expiresAt: '2027-10-31T00:00:00Z',
};

const subscription = (purchasedTokenPacks: unknown[]) =>
  ({ usage: { purchasedTokenPacks } }) as unknown as purchasedTokenPacks_subscription$key;

let container: HTMLDivElement;
let root: Root;

function render(ref: purchasedTokenPacks_subscription$key) {
  act(() => {
    root.render(<PurchasedTokenPacks subscription={ref} />);
  });
  return [...container.querySelectorAll('li')].map(row => row.textContent ?? '');
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('PurchasedTokenPacks', () => {
  it("states each pack's tokens, purchase date and the API's last valid day", () => {
    const [row] = render(subscription([OLDER]));

    expect(row).toContain('1.2M / 5M');
    expect(row).toContain('Purchased 2026-10-28');
    expect(row).toContain('Valid until 2027-10-28');
  });

  it('keeps the order the API sent, the order tokens are spent in', () => {
    const rows = render(subscription([OLDER, NEWER]));

    expect(rows.map(row => /Valid until (\S+?)Purchased/.exec(row)?.[1])).toEqual(['2027-10-28', '2027-10-30']);
  });

  it('prints no date for a pack that never expires', () => {
    const [row] = render(subscription([{ ...OLDER, validUntil: null, expiresAt: null }]));

    expect(row).not.toContain('Valid until');
    expect(row).toContain(EMPTY_VALUE);
  });

  it('draws nothing when there are no packs', () => {
    render(subscription([]));

    expect(container.innerHTML).toBe('');
  });
});
