import { useTestRunState } from '@flamingo-stack/openframe-frontend-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveCampaign, type UseLiveCampaignReturn } from './use-live-campaign';

/**
 * These pin the terminal-status mapping through the REAL lib state machine:
 * every way a live-query test can end must surface as its own status, because
 * the original bug was all of them collapsing into 'finished' and rendering
 * SUCCESS - a 5-minute timeout with zero results included.
 */

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        data: {
          integratedTools: {
            tools: [{ id: 'fleetmdm-server', toolType: 'FLEET_MDM', credentials: { apiKey: { key: 'token-1' } } }],
          },
        },
      },
    }),
  },
}));

vi.mock('@/lib/fleet-api-client', () => ({
  fleetApiClient: {
    runLiveQuery: vi.fn().mockResolvedValue({ ok: true, data: { campaign: { id: 42 } } }),
    getSockJsUrl: () => 'https://example.test/api/v1/fleet/results',
    getLabels: vi.fn(),
  },
}));

vi.mock('@/lib/token-store', () => ({
  isBearerAuthMode: () => false,
  getAccessTokenSync: () => null,
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  /** Deliver a SockJS data frame carrying one campaign message. */
  receive(message: object) {
    this.onmessage?.({ data: `a${JSON.stringify([JSON.stringify(message)])}` });
  }
}

type ProbeState = { campaign: UseLiveCampaignReturn; test: ReturnType<typeof useTestRunState> };

let latest: ProbeState;

function Probe() {
  const campaign = useLiveCampaign();
  const test = useTestRunState(campaign);
  useEffect(() => {
    latest = { campaign, test };
  });
  return null;
}

describe('useLiveCampaign + useTestRunState terminal statuses', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    FakeWebSocket.instances = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function startRun(): Promise<FakeWebSocket> {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    // Let the fleet-api-token query resolve before the run needs it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await latest.test.run(() => latest.campaign.startCampaign('SELECT 1;', [7]));
    });
    expect(latest.test.status).toBe('running');
    const socket = FakeWebSocket.instances.at(-1);
    if (!socket) throw new Error('campaign opened no WebSocket');
    // SockJS open frame -> the hook sends auth + select_campaign
    await act(async () => {
      socket.onmessage?.({ data: 'o' });
    });
    return socket;
  }

  it("maps the server's own finished status to SUCCESS", async () => {
    const socket = await startRun();
    await act(async () => {
      socket.receive({ type: 'status', data: { status: 'finished' } });
    });
    expect(latest.campaign.stopReason).toBe('completed');
    expect(latest.test.status).toBe('success');
  });

  it('maps the 5-minute client timeout to TIMED OUT, not SUCCESS', async () => {
    await startRun();
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(latest.campaign.stopReason).toBe('timeout');
    expect(latest.test.status).toBe('timeout');
  });

  it('maps a user cancel to CANCELED', async () => {
    await startRun();
    await act(async () => {
      latest.test.stop();
    });
    expect(latest.campaign.stopReason).toBe('canceled');
    expect(latest.test.status).toBe('canceled');
  });

  it('maps a dropped connection to ERROR', async () => {
    const socket = await startRun();
    await act(async () => {
      socket.onclose?.();
    });
    expect(latest.campaign.stopReason).toBe('error');
    expect(latest.test.status).toBe('error');
  });

  it('keeps ERROR for per-host osquery errors on a completed run', async () => {
    const socket = await startRun();
    await act(async () => {
      socket.receive({ type: 'result', data: { error: 'no such table', host: { id: 7, display_name: 'vm' } } });
      socket.receive({ type: 'status', data: { status: 'finished' } });
    });
    expect(latest.campaign.stopReason).toBe('completed');
    expect(latest.test.status).toBe('error');
  });
});
