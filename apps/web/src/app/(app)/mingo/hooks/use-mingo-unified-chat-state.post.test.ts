import { MingoGraphqlError } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { postMingoGraphql } from './use-mingo-unified-chat-state';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }));

const post = vi.mocked(apiClient.post);
// What QA's /chat/graphql answered (200, 2026-11-19) for a field its schema does not have.
const unknownField = {
  message:
    "Validation error (FieldUndefined@[dialog/tokenUsage/notARealField]) : Field 'notARealField' in type 'DialogTokenUsage' is undefined",
  locations: [{ line: 1, column: 87 }],
  path: ['dialog', 'tokenUsage', 'notARealField'],
  extensions: { classification: 'ValidationError', errorType: 'BAD_REQUEST', errorDetail: 'FIELD_NOT_FOUND' },
};

async function rejectionOf(answer: Awaited<ReturnType<typeof apiClient.post>>): Promise<MingoGraphqlError> {
  post.mockResolvedValueOnce(answer);
  const error: unknown = await postMingoGraphql('query { dialog { id } }', {}).then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(MingoGraphqlError);
  return error as MingoGraphqlError;
}

describe('postMingoGraphql: how a failure says what the server did', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('a query the server refused to run, answered 200', async () => {
    const error = await rejectionOf({ ok: true, status: 200, data: { errors: [unknownField] } });
    expect(error.refused).toBe(true);
    expect(error.message).toContain('FieldUndefined');
  });

  it('a query the federation router refused to run: no classification, no data', async () => {
    // What QA's /api/router/graphql answered (200, 2026-11-19) when the graphql-router flag sends Mingo there.
    const error = await rejectionOf({
      ok: true,
      status: 200,
      data: {
        errors: [
          {
            message: 'Cannot query field "notARealField" on type "DialogTokenUsage".',
            path: ['query', 'dialog', 'tokenUsage'],
          },
        ],
      },
    });
    expect(error.refused).toBe(true);
  });

  it('a query the server refused to run, answered 400 with its GraphQL body', async () => {
    const error = await rejectionOf({
      ok: false,
      status: 400,
      error: 'Request failed with status 400',
      data: { errors: [unknownField] },
    });
    expect(error.refused).toBe(true);
  });

  it('a 503 is not a refusal', async () => {
    const error = await rejectionOf({ ok: false, status: 503, error: 'Service Unavailable' });
    expect(error.refused).toBe(false);
    expect(error.message).toBe('Service Unavailable');
  });

  it('a query that ran and failed is not a refusal', async () => {
    const error = await rejectionOf({
      ok: true,
      status: 200,
      data: { data: { dialog: null }, errors: [{ message: 'boom', extensions: { classification: 'INTERNAL_ERROR' } }] },
    });
    expect(error.refused).toBe(false);
    expect(error.message).toBe('boom');
  });

  it('an answer with data beside a failed sub-resolver is still the answer', async () => {
    post.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { data: { dialog: { id: 'd1' } }, errors: [{ message: 'title resolver failed' }] },
    });
    await expect(postMingoGraphql('query { dialog { id } }', {})).resolves.toEqual({ dialog: { id: 'd1' } });
  });
});
