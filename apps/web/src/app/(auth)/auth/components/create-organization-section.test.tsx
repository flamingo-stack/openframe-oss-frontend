/**
 * The signup form holds every field to the auth server's own rules (`TenantRegistrationRequest`:
 * `@ValidEmail`, the organization-name pattern, `@TenantDomain`, and `CoreUserRequest`'s names and
 * password), so a value the server would refuse is caught under its field and never sent.
 */

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
  INVALID_EMAIL_ERROR,
  ORG_NAME_ERROR,
  PASSWORD_COMPLEXITY_ERROR,
  PERSON_NAME_ERROR,
  TENANT_SUBDOMAIN_ERROR,
} from '@/app/(auth)/auth/constants/registration-validation';
import { CreateOrganizationSection } from './create-organization-section';

const client = vi.hoisted(() => ({ checkDomainAvailability: vi.fn() }));
const domainCheck = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-api-client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authApiClient: client,
}));

vi.mock('@/app/(auth)/auth/hooks/use-registration-availability', () => ({
  BLOCKED_EMAIL_DOMAIN_MESSAGE: 'blocked',
  useEmailAvailability: () => 'available',
  useDomainAvailability: (subdomain: string, orgName: string, enabled: boolean) => {
    domainCheck(subdomain, enabled);
    return { status: enabled && subdomain ? 'available' : 'idle', suggestions: [] };
  },
}));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isSharedAuthUi: () => true,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/posthog/posthog-events', () => ({ pushSignupStarted: vi.fn() }));

const VALID_PASSWORD = 'Passw0rd!';

let root: Root;
let container: HTMLDivElement;
let onRegister: Mock<ComponentProps<typeof CreateOrganizationSection>['onRegister']>;

const field = (placeholder: string) =>
  container.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement;
function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(candidate => candidate.textContent === label);
  if (!found) throw new Error(`No ${label} button`);
  return found;
}

function type(placeholder: string, value: string) {
  const input = field(placeholder);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Leaving the field is what shows its error at once, without the form's typing pause.
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
  });
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

async function toDetails(email = 'kate@acme.com') {
  type('username@mail.com', email);
  await click(button('Continue'));
}

interface Details {
  organizationName?: string;
  domain?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

async function fillDetails(details: Details = {}) {
  type('Your Company Name', details.organizationName ?? 'Acme');
  type('company-name', details.domain ?? 'acme');
  type('Enter First Name', details.firstName ?? 'Kate');
  type('Enter Last Name', details.lastName ?? 'Lee');
  type('Enter Password', details.password ?? VALID_PASSWORD);
  type('Confirm Password', details.password ?? VALID_PASSWORD);
  await click(container.querySelector('button[role="checkbox"]') as HTMLButtonElement);
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  onRegister = vi.fn();
  client.checkDomainAvailability.mockReset();
  client.checkDomainAvailability.mockResolvedValue({ ok: true, status: 200, data: { available: true } });
  domainCheck.mockReset();
  act(() => root.render(<CreateOrganizationSection onRegister={onRegister} />));
});

afterEach(() => {
  act(() => root.unmount());
});

describe('CreateOrganizationSection validation', () => {
  it.each(['a@b.c', 'josé@acme.com', "o'brien@acme.com"])(
    'holds an email the server would refuse (%s) on step one',
    email => {
      type('username@mail.com', email);

      expect(container.textContent).toContain(INVALID_EMAIL_ERROR);
      expect(button('Continue').disabled).toBe(true);
    },
  );

  it('registers with the names trimmed and the iOS typographic apostrophe made plain', async () => {
    await toDetails();
    await fillDetails({ firstName: ' Kate ', lastName: 'O’Brien' });

    expect(button('Create Account').disabled).toBe(false);
    await click(button('Create Account'));

    expect(onRegister).toHaveBeenCalledWith({
      orgName: 'Acme',
      domain: expect.stringMatching(/^acme\./),
      email: 'kate@acme.com',
      firstName: 'Kate',
      lastName: "O'Brien",
      password: VALID_PASSWORD,
    });
  });

  it.each([
    ['first', { firstName: 'a">' }],
    ['first', { firstName: '1Ivan' }],
    ['last', { lastName: 'Ivan "Vanya"' }],
    ['last', { lastName: 'a'.repeat(51) }],
  ])('flags an invalid %s name under the field and sends nothing', async (_which, details) => {
    await toDetails();
    await fillDetails(details);

    expect(container.textContent).toContain(PERSON_NAME_ERROR);
    expect(button('Create Account').disabled).toBe(true);

    await click(button('Create Account'));
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('says what a password without a symbol lacks and sends nothing', async () => {
    await toDetails();
    await fillDetails({ password: 'Password12' });

    expect(container.textContent).toContain(PASSWORD_COMPLEXITY_ERROR);
    expect(button('Create Account').disabled).toBe(true);
  });

  it('flags a subdomain the server would refuse and does not check its availability', async () => {
    await toDetails();
    await fillDetails({ domain: 'acme-' });

    expect(container.textContent).toContain(TENANT_SUBDOMAIN_ERROR);
    expect(button('Create Account').disabled).toBe(true);
    expect(domainCheck).toHaveBeenLastCalledWith('acme-', false);
  });

  it('accepts the typographic apostrophe in an organization name, as the server does', async () => {
    await toDetails();
    await fillDetails({ organizationName: 'Joe’s Shop' });

    expect(container.textContent).not.toContain(ORG_NAME_ERROR);
    expect(button('Create Account').disabled).toBe(false);
  });

  it('says which characters an organization name may use', async () => {
    await toDetails();
    await fillDetails({ organizationName: 'Acme!' });

    expect(container.textContent).toContain(ORG_NAME_ERROR);
    expect(button('Create Account').disabled).toBe(true);
  });
});
