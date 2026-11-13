/**
 * `EntityViewAutoReader` on real rows: the real hydrator, mutation hook and relay-runtime store,
 * fed by a fake network. The loop this pins needs all of them. A failed read reverts its optimistic
 * update, the hydrator lists the row again and the reader sees an unread row it can read. The
 * mutation answers after a delay on purpose: an instant rejection collapses the update and its
 * revert into one render, and the row never leaves the list.
 */

import { type Notification, useNotifications } from '@flamingo-stack/openframe-frontend-core';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type ReactRelay from 'react-relay';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  attempts: [] as string[],
  inFlight: 0,
  failuresLeft: 0,
  rows: [] as unknown[],
  toast: vi.fn(),
  nats: null as null | ((payload: unknown) => void),
  context: null as null | { notifications: Notification[]; markRead: (id: string) => void },
  pathname: '/',
  searchParams: new URLSearchParams(),
  locationListeners: new Set<() => void>(),
}));

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run, so each
// tag resolves to the artifact relay-compiler generated for it. react-relay is CJS, so its named
// exports sit under `default` too.
vi.mock('react-relay', async importOriginal => {
  const actual = await importOriginal<typeof ReactRelay & { default?: typeof ReactRelay }>();
  const artifacts = import.meta.glob<{ default: unknown }>('/src/__generated__/*.graphql.ts');
  const loaded = new Map(
    await Promise.all(Object.entries(artifacts).map(async ([path, load]) => [path, (await load()).default] as const)),
  );
  return {
    ...actual,
    ...actual.default,
    graphql: (text: TemplateStringsArray) => {
      const name = /(?:query|mutation|fragment)\s+(\w+)/.exec(text.join(''))?.[1];
      return loaded.get(`/src/__generated__/${name}.graphql.ts`);
    },
  };
});
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => {
    h.locationListeners.add(listener);
    return () => {
      h.locationListeners.delete(listener);
    };
  };
  return {
    usePathname: () => useSyncExternalStore(subscribe, () => h.pathname),
    useSearchParams: () => useSyncExternalStore(subscribe, () => h.searchParams),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  };
});
vi.mock('@flamingo-stack/openframe-frontend-core', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NotificationPopups: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: h.toast }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/nats', () => ({
  useNatsJsonSubscription: (_subject: string, callback: (payload: unknown) => void) => {
    h.nats = callback;
  },
  useOptionalNats: () => null,
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ isAuthenticated: true, user: { id: 'u-1' } }),
}));
vi.mock('@/graphql/notifications/unread-counts-relay', () => ({ refreshUnreadCounts: vi.fn() }));
vi.mock('./use-approve-request', () => ({ useApproveRequest: () => vi.fn() }));
vi.mock('./open-mingo-dialog', () => ({ canOpenMingoDialogOverPage: () => false, openMingoDialog: vi.fn() }));

