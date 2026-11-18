/**
 * What a ticket's client chat hands the lib's chat engine: the client side of the dialog's two sides, the direct-mode
 * barrier, the technician's own direct echo, and the commands it sends. The engine does the rest; this pins only that
 * the ticket names them.
 */

import type { UseChatEngineConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketChatStore } from '../stores/ticket-chat-store';
import { useTicketClientChat } from './use-ticket-client-chat';

const { captured, service } = vi.hoisted(() => ({
  captured: { config: null as UseChatEngineConfig | null, active: undefined as boolean | undefined },
  service: { sendMessage: vi.fn(), resolveApprovalRequest: vi.fn() },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  useChatEngine: (engineConfig: UseChatEngineConfig, options?: { active?: boolean }) => {
    captured.config = engineConfig;
    captured.active = options?.active;
    return { messages: [], streamingPhase: 'idle' };
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'wss://nats.test', onBeforeReconnect: undefined }),
}));
vi.mock('../services', () => ({ ticketService: service }));

let container: HTMLDivElement;
let root: Root;
const onApprovalAnswered = vi.fn();

function Probe({ dialogId, isDirectMode }: { dialogId: string | null; isDirectMode: boolean }) {
  useTicketClientChat({
    dialogId,
    isDirectMode,
    assistantName: 'Fae',
    baselineModel: { provider: 'Claude', displayName: 'Sonnet' },
    modelsByProvider: undefined,
    onApprovalAnswered,
  });
  return null;
}

function config(): UseChatEngineConfig {
  if (!captured.config) throw new Error('the engine was not configured');
  return captured.config;
}

function render(dialogId: string | null, isDirectMode = true) {
  act(() => root.render(<Probe dialogId={dialogId} isDirectMode={isDirectMode} />));
}

describe('useTicketClientChat: the engine config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.config = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the client side of the ticket's dialog, from the store of its two sides", () => {
    render('dialog-1');
    expect(config().store).toBe(ticketChatStore);
    expect(config().side).toBe('client');
    expect(config().dialogId).toBe('dialog-1');
    expect(config().chatTypeFilter).toBe('CLIENT_CHAT');
    expect(captured.active).toBe(true);
  });

  it('is idle while the ticket has no dialog', () => {
    render(null);
    expect(captured.active).toBe(false);
  });

  it("passes the direct mode on, and takes the technician's own ADMIN echo as theirs", () => {
    render('dialog-1', true);
    expect(config().directMode).toBe(true);
    expect(config().directMessages?.ownDirectOwnerType).toBe('ADMIN');
    expect(config().sendSupersedesPending).toBe(true);
    expect(config().modelProvider).toBe('Claude');
    expect(config().modelLabel).toBe('Sonnet');
  });

  it("sends into the dialog's client chat, and answers an approval then refreshes the ticket", async () => {
    render('dialog-1');
    const transport = config().transport;
    if (transport.kind === 'stream') throw new Error('expected a live-tail transport');
    service.sendMessage.mockResolvedValueOnce(undefined);
    await expect(transport.publish('  hello  ', { dialogId: 'dialog-1' })).resolves.toBe(true);
    expect(service.sendMessage).toHaveBeenCalledWith('dialog-1', 'hello', 'CLIENT_CHAT');
    await expect(transport.publish('hello', { dialogId: null })).resolves.toBe(false);

    service.resolveApprovalRequest.mockResolvedValue(undefined);
    await transport.approve?.('request-1');
    await transport.reject?.('request-2');
    expect(service.resolveApprovalRequest).toHaveBeenNthCalledWith(1, 'request-1', true);
    expect(service.resolveApprovalRequest).toHaveBeenNthCalledWith(2, 'request-2', false);
    expect(onApprovalAnswered).toHaveBeenCalledTimes(2);
  });
});
