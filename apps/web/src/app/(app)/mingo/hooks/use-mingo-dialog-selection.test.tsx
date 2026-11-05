// Pins what a card's approve and reject controls reach: the backend's request id, whichever id the control names (a row
// of a batch, the batch, a card of one), with the whole card flipped before the round trip.

import { isToolPart } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindMingoDialog, useMingoMessagesStore } from '../stores/mingo-messages-store';
import { useMingoDialogSelection } from './use-mingo-dialog-selection';

const DIALOG = 'dialog-selection';

const { approve, reject } = vi.hoisted(() => ({
  approve: vi.fn(async (_requestId: string) => {}),
  reject: vi.fn(async (_requestId: string) => {}),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/analytics', async importOriginal => ({
  ...(await importOriginal<object>()),
  trackDashboardActivity: vi.fn(),
}));
vi.mock('../services/mingo-api-service', () => ({
  useApproveRequestMutation: () => ({ mutateAsync: approve }),
  useRejectRequestMutation: () => ({ mutateAsync: reject }),
}));
vi.mock('@/lib/dialog-messages-page', () => ({
  fetchDialogMessagesPage: async () => ({ messages: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }),
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: async () => ({
      ok: true,
      status: 200,
      data: { data: { dialog: { id: DIALOG, title: 'A chat', streamState: 'STREAMING' } } },
    }),
  },
}));

let root: Root;
let selection: ReturnType<typeof useMingoDialogSelection>;

const toolStates = () =>
  (useMingoMessagesStore.getState().messagesByDialog.get(DIALOG) ?? [])
    .flatMap(message => message.parts)
    .filter(isToolPart)
    .map(part => part.state);

function askForApproval(chunk: Record<string, unknown>) {
  const bound = bindMingoDialog(DIALOG);
  act(() => bound.apply(bound.decode({ type: 'APPROVAL_REQUEST', approvalType: 'ADMIN', ...chunk })));
}

const BATCH = {
  approvalRequestId: 'ar-1',
  streamSeq: 1,
  toolCalls: ['run-1', 'run-2'].map(toolExecutionRequestId => ({
    toolExecutionRequestId,
    toolName: 'run_script',
    requiresApproval: true,
  })),
};

beforeEach(async () => {
  approve.mockClear();
  reject.mockClear();
  useMingoMessagesStore.getState().resetAll();
  useMingoMessagesStore.getState().setActiveDialogId(DIALOG);
  function Probe() {
    const current = useMingoDialogSelection();
    selection = current;
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Probe />
      </QueryClientProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  useMingoMessagesStore.getState().resetAll();
});

describe('useMingoDialogSelection approvals', () => {
  it('approves the request a row belongs to, and flips every row of its card', async () => {
    askForApproval(BATCH);

    await act(() => selection.handleApprove('run-1'));

    expect(approve).toHaveBeenCalledWith('ar-1');
    expect(toolStates()).toEqual(['approval-responded', 'approval-responded']);
  });

  it('rejects the request a card names by its batch', async () => {
    askForApproval(BATCH);

    await act(() => selection.handleReject('ar-1'));

    expect(reject).toHaveBeenCalledWith('ar-1');
    expect(toolStates()).toEqual(['output-denied', 'output-denied']);
  });

  it('locks the composer for the round trip, as the agent resumes on the answer', async () => {
    askForApproval(BATCH);

    await act(() => selection.handleApprove('run-1'));

    expect(useMingoMessagesStore.getState().getTyping(DIALOG)).toBe(true);
  });
});
