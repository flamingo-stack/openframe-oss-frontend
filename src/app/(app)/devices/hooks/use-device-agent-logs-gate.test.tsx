// Pins the tri-state the tab, the menu entry and the Run Script CTA all read:
// "not answered yet" must not render as "off", and an explicit server "off"
// wins over the dev fallback. Mirrors use-tenant-management-gate.test.tsx.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useDeviceAgentLogsGate } from './use-device-agent-logs-gate';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useDeviceAgentLogsGate> | null = null;

function Probe() {
  const gate = useDeviceAgentLogsGate();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = gate;
  });
  return null;
}

describe('useDeviceAgentLogsGate', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it('is loading until the flags query has answered', () => {
    expect(latest).toBe('loading');
  });

  it('is off when the server answered without the flag (unknown name)', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([]));
    expect(latest).toBe('off');
  });

  it('is on when the server enabled it', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'device-agent-logs', enabled: true }]));
    expect(latest).toBe('on');
  });

  it('is off when the server explicitly disabled it — the dev fallback only covers an unknown name', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'device-agent-logs', enabled: false }]));
    expect(latest).toBe('off');
  });
});
