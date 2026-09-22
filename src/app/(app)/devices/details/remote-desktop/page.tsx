'use client';

import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  NoData,
  PageLayout,
  Skeleton,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core';
import {
  ChatOffIcon,
  ChatTextIcon,
  Collapse02Icon,
  Expand02Icon,
  Loading01Icon,
  MonitorIcon,
  MonitorOffIcon,
  ScanXmarkIcon,
  Settings01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLocalStorage, useMediaQuery, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RemoteAccessGate } from '@/app/(app)/devices/components/remote-access/remote-access-gate';
import { useApprovedRemoteAccessRequestId } from '@/app/(app)/devices/components/remote-access/remote-access-session-context';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';
import { useRemoteSessionChat, useRemoteSessionDialogId } from '@/app/(app)/devices/hooks/use-remote-session-chat';
import { buildRemoteAccessRelayIdPrefix } from '@/app/(app)/devices/types/remote-access';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
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
import { FullscreenToolbar } from './fullscreen-toolbar';
import { RemoteSettingsModal } from './remote-settings-modal';
import {
  comboLabel,
  DEFAULT_REMOTE_SHORTCUTS,
  REMOTE_SHORTCUTS_STORAGE_KEY,
  type RemoteShortcut,
  SHORTCUT_DESCRIPTIONS,
} from './remote-shortcuts';
import { SessionChatPanel } from './session-chat-panel';
import { ShortcutsSettingsModal } from './shortcuts-settings-modal';

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
  // Mobile web (below the 800px md breakpoint) gets a dead-end message per the
  // mockup - by viewport size, per the product decision. `undefined` (first
  // client render) falls through to the normal flow; the gate below only fires
  // a request on user action, so the one-frame difference cannot start one.
  const isMobileViewport = useMediaQuery('(max-width: 799px)');
  // The dead-end ships with the approval flow (CU-86agfp8w9) and is behind its
  // flag: with the flag off the page behaves exactly as before the epic.
  const remoteAccessGate = useRemoteAccessApprovalGate();
  const handleBack = useSafeBack(routes.devices.details(deviceId));

  useEffect(() => {
    if (!isMobileShell) return;
    router.replace(deviceId ? routes.devices.details(deviceId) : routes.devices.list);
  }, [isMobileShell, deviceId, router]);

  if (isMobileShell) return null;
  if (isMobileViewport && remoteAccessGate === 'on') {
    return (
      <PageLayout
        className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <NoData icon={<MonitorOffIcon />} description="Remote desktop is not supported on mobile devices." />
        </div>
      </PageLayout>
    );
  }
  return (
    // The session component below opens the MeshCentral tunnel from its own
    // effects, so the approval gate keeps it UNMOUNTED until the end user
    // approves - not merely hidden.
    <RemoteAccessGate deviceId={deviceId} onBack={handleBack}>
      <RemoteDesktopSession />
    </RemoteAccessGate>
  );
}

/** MeshCentral relay protocol number for the desktop (KVM) stream. */
const DESKTOP_PROTOCOL = 2;

