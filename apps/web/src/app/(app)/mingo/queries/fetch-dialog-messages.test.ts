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

const NO_SOURCE_ID =
  "Validation error (FieldUndefined@[messages/edges/node/messageData/sources/sourceId]) : Field 'sourceId' in type 'ChatSourceAttachment' is undefined";
const NO_RECORDS =
  "Validation error (FieldUndefined@[messages/edges/node/messageData/records]) : Field 'records' in type 'RecordCardsData' is undefined";
const NO_CARDS_TYPE = "Validation error (UnknownType) : Unknown type 'RecordCardsData'";

const rejecting = (...messages: string[]) => ({
  ok: true,
  status: 200,
  data: { errors: messages.map(message => ({ message })) },
});

const queryOfCall = (call: number): string => post.mock.calls[call][1].query;

/** A fresh module per test: the fallback is remembered for the session. */
async function loadFetch() {
  vi.resetModules();
  return (await import('./fetch-dialog-messages')).fetchMingoDialogMessages;
}

describe('fetchMingoDialogMessages', () => {
  beforeEach(() => post.mockReset());

  it('asks a current backend once, for AttachmentsData in the standard names', async () => {
    post.mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(1);
    expect(queryOfCall(0)).toContain('... on AttachmentsData');
    expect(queryOfCall(0)).toContain('sourceId');
    expect(queryOfCall(0)).toContain('records');
  });

  it('falls back to the old names on a backend without them, and stays there', async () => {
    post.mockResolvedValueOnce(rejecting(NO_SOURCE_ID)).mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(queryOfCall(1)).not.toContain('sourceId');
    expect(queryOfCall(1)).toContain('externalUrl');
    expect(queryOfCall(1)).toContain('entityType');

    await fetchMingoDialogMessages(VARIABLES);
    expect(post).toHaveBeenCalledTimes(3);
    expect(queryOfCall(2)).not.toContain('sourceId');
  });

  it("keeps a backend's record cards when the old names are what it rejects", async () => {
    // A dev cluster: `RecordCardsData` exists with its old field, and the rejection names the type.
    post.mockResolvedValueOnce(rejecting(NO_SOURCE_ID, NO_RECORDS)).mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(2);
    expect(queryOfCall(1)).toContain('... on RecordCardsData');
    expect(queryOfCall(1)).not.toContain('records');
  });

  it('drops the old names and the record cards on a backend with neither', async () => {
    post
      .mockResolvedValueOnce(rejecting(NO_SOURCE_ID, NO_CARDS_TYPE))
      .mockResolvedValueOnce(rejecting(NO_CARDS_TYPE))
      .mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(3);
    expect(queryOfCall(2)).not.toContain('sourceId');
    expect(queryOfCall(2)).not.toContain('RecordCardsData');
    expect(queryOfCall(2)).toContain('... on AttachmentsData');
  });

  it('gets its answer from a backend that rejects every flag in turn', async () => {
    post
      .mockResolvedValueOnce(REJECTED)
      .mockResolvedValueOnce(rejecting(NO_SOURCE_ID))
      .mockResolvedValueOnce(rejecting(NO_CARDS_TYPE))
      .mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(4);
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

  it('leaves out RecordCardsData on a backend without it, and stays without it', async () => {
    post.mockResolvedValueOnce(rejecting(NO_CARDS_TYPE)).mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(queryOfCall(0)).toContain('... on RecordCardsData');
    expect(queryOfCall(1)).not.toContain('RecordCardsData');
    expect(queryOfCall(1)).toContain('... on AttachmentsData');

    await fetchMingoDialogMessages(VARIABLES);
    expect(queryOfCall(2)).not.toContain('RecordCardsData');
  });

  it('drops both part types for a backend that lacks both', async () => {
    post.mockResolvedValueOnce(REJECTED).mockResolvedValueOnce(rejecting(NO_CARDS_TYPE)).mockResolvedValue(PAGE);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(PAGE);
    expect(post).toHaveBeenCalledTimes(3);
    expect(queryOfCall(2)).toContain('... on GuideData');
    expect(queryOfCall(2)).not.toContain('RecordCardsData');
  });

  it('hands any other failure back untouched', async () => {
    const failure = { ok: false, status: 500, error: 'Request failed with status 500' };
    post.mockResolvedValue(failure);
    const fetchMingoDialogMessages = await loadFetch();

    await expect(fetchMingoDialogMessages(VARIABLES)).resolves.toBe(failure);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
