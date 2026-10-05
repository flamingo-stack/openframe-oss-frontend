import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DesktopUpdateAvailability, DesktopUpdateError, DesktopUpdateProgress } from '@/lib/native-shell';

/**
 * Owns "the desktop shell has an update waiting" for the whole app: the modal
 * that offers it, and the sidebar button that reopens the modal after a
 * dismissal. Lifted into a store because those two live in unrelated subtrees —
 * the button is passed to the core sidebar through `sidebarConfig`, the modal is
 * mounted once in `AppShell`.
 *
 * Only ever populated inside the Tauri shell. On mobile and the web nothing
 * writes to it, so every consumer renders nothing.
 *
 * Note this is the FALLBACK path, not the usual one: the shell applies updates
 * silently at launch, so a user normally restarts into the new version having
 * seen nothing. This surfaces the cases that path cannot cover — offline at
 * boot, a download that failed, self-update disabled by config, or a release
 * published while the app was already running.
 */
export type DesktopUpdatePhase = 'idle' | 'downloading' | 'installing' | 'error';

interface DesktopUpdateState {
  available: boolean;
  version: string | null;
  releaseNotesUrl: string | null;
  isModalOpen: boolean;
  /**
   * The version whose modal the user closed. Kept as the VERSION rather than a
   * boolean so a newer release still announces itself: dismissing 1.0.4 should
   * not silence 1.0.5. Session-scoped — a relaunch means the silent updater ran
   * again, so a still-pending update has earned another mention.
   */
  dismissedVersion: string | null;
  phase: DesktopUpdatePhase;
  downloaded: number;
  /** Null when the download reported no size — render an indeterminate bar. */
  total: number | null;
  error: DesktopUpdateError | null;

  /** An update was offered, by the mount-time check or the shell's poll. */
  announce: (availability: DesktopUpdateAvailability) => void;
  /** Reopen from the sidebar button. */
  openModal: () => void;
  /** Close via X or "Update on Next Launch" — both mean "not now". */
  dismiss: () => void;
  startApply: () => void;
  setProgress: (progress: DesktopUpdateProgress) => void;
  setInstalling: () => void;
  fail: (error: DesktopUpdateError) => void;
}

export const useDesktopUpdateStore = create<DesktopUpdateState>()(
  devtools(
    (set, get) => ({
      available: false,
      version: null,
      releaseNotesUrl: null,
      isModalOpen: false,
      dismissedVersion: null,
      phase: 'idle',
      downloaded: 0,
      total: null,
      error: null,

      announce: availability => {
        if (!availability.available || !availability.version) return;
        const { version, dismissedVersion, phase } = get();
        // Re-announcing the version already on screen must not reset an apply
        // in flight: the shell's poll keeps running during the download.
        if (availability.version === version && phase !== 'idle') return;
        set(
          {
            available: true,
            version: availability.version,
            releaseNotesUrl: availability.releaseNotesUrl ?? null,
            isModalOpen: availability.version !== dismissedVersion,
            phase: 'idle',
            downloaded: 0,
            total: null,
            error: null,
          },
          false,
          'announce',
        );
      },

      openModal: () => set({ isModalOpen: true, error: null }, false, 'openModal'),

      // The version is remembered, not the fact of dismissing, so the sidebar
      // button stays — dismissing hides the modal, it does not decline the update.
      dismiss: () => set({ isModalOpen: false, dismissedVersion: get().version }, false, 'dismiss'),

      startApply: () => set({ phase: 'downloading', downloaded: 0, total: null, error: null }, false, 'startApply'),

      // Ignored once the phase has moved on: a progress frame emitted just
      // before the install began can still be in flight and would drag the UI
      // back to a download that is already over.
      setProgress: progress => {
        if (get().phase !== 'downloading') return;
        set({ downloaded: progress.downloaded, total: progress.total ?? null }, false, 'setProgress');
      },

      setInstalling: () => set({ phase: 'installing', error: null }, false, 'setInstalling'),

      fail: error =>
        set(
          {
            // `busy` means another apply owns the restart — this call failed,
            // but an update IS still being installed, so showing an error would
            // be a lie. Leave the pending state alone.
            ...(error.kind === 'busy' ? {} : { phase: 'error' as const, error }),
            // `gone` means it was already installed (the silent path took it) or
            // withdrawn. Either way there is nothing left to offer.
            ...(error.kind === 'gone'
              ? { available: false, isModalOpen: false, phase: 'idle' as const, error: null }
              : {}),
          },
          false,
          'fail',
        ),
    }),
    { name: 'desktop-update-store' },
  ),
);
