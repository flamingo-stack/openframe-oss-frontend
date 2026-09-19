/**
 * Pins the consent card's inert states and its one platform branch: without a
 * link copy and open are disabled, the probe is not, and the field says so; while a probe runs the
 * controls stay as drawn and only the slot beside the button changes; and "open the link" never
 * reaches for a new tab inside the app shell, where `window.open` is a dead
 * click. Each assertion was verified to fail with its guard removed.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryAccessState, DirectoryProvider } from '../../types/directory-enums';
import { ConsentBlock, type ConsentBlockProps } from './consent-block';

const { platform, toast } = vi.hoisted(() => ({ platform: { appShell: false }, toast: vi.fn() }));

vi.mock('@/lib/platform', () => ({
  isAppShell: () => platform.appShell,
  isMobileShell: () => false,
  isDesktopShell: () => false,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

const URL = 'https://login.microsoftonline.com/flamingo.cx/adminconsent?nonce=1';

const BASE: ConsentBlockProps = {
  provider: DirectoryProvider.MICROSOFT_365,
  consentUrl: URL,
  mode: 'new',
  checkState: 'idle',
  checkResult: null,
  checkError: null,
  onCheck: vi.fn(),
  onEditDomain: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<ConsentBlockProps>) {
  act(() => {
    root.render(<ConsentBlock {...BASE} {...props} />);
  });
}

function button(name: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    element => element.textContent?.trim() === name || element.getAttribute('aria-label') === name,
  );
  if (!match) throw new Error(`no button "${name}"`);
  return match;
}

describe('ConsentBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.appShell = false;
    // jsdom has no `matchMedia` (the same-window hook asks it for the viewport)
    // and no `ResizeObserver` (the `Tag` measures its label for truncation).
    window.matchMedia = () =>
      ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList;
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the link with copy, open, check and Edit Domain live', () => {
    render({});
    expect(container.querySelector('input')?.value).toBe(URL);
    expect(button('Copy consent link').disabled).toBe(false);
    expect(button('Open in Microsoft Entra').disabled).toBe(false);
    expect(button('Check Connection').disabled).toBe(false);
    expect(button('Edit Domain').disabled).toBe(false);
  });

  it('is inert with a placeholder when no link exists (Microsoft on the real backend)', () => {
    render({ consentUrl: null });
    expect(container.querySelector('input')?.placeholder).toBe('No consent link is available yet.');
    expect(button('Copy consent link').disabled).toBe(true);
    expect(button('Open in Microsoft Entra').disabled).toBe(true);
    // The probe needs no link: it is how a revoked tenant is re-verified.
    expect(button('Check Connection').disabled).toBe(false);

    render({ consentUrl: null, mode: 'details' });
    expect(container.querySelector('input')?.placeholder).toContain('use Reconnect');
  });

  it('keeps every control as drawn while the probe runs and shows the dots beside the button', () => {
    render({ checkState: 'checking' });
    // Frame 2097-122247: nothing greys out; only the slot beside the button changes.
    expect(button('Open in Microsoft Entra').disabled).toBe(false);
    expect(button('Check Connection').disabled).toBe(false);
    expect(button('Check Connection').getAttribute('aria-busy')).toBe('true');
    expect(button('Edit Domain').disabled).toBe(false);
    expect(container.querySelector('[role="status"][aria-label="Checking the connection"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Connected and readable');
  });

  it('names the outcome once the probe answered', () => {
    const checkedAt = '2026-09-17T10:00:00.000Z';
    render({
      checkState: 'connected',
      checkResult: { state: DirectoryAccessState.READ_ONLY, checkedAt, capabilities: ['USERS'] },
    });
    expect(container.textContent).toContain('Connected and readable');

    render({
      checkState: 'failed',
      checkResult: {
        state: DirectoryAccessState.CONSENT_REVOKED,
        reason: 'Admin consent was revoked.',
        checkedAt,
        capabilities: [],
      },
    });
    expect(container.textContent).toContain('Consent revoked');
    expect(container.textContent).toContain('Admin consent was revoked.');

    render({ checkState: 'failed', checkResult: null, checkError: 'The provider returned an error.' });
    expect(container.textContent).toContain('The provider returned an error.');
  });

  it('hides the caption row on the details page and the Edit Domain action when none is offered', () => {
    render({ mode: 'details' });
    expect(container.textContent).not.toContain('Grant admin consent');
    render({ mode: 'new', onEditDomain: undefined });
    expect([...container.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Edit Domain')).toBe(false);
  });

  it('opens the link in a new tab on the web and in the same window inside the app shell', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const assign = vi.fn();
    const location = window.location;
    Object.defineProperty(window, 'location', { value: { ...location, assign }, writable: true, configurable: true });

    render({});
    act(() => button('Open in Microsoft Entra').click());
    expect(open).toHaveBeenCalledWith(URL, '_blank', 'noopener,noreferrer');
    expect(assign).not.toHaveBeenCalled();

    platform.appShell = true;
    act(() => root.unmount());
    root = createRoot(container);
    render({});
    act(() => button('Open in Microsoft Entra').click());
    expect(assign).toHaveBeenCalledWith(URL);
    expect(open).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', { value: location, writable: true, configurable: true });
    open.mockRestore();
  });
});
