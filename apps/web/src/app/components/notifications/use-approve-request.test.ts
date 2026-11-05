/**
 * A decision is one request however many clicks ask for it, and a refusal for a request
 * that no longer waits settles it instead of failing.
 */

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearApprovalDecisions, useApprovalDecisionsStore } from '@/app/components/approvals/approval-decisions';
import { isSettledRefusal, useApproveRequest } from './use-approve-request';

const { resolveApprovalRequest, toast } = vi.hoisted(() => ({
  resolveApprovalRequest: vi.fn<(id: string, approve: boolean) => Promise<void>>(),
  toast: vi.fn(),
}));

vi.mock('@/app/(app)/tickets/services', () => ({ ticketService: { resolveApprovalRequest } }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast }) }));

/** The hook's callback, from a mounted component. */
function mountHook(): ReturnType<typeof useApproveRequest> {
  let approve: ReturnType<typeof useApproveRequest> | undefined;
  function Probe() {
    approve = useApproveRequest();
    return null;
  }
  act(() => createRoot(document.createElement('div')).render(createElement(Probe)));
  if (!approve) throw new Error('not mounted');
  return approve;
}

afterEach(() => {
  resolveApprovalRequest.mockReset();
  toast.mockReset();
  clearApprovalDecisions();
});

describe('isSettledRefusal', () => {
  it.each([
    'Approval request already resolved',
    'Approval request has expired',
    'Approval request not found',
    'The request is no longer pending',
  ])('settles "%s"', message => expect(isSettledRefusal(message)).toBe(true));

  it('fails anything else', () => expect(isSettledRefusal('Not authorized')).toBe(false));
});

describe('useApproveRequest', () => {
  it('sends one request for repeat clicks and gives each the same outcome', async () => {
    let finish = () => {};
    resolveApprovalRequest.mockReturnValue(new Promise<void>(resolve => (finish = resolve)));
    const approve = mountHook();

    const first = approve('ar-1', true);
    const second = approve('ar-1', false);
    finish();

    await expect(Promise.all([first, second])).resolves.toEqual(['decided', 'decided']);
    expect(resolveApprovalRequest).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);

    resolveApprovalRequest.mockResolvedValue();
    await approve('ar-1', true);
    expect(resolveApprovalRequest).toHaveBeenCalledTimes(2);
  });

  it('records a request that no longer waits as settled', async () => {
    resolveApprovalRequest.mockRejectedValue(new Error('Approval request already resolved'));
    const approve = mountHook();

    await expect(approve('ar-1', true)).resolves.toBe('settled');
    expect(useApprovalDecisionsStore.getState().decisions).toEqual({ 'ar-1': 'settled' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'info' }));
  });

  it('keeps any other refusal pending', async () => {
    resolveApprovalRequest.mockRejectedValue(new Error('Not authorized'));
    const approve = mountHook();

    await expect(approve('ar-1', true)).resolves.toBe('failed');
    expect(useApprovalDecisionsStore.getState().decisions).toEqual({});
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
