/**
 * `?mingoDialog=` — the old chat drawer's param, which older links carry — reaches the
 * chat page from any route. Not on an OSS tenant, which has no Mingo.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import { MingoDialogParamBridge } from './mingo-dialog-param-bridge';

const { replace, mode } = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  mode: { saas: true },
}));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const RAW = '6ac4e3a3fb523d620947f238';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  replace.mockReset();
  mode.saas = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, '', '/');
});

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  act(() => root.render(<MingoDialogParamBridge />));
}

describe('MingoDialogParamBridge', () => {
  it('forwards the param on any route to the chat page', () => {
    renderAt(`/devices/details?id=m-1&mingoDialog=${RAW}`);
    expect(replace).toHaveBeenCalledWith(`/mingo/chat?id=${RAW}`);
  });

  it('unwraps a Relay global id from a link older than the raw-id mapping', () => {
    renderAt(`/dashboard?mingoDialog=${toGlobalId('Dialog', RAW)}`);
    expect(replace).toHaveBeenCalledWith(`/mingo/chat?id=${RAW}`);
  });

  it('strips a param that names nothing, keeping the page', () => {
    renderAt('/devices?statuses=ONLINE&mingoDialog=#list');
    expect(replace).toHaveBeenCalledWith('/devices?statuses=ONLINE#list');
  });

  it('does nothing on an OSS tenant', () => {
    mode.saas = false;
    renderAt(`/dashboard?mingoDialog=${RAW}`);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does nothing on a URL without the param', () => {
    renderAt('/devices');
    expect(replace).not.toHaveBeenCalled();
  });
});
