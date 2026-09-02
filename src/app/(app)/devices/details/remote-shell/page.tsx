'use client';

import { Button, PageLayout, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import { TerminalSquare } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { MeshControlClient } from '@/lib/meshcentral/meshcentral-control';
import { MeshTunnel, type TunnelState } from '@/lib/meshcentral/meshcentral-tunnel';
import { routes } from '@/lib/routes';

const WINDOWS_POWERSHELL_CMD =
  'powershell -NoLogo -NoProfile 2>nul || "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile 2>nul || "%SystemRoot%\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile 2>nul || "%ProgramFiles%\\PowerShell\\7\\pwsh.exe" -NoLogo -NoProfile 2>nul || "%ProgramFiles(x86)%\\PowerShell\\7\\pwsh.exe" -NoLogo -NoProfile 2>nul';

export default function RemoteShellPage() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('id') ?? '';
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const safeBackToDevice = useSafeBack(routes.devices.details(deviceId));
  const safeBackToDevices = useSafeBack(routes.devices.list);

  const shellTypeParam = searchParams.get('shellType');
  const shellType = useMemo<'cmd' | 'powershell'>(() => {
    return shellTypeParam === 'powershell' ? 'powershell' : 'cmd';
  }, [shellTypeParam]);

  const {
    deviceDetails,
    isLoading: isDeviceLoading,
    error: deviceError,
  } = useDeviceDetails(deviceId, { polling: false });

  const meshcentralAgentId = useMemo(() => {
    return deviceDetails?.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL')?.agentToolId;
  }, [deviceDetails]);

  const hostname = useMemo(() => {
    return deviceDetails?.hostname || deviceDetails?.displayName;
  }, [deviceDetails]);

  const organizationName = useMemo(() => {
    return deviceDetails?.organization;
  }, [deviceDetails]);

  // Keep this device as the Mingo "open view" while on the remote-shell surface
  // (the parent detail page unmounted on navigation, clearing its own openView).
  useTrackOpenView(
    deviceDetails ? { type: CONTEXT_ENTITY_KIND.DEVICE, id: deviceId, label: hostname || deviceId } : null,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  /**
   * Teardown for the terminal built inside the async IIFE below. It cannot be a
   * local: the effect's cleanup runs on a different tick and has to reach
   * whatever the IIFE ended up creating.
   */
  const cleanupRef = useRef<(() => void) | null>(null);
  const tunnelRef = useRef<MeshTunnel | null>(null);
  const controlRef = useRef<MeshControlClient | null>(null);
  const [state, setState] = useState<TunnelState>(0);
  const [connecting, setConnecting] = useState(false);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const powershellCommandSentRef = useRef(false);
  const [isPageReady, setIsPageReady] = useState(false);

  useEffect(() => {
    if (meshcentralAgentId) {
      const timer = setTimeout(() => setIsPageReady(true), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [meshcentralAgentId]);

  useEffect(() => {
    if (!isPageReady) return undefined;

    let isDisposed = false;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);

      if (isDisposed) return;

      const term = new Terminal({
        fontFamily: 'monospace',
        theme: { background: '#000000' },
        cursorBlink: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      const container = containerRef.current;
      if (!container) {
        term.dispose();
        return;
      }
      term.open(container);
      fit.fit();
      term.focus();
      termRef.current = term;
      fitRef.current = fit;

      const handleResize = () => {
        try {
          fit.fit();
        } catch {
          // xterm throws from `fit()` when the container has no layout yet (a resize observed mid-unmount, a hidden tab). The next resize re-fits.
        }
        if (tunnelRef.current && termRef.current) {
          tunnelRef.current.sendCtrl({ ctrlChannel: 102938, type: 'termsize', cols: term.cols, rows: term.rows });
        }
      };
      window.addEventListener('resize', handleResize);
      const disposeResize = term.onResize(() => handleResize);
      const disposeData = term.onData((d: string) => tunnelRef.current?.sendBinary(new TextEncoder().encode(d)));

      cleanupRef.current = () => {
        window.removeEventListener('resize', handleResize);
        disposeResize.dispose();
        disposeData.dispose();
        tunnelRef.current?.stop();
        term.dispose();
        termRef.current = null;
        fitRef.current = null;
      };
    })();

    return () => {
      isDisposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [isPageReady]);

  useEffect(() => {
    if (
      state === 3 &&
      shellType === 'powershell' &&
      hasReceivedData &&
      !powershellCommandSentRef.current &&
      tunnelRef.current
    ) {
      setTimeout(() => {
        if (tunnelRef.current && !powershellCommandSentRef.current) {
          tunnelRef.current.sendBinary(new TextEncoder().encode(WINDOWS_POWERSHELL_CMD + '\r'));
          powershellCommandSentRef.current = true;
        }
      }, 100);
    }
  }, [state, shellType, hasReceivedData]);

  useEffect(() => {
    if (!isPageReady || !meshcentralAgentId) return undefined;

    let control: MeshControlClient | undefined;
    (async () => {
      setConnecting(true);
      try {
        control = new MeshControlClient();
        controlRef.current = control;
        const { authCookie } = await control.getAuthCookies();
        const term = termRef.current;
        if (!term) throw new Error('Terminal not initialized');
        const tunnel = new MeshTunnel({
          authCookie,
          nodeId: meshcentralAgentId,
          protocol: 1,
          options: { cols: term.cols, rows: term.rows },
          getAuthCookie: () => controlRef.current?.getCachedAuthCookie() ?? null,
          onBeforeReconnect: async () => {
            try {
              const ctrl = controlRef.current;
              if (ctrl && !ctrl.isConnected()) {
                await ctrl.openSession();
              }
            } catch {
              // Best-effort warm-up: re-opening the control session here only saves the reconnect a round trip. The tunnel reconnects either way and re-opens the session itself if this failed.
            }
          },
          onData: data => {
            setHasReceivedData(true);
            if (typeof data === 'string') term.write(data);
            else term.write(new TextDecoder().decode(data));
          },
          onCtrlMessage: () => {},
          onConsoleMessage: msg => {
            toastRef.current({ title: 'Remote Shell', description: msg, variant: 'default' });
          },
          onRequestPairing: async relayId => {
            try {
              const ctrl = controlRef.current;
              if (!ctrl) return;
              await ctrl.openSession();
              const cookies = await ctrl.getAuthCookies();
              tunnelRef.current?.updateAuthCookie(cookies.authCookie);
              ctrl.sendRelayTunnel(meshcentralAgentId, relayId, 1);
            } catch {
              // The re-announce races the socket coming back. If it loses, the tunnel raises its own state change and the retry path above runs again — throwing out of a reconnect callback would strand the session instead.
            }
          },
          onStateChange: s => setState(s),
        });
        tunnelRef.current = tunnel;
        try {
          await control.openSession();
        } catch {
          // The session is opened again by the tunnel if this failed; starting the tunnel is what matters here.
        }
        tunnel.start();
      } catch (e) {
        toastRef.current({ title: 'Remote Shell failed', description: (e as Error).message, variant: 'destructive' });
      } finally {
        setConnecting(false);
      }
    })();
    return () => {
      controlRef.current = null;
      control?.close();
    };
  }, [isPageReady, meshcentralAgentId]);

  const handleBack = () => {
    tunnelRef.current?.stop();
    safeBackToDevice();
  };

  const statusText = state === 3 ? 'Connected' : state === 2 ? 'Open' : state === 1 ? 'Connecting' : 'Idle';
  const statusColor =
    state === 3
      ? 'text-ods-success'
      : state === 1 || state === 2
        ? 'text-ods-text-secondary'
        : 'text-ods-text-secondary';

  const shellLabel = shellType === 'powershell' ? 'PowerShell' : 'Terminal';

  // Loading skeleton
  if (isDeviceLoading) {
    return (
      <div className="flex h-full animate-pulse flex-col overflow-hidden p-4 md:p-6">
        <div className="flex-shrink-0 bg-ods-bg py-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-ods-border" />
            <div className="h-5 w-28 rounded bg-ods-border" />
          </div>
        </div>
        <div className="mb-2 flex flex-shrink-0 items-center justify-between rounded-md border border-ods-border bg-ods-card px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="rounded-md border border-ods-border bg-ods-card p-2">
              <div className="h-4 w-4 rounded bg-ods-border" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-5 w-48 rounded bg-ods-border" />
              <div className="h-4 w-36 rounded bg-ods-border" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-24 rounded-md bg-ods-border" />
          </div>
        </div>
        <div className="min-h-0 flex-1 pb-4">
          <div className="flex h-full items-center justify-center overflow-hidden rounded-lg border border-ods-border bg-ods-card">
            <div className="flex flex-col items-center gap-4">
              <TerminalSquare className="h-16 w-16 text-ods-border" />
              <div className="h-4 w-48 rounded bg-ods-border" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (deviceError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 md:p-6">
        <div className="text-ods-error text-h4">Error: {deviceError}</div>
        <Button onClick={safeBackToDevices}>Back</Button>
      </div>
    );
  }

  // Missing MeshCentral agent
  if (!meshcentralAgentId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 md:p-6">
        <div className="text-ods-error text-h4">Error: MeshCentral Agent ID not available for this device</div>
        <p className="text-ods-text-secondary">Remote shell requires MeshCentral agent to be connected.</p>
        <Button onClick={safeBackToDevice}>Back</Button>
      </div>
    );
  }

  return (
    <PageLayout
      title="Remote Shell"
      className="h-full px-4 pb-4 md:px-6 md:pb-6"
      contentClassName="flex flex-col"
      backButton={{
        label: 'Back',
        onClick: handleBack,
      }}
    >
      <div className="mb-2 flex flex-shrink-0 items-center justify-between rounded-md border border-ods-border bg-ods-card px-4 py-2">
        {/* Device info */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0 rounded-md border border-ods-border bg-ods-card p-2">
            <TerminalSquare className="h-4 w-4 text-ods-text-primary" />
          </div>
          <div className="flex min-w-0 flex-col">
            <TruncateText>{hostname || `Device ${deviceId}`}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {`${shellLabel}${organizationName ? ` \u2022 ${organizationName}` : ''}`}
            </TruncateText>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <span className={`text-h6 ${statusColor}`}>
            {statusText}
            {connecting ? '\u2026' : ''}
          </span>
          <Button
            onClick={() => tunnelRef.current?.stop()}
            variant="outline"
            className="border border-ods-border bg-ods-card text-ods-text-primary"
            disabled={state !== 3}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="min-h-0 flex-1 pb-4">
        <div className="h-full overflow-hidden rounded-lg bg-black">
          <div ref={containerRef} className="h-full w-full p-2" />
        </div>
      </div>
    </PageLayout>
  );
}
