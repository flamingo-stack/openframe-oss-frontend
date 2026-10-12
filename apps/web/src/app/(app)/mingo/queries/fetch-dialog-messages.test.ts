import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));

const VARIABLES = { dialogId: 'd-1', limit: 50, sortField: 'createdAt', sortDirection: 'DESC' } as const;

const PAGE = {
  ok: true,
  status: 200,
  data: { data: { messages: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } } } },
};

/** A schema without the type, as the chat service words it (HTTP 200, no data). */
const REJECTED = {
  ok: true,
  status: 200,
  data: {
    errors: [
      {
        message: "Validation error (UnknownType@[messages/edges/node/messageData]) : Unknown type 'AttachmentsData'",
      },
    ],
  },
};

const queryOfCall = (call: number): string => post.mock.calls[call][1].query;

/** A fresh module per test: the fallback is remembered for the session. */
async function loadFetch() {
  vi.resetModules();
  return (await import('./fetch-dialog-messages')).fetchMingoDialogMessages;
}

describe('fetchMingoDialogMessages', () => {
  beforeEach(() => post.mockReset());

  it('asks a current backend once, for AttachmentsData', async () => {
    post.mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(1);
    expect(queryOfCall(0)).toContain('... on AttachmentsData');
  });

  it('falls back to GuideData on a backend without AttachmentsData, and stays there', async () => {
    post.mockResolvedValueOnce(REJECTED).mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(queryOfCall(1)).toContain('... on GuideData');
    expect(queryOfCall(1)).not.toContain('AttachmentsData');

    await fetchMingoDialogMessages(VARIABLES);
    expect(post).toHaveBeenCalledTimes(3);
    expect(queryOfCall(2)).toContain('... on GuideData');
  });

  it('hands any other failure back untouched', async () => {
    const failure = { ok: false, status: 500, error: 'Request failed with status 500' };
    post.mockResolvedValue(failure);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(failure);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
