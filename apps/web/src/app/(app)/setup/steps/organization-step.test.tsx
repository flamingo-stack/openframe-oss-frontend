/**
 * "Continue" on Set Up Your Organization waits for a logo or a website, at
 * least one of them; with neither the way on is "Skip this Step".
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tenant: { name: 'Acme', website: '', image: null as { imageUrl: string } | null },
  logoUrl: undefined as string | undefined,
}));

vi.mock('@/app/(app)/settings/hooks/use-tenant-info', () => ({
  useTenantInfo: () => ({ data: state.tenant }),
  useUpdateTenantInfo: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/app/(app)/onboarding/hooks/use-tenant-logo-upload', () => ({
  useTenantLogoUpload: () => ({
    imageUrl: state.logoUrl,
    imageHash: undefined,
    isBusy: false,
    seed: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { OrganizationStep } from './organization-step';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  state.tenant = { name: 'Acme', website: '', image: null };
  state.logoUrl = undefined;
});

function renderStep() {
  act(() => root.render(<OrganizationStep onSkip={vi.fn()} onSaved={vi.fn()} persisting={false} />));
}

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(element => element.textContent?.includes(label));

describe('OrganizationStep', () => {
  it('keeps Continue locked with a name alone, and Skip open', () => {
    renderStep();
    expect(button('Continue')?.disabled).toBe(true);
    expect(button('Skip this Step')?.disabled).toBe(false);
  });

  it('opens Continue with a website', () => {
    state.tenant = { name: 'Acme', website: 'acme.com', image: null };
    renderStep();
    expect(button('Continue')?.disabled).toBe(false);
  });

  it('opens Continue with an uploaded logo', () => {
    state.logoUrl = '/api/tenant/image/logo.png';
    renderStep();
    expect(button('Continue')?.disabled).toBe(false);
  });
});
