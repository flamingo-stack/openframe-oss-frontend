'use client';

import { Chevron01RightIcon, Rocket02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Progress } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatBytes } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useEffect } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import {
  applyDesktopUpdate,
  checkDesktopUpdate,
  type DesktopUpdateErrorKind,
  onDesktopUpdateAvailable,
  onDesktopUpdateError,
  onDesktopUpdateInstalling,
  onDesktopUpdateProgress,
} from '@/lib/native-shell';
import { isDesktopShell } from '@/lib/platform';
import { useDesktopUpdateStore } from '@/stores/desktop-update-store';

/**
 * What each failure means to the user, and whether doing it again could help.
 * Keyed on the shell-assigned kind, never on the plugin's message text.
 */
const ERROR_COPY: Record<DesktopUpdateErrorKind, { message: string; retryable: boolean }> = {
  network: {
    message: "Couldn't reach the update server. Check your connection and try again.",
    retryable: true,
  },
  signature: {
    message: "The download didn't pass verification, so it wasn't installed. Try again later.",
    retryable: true,
  },
  io: {
    message: "Couldn't write the update to disk. Free up some space and try again.",
    retryable: true,
  },
  unavailable: {
    message: "This update isn't available for your system. You can keep using this version.",
    retryable: false,
  },
  // Neither reaches this table — the store handles both without an error state —
  // but the record is exhaustive so a new kind in the shell is a type error here
  // rather than a blank message in front of a user.
  busy: { message: 'An update is already being installed.', retryable: false },
  gone: { message: "You're already up to date.", retryable: false },
  unknown: { message: "The update couldn't be installed. Try again.", retryable: true },
};

// The event transports outlive React lifecycles — subscribe once per document
// however many times this component (re)mounts.
let listenersRegistered = false;

/**
 * The desktop shell's "an update is ready" dialog, mounted once in `AppShell`.
 *
 * The shell installs updates SILENTLY at launch, so most users restart into the
 * new version having seen nothing. This covers what that path cannot: a machine
 * that was offline at boot, a download that failed, self-update turned off in
 * config, and releases published while the app was already running. It also
 * owns the mount-time check that finds the first case.
 *
 * "Update on Next Launch" is simply a dismissal — the next launch's silent pass
 * takes it — so it needs no shell state and cannot fall out of step with one.
 */
export function DesktopUpdateModal() {
  // The subscription effect reaches its actions through `getState()` instead of
  // these, so it can stay a mount-once effect with no action in its deps.
  const { version, releaseNotesUrl, isModalOpen, phase, downloaded, total, error, dismiss, startApply, fail } =
    useDesktopUpdateStore();

  useEffect(() => {
    if (!isDesktopShell() || listenersRegistered) return;
    listenersRegistered = true;

    void (async () => {
      const store = useDesktopUpdateStore;
      const onAnnounce = store.getState().announce;
      await onDesktopUpdateAvailable(onAnnounce);
      await onDesktopUpdateProgress(progress => store.getState().setProgress(progress));
      await onDesktopUpdateInstalling(() => store.getState().setInstalling());
      await onDesktopUpdateError(e => store.getState().fail(e));

      // Pulled, not awaited: the shell's poll EMITS availability, but an event
      // fired before this listener existed is gone. Only a request/response can
      // answer for an update that was already waiting when the app opened.
      try {
        const availability = await checkDesktopUpdate();
        if (availability) onAnnounce(availability);
      } catch (e) {
        // "Don't know" — offline, or the manifest was unreachable. Not "no
        // update", and nothing to interrupt the user with: the shell's poll
        // asks again on its own schedule.
        console.warn('[Desktop Update] startup check failed:', e);
      }
    })();
  }, []);

  const handleApply = useCallback(async () => {
    startApply();
    try {
      await applyDesktopUpdate();
    } catch (e) {
      fail(e as { kind: DesktopUpdateErrorKind; message: string });
    }
  }, [startApply, fail]);

  const isApplying = phase === 'downloading' || phase === 'installing';
  // Closing mid-download would leave the install running with no way to see it
  // through — the shell has no cancel, and reopening would hit the busy path.
  const handleClose = useCallback(() => {
    if (!isApplying) dismiss();
  }, [isApplying, dismiss]);

  if (!version) return null;

  const errorCopy = error ? ERROR_COPY[error.kind] : null;
  const percent = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

  return (
    <SimpleModal
      isOpen={isModalOpen}
      onClose={handleClose}
      className="md:max-w-[600px]"
      title="Update Available"
      footer={
        isApplying ? (
          <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
            <div className="flex items-center justify-between text-ods-text-secondary text-h6">
              <span>{phase === 'installing' ? 'Installing…' : 'Downloading…'}</span>
              {phase === 'downloading' && (
                <span>
                  {total ? `${formatBytes(downloaded, 1)} of ${formatBytes(total, 1)}` : formatBytes(downloaded, 1)}
                </span>
              )}
            </div>
            {/* An indeterminate bar whenever there is no honest fraction to
                show: no Content-Length on the download, or an install whose
                duration nothing reports. Full-width and pulsing says "working"
                without claiming progress it doesn't have. */}
            {percent !== null && phase === 'downloading' ? (
              <Progress value={percent} className="bg-ods-bg" indicatorClassName="bg-ods-accent" />
            ) : (
              <div className="h-2 w-full overflow-hidden rounded-full bg-ods-bg">
                <div className="h-full w-full animate-pulse bg-ods-accent" />
              </div>
            )}
          </div>
        ) : (
          <>
            <Button variant="outline" className="flex-1" onClick={dismiss}>
              {errorCopy ? 'Later' : 'Update on Next Launch'}
            </Button>
            {(!errorCopy || errorCopy.retryable) && (
              <Button variant="accent" className="flex-1" onClick={handleApply}>
                {errorCopy ? 'Try Again' : 'Update & Restart'}
              </Button>
            )}
          </>
        )
      }
    >
      <p className="text-ods-text-secondary text-h4">
        OpenFrame v{version} is ready to install. This version includes performance improvements and bug fixes.
      </p>

      {errorCopy && (
        <div
          role="alert"
          // NOT text-h5 — that ramp step is `text-transform: uppercase`, which is
          // a label style. This is a sentence.
          className="rounded-md border border-ods-error bg-ods-error/10 p-[var(--spacing-system-sf)] text-ods-text-primary text-h4"
        >
          {errorCopy.message}
        </div>
      )}

      {/* Absent on manifests published before the release page existed — a
          missing link beats a link to a 404. Opened with target="_blank" so the
          shell's new-window routing hands it to the system browser. */}
      {releaseNotesUrl && (
        <a
          href={releaseNotesUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] transition-colors hover:bg-ods-bg-hover"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ods-border">
            <Rocket02Icon className="size-5 text-ods-text-secondary" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            {/* text-h3 is the ODS "bold body" ramp — the same `h3 - bold body`
                token the design uses here. text-h5 would uppercase it. */}
            <span className="text-ods-text-primary text-h3">Release Notes</span>
            <span className="text-ods-text-secondary text-h6">See everything that changed in this version</span>
          </span>
          <Chevron01RightIcon className="size-5 shrink-0 text-ods-text-secondary" />
        </a>
      )}
    </SimpleModal>
  );
}
