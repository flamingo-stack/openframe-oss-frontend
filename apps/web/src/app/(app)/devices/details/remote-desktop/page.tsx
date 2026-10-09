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
  ChatsIcon,
  Chevron02DownIcon,
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
import { useRemoteAccessSession } from '@/app/(app)/devices/components/remote-access/remote-access-session-context';
import { RecordingWarningAlert } from '@/app/(app)/devices/components/remote-sessions/recording-storage-banner';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';
import { useRemoteSessionChat, useRemoteSessionDialogId } from '@/app/(app)/devices/hooks/use-remote-session-chat';
import { buildRemoteAccessRelayIdPrefix, type RemoteSessionEndReason } from '@/app/(app)/devices/types/remote-access';
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
  // The dead-end ships with the approval flow and is behind its
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

/** How long a paired relay may stay silent before its pairing is thrown away for a fresh one. */
const FIRST_FRAME_TIMEOUT_MS = 10_000;

/** Fresh pairings the page tries on its own before it hands the failure to the technician. */
const MAX_STREAM_RETRIES = 2;

/** The agent reports display ids only, no monitor names. */
function displayLabel(displayId: number): string {
  return `Display ${displayId}`;
}

/** The "Session ended" line per end reason; the dev lever plays the end user's end. */
const SESSION_ENDED_COPY: Record<RemoteSessionEndReason, string> = {
  client: 'The user ended the remote session',
  admin: 'The remote session was ended',
  timeout: 'The remote session reached its time limit',
  connection_lost: 'The connection to the device was lost',
  never_connected: 'The remote desktop never connected',
  policy: 'Remote access to this device was disabled',
};