function RemoteDesktopSession() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('id') ?? '';
  // The approval this session runs under (null with the flag off): its id is
  // the first token of every relay id, so the gateway gate can match the
  // tunnel against the grant. Read once into a ref - the session is mounted
  // only after approval and never re-approved while mounted.
  const approvedRequestId = useApprovedRemoteAccessRequestId();
  const relayIdPrefixRef = useRef(
    approvedRequestId ? buildRemoteAccessRelayIdPrefix(approvedRequestId, DESKTOP_PROTOCOL) : undefined,
  );
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

  const deviceName = getDeviceName(deviceDetails) || legacyDeviceData?.hostname;

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
  useTrackOpenView(deviceName ? { type: CONTEXT_ENTITY_KIND.DEVICE, id: deviceId, label: deviceName } : null);

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
  const didAutoSelectDisplayRef = useRef(false);
  const [firstFrameReceived, setFirstFrameReceived] = useState(false);
  const [clipboardEnabled, setClipboardEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shortcuts, setShortcuts] = useLocalStorage<RemoteShortcut[]>(
    REMOTE_SHORTCUTS_STORAGE_KEY,
    DEFAULT_REMOTE_SHORTCUTS,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Page-visible connection lifecycle, driven from tunnel state changes. The
  // toasts stay, but terminal/transient states must be visible on the page
  // itself - a failed session used to leave a dead canvas behind a toast.
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>(
    'connecting',
  );
  const [retryNonce, setRetryNonce] = useState(0);
  // "The user ended the remote session" (mockup 1036-33339). Distinguishing a
  // clean client-side end from a connection drop needs the session lifecycle
  // events from the BE (CU-86ajx02qj) - until then only the dev lever below
  // can set it, so the state ships dark with the UI ready.
  const [sessionEnded, setSessionEnded] = useState(false);
  // Session chat: the dialog exists only for an approved session (null with
  // the flag off), so the toggle stays hidden otherwise.
  // The panel closes with the session.
  const chatDialogId = useRemoteSessionDialogId();
  const chat = useRemoteSessionChat(chatDialogId);
  // "Open" is remembered per dialog: a different (or absent) dialog id reads
  // as closed without any effect, so a panel can never carry over to the next
  // dialog. `showChat` is the single source for the panel AND the toggle
  // labels, so "Close Chat" never shows while nothing is open.
  const [chatOpenFor, setChatOpenFor] = useState<string | null>(null);
  const showChat = chatDialogId !== null && chatOpenFor === chatDialogId && !sessionEnded;
  const toggleChat = () => setChatOpenFor(showChat ? null : chatDialogId);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    // Dev only - simulate the end user ending the session:
    // window.dispatchEvent(new Event('openframe:dev-remote-session-ended'))
    const onEnded = () => {
      tunnelRef.current?.stop();
      setSessionEnded(true);
      setChatOpenFor(null);
    };
    window.addEventListener('openframe:dev-remote-session-ended', onEnded);
    return () => window.removeEventListener('openframe:dev-remote-session-ended', onEnded);
  }, []);

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
      // Auto-select primary display once, on the initial list. Later callbacks
      // (cmd 82 location updates) must not kick the user off an explicitly
      // chosen "All Displays" (id 0) selection.
      const primaryDisplay = newDisplays.find(d => d.primary);
      if (primaryDisplay && currentDisplayRef.current === 0 && !didAutoSelectDisplayRef.current) {
        didAutoSelectDisplayRef.current = true;
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
    // retryNonce re-arms this effect after a failed session (Retry button).
    void retryNonce;
    if (!isPageReady || !meshcentralAgentId || initializingRef.current) return undefined;

    initializingRef.current = true;
    setFirstFrameReceived(false);
    setConnectionStatus('connecting');
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
          protocol: DESKTOP_PROTOCOL,
          relayIdPrefix: relayIdPrefixRef.current,
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
              setConnectionStatus('reconnecting');
              toastRef.current({
                title: 'Connection Lost',
                description: 'Attempting to reconnect...',
                variant: 'info',
              });
            } else if (s === 3) {
              if (isReconnectingRef.current) {
                isReconnectingRef.current = false;
                toastRef.current({
                  title: 'Reconnected',
                  description: 'Connection restored successfully',
                  variant: 'success',
                });
              }
              setConnectionStatus('connected');
            } else if (s === 0 && isReconnectingRef.current) {
              isReconnectingRef.current = false;
              setConnectionStatus('failed');
              toastRef.current({
                title: 'Reconnection Failed',
                description: 'Unable to restore connection. Please try again.',
                variant: 'destructive',
              });
            } else if (s === 0) {
              setConnectionStatus('failed');
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
        setConnectionStatus('failed');
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
  }, [isPageReady, meshcentralAgentId, retryNonce]);

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

  const sendShortcut = (combo: string) => {
    if (state !== 3) return;
    // MeshDesktop.sendKeyCombo parses the combo string itself and special-cases
    // 'alt+ctrl+del' into the secure attention sequence.
    desktopRef.current?.sendKeyCombo(combo);
    toast({
      title: comboLabel(combo),
      description: SHORTCUT_DESCRIPTIONS[combo] ?? 'Shortcut sent',
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
    sendShortcut,
    openShortcutsManager: () => setShortcutsOpen(true),
    sendPower,
    setEnableInput: (enabled: boolean) => {
      setEnableInput(enabled);
      desktopRef.current?.setViewOnly(!enabled);
    },
    setClipboardEnabled,
    toast,
  };

  const actionsMenuGroups = createActionsMenuGroups(actionHandlers, enableInput, clipboardEnabled, shortcuts);

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
        <TruncateText>{deviceName || `Device ${deviceId}`}</TruncateText>
        <TruncateText
          variant="h6"
          tone="secondary"
        >{`Desktop • ${organizationName || 'Unknown Customer'}`}</TruncateText>
      </div>
    </div>
  );

  const controlsBar = (
    <div className="flex flex-shrink-0 items-center justify-between gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-mf)] py-[var(--spacing-system-xs)]">
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
        {chatDialogId && (
          <Button
            variant="outline"
            onClick={toggleChat}
            leftIcon={
              showChat ? (
                <ChatOffIcon className="h-4 w-4 md:h-6 md:w-6" />
              ) : (
                <ChatTextIcon className="h-4 w-4 md:h-6 md:w-6" />
              )
            }
          >
            {showChat ? 'Close Chat' : 'Open Chat'}
          </Button>
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

  // "Show All" grid: the main canvas keeps receiving the combined
  // virtual-desktop stream and stays mounted (hidden) as the blit source;
  // each display with known geometry (cmd 82) gets its own cropped view.
  const gridDisplays = displays.filter(d => d.id !== 0 && d.w > 0 && d.h > 0);
  const isGridActive = currentDisplay === 0 && gridDisplays.length > 1;

  const chatPanel = (variant: 'side' | 'overlay') =>
    showChat && chatDialogId ? (
      <SessionChatPanel
        messages={chat.messages}
        technician={chat.technician}
        sending={chat.sending}
        onSend={chat.send}
        variant={variant}
      />
    ) : null;

  const canvasContainer = (
    <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black ${isFullscreen ? '' : 'rounded-lg'}`}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="absolute inset-0 h-full w-full object-contain outline-none"
        style={{ visibility: firstFrameReceived && !isGridActive ? 'visible' : 'hidden' }}
        onContextMenu={e => e.preventDefault()}
      />
      {isGridActive && firstFrameReceived && (
        <div className="absolute inset-0 grid grid-cols-2 content-center gap-[var(--spacing-system-mf)] p-[var(--spacing-system-mf)]">
          {gridDisplays.map(display => (
            <div key={display.id} className="relative flex min-h-0 min-w-0 items-center justify-center">
              <canvas
                ref={el => {
                  const desktop = desktopRef.current;
                  if (!desktop || !el) return undefined;
                  desktop.attachDisplayView?.(display.id, el);
                  return () => desktop.detachDisplayView?.(display.id);
                }}
                tabIndex={0}
                aria-label={`Display ${display.id}${display.primary ? ' (Primary)' : ''}`}
                className="max-h-full max-w-full object-contain outline-none"
                onContextMenu={e => e.preventDefault()}
              />
            </div>
          ))}
        </div>
      )}
      {!firstFrameReceived && state >= 1 && connectionStatus !== 'failed' && !sessionEnded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-sf)]">
          {/* Three-dot pulse per the "Connecting" mockup (1036-31098). */}
          <span className="flex items-center gap-[var(--spacing-system-xxs)]">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="size-1 animate-pulse rounded-full bg-ods-text-secondary"
                style={{ animationDelay: `${i * 250}ms` }}
              />
            ))}
          </span>
          <span className="text-ods-text-secondary text-h6">
            {state === 3 ? 'Waiting for desktop stream' : 'Connecting to desktop'}
          </span>
        </div>
      )}
      {connectionStatus === 'reconnecting' && !sessionEnded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-sf)] bg-ods-overlay">
          <Loading01Icon className="h-8 w-8 animate-spin text-ods-text-secondary" />
          <span className="text-ods-text-primary text-h4">Connection lost</span>
          <span className="text-ods-text-secondary text-h6">Attempting to reconnect...</span>
        </div>
      )}
      {connectionStatus === 'failed' && !sessionEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-ods-overlay">
          {/* "Connection failed" mockup (1036-32959). */}
          <NoData
            icon={<ScanXmarkIcon />}
            title="Connection failed"
            description="Couldn't establish a remote session. Check the device status and try again."
            button={
              <div className="flex items-stretch gap-[var(--spacing-system-mf)]">
                <Button variant="outline" onClick={handleBack}>
                  Back to Device Details
                </Button>
                <Button variant="accent" onClick={() => setRetryNonce(n => n + 1)}>
                  Retry
                </Button>
              </div>
            }
          />
        </div>
      )}
      {sessionEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {/* "Session ended" mockup (1036-33339); solid black - the last frame
              must not stay visible once the user has ended the session. */}
          <NoData
            icon={<MonitorOffIcon />}
            title="Session ended"
            description="The user ended the remote session"
            button={
              <Button variant="outline" onClick={handleBack}>
                Back to Device Details
              </Button>
            }
          />
        </div>
      )}
      {isFullscreen && chatPanel('overlay')}
    </div>
  );

  return (
    <PageLayout
      className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      showHeader={!isFullscreen}
    >
      <div className={isFullscreen ? 'fixed inset-0 z-50 flex flex-col bg-black' : 'contents'}>
        {isFullscreen ? (
          <FullscreenToolbar
            deviceName={deviceName || `Device ${deviceId}`}
            displayMenuGroups={displayMenuGroups}
            currentDisplayLabel={`Display ${currentDisplay === 0 ? 'All' : currentDisplay}`}
            actionsMenuGroups={actionsMenuGroups}
            onOpenSettings={() => setSettingsOpen(true)}
            onExitFullscreen={exitFullscreen}
            chatOpen={chatDialogId ? showChat : undefined}
            onToggleChat={chatDialogId ? toggleChat : undefined}
          />
        ) : (
          controlsBar
        )}
        {/* One wrapper in both modes: the canvas must keep its DOM node across
            the fullscreen toggle (MeshDesktop is attached to it once), so the
            tree shape never changes - only the side panel comes and goes. */}
        <div className={`flex min-h-0 min-w-0 flex-1 ${isFullscreen ? '' : 'gap-[var(--spacing-system-mf)]'}`}>
          {canvasContainer}
          {!isFullscreen && chatPanel('side')}
        </div>
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

      {shortcutsOpen && (
        <ShortcutsSettingsModal
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          shortcuts={shortcuts}
          onSave={setShortcuts}
        />
      )}
    </PageLayout>
  );
}
