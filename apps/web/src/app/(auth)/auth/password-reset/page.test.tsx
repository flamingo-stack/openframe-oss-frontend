/**
 * The new password is held to the rule the auth server applies to it (`ResetConfirm.newPassword`,
 * the same as at signup), so a weak one is caught under the field instead of coming back as a 400.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_COMPLEXITY_ERROR } from '@/app/(auth)/auth/constants/registration-validation';
import PasswordResetPage from './page';

const client = vi.hoisted(() => ({ confirmPasswordReset: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/auth/password-reset',
  useSearchParams: () => new URLSearchParams('token=t-1'),
}));

vi.mock('@/lib/auth-api-client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authApiClient: client,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast }),
}));

vi.mock('@/app/hooks/use-login-only-mobile-shell', () => ({ useLoginOnlyMobileShell: () => false }));

let root: Root;
let container: HTMLDivElement;

const inputs = () => Array.from(container.querySelectorAll('input'));
function submitButton(): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === 'Reset Password',
  );
  if (!found) throw new Error('No Reset Password button');
  return found;
}

function typePasswords(password: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  for (const input of inputs()) {
    act(() => {
      setValue?.call(input, password);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
  }
}

async function submit() {
  await act(async () => {
    submitButton().click();
  });
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  client.confirmPasswordReset.mockReset();
  toast.mockReset();
  act(() => root.render(<PasswordResetPage />));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('PasswordResetPage validation', () => {
  it('says what a weak password lacks and sends nothing', async () => {
    typePasswords('password12');

    expect(container.textContent).toContain(PASSWORD_COMPLEXITY_ERROR);
    expect(submitButton().disabled).toBe(true);

    await submit();
    expect(client.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('sends a password that meets the rule', async () => {
    client.confirmPasswordReset.mockResolvedValue({ ok: true, status: 200 });
    typePasswords('Passw0rd!');

    expect(container.textContent).not.toContain(PASSWORD_COMPLEXITY_ERROR);
    await submit();

    expect(client.confirmPasswordReset).toHaveBeenCalledWith({ token: 't-1', newPassword: 'Passw0rd!' });
  });

  it('explains a bare 502 from the firewall instead of quoting the status', async () => {
    client.confirmPasswordReset.mockResolvedValue({ ok: false, status: 502, error: 'Request failed with status 502' });
    typePasswords('Passw0rd!<>');

    await submit();

    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining('remove characters such as < > or "') }),
    );
    expect(toast).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining('502') }),
    );
  });
});
