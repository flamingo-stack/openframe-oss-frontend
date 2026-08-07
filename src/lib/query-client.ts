import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single React Query client, reachable from outside the component
 * tree.
 *
 * It used to live in a `useState` inside `QueryClientProvider`, which made it
 * unreachable from `lib/` — and `forceLogout` is in `lib/`. So a forced sign-out
 * cleared the auth STORE but left the `['auth','session']` query reporting the
 * old, authenticated `/me`, and the app ran on two contradictory ideas of who was
 * signed in. In saas-tenant mode, where `forceLogout` deliberately does not
 * reload the page, that state was permanent: the shell kept `sessionReady` true
 * off the stale query while the stores it had just reset stayed empty, which is
 * what left the sidebar and header in their skeleton forever (see
 * `force-logout.ts` and the chrome fail-open in `components/app-layout.tsx`).
 *
 * Owning it here instead lets the sign-out path settle the session query in the
 * same breath as the stores.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The browser's client — created once, shared by the provider and by any
 * non-React caller that needs to settle a query (see `force-logout.ts`).
 *
 * A fresh client per server render on purpose: a module-level singleton would be
 * shared across concurrent requests in the Node process, so one user's cached
 * `/me` could be handed to the next. The provider seeds `useState` from this, so
 * the browser still gets exactly one client for the life of the tab.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
