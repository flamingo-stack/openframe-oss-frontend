import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopSignInWaiting } from './desktop-sign-in-waiting';

const plugin = vi.hoisted(() => ({ cancel: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/native-shell', () => ({ nativeAuthPlugin: () => plugin }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast }),
}));

const LOGIN_URL = 'https://auth.openframe.example/oauth/login?tenantId=t-1';

let root: Root;
let container: HTMLDivElement;

function render(email?: string) {
  act(() => {
    root.render(<DesktopSignInWaiting wait={{ loginUrl: LOGIN_URL, email, deadline: Date.now() + 5 * 60 * 1000 }} />);
  });
}

const buttonNamed = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name);

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
  plugin.cancel.mockReset().mockResolvedValue(true);
  toast.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('DesktopSignInWaiting', () => {
  it('says who is signing in and counts down the shell’s window', () => {
    render('owner@acme.example');

    expect(container.textContent).toContain('Finish signing in your browser');
    expect(container.textContent).toContain('Signing in as owner@acme.example');
    expect(container.textContent).toContain('5:00 left');

    act(() => vi.advanceTimersByTime(61_000));
    expect(container.textContent).toContain('3:59 left');
  });

  it('names nobody when the screen did not know the account', () => {
    render();

    expect(container.textContent).not.toContain('Signing in as');
  });

  // A tab closed by mistake: the same sign-in again, without ending the one the app waits on.
  it('reopens the same sign-in in the browser', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render();

    act(() => buttonNamed('Reopen browser')?.click());

    expect(open).toHaveBeenCalledWith(LOGIN_URL, '_blank', 'noopener,noreferrer');
    expect(plugin.cancel).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('cancels the waiting sign-in in the shell with a quiet note', async () => {
    render();

    await act(async () => buttonNamed('Cancel')?.click());

    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign-in canceled' }));
    expect(toast.mock.calls[0][0].variant).toBeUndefined();
  });

  // The browser's result landed in the same instant: the sign-in it finishes is what the user sees next.
  it('claims no cancel when the shell had nothing left to cancel', async () => {
    plugin.cancel.mockResolvedValue(false);
    render();

    await act(async () => buttonNamed('Cancel')?.click());

    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });
});
