/**
 * The flags say the module exists, and they are on for every tenant. What decides the device screens is whether a
 * connection of this tenant has synced: a tenant with none must keep its machines' local accounts, so "no answer" and
 * "failed" never read as "has one". Both flags, `tenant-management-v2` included: off, the backend serves main's schema,
 * which has no directory users to show.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({ appMode: 'saas-tenant' }));

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { appMode: () => env.appMode } }));

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const artifact = (await import('@/__generated__/useDirectoryGateQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => artifact };
});

import { useDirectoryGate } from './use-directory-gate';

let container: HTMLDivElement;
let root: Root;
let environment: Environment;
let fetchFn: ReturnType<typeof vi.fn>;
let committed: string[];

function Probe() {
  const gate = useDirectoryGate();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    committed.push(gate);
  });
  return null;
}

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function mount() {
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Probe />
      </RelayEnvironmentProvider>,
    );
  });
}

function answer(totalCount: number) {
  fetchFn.mockResolvedValue({ data: { directoryConnections: { totalCount } } });
}

const flagsOn = () =>
  useFeatureFlagsStore.getState().setFlags([
    { name: 'tenant-management', enabled: true },
    { name: 'tenant-management-v2', enabled: true },
  ]);

describe('useDirectoryGate', () => {
  beforeEach(() => {
    env.appMode = 'saas-tenant';
    committed = [];
    useFeatureFlagsStore.getState().reset();
    fetchFn = vi.fn();
    environment = new Environment({ network: Network.create(fetchFn as never), store: new Store(new RecordSource()) });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('is off in OSS whatever the flag says, and asks nothing', async () => {
    env.appMode = 'oss-tenant';
    flagsOn();
    mount();
    await settle();
    expect(committed.at(-1)).toBe('off');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('is loading until the flag answers, and asks nothing yet', async () => {
    mount();
    await settle();
    expect(committed.at(-1)).toBe('loading');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('is off when the flag is off, and asks nothing', async () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: 'tenant-management', enabled: false },
      { name: 'tenant-management-v2', enabled: true },
    ]);
    mount();
    await settle();
    expect(committed.at(-1)).toBe('off');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('is off when tenant-management-v2 is off, though tenant-management is on, and asks nothing', async () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'tenant-management', enabled: true }]);
    answer(2);
    mount();
    await settle();
    expect(committed).not.toContain('on');
    expect(committed.at(-1)).toBe('off');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('is loading until the count answers, then on when a connection has synced', async () => {
    flagsOn();
    answer(2);
    mount();
    expect(committed).toEqual(['loading']);
    await settle();
    expect(committed.at(-1)).toBe('on');
  });

  it('counts only connections that have synced: a generated link has nothing to show yet', async () => {
    flagsOn();
    answer(1);
    mount();
    await settle();
    const text = fetchFn.mock.calls[0][0].text as string;
    expect(text).toMatch(/lastSyncStatuses:\s*\[SUCCESS, ERROR\]/);
    expect(text).not.toContain('NEVER');
  });

  it('is off for a tenant with no synced directory, though the flag is on', async () => {
    flagsOn();
    answer(0);
    mount();
    await settle();
    expect(committed.at(-1)).toBe('off');
  });

  it('is off when the count fails', async () => {
    flagsOn();
    fetchFn.mockRejectedValue(new Error('down'));
    mount();
    await settle();
    expect(committed.at(-1)).toBe('off');
  });

  it('answers from the store on the first frame of a later mount, with no second request', async () => {
    flagsOn();
    answer(2);
    mount();
    await settle();

    committed = [];
    act(() => root.unmount());
    root = createRoot(container);
    mount();

    expect(committed[0]).toBe('on');
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
