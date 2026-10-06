/**
 * The page-level contract of `/auth/error`: whatever the URL says, the only text on the page is what
 * the auth server answered for `ref`. The old `error=<text>` parameter is ignored even when present.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthErrorPage from './page';

const url = vi.hoisted(() => ({ search: '' }));
const client = vi.hoisted(() => ({ authErrorMessage: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/auth/error',
  useSearchParams: () => new URLSearchParams(url.search),
}));

vi.mock('@/lib/auth-api-client', () => ({ authApiClient: client }));

let root: Root;
let container: HTMLDivElement;

async function render() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AuthErrorPage />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  client.authErrorMessage.mockReset();
  url.search = '';
});

afterEach(() => {
  act(() => root.unmount());
});

describe('AuthErrorPage', () => {
  it('renders the resolved message and nothing from the URL', async () => {
    url.search = 'ref=SSO_SESSION_EXPIRED&error=Your+account+is+suspended.+Call+%2B1-555-0100';
    client.authErrorMessage.mockResolvedValue({
      ok: true,
      status: 200,
      data: { code: 'SSO_SESSION_EXPIRED', message: 'SSO session expired. Please try again.' },
    });

    await render();

    expect(container.textContent).toContain('Oops, Something Went Wrong');
    expect(container.textContent).toContain('SSO session expired. Please try again.');
    expect(container.textContent).not.toContain('suspended');
    expect(container.textContent).not.toContain('555');
  });

  it('shows the generic text for a crafted link that carries only free text', async () => {
    url.search = 'error=Your+account+is+suspended.+Call+%2B1-555-0100+to+restore+access';

    await render();

    expect(client.authErrorMessage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('An unexpected error occurred.');
    expect(container.textContent).not.toContain('suspended');
  });
});
