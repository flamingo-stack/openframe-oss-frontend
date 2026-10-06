/**
 * Pins the one property the error page exists for: its description is the auth server's answer for
 * `ref`, or the fallback. Nothing in the URL becomes text on the page, and a value that is not a
 * reference is not even sent.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ERROR_FALLBACK, isAuthErrorRef, useAuthErrorMessage } from './use-auth-error-message';

const client = vi.hoisted(() => ({ authErrorMessage: vi.fn() }));

vi.mock('@/lib/auth-api-client', () => ({ authApiClient: client }));

function Probe({ reference }: { reference: string | null }) {
  const { title, description, isLoading } = useAuthErrorMessage(reference);
  return (
    <output data-title={title} data-loading={String(isLoading)}>
      {description}
    </output>
  );
}

let root: Root;
let container: HTMLDivElement;

const shown = () => container.querySelector('output');

async function render(reference: string | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe reference={reference} />
      </QueryClientProvider>,
    );
  });
}

/** Lets a pending lookup settle and the probe re-render from it. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  client.authErrorMessage.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useAuthErrorMessage', () => {
  it('shows the message the auth server resolves for a catalog code', async () => {
    client.authErrorMessage.mockResolvedValue({
      ok: true,
      status: 200,
      data: { code: 'SSO_SESSION_EXPIRED', message: 'SSO session expired. Please try again.' },
    });

    await render('SSO_SESSION_EXPIRED');
    expect(shown()?.getAttribute('data-loading')).toBe('true');

    await settle();
    expect(client.authErrorMessage).toHaveBeenCalledWith('SSO_SESSION_EXPIRED');
    expect(shown()?.textContent).toBe('SSO session expired. Please try again.');
    expect(shown()?.getAttribute('data-loading')).toBe('false');
    expect(shown()?.getAttribute('data-title')).toBe(AUTH_ERROR_FALLBACK.title);
  });

  it('shows the stored message behind an 8-character reference', async () => {
    client.authErrorMessage.mockResolvedValue({
      ok: true,
      status: 200,
      data: { code: 'ACCOUNT_NOT_FOUND', message: 'No account found for owner@example.com. Please sign up first.' },
    });

    await render('7KQ2M9XD');
    await settle();

    expect(client.authErrorMessage).toHaveBeenCalledWith('7KQ2M9XD');
    expect(shown()?.textContent).toBe('No account found for owner@example.com. Please sign up first.');
  });

  it('falls back without a lookup when there is no reference', async () => {
    await render(null);

    expect(client.authErrorMessage).not.toHaveBeenCalled();
    expect(shown()?.getAttribute('data-loading')).toBe('false');
    expect(shown()?.textContent).toBe(AUTH_ERROR_FALLBACK.description);
  });

  it('never sends, and never shows, a value that is not a reference', async () => {
    await render('Your account is suspended. Call +1-555-0100 to restore access');

    expect(client.authErrorMessage).not.toHaveBeenCalled();
    expect(shown()?.textContent).toBe(AUTH_ERROR_FALLBACK.description);
    expect(shown()?.textContent).not.toContain('suspended');
  });

  it('falls back to the generic text when the lookup cannot reach the server', async () => {
    client.authErrorMessage.mockResolvedValue({ ok: false, status: 0, error: 'Network error' });

    await render('SSO_SESSION_EXPIRED');
    await settle();

    expect(shown()?.getAttribute('data-loading')).toBe('false');
    expect(shown()?.textContent).toBe(AUTH_ERROR_FALLBACK.description);
  });
});

describe('isAuthErrorRef', () => {
  it('accepts what the auth server hands out and nothing that reads as a sentence', () => {
    expect(isAuthErrorRef('SSO_SESSION_EXPIRED')).toBe(true);
    expect(isAuthErrorRef('7KQ2M9XD')).toBe(true);
    expect(isAuthErrorRef('')).toBe(false);
    expect(isAuthErrorRef(null)).toBe(false);
    expect(isAuthErrorRef(undefined)).toBe(false);
    expect(isAuthErrorRef('Your account is suspended')).toBe(false);
    expect(isAuthErrorRef('sso_session_expired')).toBe(false);
    expect(isAuthErrorRef('<b>hi</b>')).toBe(false);
  });
});
