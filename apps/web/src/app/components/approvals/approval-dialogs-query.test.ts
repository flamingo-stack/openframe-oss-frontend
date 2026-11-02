import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_DIALOGS_FILTER, fetchApprovalDialogs, fetchApprovalDialogsCount } from './approval-dialogs-query';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));

const PAGE = {
  ok: true,
  data: {
    data: {
      dialogs: {
        edges: [{ node: { id: 'g-1', dialogId: 'd-1', title: 'Disk', createdAt: '', pendingApproval: { id: 'r-1' } } }],
        pageInfo: { hasNextPage: true, endCursor: 'c-1' },
        filteredCount: 42,
      },
    },
  },
};

describe('the chats waiting on an approval', () => {
  beforeEach(() => post.mockReset());

  it('asks the server for every admin open chat with a pending request', async () => {
    post.mockResolvedValueOnce(PAGE);
    await fetchApprovalDialogs('c-0');
    expect(post.mock.calls[0][1].variables).toEqual({
      filter: {
        agentTypes: ['ADMIN'],
        statuses: ['ACTION_REQUIRED', 'ACTIVE', 'ON_HOLD'],
        scope: 'ALL',
        hasPendingApproval: true,
      },
      first: 20,
      after: 'c-0',
    });
  });

  it('reads the page and how many wait across all pages', async () => {
    post.mockResolvedValueOnce(PAGE);
    const page = await fetchApprovalDialogs(undefined);
    expect(page.dialogs.map(dialog => dialog.dialogId)).toEqual(['d-1']);
    expect(page.pageInfo).toEqual({ hasNextPage: true, endCursor: 'c-1' });
    expect(page.filteredCount).toBe(42);
  });

  it('counts them with the same filter', async () => {
    post.mockResolvedValueOnce({ ok: true, data: { data: { dialogs: { filteredCount: 3 } } } });
    await expect(fetchApprovalDialogsCount()).resolves.toBe(3);
    expect(post.mock.calls[0][1].variables).toEqual({ filter: APPROVAL_DIALOGS_FILTER });
  });

  it('fails on an error', async () => {
    post.mockResolvedValueOnce({ ok: false, status: 500, error: 'Server error' });
    await expect(fetchApprovalDialogs(undefined)).rejects.toThrow('Server error');
  });
});
