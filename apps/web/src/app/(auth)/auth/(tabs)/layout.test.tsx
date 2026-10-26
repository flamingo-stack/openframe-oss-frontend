/**
 * While a desktop sign-in waits on the browser the tabs show the waiting screen in place of the form,
 * and the form must come back as the user left it — hidden, never unmounted.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginDesktopSignInWait } from '@/lib/desktop-sign-in-wait';
import AuthTabsLayout from './layout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/auth/login',
}));
vi.mock('@/app/hooks/use-login-only-mobile-shell', () => ({ useLoginOnlyMobileShell: () => false }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CompactAuthShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  TabSelector: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => {
    root.render(
      <AuthTabsLayout>
        <input aria-label="Email" defaultValue="" />
      </AuthTabsLayout>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('AuthTabsLayout', () => {
  it('swaps the form for the waiting screen and brings it back with what was typed', () => {
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'owner@acme.example';

    let end: () => void = () => {};
    act(() => {
      end = beginDesktopSignInWait({ loginUrl: 'https://auth.example/login', deadline: Date.now() + 60_000 });
    });

    expect(container.textContent).toContain('Finish signing in your browser');
    expect(input.closest('.hidden')).not.toBeNull();

    act(() => end());

    expect(container.textContent).not.toContain('Finish signing in your browser');
    expect(container.querySelector('input')).toBe(input);
    expect(input.closest('.hidden')).toBeNull();
    expect(input.value).toBe('owner@acme.example');
  });
});
