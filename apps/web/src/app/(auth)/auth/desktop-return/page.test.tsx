/**
 * The page-level contract of `/auth/desktop-return`: it shows what the gateway sent, launches the
 * desktop scheme with it exactly once, and takes it off the address bar - while keeping it for the
 * button, which is the way back when the browser blocked the launch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

const launch = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ authErrorMessage: vi.fn() }));

vi.mock('@/lib/desktop-auth-return', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  launchDesktopApp: launch,
}));

vi.mock('@/lib/auth-api-client', () => ({ authApiClient: client }));

let root: Root;
let container: HTMLDivElement;

/**
 * The page reads its URL once per module instance, as once per page load: a fresh import per test.
 * StrictMode, as in the app: its double-run effects are what the single-launch guard is for.
 */
async function render(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { default: DesktopReturnPage } = await import('./page');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <DesktopReturnPage />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const button = () => container.querySelector('button');

// The first import transforms the whole core library, which on a cold cache takes most of a test's
// five seconds. Pay it once here, so each test's fresh import only re-evaluates.
beforeAll(async () => {
  await import('./page');
}, 60_000);

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  launch.mockReset();
  client.authErrorMessage.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('DesktopReturnPage', () => {
  it('confirms the sign-in, launches the app once and strips the ticket from the address bar', async () => {
    await render('/auth/desktop-return/#?devTicket=T-1');

    expect(container.textContent).toContain('signed in');
    expect(container.textContent).toContain('You can close this tab.');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith('openframe-console://auth?devTicket=T-1');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/auth/desktop-return/');
  });

  it('keeps the ticket for the button after the address bar is clean', async () => {
    await render('/auth/desktop-return/#?devTicket=T-1');

    await act(async () => button()?.click());

    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenLastCalledWith('openframe-console://auth?devTicket=T-1');
  });

  it('sends the signup on to the app, where the organization is set up', async () => {
    await render('/auth/desktop-return/#?signupTicket=S-1');

    expect(container.textContent).toContain('One more step');
    expect(launch).toHaveBeenCalledWith('openframe-console://auth?signupTicket=S-1');
  });

  it('still launches on a cancel, so the app stops waiting', async () => {
    await render('/auth/desktop-return/#?error=USER_CANCELED');

    expect(container.textContent).toContain('Sign-in canceled');
    expect(launch).toHaveBeenCalledWith('openframe-console://auth?error=USER_CANCELED');
    expect(client.authErrorMessage).not.toHaveBeenCalled();
  });

  it('shows the auth server’s sentence for any other code', async () => {
    client.authErrorMessage.mockResolvedValue({
      ok: true,
      status: 200,
      data: { code: 'SSO_LOGIN_FAILED', message: 'We could not sign you in with that provider.' },
    });

    await render('/auth/desktop-return/#?error=SSO_LOGIN_FAILED');

    expect(container.textContent).toContain('Login failed');
    expect(client.authErrorMessage).toHaveBeenCalledWith('SSO_LOGIN_FAILED');
    expect(container.textContent).toContain('We could not sign you in with that provider.');
    expect(launch).toHaveBeenCalledWith('openframe-console://auth?error=SSO_LOGIN_FAILED');
  });

  it('copies the failure details for an administrator', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    client.authErrorMessage.mockResolvedValue({
      ok: true,
      status: 200,
      data: { code: 'ORGANIZATION_SSO_REQUIRED', message: 'Your organization requires its own sign-in.' },
    });
    await render('/auth/desktop-return/#?error=ORGANIZATION_SSO_REQUIRED');

    const copyButton = [...container.querySelectorAll('button')].find(b => b.textContent === 'Copy details');
    await act(async () => copyButton?.click());

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Code: ORGANIZATION_SSO_REQUIRED');
    expect(writeText.mock.calls[0][0]).toContain('Reason: Your organization requires its own sign-in.');
  });

  it('offers no details to copy when there is no failure', async () => {
    await render('/auth/desktop-return/#?devTicket=T-1');

    expect([...container.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Open OpenFrame Console']);
  });

  // Copied mid-lookup, the details would carry the generic fallback instead of the server's reason.
  it('offers the details to copy only once the reason is known', async () => {
    client.authErrorMessage.mockReturnValue(new Promise(() => {}));

    await render('/auth/desktop-return/#?error=SSO_LOGIN_FAILED');

    expect(container.textContent).toContain('Login failed');
    expect([...container.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Open OpenFrame Console']);
  });

  it('words a code the app has copy for in the app’s own sentence, without asking the auth server', async () => {
    await render('/auth/desktop-return/#?error=SESSION_EXPIRED');

    expect(container.textContent).toContain('Your sign-in session expired. Please sign in again.');
    expect(client.authErrorMessage).not.toHaveBeenCalled();
    // Nothing to wait for, so the details can be copied straight away.
    expect([...container.querySelectorAll('button')].map(b => b.textContent)).toEqual([
      'Open OpenFrame Console',
      'Copy details',
    ]);
  });

  // What the browser actually runs: prerendered HTML with no URL to read, hydrated, then re-rendered
  // with the hand-off. The first effect run sees nothing and must not use up the single launch.
  it('launches once after hydrating the prerendered frame', async () => {
    window.history.replaceState(null, '', '/auth/desktop-return/#?devTicket=T-1');
    vi.resetModules();
    const { default: DesktopReturnPage } = await import('./page');
    const page = () => (
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <DesktopReturnPage />
        </QueryClientProvider>
      </StrictMode>
    );
    const prerendered = document.createElement('div');
    prerendered.innerHTML = renderToString(page());
    expect(prerendered.textContent).toBe('');

    let hydrated: Root | undefined;
    await act(async () => {
      hydrated = hydrateRoot(prerendered, page());
    });

    expect(prerendered.textContent).toContain('signed in');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith('openframe-console://auth?devTicket=T-1');
    act(() => hydrated?.unmount());
  });

  it('sends a bare callback when the gateway landed the page with nothing, so the app stops waiting', async () => {
    await render('/auth/desktop-return/#');

    expect(container.textContent).toContain('Sign-in didn’t finish');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith('openframe-console://auth');
  });

  // jsdom keeps a bare `#` in the address; a browser running the app router does not, and only the
  // navigation entry still has it.
  it('reads a bare landing from the navigation entry after the router dropped the `#`', async () => {
    const entries = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([{ name: new URL('/auth/desktop-return/#', window.location.origin).href } as PerformanceEntry]);
    onTestFinished(() => entries.mockRestore());

    await render('/auth/desktop-return/');

    expect(container.textContent).toContain('Sign-in didn’t finish');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith('openframe-console://auth');
  });

  it('launches nothing and offers no button without a hand-off', async () => {
    await render('/auth/desktop-return/');

    expect(container.textContent).toContain('Nothing to finish here');
    expect(launch).not.toHaveBeenCalled();
    expect(button()).toBeNull();
  });
});