import type { notificationFields_notification$data } from '@/__generated__/notificationFields_notification.graphql';
import { refreshUnreadCounts } from '@/graphql/notifications/unread-counts-relay';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { asInstant } from '@/lib/graphql-scalars';
import { notificationGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { ATTENTION_IDLE_MS, isSessionActive } from '@/lib/session-activity';
import { NotificationsDataProvider } from './notifications-data-provider';

const T0 = Date.parse('2026-11-02T10:00:00Z');
const LATENCY_MS = 5;
/** Enough to outlast every attempt a test expects, and bounded so a loop ends itself. */
const FAILING = 8;
const TICKET = 't-1';
const TICKET_ROUTE = routes.tickets.dialog(TICKET);
const OTHER_ROUTE = routes.dashboard;
const DIALOG = 'd-1';
const FIRST = notificationGlobalId('n-1');
const SECOND = notificationGlobalId('n-2');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Waits for a quiet stretch long enough for a failed read's retry to have started. */
const settle = () =>
  act(async () => {
    do {
      await sleep(LATENCY_MS * 3);
    } while (h.inFlight > 0);
  });

function ticketRow(id: string) {
  return row(id, { ticketId: TICKET });
}

function row(id: string, attributes: Record<string, string>) {
  // Typed so a field added to the fragment fails to compile here instead of going missing.
  const node: Omit<notificationFields_notification$data, ' $fragmentType'> = {
    id,
    severity: 'INFO',
    title: id,
    description: null,
    createdAt: asInstant('2026-11-01T10:00:00Z'),
    status: 'UNREAD',
    category: 'TICKETS',
    type: 'TICKET_ASSIGNED',
    attributes,
  };
  return { cursor: id, node: { __typename: 'Notification', ...node } };
}

async function answerMarkRead(id: string) {
  h.attempts.push(id);
  h.inFlight += 1;
  await sleep(LATENCY_MS);
  h.inFlight -= 1;
  if (h.failuresLeft > 0) {
    h.failuresLeft -= 1;
    throw new Error('mark-read failed');
  }
  return { data: { markNotificationAsRead: true } };
}

function makeEnvironment(): Environment {
  return new Environment({
    network: Network.create(async (params, variables) => {
      if (params.name === 'markNotificationReadMutation') return answerMarkRead(String(variables.id));
      if (params.name === 'notificationsDrawerRelayQuery') {
        return {
          data: { notifications: { edges: h.rows, pageInfo: { endCursor: null, hasNextPage: false } } },
        };
      }
      throw new Error(`unexpected operation ${params.name}`);
    }),
    store: new Store(new RecordSource()),
  });
}

function setLocation(route: string) {
  const [pathname, query] = route.split('?');
  h.pathname = pathname;
  h.searchParams = new URLSearchParams(query);
}

function ContextProbe() {
  const context = useNotifications();
  useEffect(() => {
    h.context = context;
  });
  return null;
}

const unreadIds = () => h.context?.notifications.filter(n => !n.read).map(n => n.id);

describe('EntityViewAutoReader', () => {
  let root: Root;
  let container: HTMLElement;

  const mount = async () => {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={makeEnvironment()}>
          <NotificationsDataProvider>
            <ContextProbe />
          </NotificationsDataProvider>
        </RelayEnvironmentProvider>,
      );
    });
    await settle();
  };

  const navigate = async (route: string) => {
    setLocation(route);
    act(() => {
      for (const listener of h.locationListeners) listener();
    });
    await settle();
  };

  /** Input after `idleMs` of silence: past the attention window this is an attention edge. */
  const inputAfter = async (idleMs: number) => {
    vi.setSystemTime(Date.now() + idleMs);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown'));
    });
    await settle();
  };
  const attentionEdge = () => inputAfter(ATTENTION_IDLE_MS + 1_000);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(refreshUnreadCounts).mockClear();
    h.attempts = [];
    h.inFlight = 0;
    h.failuresLeft = 0;
    h.rows = [ticketRow(FIRST)];
    h.toast.mockClear();
    setLocation(TICKET_ROUTE);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    // Session activity is one module-level clock; every test starts focused, with input at T0.
    // It starts lazily and nothing listens until it does, so a test running first needs this.
    isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS });
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new KeyboardEvent('keydown'));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('when the read succeeds', () => {
    it('reads a row matching the route once and refreshes the counts', async () => {
      await mount();

      expect(h.attempts).toEqual([FIRST]);
      expect(unreadIds()).toEqual([]);
      expect(refreshUnreadCounts).toHaveBeenCalledOnce();
      expect(h.toast).not.toHaveBeenCalled();
    });

    it('leaves a row for another entity alone', async () => {
      setLocation(OTHER_ROUTE);
      await mount();

      expect(h.attempts).toEqual([]);
      expect(unreadIds()).toEqual([FIRST]);
    });
  });

  describe('when the read fails', () => {
    beforeEach(() => {
      h.failuresLeft = FAILING;
    });

    it('makes one attempt per row, shows no toast and leaves the rows unread', async () => {
      h.rows = [ticketRow(FIRST), ticketRow(SECOND)];
      await mount();

      expect(h.attempts).toEqual([FIRST, SECOND]);
      expect(h.toast).not.toHaveBeenCalled();
      expect(unreadIds()).toEqual([FIRST, SECOND]);
    });

    it('makes one attempt for a row whose dialog is on screen', async () => {
      h.rows = [row(FIRST, { dialogId: DIALOG })];
      setLocation(OTHER_ROUTE);
      const unregister = registerActiveDialogView(DIALOG);
      await mount();
      act(() => unregister());

      expect(h.attempts).toEqual([FIRST]);
      expect(h.toast).not.toHaveBeenCalled();
    });

    it('does not retry on input inside the attention window', async () => {
      await mount();

      await inputAfter(1_000);
      await inputAfter(1_000);

      expect(h.attempts).toEqual([FIRST]);
    });

    it('does not retry the failed row when another notification arrives', async () => {
      await mount();

      act(() => {
        h.nats?.({ id: 'n-2', type: 'TICKET_ASSIGNED', title: 'Arrived', attributes: { ticketId: TICKET } });
      });
      await settle();

      expect(h.attempts).toEqual([FIRST, SECOND]);
      expect(h.toast).not.toHaveBeenCalled();
    });

    it('retries once per attention edge, silently, and lands when the server recovers', async () => {
      await mount();

      await attentionEdge();
      expect(h.attempts).toEqual([FIRST, FIRST]);
      expect(unreadIds()).toEqual([FIRST]);

      h.failuresLeft = 0;
      await attentionEdge();
      expect(h.attempts).toEqual([FIRST, FIRST, FIRST]);
      expect(unreadIds()).toEqual([]);
      expect(h.toast).not.toHaveBeenCalled();
    });

    it('retries once when the user navigates back to the entity', async () => {
      await mount();

      await navigate(OTHER_ROUTE);
      expect(h.attempts).toEqual([FIRST]);

      await navigate(TICKET_ROUTE);
      expect(h.attempts).toEqual([FIRST, FIRST]);
    });

    it('retries once when only the query changes', async () => {
      await mount();

      await navigate(routes.tickets.dialog(TICKET, { tab: 'chat' }));

      expect(h.attempts).toEqual([FIRST, FIRST]);
    });

    it('retries once when only the path changes', async () => {
      h.rows = [row(FIRST, { dialogId: DIALOG })];
      setLocation(OTHER_ROUTE);
      const unregister = registerActiveDialogView(DIALOG);
      await mount();

      await navigate(routes.devices.list);
      act(() => unregister());

      expect(h.attempts).toEqual([FIRST, FIRST]);
    });

    it('retries once when a dialog view comes on screen', async () => {
      h.rows = [row(FIRST, { dialogId: DIALOG })];
      setLocation(OTHER_ROUTE);
      let unregister = registerActiveDialogView(DIALOG);
      await mount();
      expect(h.attempts).toEqual([FIRST]);

      act(() => unregister());
      act(() => {
        unregister = registerActiveDialogView(DIALOG);
      });
      await settle();
      act(() => unregister());

      expect(h.attempts).toEqual([FIRST, FIRST]);
    });
  });

  describe('while the session is not attentive', () => {
    it('spends no attempt on a row, and reads it on the attention edge', async () => {
      vi.setSystemTime(T0 + ATTENTION_IDLE_MS + 1_000);
      await mount();
      expect(h.attempts).toEqual([]);

      await inputAfter(0);

      expect(h.attempts).toEqual([FIRST]);
      expect(unreadIds()).toEqual([]);
    });
  });

  describe('a mark-read the user clicked', () => {
    beforeEach(() => {
      h.failuresLeft = FAILING;
    });

    const click = async (id: string) => {
      act(() => h.context?.markRead(id));
      await settle();
    };

    it('toasts on failure', async () => {
      setLocation(OTHER_ROUTE);
      await mount();

      await click(FIRST);

      expect(h.attempts).toEqual([FIRST]);
      expect(h.toast).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ title: 'Failed to mark as read', variant: 'destructive' }),
      );
    });

    it('toasts once when the auto-read of the same row already failed silently', async () => {
      await mount();
      expect(h.toast).not.toHaveBeenCalled();

      await click(FIRST);

      expect(h.attempts).toEqual([FIRST, FIRST]);
      expect(h.toast).toHaveBeenCalledOnce();
    });
  });
});
