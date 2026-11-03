/**
 * The first suggestion comes preselected. A search that hides the picked machine, or a failed read that takes the list
 * with it, must drop the pick: otherwise no radio is checked, Link Device stays enabled, and Link links a machine the
 * user can no longer see.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkMachine } from '@/graphql/directory/link-machine-fields';

const commit = vi.fn();

function machine(machineId: string, name: string): LinkMachine {
  return {
    id: `relay-${machineId}`,
    machineId,
    name,
    hostname: name,
    type: null,
    status: 'ONLINE',
    lastSeen: null,
    summary: '',
    facts: '',
  };
}

const ALPHA = machine('m-alpha', 'ALPHA-PC');
const ZETA = machine('m-zeta', 'ZETA-PC');

// The devices query answers the search: "zeta" names Zeta only, and "fail" is a read that fails.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  useLazyLoadQuery: (_query: unknown, variables: { search: string | null }) => {
    if (variables.search === 'fail') throw new Error('devices read failed');
    return { devices: { edges: (variables.search === 'zeta' ? [ZETA] : [ALPHA, ZETA]).map(node => ({ node })) } };
  },
  useMutation: () => [commit, false],
}));
vi.mock('@/graphql/directory/link-machine-fields', () => ({ toLinkMachine: (node: LinkMachine) => node }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useDebounce: <T,>(value: T) => value,
}));
// The modal's chrome (a portal, focus trapping) is not what this is about.
vi.mock('@/app/components/shared/simple-modal', () => ({
  SimpleModal: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));

import { LinkDeviceModal } from './link-device-modal';

let container: HTMLDivElement;
let root: Root;

const RECORD = { id: 'rec-1', name: 'LAPTOP-1', origin: 'Entra ID', suggestions: [ALPHA] };

function checkedRadios() {
  return [...container.querySelectorAll('[role="radio"]')]
    .filter(radio => radio.getAttribute('aria-checked') === 'true')
    .map(radio => radio.getAttribute('aria-label'));
}

function linkButton() {
  const button = [...container.querySelectorAll('button')].find(item => item.textContent === 'Link Device');
  if (!button) throw new Error('no Link Device button');
  return button;
}

function search(text: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Search for Devices"]');
  if (!input) throw new Error('no search input');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('LinkDeviceModal, a search that hides the pick', () => {
  beforeEach(() => {
    commit.mockReset();
    // The search input measures itself.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('drops the pick, so Link Device is off and links nothing', async () => {
    await act(async () => {
      root.render(<LinkDeviceModal record={RECORD} onClose={() => undefined} onLinked={() => undefined} />);
    });
    expect(checkedRadios()).toEqual([ALPHA.name]);
    expect(linkButton().disabled).toBe(false);

    await act(async () => search('zeta'));

    expect(container.textContent).not.toContain(ALPHA.name);
    expect(checkedRadios()).toEqual([]);
    expect(linkButton().disabled).toBe(true);
    act(() => linkButton().click());
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps the pick while the search still shows it', async () => {
    await act(async () => {
      root.render(<LinkDeviceModal record={RECORD} onClose={() => undefined} onLinked={() => undefined} />);
    });
    await act(async () => search('pc'));

    expect(checkedRadios()).toEqual([ALPHA.name]);
    expect(linkButton().disabled).toBe(false);
  });

  it('drops the pick when the devices cannot be read, suggestions and all', async () => {
    // The boundary and React both report the caught error.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      root.render(<LinkDeviceModal record={RECORD} onClose={() => undefined} onLinked={() => undefined} />);
    });
    expect(checkedRadios()).toEqual([ALPHA.name]);

    await act(async () => search('fail'));

    expect(container.textContent).toContain("Couldn't read the devices.");
    expect(container.textContent).not.toContain(ALPHA.name);
    expect(linkButton().disabled).toBe(true);
    act(() => linkButton().click());
    expect(commit).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
