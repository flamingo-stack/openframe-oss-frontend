import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pendingApprovalSupported,
  resetPendingApprovalSupport,
} from '@/app/(app)/mingo/utils/pending-approval-support';
import { fetchApprovalDialogs, resetApprovalDialogsFilterSupport } from './approval-dialogs-query';

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
          "The variables input contains a field name 'hasPendingApproval' that is not defined for input object type 'DialogFilterInput'",
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

const filterOfCall = (call: number): Record<string, unknown> => post.mock.calls[call][1].variables.filter;

// Both fallbacks are remembered for the session.
beforeEach(() => {
  post.mockReset();
  resetPendingApprovalSupport();
  resetApprovalDialogsFilterSupport();
});

describe('fetchApprovalDialogs over a backend without Dialog.pendingApproval', () => {
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

  it('still fails on any other error', async () => {
    post.mockResolvedValueOnce({ ok: false, status: 500, error: 'Server error' });

    await expect(fetchApprovalDialogs(undefined)).rejects.toThrow('Server error');
    expect(pendingApprovalSupported()).toBe(true);
  });
});

describe('fetchApprovalDialogs and the hasPendingApproval filter', () => {
  it('asks for the waiting chats only', async () => {
    post.mockResolvedValueOnce(PAGE);

    await fetchApprovalDialogs(undefined);
    expect(filterOfCall(0).hasPendingApproval).toBe(true);
  });

  it('over a backend without it, lists every chat once refused and keeps the field', async () => {
    post.mockResolvedValueOnce(MISSING_FILTER).mockResolvedValue(PAGE);

    const page = await fetchApprovalDialogs(undefined);
    await fetchApprovalDialogs(undefined);

    expect(page.dialogs.map(dialog => dialog.dialogId)).toEqual(['d-1']);
    expect(post).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(filterOfCall(1))).not.toContain('hasPendingApproval');
    expect(JSON.stringify(filterOfCall(2))).not.toContain('hasPendingApproval');
    expect(pendingApprovalSupported()).toBe(true);
  });

  it('retries without it once, not again', async () => {
    post.mockResolvedValue(MISSING_FILTER);

    await expect(fetchApprovalDialogs(undefined)).rejects.toThrow('hasPendingApproval');
    expect(post).toHaveBeenCalledTimes(2);
  });
});
