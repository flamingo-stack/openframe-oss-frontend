/**
 * Arrival of a notification for a dialog on screen, through the real bridge, gate, session
 * activity and relay-runtime store. Being read on arrival is what keeps it out of the drawer
 * and off the phone: the mark-read reaches the outbox before its 7s grace ends. Staying unread
 * means a popup now and a push at the end of that grace.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type ReactRelay from 'react-relay';
import { RelayEnvironmentProvider } from 'react-relay';
import { commitLocalUpdate, Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mutations: [] as string[],
  mutationsFail: false,
  nats: null as null | ((payload: unknown) => void),
  refetchDrawer: vi.fn(),
}));

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run.
// The tag keeps its text so a committed mutation can be told apart by name; react-relay is
// CJS, so its named exports sit under `default` too.
vi.mock('react-relay', async importOriginal => {
  const actual = await importOriginal<typeof ReactRelay & { default?: typeof ReactRelay }>();
  return {
    ...actual,
    ...actual.default,
    graphql: (text: TemplateStringsArray) => ({ text: text.join('') }),
    commitMutation: (_environment: unknown, config: { mutation: { text: string }; onError?: (e: Error) => void }) => {
      h.mutations.push(/mutation\s+(\w+)/.exec(config.mutation.text)?.[1] ?? '?');
      if (h.mutationsFail) config.onError?.(new Error('mutation failed'));
    },
  };
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isSaasTenantMode: () => true,
}));
// The drawer's hydrator reads compiled artifacts vitest has no transform for. What these tests
// pin is the store and the mutations, which is what the drawer and the popups render from.
vi.mock('@/app/components/shared/hydrator-boundary', () => ({ HydratorBoundary: () => null }));
vi.mock('@/graphql/notifications/notifications-drawer-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  refetchNotificationsDrawer: h.refetchDrawer,
}));
vi.mock('@/graphql/notifications/unread-counts-relay', () => ({ refreshUnreadCounts: vi.fn() }));
vi.mock('@/graphql/notifications/use-notification-mutations', () => ({
  useNotificationMutations: () => ({
    markRead: vi.fn(),
    autoMarkRead: vi.fn(),
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
  }),
}));
vi.mock('./use-approve-request', () => ({ useApproveRequest: () => vi.fn() }));
vi.mock('./open-mingo-dialog', () => ({ canOpenMingoDialogOverPage: () => false, openMingoDialog: vi.fn() }));

import { createConnection, nodeIds } from '@/graphql/notifications/__tests__/store-fixtures';
import { UNFILTERED_NOTIFICATION_PAIR } from '@/graphql/notifications/notifications-helpers';
import { refreshUnreadCounts } from '@/graphql/notifications/unread-counts-relay';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { notificationGlobalId } from '@/lib/relay-id';
import { ATTENTION_IDLE_MS, PRESENCE_IDLE_MS } from '@/lib/session-activity';
import { NotificationsDataProvider } from './notifications-data-provider';

const T0 = Date.parse('2026-11-02T10:00:00Z');
const INSIDE_ATTENTION = ATTENTION_IDLE_MS - 5_000;
const PAST_ATTENTION = ATTENTION_IDLE_MS + 20_000;
const ON_SCREEN = 'on-screen';
const MARK_READ = 'markNotificationReadMutation';
const CANCEL_PUSH = 'cancelPendingPushMutation';
const READ_ON_ARRIVAL = { unread: false, read: true, markedRead: true };
const ALERT = { unread: true, read: false, markedRead: false };

function makeEnvironment(): Environment {
  const environment = new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(new RecordSource()),
  });
  commitLocalUpdate(environment, store => {
    createConnection(store, UNFILTERED_NOTIFICATION_PAIR.unread);
    createConnection(store, UNFILTERED_NOTIFICATION_PAIR.read);
  });
  return environment;
}

describe('a notification for a dialog on screen', () => {
  const RAW_ID = 'n-1';
  const RELAY_ID = notificationGlobalId(RAW_ID);
  let root: Root;
  let container: HTMLElement;
  let environment: Environment;
  let unregister: () => void;

  const arrive = (type: string, idleMs: number, dialogId = ON_SCREEN) => {
    vi.setSystemTime(T0 + idleMs);
    return act(async () => {
      h.nats?.({ id: RAW_ID, type, severity: 'INFO', title: 'Arrived', attributes: { dialogId } });
    });
  };
  const outcome = () => ({
    unread: nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.unread).includes(RELAY_ID),
    read: nodeIds(environment, UNFILTERED_NOTIFICATION_PAIR.read).includes(RELAY_ID),
    markedRead: h.mutations.includes(MARK_READ),
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    h.mutations.length = 0;
    h.mutationsFail = false;
    h.refetchDrawer.mockClear();
    vi.mocked(refreshUnreadCounts).mockClear();
    environment = makeEnvironment();
    unregister = registerActiveDialogView(ON_SCREEN);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <NotificationsDataProvider>{null}</NotificationsDataProvider>
        </RelayEnvironmentProvider>,
      );
    });
    // Session activity is one module-level clock; every test starts focused, with input at T0.
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new KeyboardEvent('keydown'));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    unregister();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe.each(['ADMIN_AI_MESSAGE', 'ADMIN_AI_TICKET_MESSAGE'])('a Mingo reply (%s)', type => {
    it('is read on arrival when the user sat watching it stream past the attention window', async () => {
      await arrive(type, PAST_ATTENTION);

      expect(outcome()).toEqual(READ_ON_ARRIVAL);
      expect(h.mutations).not.toContain(CANCEL_PUSH);
    });

    it('refreshes the counts but does not list the row again when its mark-read fails', async () => {
      h.mutationsFail = true;
      await arrive(type, PAST_ATTENTION);

      expect(outcome()).toEqual(READ_ON_ARRIVAL);
      expect(refreshUnreadCounts).toHaveBeenCalledOnce();
      expect(h.refetchDrawer).not.toHaveBeenCalled();
    });

    it('is still read on arrival just inside the presence window', async () => {
      await arrive(type, PRESENCE_IDLE_MS - 1_000);

      expect(outcome()).toEqual(READ_ON_ARRIVAL);
    });

    it('also cancels the push by itself inside the attention window', async () => {
      await arrive(type, INSIDE_ATTENTION);

      expect(outcome()).toEqual(READ_ON_ARRIVAL);
      expect(h.mutations).toContain(CANCEL_PUSH);
    });

    it('alerts once the user has been idle past the presence window', async () => {
      await arrive(type, PRESENCE_IDLE_MS + 1_000);

      expect(outcome()).toEqual(ALERT);
    });

    it('alerts in a blurred window, whatever the input clock says', async () => {
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      await arrive(type, 1_000);

      expect(outcome()).toEqual(ALERT);
    });

    it('alerts when its dialog is not the one on screen', async () => {
      await arrive(type, PAST_ATTENTION, 'another-dialog');

      expect(outcome()).toEqual(ALERT);
    });
  });

  describe.each(['MINGO_APPROVAL_REQUEST', 'CLIENT_AI_MESSAGE', 'CUSTOMER_MESSAGE_PUBLISHED'])('a %s', type => {
    it('is read on arrival inside the attention window', async () => {
      await arrive(type, INSIDE_ATTENTION);

      expect(outcome()).toEqual(READ_ON_ARRIVAL);
    });

    it('alerts past the attention window, because nobody asked for it and a miss costs more', async () => {
      await arrive(type, PAST_ATTENTION);

      expect(outcome()).toEqual(ALERT);
      expect(h.mutations).toEqual([]);
    });
  });
});
