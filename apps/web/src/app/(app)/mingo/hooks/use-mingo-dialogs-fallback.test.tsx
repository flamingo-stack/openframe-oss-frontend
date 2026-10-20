import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET_MINGO_DIALOGS_QUERY, GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY } from '../queries/dialogs-queries';
import { pendingApprovalSupported, resetPendingApprovalSupport } from '../utils/pending-approval-support';
import { useMingoDialogs } from './use-mingo-dialogs';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));
vi.mock('@flamingo-stack/openframe-frontend-core', () => ({ useOptionalNotifications: () => null }));

const MISSING_FIELD = {
  ok: true,
  data: { errors: [{ message: "Field 'pendingApproval' in type 'Dialog' is undefined" }] },
};
const PAGE = {
  ok: true,
  data: {
    data: {
      dialogs: {
        edges: [
          { node: { id: 'g-1', dialogId: 'd-1', title: 'Disk', status: 'ACTIVE', createdAt: '2026-10-20T10:00:00Z' } },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  },
};

const seen = { titles: [] as string[], error: null as unknown };

function Probe() {
  const { dialogs, error } = useMingoDialogs({ search: 'disk' });
  useLayoutEffect(() => {
    seen.titles = dialogs.map(dialog => dialog.title);
    seen.error = error;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

describe('useMingoDialogs over a backend without Dialog.pendingApproval', () => {
  beforeEach(() => {
    post.mockReset();
    resetPendingApprovalSupport();
    seen.titles = [];
    seen.error = null;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it('loads the history without the field instead of failing', async () => {
    post.mockResolvedValueOnce(MISSING_FIELD).mockResolvedValueOnce(PAGE);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await vi.waitFor(() => expect(seen.titles).toEqual(['Disk']));

    expect(post.mock.calls.map(call => call[1].query)).toEqual([
      GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY,
      GET_MINGO_DIALOGS_QUERY,
    ]);
    expect(pendingApprovalSupported()).toBe(false);
  });
});
