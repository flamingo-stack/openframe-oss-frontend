/**
 * The local install as page state: the shell owns the run and reports through
 * events; the hook keeps the lines and the outcome for the screen.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentInstallDone } from '@/lib/native-shell';

const bridge = vi.hoisted(() => ({
  supported: true,
  start: vi.fn<(command: string) => Promise<void>>(),
  output: null as ((lines: string[]) => void) | null,
  done: null as ((done: AgentInstallDone) => void) | null,
}));

vi.mock('@/lib/native-shell', () => ({
  canInstallAgentLocally: () => bridge.supported,
  startLocalAgentInstall: bridge.start,
  onLocalAgentInstallOutput: (callback: (lines: string[]) => void) => {
    bridge.output = callback;
    return Promise.resolve(true);
  },
  onLocalAgentInstallDone: (callback: (done: AgentInstallDone) => void) => {
    bridge.done = callback;
    return Promise.resolve(true);
  },
}));

import { type LocalAgentInstall, useLocalAgentInstall } from './use-local-agent-install';

let container: HTMLDivElement;
let root: Root;
/** The hook's latest value, read after each `act`. */
let probe: { latest: () => LocalAgentInstall | null };

/** Mount the hook in a bare component and hand back a reader for its value. */
function mount(): { latest: () => LocalAgentInstall | null } {
  let latest: LocalAgentInstall | null = null;
  function Probe() {
    latest = useLocalAgentInstall();
    return null;
  }
  act(() => root.render(<Probe />));
  return { latest: () => latest };
}

beforeEach(() => {
  bridge.supported = true;
  bridge.start.mockReset();
  bridge.start.mockResolvedValue(undefined);
  bridge.output = null;
  bridge.done = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  probe = mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useLocalAgentInstall', () => {
  it('starts idle, runs the command and collects what it prints until it is done', async () => {
    expect(probe.latest()?.supported).toBe(true);
    expect(probe.latest()?.status).toBe('idle');

    await act(async () => {
      await probe.latest()?.start('echo hello');
    });
    expect(bridge.start).toHaveBeenCalledWith('echo hello');
    expect(probe.latest()?.status).toBe('running');

    act(() => bridge.output?.(['[+] Admin privileges', 'Starting installation...']));
    act(() => bridge.output?.(['OpenFrame agent installed successfully.']));
    expect(probe.latest()?.lines.map(line => line.text)).toEqual([
      '[+] Admin privileges',
      'Starting installation...',
      'OpenFrame agent installed successfully.',
    ]);
    expect(probe.latest()?.lines.every(line => line.receivedAt instanceof Date)).toBe(true);

    act(() => bridge.done?.({ success: true, exitCode: 0 }));
    expect(probe.latest()?.status).toBe('succeeded');
    expect(probe.latest()?.error).toBeNull();
  });

  it('reports a run the shell could not start, and a run that failed', async () => {
    bridge.start.mockRejectedValueOnce({ kind: 'busy', message: 'an install is already running' });
    await act(async () => {
      await probe.latest()?.start('echo hello');
    });
    expect(probe.latest()?.status).toBe('failed');
    expect(probe.latest()?.error?.kind).toBe('busy');

    // The next start clears the previous outcome.
    await act(async () => {
      await probe.latest()?.start('echo again');
    });
    expect(probe.latest()?.status).toBe('running');
    expect(probe.latest()?.error).toBeNull();
    expect(probe.latest()?.lines).toEqual([]);

    act(() => bridge.done?.({ success: false, exitCode: 1, error: { kind: 'failed', message: 'exit 1' } }));
    expect(probe.latest()?.status).toBe('failed');
    expect(probe.latest()?.error?.kind).toBe('failed');
  });
});

describe('useLocalAgentInstall outside the desktop shell', () => {
  it('is not supported and never subscribes', () => {
    act(() => root.unmount());
    bridge.supported = false;
    bridge.output = null;
    root = createRoot(container);
    probe = mount();
    expect(probe.latest()?.supported).toBe(false);
    expect(bridge.output).toBeNull();
  });
});
