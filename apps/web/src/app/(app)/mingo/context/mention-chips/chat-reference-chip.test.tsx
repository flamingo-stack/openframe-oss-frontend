/**
 * `@chat:<dialogId>` — an earlier conversation Mingo cites from chat memory.
 *
 * Pins the three answers the ai-agent's `conversationMemoryChatReference` can
 * give and what each becomes in the sentence: a title → a linked chip that
 * opens the dialog IN THE DRAWER (no page navigation, no new tab, even on the
 * desktop web where entity chips open a tab); `null` → the backend will not
 * name the chat for this caller, so an unlinked chip that says so; a failed
 * request → the link kept under a generic label, because the drawer resolves
 * the dialog on its own.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { mingoDialogLink } from '@/lib/routes';
import { ChatReferenceChip } from './chat-reference-chip';

type ApiResponse = { ok: boolean; data?: unknown; error?: string; status: number };

const spies = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  post: vi.fn<(url: string, body?: { query?: string; variables?: unknown }) => Promise<ApiResponse>>(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: spies.push }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post: spies.post }, REQUEST_TIMEOUT_MS: 30_000 }));
// Desktop web: an entity chip would open a NEW TAB here. The chat chip must not.
vi.mock('@/app/hooks/use-same-window-links', () => ({ useSameWindowLinks: () => false }));

// The lib `Tag` measures its label for the truncation tooltip; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const DIALOG_ID = '68f0c2a1b3d4e5f601234567';

function graphql(reference: { id: string; title: string | null } | null): ApiResponse {
  return { ok: true, status: 200, data: { data: { conversationMemoryChatReference: reference } } };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  spies.push.mockReset();
  spies.post.mockReset();
  useMingoLauncherStore.setState({ isOpen: true, closedForNavigation: false });
  useMingoMessagesStore.getState().setActiveDialogId('other-dialog');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderChip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ChatReferenceChip id={DIALOG_ID} />
      </QueryClientProvider>,
    );
  });
  // The chip suspends on its lookup; settle it (the skeleton has no text). A
  // failed lookup retries once after a second before the boundary shows the
  // fallback, so the wait outlasts that.
  await vi.waitFor(
    () => {
      expect(container.textContent?.trim()).not.toBe('');
    },
    { timeout: 3000 },
  );
}

function primaryClick(anchor: HTMLAnchorElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  act(() => {
    anchor.dispatchEvent(event);
  });
  return event;
}

describe('ChatReferenceChip', () => {
  it('asks the ai-agent for the reference by the id the marker carries', async () => {
    spies.post.mockResolvedValue(graphql({ id: DIALOG_ID, title: 'Weak passwords review' }));
    await renderChip();

    expect(spies.post).toHaveBeenCalledTimes(1);
    const [url, body] = spies.post.mock.calls[0];
    expect(url).toBe('/chat/graphql');
    expect(body?.query).toContain('conversationMemoryChatReference(id: $id)');
    expect(body?.variables).toEqual({ id: DIALOG_ID });
  });

  it('shows the original title and opens the chat in the drawer, in place', async () => {
    spies.post.mockResolvedValue(graphql({ id: DIALOG_ID, title: 'Weak passwords review' }));
    await renderChip();

    const anchor = container.querySelector('a');
    if (!anchor) throw new Error('chip rendered no anchor');
    expect(anchor.textContent).toContain('Weak passwords review');
    expect(anchor.getAttribute('href')).toBe(mingoDialogLink(DIALOG_ID));
    // In place: never a new tab, even where entity chips open one.
    expect(anchor.getAttribute('target')).toBeNull();

    const event = primaryClick(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(spies.push).not.toHaveBeenCalled();
    expect(useMingoMessagesStore.getState().activeDialogId).toBe(DIALOG_ID);
    expect(useMingoLauncherStore.getState()).toMatchObject({ isOpen: true, closedForNavigation: false });
  });

  it('leaves a modifier click to the browser, with the href to open elsewhere', async () => {
    spies.post.mockResolvedValue(graphql({ id: DIALOG_ID, title: 'Weak passwords review' }));
    await renderChip();

    const anchor = container.querySelector('a');
    if (!anchor) throw new Error('chip rendered no anchor');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    act(() => {
      anchor.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(useMingoMessagesStore.getState().activeDialogId).toBe('other-dialog');
  });

  it('names a chat the backend left untitled', async () => {
    spies.post.mockResolvedValue(graphql({ id: DIALOG_ID, title: null }));
    await renderChip();

    expect(container.querySelector('a')?.textContent).toContain('Untitled conversation');
  });

  it('says so, and links nowhere, when the backend will not name the chat', async () => {
    spies.post.mockResolvedValue(graphql(null));
    await renderChip();

    expect(container.textContent).toContain('Chat unavailable');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).not.toContain(DIALOG_ID);
  });

  it('keeps the link under a generic label when the lookup fails', async () => {
    spies.post.mockResolvedValue({ ok: false, status: 502, error: 'Bad Gateway' });
    await renderChip();

    const anchor = container.querySelector('a');
    if (!anchor) throw new Error('chip rendered no anchor');
    expect(anchor.textContent).toContain('Chat');
    expect(anchor.textContent).not.toContain(DIALOG_ID);
    expect(anchor.getAttribute('href')).toBe(mingoDialogLink(DIALOG_ID));

    primaryClick(anchor);
    expect(useMingoMessagesStore.getState().activeDialogId).toBe(DIALOG_ID);
  });

  it('treats a GraphQL error the same as a failed request', async () => {
    spies.post.mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: null, errors: [{ message: 'Access denied' }] },
    });
    await renderChip();

    expect(container.querySelector('a')?.getAttribute('href')).toBe(mingoDialogLink(DIALOG_ID));
  });
});
