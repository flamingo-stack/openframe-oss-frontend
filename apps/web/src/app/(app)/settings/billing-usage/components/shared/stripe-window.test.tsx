import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDeferredTab } from './stripe-window';

const CAPTION = 'Preparing your invoice...';

let frame: HTMLIFrameElement;
let tab: Window;

beforeEach(() => {
  frame = document.createElement('iframe');
  document.body.appendChild(frame);
  tab = frame.contentWindow as Window;
  vi.spyOn(window, 'open').mockReturnValue(tab);
});

afterEach(() => {
  frame.remove();
  vi.restoreAllMocks();
  document.documentElement.className = '';
  document.head.innerHTML = '';
  document.body.removeAttribute('class');
  delete document.body.dataset.appType;
});

describe('openDeferredTab', () => {
  it('shows what the tab is waiting for, under the title of the app', () => {
    act(() => {
      openDeferredTab(CAPTION);
    });

    expect(tab.document.querySelector('[role="status"]')?.textContent).toBe(CAPTION);
    expect(tab.document.title).toBe(`${CAPTION} | OpenFrame`);
  });

  it('dresses the tab in the styles and the attributes the design tokens hang off', () => {
    document.documentElement.className = 'dark';
    document.body.className = 'font-body';
    document.body.dataset.appType = 'openframe';
    document.head.innerHTML = `
      <style>.bg-ods-bg {}</style>
      <link rel="stylesheet" href="/_next/static/css/app.css" />
      <link rel="icon" href="/assets/openframe/favicon.svg" />
      <link rel="preload" href="/font.woff2" />
    `;

    act(() => {
      openDeferredTab(CAPTION);
    });

    expect(tab.document.documentElement.className).toBe('dark');
    expect(tab.document.body.className).toBe('font-body');
    expect(tab.document.body.dataset.appType).toBe('openframe');
    expect(tab.document.head.querySelector('style')?.textContent).toBe('.bg-ods-bg {}');
    expect(tab.document.head.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBe(
      '/_next/static/css/app.css',
    );
    expect(tab.document.head.querySelector('link[rel="icon"]')).not.toBeNull();
    expect(tab.document.head.querySelector('link[rel="preload"]')).toBeNull();
  });

  it('cuts the tab off from this page', () => {
    const opener = vi.fn();
    Object.defineProperty(tab, 'opener', { configurable: true, set: opener });

    act(() => {
      openDeferredTab(CAPTION);
    });

    expect(opener).toHaveBeenCalledWith(null);
  });

  it('still reaches Stripe when the placeholder cannot be drawn', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const location = { href: '' };
    const unpaintable = {
      get document(): Document {
        throw new Error('blocked');
      },
      location,
      close: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(unpaintable);

    const deferred = openDeferredTab(CAPTION);
    deferred.navigate('https://invoice.stripe.com/i/abc');

    expect(location.href).toBe('https://invoice.stripe.com/i/abc');
  });

  it('closes the tab when the URL never arrives', () => {
    const close = vi.spyOn(tab, 'close').mockImplementation(() => {});

    let deferred: ReturnType<typeof openDeferredTab> | undefined;
    act(() => {
      deferred = openDeferredTab(CAPTION);
    });
    deferred?.cancel();

    expect(close).toHaveBeenCalled();
  });
});
