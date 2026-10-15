import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mesh = vi.hoisted(() => ({
  connect: (): Promise<void> => new Promise(() => {}),
  managers: 0,
  closedClients: 0,
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: () => {} }),
}));

vi.mock('@/lib/meshcentral/meshcentral-control', () => ({
  MeshControlClient: class {
    close() {
      mesh.closedClients++;
    }
  },
}));

vi.mock('@/lib/meshcentral/file-manager', () => ({
  MeshCentralFileManager: class {
    constructor() {
      mesh.managers++;
    }
    connect() {
      return mesh.connect();
    }
    disconnect() {}
  },
}));

import { useMeshFileManager } from './use-mesh-file-manager';

let latest: ReturnType<typeof useMeshFileManager>;
let container: HTMLDivElement;
let root: Root;

function Probe() {
  const result = useMeshFileManager({ meshcentralAgentId: 'node' });
  useEffect(() => {
    latest = result;
  });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  mesh.connect = () => new Promise(() => {});
  mesh.managers = 0;
  mesh.closedClients = 0;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useMeshFileManager', () => {
  it('fails and closes the control client when the connection does not open in time', async () => {
    act(() => root.render(<Probe />));
    expect(latest.connectionState).toBe('connecting');

    await act(() => vi.advanceTimersByTimeAsync(15000));

    expect(latest.connectionState).toBe('failed');
    expect(mesh.closedClients).toBe(1);
  });

  it('connects again with a new file manager on retry', async () => {
    mesh.connect = () => Promise.reject(new Error('Failed to establish control connection'));
    act(() => root.render(<Probe />));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(latest.connectionState).toBe('failed');

    mesh.connect = () => Promise.resolve();
    await act(async () => latest.retryConnection());

    expect(mesh.managers).toBe(2);
    expect(latest.connectionState).toBe('connecting');
  });
});