function RemoteDesktopSession() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('id') ?? '';
  // The approval this session runs under (null with the flag off): its id is
  // the first token of every relay id, so the gateway gate can match the
  // tunnel against the grant. Read once into a ref - the session is mounted
  // only after approval and never re-approved while mounted.
  const {
    requestId: approvedRequestId,
    session: remoteSession,
    ended: remoteSessionEnd,
    endSession,
    requestAgain,
  } = useRemoteAccessSession();
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
  // The display the agent streams; MeshDesktop picks the primary until the technician picks one.
  const [currentDisplay, setCurrentDisplay] = useState<number | null>(null);
  const [firstFrameReceived, setFirstFrameReceived] = useState(false);
  // A relay that pairs proves nothing about the stream: the agent can accept
  // the tunnel and never start the capture, and nothing on the wire says so.
  // True from a pairing until its first frame. Deliberately not cleared when
  // the socket drops - a relay that keeps dropping and re-pairing without ever
  // drawing a frame must run out of time too.
  const [awaitingStream, setAwaitingStream] = useState(false);
  const streamRetriesRef = useRef(0);
  // The agent's own status line (a consent wait, a refusal), kept on the page
  // while there is no picture to look at: a toast is gone before it explains
  // why the stream is late.
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
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
  // The session is over: the backend said so (the end user pressed End
  // Session, the cap passed, the tunnel was lost), or the dev lever below did.
  // The stream must stop here - nothing on the server side closes the relay.
  const [devSessionEnded, setDevSessionEnded] = useState(false);
  const sessionEnded = devSessionEnded || remoteSessionEnd !== null;
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
    if (remoteSessionEnd) tunnelRef.current?.stop();
  }, [remoteSessionEnd]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    // Dev only - simulate the end user ending the session:
    // window.dispatchEvent(new Event('openframe:dev-remote-session-ended'))
    const onEnded = () => {
      tunnelRef.current?.stop();
      setDevSessionEnded(true);
      setChatOpenFor(null);
    };
    window.addEventListener('openframe:dev-remote-session-ended', onEnded);
    return () => window.removeEventListener('openframe:dev-remote-session-ended', onEnded);
  }, []);

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

    desktop.onFirstFrame?.(() => {
      setFirstFrameReceived(true);
      setAwaitingStream(false);
      streamRetriesRef.current = 0;
    });

    desktop.onDisplayListChange?.((newDisplays, streamed) => {
      setDisplays(newDisplays);
      setCurrentDisplay(streamed);
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
    setAwaitingStream(false);
    setAgentMessage(null);
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
            setAgentMessage(msg);
            if (msg) toastRef.current({ title: 'Remote Desktop', description: msg, variant: 'default' });
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
              desktopRef.current?.beginStream?.();
              setAwaitingStream(true);
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
    if (!awaitingStream || sessionEnded) return undefined;
    const timer = setTimeout(() => {
      setAwaitingStream(false);
      if (streamRetriesRef.current < MAX_STREAM_RETRIES) {
        streamRetriesRef.current += 1;
        console.warn('[RemoteDesktop] No desktop frame after pairing, pairing again', {
          attempt: streamRetriesRef.current,
        });
        // A whole new attempt rather than a redial: new control session, new tunnel, new relay id.
        setRetryNonce(n => n + 1);
        return;
      }
      console.warn('[RemoteDesktop] No desktop frame after pairing, giving up');
      tunnelRef.current?.stop();
      setConnectionStatus('failed');
    }, FIRST_FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [awaitingStream, sessionEnded]);

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
    endSession();
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
        description: `Switched to ${displayLabel(displayId)}`,
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

  // One entry per separate display; with one display or none (macOS agents
  // before multi-monitor support, Linux) there is nothing to pick.
  const displayMenuGroups: ActionsMenuGroup[] =
    displays.length > 1
      ? [
          {
            items: displays.map(display => ({
              id: `display-${display.id}`,
              label: displayLabel(display.id),
              icon: <MonitorIcon className="h-6 w-6" />,
              onClick: () => handleDisplayChange(display.id),
            })),
          },
        ]
      : [];
  const currentDisplayLabel = currentDisplay === null ? 'Display' : displayLabel(currentDisplay);

  if (!legacyDeviceData && isDeviceLoading) {
    return (
      <PageLayout
        className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="flex flex-shrink-0 flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-lg:flex-row content-lg:items-center content-lg:justify-between">
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-m)]">
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
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
      <div className="flex-shrink-0 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)]">
        <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
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

  // Header per Figma 2155-109503 (desktop) / 2164-111246 (tablet): the device
  // card and the buttons share one 80px row on desktop; below that the buttons
  // drop to a row of their own. Chat, actions, fullscreen, settings - in that order.
  const controlsBar = (
    <div className="flex flex-shrink-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card">
      <div className="flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] content-lg:flex-row content-lg:items-center content-lg:justify-between">
        {deviceInfoBlock}
        <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-m)]">
          {chatDialogId && !sessionEnded && (
            <Button
              variant="outline"
              onClick={toggleChat}
              leftIcon={<ChatsIcon className="h-4 w-4 text-ods-text-secondary md:h-6 md:w-6" />}
            >
              {showChat ? 'Close Chat' : 'Open Chat'}
            </Button>
          )}
          <ActionsMenuDropdown groups={actionsMenuGroups} triggerAriaLabel="Actions" />
          <Button
            variant="outline"
            size="icon"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            leftIcon={isFullscreen ? <Collapse02Icon /> : <Expand02Icon />}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            leftIcon={<Settings01Icon />}
          />
        </div>
      </div>
      {displayMenuGroups.length > 0 && (
        <ActionsMenuDropdown
          groups={displayMenuGroups}
          align="start"
          customTrigger={
            <button
              type="button"
              aria-label="Switch display"
              className="flex w-full items-center gap-[var(--spacing-system-xs)] border-t border-ods-border p-[var(--spacing-system-sf)] text-left text-ods-text-primary outline-none transition-colors hover:bg-ods-bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus"
            >
              <MonitorIcon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-h4">{currentDisplayLabel}</span>
              <Chevron02DownIcon className="h-6 w-6 shrink-0" />
            </button>
          }
        />
      )}
    </div>
  );

  const chatPanel = (variant: 'side' | 'overlay') =>
    showChat && chatDialogId ? (
      <SessionChatPanel
        messages={chat.messages}
        loading={chat.isLoading}
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
        style={{ visibility: firstFrameReceived ? 'visible' : 'hidden' }}
        onContextMenu={e => e.preventDefault()}
      />
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
          {agentMessage && <span className="text-ods-text-secondary text-h6">{agentMessage}</span>}
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
                <Button
                  variant="accent"
                  onClick={() => {
                    streamRetriesRef.current = 0;
                    setRetryNonce(n => n + 1);
                  }}
                >
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
            description={SESSION_ENDED_COPY[remoteSessionEnd?.endReason ?? 'client']}
            button={
              // A desktop that never connected is retried as a new request (a
              // new session); the ended session cannot carry a tunnel any more.
              remoteSessionEnd?.endReason === 'never_connected' && requestAgain ? (
                <div className="flex items-stretch gap-[var(--spacing-system-mf)]">
                  <Button variant="outline" onClick={handleBack}>
                    Back to Device Details
                  </Button>
                  <Button variant="accent" onClick={requestAgain}>
                    Retry
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={handleBack}>
                  Back to Device Details
                </Button>
              )
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
            currentDisplayLabel={currentDisplayLabel}
            actionsMenuGroups={actionsMenuGroups}
            onOpenSettings={() => setSettingsOpen(true)}
            onExitFullscreen={exitFullscreen}
            chatOpen={chatDialogId && !sessionEnded ? showChat : undefined}
            onToggleChat={chatDialogId && !sessionEnded ? toggleChat : undefined}
          />
        ) : (
          controlsBar
        )}
        {/* Figma 2328-20570: the session started while recording storage was full. Windowed only, as drawn. */}
        {!isFullscreen && remoteSession?.recordingSuppressed === 'storage_full' && (
          <RecordingWarningAlert className="flex-shrink-0">
            This session isn&apos;t being recorded. Recording storage is full. New sessions aren&apos;t recorded until
            space is freed.
          </RecordingWarningAlert>
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
