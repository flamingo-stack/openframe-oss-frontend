/**
 * The footer leads to flamingo.run, which carries pricing and a sign-up link. A store app may not lead to either, so
 * the phone apps draw the mark with nothing to tap.
 */

import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoweredByFlamingo } from './powered-by-flamingo';

const shell = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/lib/platform', () => ({ isMobileShell: () => shell.mobile }));

let root: Root | null = null;

function render(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<PoweredByFlamingo />));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  shell.mobile = false;
});

describe('PoweredByFlamingo', () => {
  it('links to flamingo.run on the web and in the desktop app', () => {
    const link = render().querySelector('a');

    expect(link?.getAttribute('href')).toBe('https://flamingo.run');
    expect(link?.textContent).toContain('Powered by');
  });

  it('is not a link in the phone apps', () => {
    shell.mobile = true;

    const container = render();

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Powered by');
    expect(container.textContent).toContain('Flamingo');
  });

  it('drops a prerendered link when a phone hydrates it', async () => {
    // The export is built with no shell, so a prerendered footer is the link.
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PoweredByFlamingo />);
    document.body.append(container);
    expect(container.querySelector('a')).not.toBeNull();
    shell.mobile = true;

    await act(async () => {
      root = hydrateRoot(container, <PoweredByFlamingo />);
    });

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Powered by');
  });
});
