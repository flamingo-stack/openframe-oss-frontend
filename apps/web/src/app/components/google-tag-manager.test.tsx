/**
 * GTM loads on the web and never in the desktop app (CU-17tkuw6abhg), even with a container id in
 * the runtime config or passed in.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ desktop: false, envId: 'GTM-RUNTIME' as string | undefined }));

vi.mock('@/lib/platform', () => ({ isDesktopShell: () => state.desktop }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { gtmContainerId: () => state.envId } }));
vi.mock('next/script', () => ({
  default: ({ id, dangerouslySetInnerHTML }: { id: string; dangerouslySetInnerHTML: { __html: string } }) => (
    <script data-testid={id} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />
  ),
}));

import { GoogleTagManager } from './google-tag-manager';

const win = window as unknown as { dataLayer?: unknown[] };
let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  state.desktop = false;
  state.envId = 'GTM-RUNTIME';
  delete win.dataLayer;
});

function render(props: { containerId?: string; noscriptFallback: boolean }) {
  act(() => root.render(<GoogleTagManager {...props} />));
}

describe('GoogleTagManager', () => {
  it('loads the runtime container on the web', () => {
    render({ noscriptFallback: true });
    expect(container.querySelector('[data-testid="gtm-script"]')?.innerHTML).toContain("'GTM-RUNTIME'");
    expect(container.querySelector('noscript')).not.toBeNull();
    expect(win.dataLayer).toEqual([]);
  });

  it('loads nothing in the desktop app, whatever id it is given', () => {
    state.desktop = true;
    render({ containerId: 'GTM-PROP', noscriptFallback: true });
    expect(container.innerHTML).toBe('');
    expect(win.dataLayer).toBeUndefined();
  });

  it('loads nothing without a container id', () => {
    state.envId = undefined;
    render({ noscriptFallback: false });
    expect(container.innerHTML).toBe('');
  });
});
