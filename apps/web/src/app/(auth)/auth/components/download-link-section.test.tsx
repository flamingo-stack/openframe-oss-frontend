/**
 * "Send me download link": a valid address is sent with the honeypot as it holds, "sent" follows any
 * success with the way back to OpenFrame, an invalid address is caught under the field and never
 * sent, and a failed request keeps the form and says so.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD_LINK_COPY, DownloadLinkSection } from './download-link-section';

const client = vi.hoisted(() => ({ requestDownloadLink: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-api-client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authApiClient: client,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast }),
}));

let root: Root;
let container: HTMLDivElement;

const emailField = () => container.querySelector('input[type="email"]') as HTMLInputElement;
const honeypot = () => container.querySelector('input[name="website"]') as HTMLInputElement;

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(candidate => candidate.textContent === label);
  if (!found) throw new Error(`No ${label} button`);
  return found;
}

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function submit() {
  await act(async () => {
    button(DOWNLOAD_LINK_COPY.submit).click();
  });
  await settle();
}

beforeEach(() => {
  client.requestDownloadLink.mockReset();
  toast.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <DownloadLinkSection />
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DownloadLinkSection', () => {
  it('sends the address with the honeypot empty, then shows "sent" and the way back', async () => {
    client.requestDownloadLink.mockResolvedValue({ ok: true, status: 204 });
    type(emailField(), '  kate@acme.com ');
    await submit();

    expect(client.requestDownloadLink).toHaveBeenCalledWith({ email: 'kate@acme.com', website: '' });
    expect(container.textContent).toContain(DOWNLOAD_LINK_COPY.sentTitle);
    expect(container.textContent).toContain(DOWNLOAD_LINK_COPY.sentBody);
    const back = Array.from(container.querySelectorAll('a')).find(link => link.textContent === DOWNLOAD_LINK_COPY.back);
    expect(back?.getAttribute('href')).toBe('https://openframe.ai');
    expect(emailField()).toBeNull();
  });

  it('sends what a bot typed into the honeypot, for the backend to drop', async () => {
    client.requestDownloadLink.mockResolvedValue({ ok: true, status: 204 });
    type(emailField(), 'bot@spam.example');
    act(() => {
      honeypot().readOnly = false;
    });
    type(honeypot(), 'https://spam.example');
    await submit();

    expect(client.requestDownloadLink).toHaveBeenCalledWith({
      email: 'bot@spam.example',
      website: 'https://spam.example',
    });
  });

  it('catches an invalid address under the field and sends nothing', async () => {
    type(emailField(), 'not-an-email');
    await submit();

    expect(client.requestDownloadLink).not.toHaveBeenCalled();
    expect(container.textContent).toContain(DOWNLOAD_LINK_COPY.invalidEmail);
    expect(container.textContent).not.toContain(DOWNLOAD_LINK_COPY.sentTitle);
  });

  it('keeps the form and says so when the request fails', async () => {
    client.requestDownloadLink.mockResolvedValue({ ok: false, status: 0, error: 'Network error' });
    type(emailField(), 'kate@acme.com');
    await submit();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: DOWNLOAD_LINK_COPY.failedTitle, variant: 'destructive' }),
    );
    expect(container.textContent).not.toContain(DOWNLOAD_LINK_COPY.sentTitle);
    expect(emailField().value).toBe('kate@acme.com');
  });
});
