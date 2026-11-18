import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDialogModel, updateDialogModel } from './mingo-model-api-service';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));

const MODEL = { provider: 'OPENAI', modelName: 'gpt-test', displayName: 'GPT Test' } as const;
const DIALOG = {
  id: 'relay-a',
  dialogId: 'a',
  agentType: 'ADMIN',
  contextSize: 150_000,
  status: 'ACTIVE',
  streamState: 'IDLE',
  pendingApproval: null,
  model: MODEL,
  effectiveModel: MODEL,
};
beforeEach(() => post.mockReset());

describe('Mingo model Relay operations on the chat endpoint', () => {
  it('reads the authoritative model via /chat/graphql without the API Relay endpoint', async () => {
    post.mockResolvedValue({
      ok: true,
      data: { data: { dialog: { ...DIALOG, modelTokenBudget: 150_000 } } },
    });
    expect(await readDialogModel('a')).toEqual(DIALOG);
    const [endpoint, operation] = post.mock.calls[0];
    expect(endpoint).toBe('/chat/graphql');
    expect(operation.variables).toEqual({ id: 'a' });
    expect(operation.query).toContain('effectiveModel');
  });
  it('sends an exact provider/model input, ignoring display-only fields', async () => {
    post.mockResolvedValue({
      ok: true,
      data: {
        data: {
          updateDialogModel: {
            dialog: { ...DIALOG, modelTokenBudget: 150_000 },
            userErrors: [],
          },
        },
      },
    });
    expect(await updateDialogModel('relay-a', MODEL)).toEqual(DIALOG);
    expect(post.mock.calls[0][1].variables).toEqual({
      input: { id: 'relay-a', model: { provider: 'OPENAI', modelName: 'gpt-test' } },
    });
  });
  it('sends explicit null for reset and uses the returned effective default', async () => {
    const reset = {
      ...DIALOG,
      model: null,
      effectiveModel: { ...MODEL, provider: 'ANTHROPIC', modelName: 'claude-default' },
    };
    post.mockResolvedValue({
      ok: true,
      data: {
        data: {
          updateDialogModel: {
            dialog: { ...reset, modelTokenBudget: 150_000 },
            userErrors: [],
          },
        },
      },
    });
    expect(await updateDialogModel('relay-a', null)).toEqual(reset);
    expect(post.mock.calls[0][1].variables.input.model).toBeNull();
  });
  it('rejects a backend business refusal instead of treating a null dialog as success', async () => {
    post.mockResolvedValue({
      ok: true,
      data: {
        data: {
          updateDialogModel: {
            dialog: null,
            userErrors: [{ field: ['model'], code: 'DIALOG_LOCKED', message: 'Chat is busy' }],
          },
        },
      },
    });
    await expect(updateDialogModel('relay-a', MODEL)).rejects.toThrow('Chat is busy');
  });
  it('rejects network, GraphQL and missing-chat failures', async () => {
    post.mockResolvedValueOnce({ ok: false, error: 'Offline' });
    await expect(readDialogModel('a')).rejects.toThrow('Offline');
    post.mockResolvedValueOnce({
      ok: true,
      data: { data: { updateDialogModel: null }, errors: [{ message: 'Access denied' }] },
    });
    await expect(updateDialogModel('relay-a', MODEL)).rejects.toThrow('Access denied');
    post.mockResolvedValueOnce({ ok: true, data: { data: { dialog: null } } });
    await expect(readDialogModel('a')).rejects.toThrow('This chat is not available');
  });
});
