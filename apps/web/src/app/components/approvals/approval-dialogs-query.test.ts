import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pendingApprovalFilterSupported,
  pendingApprovalSupported,
  resetPendingApprovalSupport,
} from '@/app/(app)/mingo/utils/pending-approval-support';
import { fetchApprovalDialogs } from './approval-dialogs-query';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));

const MISSING_FIELD = {
  ok: true,
  data: {
    errors: [
      {
        message:
          "Validation error (FieldUndefined@[dialogs/edges/node/pendingApproval]) : Field 'pendingApproval' in type 'Dialog' is undefined",
      },
    ],
  },
};

const MISSING_FILTER = {
  ok: true,
  data: {
    errors: [
      {
        message:
          "Variable 'filter' has an invalid value: The variables input contains a field name 'pendingApproval' that is not defined for input object type 'DialogFilterInput'",
      },
    ],
  },
};

const PAGE = {
  ok: true,
  data: {
    data: {
      dialogs: {
        edges: [{ node: { id: 'g-1', dialogId: 'd-1', title: 'Disk', createdAt: '', pendingApproval: { id: 'r-1' } } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  },
};

describe('fetchApprovalDialogs over a backend without Dialog.pendingApproval', () => {
  beforeEach(() => {
    post.mockReset();
    resetPendingApprovalSupport();
  });

  it('finds no chats waiting instead of failing, and stops asking', async () => {
    post.mockResolvedValueOnce(MISSING_FIELD);

    await expect(fetchApprovalDialogs(undefined)).resolves.toEqual({
      dialogs: [],
      pageInfo: { hasNextPage: false },
    });
    expect(pendingApprovalSupported()).toBe(false);

    await fetchApprovalDialogs(undefined);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reads the chats where the field is served', async () => {
    post.mockResolvedValueOnce(PAGE);
    const page = await fetchApprovalDialogs(undefined);
    expect(page.dialogs.map(dialog => dialog.dialogId)).toEqual(['d-1']);
    expect(pendingApprovalSupported()).toBe(true);
  });

  it('asks for the waiting chats only', async () => {
    post.mockResolvedValueOnce(PAGE);
    await fetchApprovalDialogs(undefined);
    expect(post.mock.calls[0][1].variables.filter.pendingApproval).toBe(true);
  });

  it('over a backend without the filter, lists every chat and keeps asking for the field', async () => {
    post.mockResolvedValueOnce(MISSING_FILTER).mockResolvedValueOnce(PAGE);

    const page = await fetchApprovalDialogs(undefined);

    expect(page.dialogs.map(dialog => dialog.dialogId)).toEqual(['d-1']);
    expect(post).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(post.mock.calls[1][1].variables)).not.toContain('pendingApproval');
    expect(pendingApprovalFilterSupported()).toBe(false);
    expect(pendingApprovalSupported()).toBe(true);
  });

  it('still fails on any other error', async () => {
    post.mockResolvedValueOnce({ ok: false, status: 500, error: 'Server error' });
    await expect(fetchApprovalDialogs(undefined)).rejects.toThrow('Server error');
    expect(pendingApprovalSupported()).toBe(true);
  });
});
