/**
 * The invite-accept form holds names and the password to the auth server's own rules
 * (`CoreUserRequest`), so a value the server would refuse is caught under its field and never sent:
 * one signup on prod got three bare 502s from the edge firewall for a `">` in the first name, then
 * two 400s on password strength. Whatever the server still refuses is shown in words.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_COMPLEXITY_ERROR, PERSON_NAME_ERROR } from '@/app/(auth)/auth/constants/registration-validation';
import InvitePage from './page';

const client = vi.hoisted(() => ({ acceptInvitation: vi.fn(), acceptInvitationSso: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/auth/invite',
  useSearchParams: () => new URLSearchParams('id=inv-1'),
}));

vi.mock('@/lib/auth-api-client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authApiClient: client,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast }),
}));

vi.mock('@/app/(auth)/auth/hooks/use-invite-providers', () => ({
  useInviteProviders: () => ({ providers: [], loading: false, error: null }),
}));
vi.mock('@/app/hooks/use-apple-platform', () => ({ useIsApplePlatform: () => false }));
vi.mock('@/app/hooks/use-login-only-mobile-shell', () => ({ useLoginOnlyMobileShell: () => false }));

const VALID_PASSWORD = 'Passw0rd!';

let root: Root;
let container: HTMLDivElement;

const field = (placeholder: string) =>
  container.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement;
function submitButton(): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === 'Create Account',
  );
  if (!found) throw new Error('No Create Account button');
  return found;
}

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Leaving the field is what shows its error at once, without the form's typing pause. */
function blur(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function fill(values: { firstName: string; lastName: string; password: string; confirmPassword?: string }) {
  type(field('Enter First Name'), values.firstName);
  type(field('Enter Last Name'), values.lastName);
  type(field('Enter Password'), values.password);
  type(field('Confirm Password'), values.confirmPassword ?? values.password);
  for (const placeholder of ['Enter First Name', 'Enter Last Name', 'Enter Password']) blur(field(placeholder));
}

async function submit() {
  await act(async () => {
    submitButton().click();
  });
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  client.acceptInvitation.mockReset();
  toast.mockReset();
  act(() => root.render(<InvitePage />));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('InvitePage validation', () => {
  it.each(['Ivan "Vanya"', 'a">', '<b>', '1Ivan', 'a'.repeat(51)])(
    'flags the first name %s under the field and sends nothing',
    async firstName => {
      fill({ firstName, lastName: 'Lee', password: VALID_PASSWORD });

      expect(container.textContent).toContain(PERSON_NAME_ERROR);
      expect(submitButton().disabled).toBe(true);

      pressEnter(field('Enter Last Name'));
      await submit();
      expect(client.acceptInvitation).not.toHaveBeenCalled();
    },
  );

  it('flags an invalid last name too', () => {
    fill({ firstName: 'Ann', lastName: '<b>', password: VALID_PASSWORD });

    expect(container.textContent).toContain(PERSON_NAME_ERROR);
    expect(submitButton().disabled).toBe(true);
  });

  it.each([
    ['Антон', "Мар'яна"],
    ['फ़्राँसिस', 'चद José-María'],
    ["O'Brien", "Ng'ang'a"],
    ['王小明', 'Lee'],
  ])('accepts %s %s and sends them', async (firstName, lastName) => {
    client.acceptInvitation.mockResolvedValue({ ok: true, status: 200, data: {} });
    fill({ firstName, lastName, password: VALID_PASSWORD });

    expect(container.textContent).not.toContain(PERSON_NAME_ERROR);
    expect(submitButton().disabled).toBe(false);

    await submit();

    expect(client.acceptInvitation).toHaveBeenCalledWith({
      invitationId: 'inv-1',
      firstName,
      lastName,
      password: VALID_PASSWORD,
      switchTenant: false,
    });
  });

  it('sends the names trimmed, with the iOS typographic apostrophe made plain', async () => {
    client.acceptInvitation.mockResolvedValue({ ok: true, status: 200, data: {} });
    fill({ firstName: '  Ann ', lastName: 'O’Brien', password: VALID_PASSWORD });

    await submit();

    expect(client.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Ann', lastName: "O'Brien" }),
    );
  });

  it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password12', 'Password1~'])(
    'says what the weak password %s lacks and sends nothing',
    async password => {
      fill({ firstName: 'Ann', lastName: 'Lee', password });

      expect(container.textContent).toContain(PASSWORD_COMPLEXITY_ERROR);
      expect(submitButton().disabled).toBe(true);

      await submit();
      expect(client.acceptInvitation).not.toHaveBeenCalled();
    },
  );

  it('shows the per-field messages of a 400 instead of the field-prefixed summary', async () => {
    client.acceptInvitation.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'Request failed with status 400',
      data: {
        code: 'VALIDATION_ERROR',
        message: 'lastName: Invalid last name',
        fieldErrors: [{ field: 'lastName', message: 'Invalid last name' }],
      },
    });
    fill({ firstName: 'Ann', lastName: 'Lee', password: VALID_PASSWORD });

    await submit();

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Invalid last name.' }));
  });

  it('explains a bare 502 from the firewall instead of quoting the status', async () => {
    client.acceptInvitation.mockResolvedValue({ ok: false, status: 502, error: 'Request failed with status 502' });
    fill({ firstName: 'Ann', lastName: 'Lee', password: VALID_PASSWORD });

    await submit();

    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining('remove characters such as < > or "') }),
    );
    expect(toast).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ description: expect.stringContaining('502') }),
    );
  });
});
