import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { renderMingoMention } from './render-mention';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('@/app/(auth)/auth/stores/auth-store', async () => {
  const { create } = await import('zustand');
  return { useAuthStore: create(() => ({ user: null, tenantId: null, isAuthenticated: false })) };
});
vi.mock('@/app/hooks/use-same-window-links', () => ({ useSameWindowLinks: () => false }));
vi.mock('../context-sources', () => ({ MINGO_CONTEXT_ENTITY_TYPES: [] }));
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: () => null }));

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  push.mockReset();
  vi.mocked(apiClient.post).mockReset();
  useMingoLauncherStore.setState({ isOpen: true, closedForNavigation: false });
  useAuthStore.setState({
    user: { id: 'user-a', email: 'a@example.test', tenantId: 'tenant-a' },
    tenantId: 'tenant-a',
    isAuthenticated: true,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderChatMention(id: string): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <p>{renderMingoMention({ marker: 'chat', id })}</p>
      </QueryClientProvider>,
    );
  });
}

describe('chat memory mention', () => {
  it('renders an authorized chat as an inline tag and opens it in this window', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: { data: { conversationMemoryChatReference: { id: 'chat-1', title: 'VPN incident' } } },
    } as Awaited<ReturnType<typeof apiClient.post>>);

    await renderChatMention('chat-1');

    await vi.waitFor(() => expect(container.querySelector('a')?.textContent).toBe('VPN incident'));
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/dashboard?mingoDialog=chat-1');
    expect(anchor?.textContent).toBe('VPN incident');
    expect(anchor?.getAttribute('target')).toBeNull();
    expect(apiClient.post).toHaveBeenCalledWith('/chat/graphql', {
      query:
        'query ConversationMemoryChatReference($id: ID!) { conversationMemoryChatReference(id: $id) { id title } }',
      variables: { id: 'chat-1' },
    });

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => anchor?.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith('/dashboard?mingoDialog=chat-1');
  });

  it('does not link a chat the user cannot access', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: { data: { conversationMemoryChatReference: null } },
    } as Awaited<ReturnType<typeof apiClient.post>>);

    await renderChatMention('private-chat');

    await vi.waitFor(() => expect(container.textContent).toBe('@chat:private-chat'));
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('@chat:private-chat');
  });

  it('does not retry or link a forbidden lookup', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Forbidden',
    } as Awaited<ReturnType<typeof apiClient.post>>);

    await renderChatMention('chat-2');

    await vi.waitFor(() => expect(container.textContent).toBe('@chat:chat-2'));
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('@chat:chat-2');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('recovers a chat tag after a temporary GraphQL failure', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        error: 'Service unavailable',
      } as Awaited<ReturnType<typeof apiClient.post>>)
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { conversationMemoryChatReference: { id: 'chat-3', title: 'Recovered chat' } } },
      } as Awaited<ReturnType<typeof apiClient.post>>);

    await renderChatMention('chat-3');

    await vi.waitFor(() => expect(container.querySelector('a')?.textContent).toBe('Recovered chat'), { timeout: 2500 });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('never shows a cached chat title when the authenticated tenant changes', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      ok: true,
      data: { data: { conversationMemoryChatReference: { id: 'chat-1', title: 'Tenant A chat' } } },
    } as Awaited<ReturnType<typeof apiClient.post>>);
    let resolveTenantB: (value: Awaited<ReturnType<typeof apiClient.post>>) => void = () => {};
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveTenantB = resolve;
        }),
    );

    await renderChatMention('chat-1');
    await vi.waitFor(() => expect(container.querySelector('a')?.textContent).toBe('Tenant A chat'));
    expect(container.querySelector('a')?.textContent).toBe('Tenant A chat');

    act(() => {
      useAuthStore.setState({
        user: { id: 'user-a', email: 'a@example.test', tenantId: 'tenant-b' },
        tenantId: 'tenant-b',
        isAuthenticated: true,
      });
    });
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).not.toContain('Tenant A chat');

    await act(async () => {
      resolveTenantB({
        ok: true,
        data: { data: { conversationMemoryChatReference: { id: 'chat-1', title: 'Tenant B chat' } } },
      } as Awaited<ReturnType<typeof apiClient.post>>);
    });
    await vi.waitFor(() => expect(container.querySelector('a')?.textContent).toBe('Tenant B chat'));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a chat title when another user signs into the same tenant', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { conversationMemoryChatReference: { id: 'chat-1', title: 'Private chat' } } },
      } as Awaited<ReturnType<typeof apiClient.post>>)
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { conversationMemoryChatReference: null } },
      } as Awaited<ReturnType<typeof apiClient.post>>);

    await renderChatMention('chat-1');
    await vi.waitFor(() => expect(container.querySelector('a')?.textContent).toBe('Private chat'));

    act(() => {
      useAuthStore.setState({
        user: { id: 'user-b', email: 'b@example.test', tenantId: 'tenant-a' },
        tenantId: 'tenant-a',
        isAuthenticated: true,
      });
    });
    expect(container.querySelector('a')).toBeNull();

    await vi.waitFor(() => expect(container.textContent).toBe('@chat:chat-1'));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('does not look up or link a chat without an authenticated identity', async () => {
    useAuthStore.setState({ user: null, tenantId: null, isAuthenticated: false });

    await renderChatMention('chat-1');

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('@chat:chat-1');
  });
});
