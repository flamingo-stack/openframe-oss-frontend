'use client';

import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  PageLayout,
  Skeleton,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core';
import {
  Collapse02Icon,
  Expand02Icon,
  MonitorIcon,
  Settings01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { getMeshCentralBlockedCopy, getToolConnectionState } from '@/app/(app)/devices/utils/tool-connection-status';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { MeshControlClient } from '@/lib/meshcentral/meshcentral-control';
import { type DisplayInfo, MeshDesktop } from '@/lib/meshcentral/meshcentral-desktop';
import { MeshTunnel, type TunnelState } from '@/lib/meshcentral/meshcentral-tunnel';
import { DEFAULT_SETTINGS, RemoteDesktopSettings, type RemoteSettingsConfig } from '@/lib/meshcentral/remote-settings';
import { routes } from '@/lib/routes';
import { type ActionHandlers, createActionsMenuGroups } from './actions-menu-config';
import { RemoteSettingsModal } from './remote-settings-modal';

interface LegacyDeviceData {
  id: string;
  meshcentralAgentId?: string;
  hostname?: string;
  organization?: string | { name?: string };
}

/**
 * Remote Control is desktop-only. `useDeviceActionsMenu` already drops the menu
 * item in the mobile shell, so this catches what never passed through a menu: a
 * restored URL, and the `/devices/details/{id}/remote-desktop` legacy remap in
 * `not-found`. It redirects instead of rendering an explanation because the
 * session component below opens a MeshCentral tunnel from its own effects — a
 * guard inside it would fire after the connection had already started.
 */
export default function RemoteDesktopPage() {
  const router = useRouter();
  const deviceId = useSearchParams().get('id') ?? '';
  const isMobileShell = useIsMobileShell();

  useEffect(() => {
    if (!isMobileShell) return;
    router.replace(deviceId ? routes.devices.details(deviceId) : routes.devices.list);
  }, [isMobileShell, deviceId, router]);

  if (isMobileShell) return null;
  return <RemoteDesktopSession />;
}

function RemoteDesktopSession() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('id') ?? '';
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const safeBackToDevice = useSafeBack(routes.devices.details(deviceId));
  const safeBackToDevices = useSafeBack(routes.devices.list);

  // Check for legacy deviceData query param (backward compatibility)
  const deviceDataParam = searchParams.get('deviceData');
  const legacyDeviceData = useMemo((): LegacyDeviceData | null => {
    if (!deviceDataParam) return null;
    try {
      return JSON.parse(deviceDataParam);
    } catch {
      return null;
    }
  }, [deviceDataParam]);

  // Fetch device data internally if no legacy data provided
  const {
    deviceDetails,
    isLoading: isDeviceLoading,
    error: deviceError,
  } = useDeviceDetails(!legacyDeviceData ? deviceId : null, { polling: false });

  // Extract device info from either legacy data or fetched data. The legacy
  // snapshot carries a bare agent id (no connection row), so it can't be state-
  // checked — treat it as live, exactly as before.
  const meshcentralState = legacyDeviceData?.meshcentralAgentId
    ? 'live'
    : getToolConnectionState(deviceDetails?.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL'));
  const meshcentralAgentId = useMemo(() => {
    if (legacyDeviceData?.meshcentralAgentId) {
      return legacyDeviceData.meshcentralAgentId;
    }
    const connection = deviceDetails?.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL');
    return getToolConnectionState(connection) === 'live' ? connection?.agentToolId : undefined;
  }, [legacyDeviceData, deviceDetails]);

  const hostname = useMemo(() => {
    if (legacyDeviceData?.hostname) {
      return legacyDeviceData.hostname;
    }
    return deviceDetails?.hostname || deviceDetails?.displayName;
  }, [legacyDeviceData, deviceDetails]);

  const organizationName = useMemo(() => {
    if (legacyDeviceData?.organization) {
      return typeof legacyDeviceData.organization === 'string'
        ? legacyDeviceData.organization
        : legacyDeviceData.organization?.name;
    }
    return deviceDetails?.organization;
  }, [legacyDeviceData, deviceDetails]);

  // Keep this device as the Mingo "open view" while on the remote-desktop surface
  // (the parent detail page unmounted on navigation, clearing its own openView).
  useTrackOpenView(hostname ? { type: CONTEXT_ENTITY_KIND.DEVICE, id: deviceId, label: hostname } : null);

  // Remote desktop state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desktopRef = useRef<MeshDesktop | null>(null);
  const tunnelRef = useRef<MeshTunnel | null>(null);
  const controlRef = useRef<MeshControlClient | null>(null);
  const initializingRef = useRef(false);
  const remoteSettingsRef = useRef<RemoteSettingsConfig>(DEFAULT_SETTINGS);
  const [state, setState] = useState<TunnelState>(0);
  const [enableInput, setEnableInput] = useState(true);
  const [isPageReady, setIsPageReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteSettings, setRemoteSettings] = useState<RemoteSettingsConfig>(DEFAULT_SETTINGS);
  const isReconnectingRef = useRef(false);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [currentDisplay, setCurrentDisplay] = useState(0);
  const currentDisplayRef = useRef(currentDisplay);
  const [firstFrameReceived, setFirstFrameReceived] = useState(false);
  const [clipboardEnabled, setClipboardEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    currentDisplayRef.current = currentDisplay;
  }, [currentDisplay]);

  useEffect(() => {
    remoteSettingsRef.current = remoteSettings;
  }, [remoteSettings]);

  // Derived from the id the render already has - an effect would hold the page
  // in its not-ready state for one extra frame on every mount. Guarded on the
  // current state, not on the id changing: the id is routinely already known on
  // the FIRST render (react-query cache hit after the device details page, or
  // the legacy deviceData param), and a change-detection guard seeded with that
  // value never fires, leaving the page permanently not ready - no tunnel, no
  // stream, black screen.
  if (meshcentralAgentId && !isPageReady) setIsPageReady(true);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (isFullscreen) canvasRef.current?.focus();
  }, [isFullscreen]);

  useEffect(() => {
    if (!isPageReady) return undefined;

    const desktop = new MeshDesktop();
    desktopRef.current = desktop;

    desktop.onFirstFrame?.(() => setFirstFrameReceived(true));

    // Set up display list change callback
    desktop.onDisplayListChange?.(newDisplays => {
      setDisplays(newDisplays);
      // Auto-select primary display if available
      const primaryDisplay = newDisplays.find(d => d.primary);
      if (primaryDisplay && currentDisplayRef.current === 0) {
        setCurrentDisplay(primaryDisplay.id);
      }
    });

    const canvas = canvasRef.current;
    if (canvas) {
      desktop.attach(canvas);
      desktop.setViewOnly(false);
    }
    return () => {
      desktop.detach();
      if (desktopRef.current === desktop) {
        desktopRef.current = null;
      }
    };
  }, [isPageReady]);

  useEffect(() => {
    if (!isPageReady || !meshcentralAgentId || initializingRef.current) return undefined;

    initializingRef.current = true;
    setFirstFrameReceived(false);
    let cancelled = false;
    let control: MeshControlClient | undefined;
    let tunnel: MeshTunnel | undefined;
    (async () => {
      try {
        control = new MeshControlClient();
        if (cancelled) return;
        controlRef.current = control;
        const { authCookie } = await control.getAuthCookies();
        if (cancelled) return;
        tunnel = new MeshTunnel({
          authCookie,
          nodeId: meshcentralAgentId,
          protocol: 2,
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
          onData: () => {},
          onBinaryData: bytes => {
            desktopRef.current?.onBinaryFrame(bytes);
          },
          onCtrlMessage: () => {},
          onConsoleMessage: msg => {
            toastRef.current({ title: 'Remote Desktop', description: msg, variant: 'default' });
          },
          onRequestPairing: async relayId => {
            try {
              const ctrl = controlRef.current;
              if (!ctrl) return;
              await ctrl.openSession();
              const cookies = await ctrl.getAuthCookies();
              tunnelRef.current?.updateAuthCookie(cookies.authCookie);
              ctrl.sendDesktopTunnel(meshcentralAgentId, relayId);
            } catch {
              // The re-announce races the socket coming back. If it loses, the tunnel raises its own state change and the retry path above runs again — throwing out of a reconnect callback would strand the session instead.
            }
          },
          onStateChange: s => {
            setState(s);
            if (s === 1 && tunnelRef.current?.getState() === 0) {
              isReconnectingRef.current = true;
              toastRef.current({
                title: 'Connection Lost',
                description: 'Attempting to reconnect...',
                variant: 'info',
              });
            } else if (s === 3 && isReconnectingRef.current) {
              isReconnectingRef.current = false;
              toastRef.current({
                title: 'Reconnected',
                description: 'Connection restored successfully',
                variant: 'success',
              });
            } else if (s === 0 && isReconnectingRef.current) {
              isReconnectingRef.current = false;
              toastRef.current({
                title: 'Reconnection Failed',
                description: 'Unable to restore connection. Please try again.',
                variant: 'destructive',
              });
            }
          },
        });
        if (cancelled) return;
        tunnelRef.current = tunnel;
        desktopRef.current?.setSender(data => {
          tunnel?.sendBinary(data);
        });
        try {
          await control.openSession();
        } catch {
          // The session is opened again below with the cookies it needs; a failure here only means the first request pays for it.
        }
        if (cancelled) return;
        tunnel.start();
      } catch (e) {
        if (cancelled) return;
        toastRef.current({ title: 'Remote Desktop failed', description: (e as Error).message, variant: 'destructive' });
      }
    })();
    return () => {
      cancelled = true;
      isReconnectingRef.current = false;
      initializingRef.current = false;
      controlRef.current = null;
      control?.close();
      tunnel?.stop();
      tunnelRef.current = null;
    };
  }, [isPageReady, meshcentralAgentId]);

  useEffect(() => {
    if (state !== 3) return;
    const tunnel = tunnelRef.current;
    if (!tunnel) return;

    try {
      const settingsManager = new RemoteDesktopSettings(remoteSettingsRef.current);
      settingsManager.setWebSocket(tunnel);
      settingsManager.applySettings();
    } catch (error) {
      console.error('Failed to apply initial settings:', error);
    }
  }, [state]);

  // Clipboard interceptor
  useEffect(() => {
    if (!isPageReady) return undefined;
    const desktop = desktopRef.current;
    if (!desktop) return undefined;
    if (!clipboardEnabled) {
      desktop.setClipboardInterceptor?.(null);
      return undefined;
    }

    desktop.setClipboardInterceptor?.((type, sendKeys) => {
      if (type === 'paste') {
        (async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text && controlRef.current && meshcentralAgentId) {
              await controlRef.current.setClipboard(meshcentralAgentId, text);
            }
          } catch {
            // Clipboard read failed (permissions/insecure context) — proceed anyway
          }
          sendKeys();
        })();
      } else {
        sendKeys();
        (async () => {
          try {
            await new Promise(r => setTimeout(r, 250));
            if (controlRef.current && meshcentralAgentId) {
              const text = await controlRef.current.getClipboard(meshcentralAgentId);
              if (text) await navigator.clipboard.writeText(text);
            }
          } catch {
            // Clipboard write failed (permissions/insecure context) — ignore
          }
        })();
      }
    });

    return () => {
      desktop.setClipboardInterceptor?.(null);
    };
  }, [clipboardEnabled, meshcentralAgentId, isPageReady]);

  const handleBack = () => {
    tunnelRef.current?.stop();
    safeBackToDevice();
  };

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      toast({ title: 'Fullscreen failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const exitFullscreen = async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Leaving fullscreen fails when the document already left it (Escape, a tab switch) — the state this is trying to reach is the state we are in.
    }
  };

  const sendPower = async (action: 'wake' | 'sleep' | 'reset' | 'poweroff') => {
    if (!meshcentralAgentId) return;
    try {
      const client = controlRef.current || new MeshControlClient();
      if (!controlRef.current) controlRef.current = client;
      await client.powerAction(meshcentralAgentId, action);
      toast({ title: 'Power action', description: `${action} sent`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Power action failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const sendKeyCombo = (keys: number[]) => {
    const desktop = desktopRef.current;
    if (!desktop) return;

    const keyMappings: Record<string, string> = {
      [`${0x5b},${0x4d}`]: 'win+m',
      [`${0x5b},${0x28}`]: 'win+down',
      [`${0x5b},${0x26}`]: 'win+up',
      [`${0x10},${0x5b},${0x4d}`]: 'shift+win+m',
      [`${0x5b},${0x4c}`]: 'win+l',
      [`${0x5b},${0x52}`]: 'win+r',
      [`${0x11},${0x57}`]: 'ctrl+w',
    };

    const comboString = keyMappings[keys.join(',')];
    if (comboString) {
      desktop.sendKeyCombo(comboString);
    } else {
      console.warn('Unmapped key combination:', keys);
    }
  };

  const sendCtrlAltDel = () => {
    if (state !== 3) return;
    desktopRef.current?.sendCtrlAltDel();
    toast({
      title: 'Ctrl+Alt+Del',
      description: 'Shortcut sent',
      variant: 'success',
      duration: 2000,
    });
  };

  const handleDisplayChange = (displayId: number) => {
    try {
      desktopRef.current?.switchDisplay?.(displayId);
      setCurrentDisplay(displayId);
      toast({
        title: 'Display Switched',
        description: `Switched to display ${displayId}`,
        variant: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Display Switch Failed',
        description: error instanceof Error ? error.message : 'Unable to switch display',
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  const actionHandlers: ActionHandlers = {
    sendCtrlAltDel,
    sendKeyCombo,
    sendPower,
    setEnableInput: (enabled: boolean) => {
      setEnableInput(enabled);
      desktopRef.current?.setViewOnly(!enabled);
    },
    setClipboardEnabled,
    toast,
  };

  const actionsMenuGroups = createActionsMenuGroups(actionHandlers, enableInput, clipboardEnabled);

  const displayMenuGroups: ActionsMenuGroup[] =
    displays.length > 1
      ? [
          {
            items: [
              ...(displays.some(d => d.id === 0) || displays.length > 1
                ? [
                    {
                      id: 'display-all',
                      label: 'All Displays',
                      icon: <MonitorIcon className="h-4 w-4" />,
                      type: 'checkbox' as const,
                      checked: currentDisplay === 0,
                      onClick: () => handleDisplayChange(0),
                    },
                  ]
                : []),
              ...displays
                .filter(d => d.id !== 0)
                .map(display => ({
                  id: `display-${display.id}`,
                  label: `Display ${display.id}${display.primary ? ' (Primary)' : ''}`,
                  icon: <MonitorIcon className="h-4 w-4" />,
                  type: 'checkbox' as const,
                  checked: currentDisplay === display.id,
                  onClick: () => handleDisplayChange(display.id),
                })),
            ],
          },
        ]
      : [];

  if (!legacyDeviceData && isDeviceLoading) {
    return (
      <PageLayout
        className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-mf)] py-[var(--spacing-system-xs)]">
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 rounded-lg bg-black" />
      </PageLayout>
    );
  }

  if (!legacyDeviceData && deviceError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[var(--spacing-system-mf)] p-[var(--spacing-system-l)]">
        <div className="text-ods-error text-h4">Error: {deviceError}</div>
        <Button onClick={safeBackToDevices}>Back</Button>
      </div>
    );
  }

  if (!meshcentralAgentId) {
    const copy = getMeshCentralBlockedCopy(meshcentralState, 'Remote desktop');
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[var(--spacing-system-mf)] p-[var(--spacing-system-l)]">
        <div className="text-ods-error text-h4">{copy.title}</div>
        <p className="text-ods-text-secondary">{copy.description}</p>
        <Button onClick={safeBackToDevice}>Back</Button>
      </div>
    );
  }

  const deviceInfoBlock = (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <div className="flex-shrink-0 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)]">
        <MonitorIcon className="h-4 w-4 text-ods-text-primary" />
      </div>
      <div className="flex min-w-0 flex-col">
        <TruncateText>{hostname || `Device ${deviceId}`}</TruncateText>
        <TruncateText
          variant="h6"
          tone="secondary"
        >{`Desktop • ${organizationName || 'Unknown Customer'}`}</TruncateText>
      </div>
    </div>
  );

  const controlsBar = (
    <div
      className={`flex flex-shrink-0 items-center justify-between gap-[var(--spacing-system-mf)] border border-ods-border bg-ods-card px-[var(--spacing-system-mf)] py-[var(--spacing-system-xs)] ${
        isFullscreen ? '' : 'rounded-md'
      }`}
    >
      {deviceInfoBlock}
      <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
        {displays.length > 1 && (
          <ActionsMenuDropdown
            groups={displayMenuGroups}
            customTrigger={
              <Button variant="outline" leftIcon={<MonitorIcon className="h-4 w-4 md:h-6 md:w-6" />}>
                Display {currentDisplay === 0 ? 'All' : currentDisplay}
              </Button>
            }
          />
        )}
        <ActionsMenuDropdown groups={actionsMenuGroups} triggerAriaLabel="Actions" />
        <Button
          variant="outline"
          size="icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
          leftIcon={<Settings01Icon />}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          leftIcon={isFullscreen ? <Collapse02Icon /> : <Expand02Icon />}
        />
      </div>
    </div>
  );

  const canvasContainer = (
    <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black ${isFullscreen ? '' : 'rounded-lg'}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="absolute inset-0 h-full w-full object-contain outline-none"
        style={{ visibility: firstFrameReceived ? 'visible' : 'hidden' }}
        onContextMenu={e => e.preventDefault()}
      />
      {!firstFrameReceived && state >= 1 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-sf)]">
          <Loader2 className="h-8 w-8 animate-spin text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">
            {state === 3 ? 'Waiting for desktop stream...' : 'Connecting to desktop...'}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <PageLayout
      className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      showHeader={!isFullscreen}
    >
      <div className={isFullscreen ? 'fixed inset-0 z-50 flex flex-col bg-black' : 'contents'}>
        {controlsBar}
        {canvasContainer}
      </div>

      <RemoteSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentSettings={remoteSettings}
        desktopRef={desktopRef}
        tunnelRef={tunnelRef}
        connectionState={state}
        onSettingsChange={setRemoteSettings}
      />
    </PageLayout>
  );
}
