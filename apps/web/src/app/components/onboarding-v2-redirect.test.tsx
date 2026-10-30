// Pins the moves the redirect makes under onboarding v2 - the dashboard to the
// wizard while the setup is pending, the wizard to the dashboard when nothing
// is - and the one it must not make: the wizard records its last screen as
// seen the moment it shows, and that answer must not throw the admin off the
// screen mid-visit.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { OnboardingV2Redirect } from './onboarding-v2-redirect';

type Pending = 'unknown' | 'setup' | 'none';

const { replace, state } = vi.hoisted(() => ({
  replace: vi.fn(),
  state: { pathname: '/dashboard', pending: 'unknown' as 'unknown' | 'setup' | 'none' },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => state.pathname,
}));
vi.mock('@/app/(app)/setup/hooks/use-setup-pending', () => ({ useSetupPending: () => state.pending }));

let container: HTMLDivElement;
let root: Root;

/** The session is at `pathname` and the setup answer reads `pending`. */
function at(pathname: string, pending: Pending) {
  state.pathname = pathname;
  state.pending = pending;
  act(() => root.render(<OnboardingV2Redirect />));
}

beforeEach(() => {
  replace.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('OnboardingV2Redirect', () => {
  it('moves nothing while the answer is unknown', () => {
    at('/dashboard', 'unknown');
    at('/setup', 'unknown');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the dashboard to the wizard while the setup is pending', () => {
    at('/dashboard', 'setup');
    expect(replace).toHaveBeenCalledWith(routes.setup);
  });

  it('leaves the dashboard alone once nothing is pending', () => {
    at('/dashboard', 'none');
    expect(replace).not.toHaveBeenCalled();
  });

  it('honours a deep link to any other page', () => {
    at('/devices', 'setup');
    at('/devices', 'none');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a session with nothing pending from the wizard to the dashboard', () => {
    at('/setup', 'unknown');
    at('/setup', 'none');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(routes.dashboard);
  });

  it('keeps the admin on the wizard when its last screen is recorded as seen mid-visit', () => {
    at('/setup', 'unknown');
    at('/setup', 'setup');
    at('/setup', 'none');
    expect(replace).not.toHaveBeenCalled();
  });

  it('decides again on the next visit to the wizard', () => {
    at('/setup', 'setup');
    at('/setup', 'none');
    at('/devices', 'none');
    at('/setup', 'none');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(routes.dashboard);
  });

  it('follows "Reset Onboarding" back to the wizard', () => {
    at('/dashboard', 'none');
    at('/dashboard', 'setup');
    expect(replace).toHaveBeenCalledWith(routes.setup);
  });
});
