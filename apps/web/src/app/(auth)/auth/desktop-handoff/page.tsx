'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { launchDesktopApp } from '@/lib/desktop-auth-return';
import {
  desktopDownloadAppUrl,
  DOWNLOAD_HANDOFF_LAUNCH_FRAGMENT,
  lookUpHandoffDownloadId,
} from '@/lib/desktop-download-handoff';
import { SsoJoinCardLayout } from '../components/sso-join-card-layout';

const DESKTOP_APP_NAME = 'OpenFrame Console';

const handoffQueryKey = ['desktop-download-handoff'] as const;

/** Read once per page load: the effect strips the fragment right after. */
let openedByApp: boolean | null = null;

/** The URL is read once and never watched, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  openedByApp ??= window.location.hash === `#${DOWNLOAD_HANDOFF_LAUNCH_FRAGMENT}`;
  return openedByApp;
}

/** Prerendered HTML has no URL to read: render the frame with the button held, then the real state on hydration. */
function getServerSnapshot(): null {
  return null;
}

/**
 * Where the desktop app's first-launch hand-off lands, in the default browser (see
 * `lib/desktop-download-handoff.ts`). Opened by the app (the `#launch` fragment), it asks the gateway
 * for this browser's download id and launches the app's scheme with it once, or without one when
 * there is none: either way the person is taken back to the app. Any other load (a reload, a
 * restored tab) launches and looks up nothing until the button is pressed. The button is the way
 * back for a browser that blocked the launch or a prompt the person dismissed.
 */
export default function DesktopHandoffPage() {
  const opened = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const lookup = useQuery({
    queryKey: handoffQueryKey,
    queryFn: lookUpHandoffDownloadId,
    enabled: opened === true,
    // One attempt: every moment spent here keeps the person away from the app they just opened.
    retry: false,
    staleTime: Infinity,
  });
  const appUrl = lookup.isFetched ? desktopDownloadAppUrl(lookup.data ?? null) : null;
  const launched = useRef(false);

  useEffect(() => {
    if (opened) window.history.replaceState(null, '', window.location.pathname);
  }, [opened]);

  useEffect(() => {
    if (!opened || !appUrl || launched.current) return;
    launched.current = true;
    launchDesktopApp(appUrl);
  }, [opened, appUrl]);

  const returnToApp = () => {
    if (appUrl) {
      launchDesktopApp(appUrl);
      return;
    }
    void lookup.refetch().then(result => launchDesktopApp(desktopDownloadAppUrl(result.data ?? null)));
  };

  return (
    <SsoJoinCardLayout>
      <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <h1 className="text-ods-text-primary text-h2">Opening {DESKTOP_APP_NAME}</h1>
          <p className="text-ods-text-secondary text-h4">
            {DESKTOP_APP_NAME} opened this tab to link the app to your download. You can close it once the app is open.
          </p>
        </div>
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <Button
            type="button"
            variant="outline"
            fullWidth
            disabled={opened === null || lookup.isFetching}
            onClick={returnToApp}
          >
            Return to {DESKTOP_APP_NAME}
          </Button>
          <p className="text-center text-ods-text-tertiary text-h6">
            If your browser asks, allow it to open {DESKTOP_APP_NAME}.
          </p>
        </div>
      </div>
    </SsoJoinCardLayout>
  );
}
