import { useEffect, useRef, useState } from 'react';

/** `useLocalStorage` key of the "Auto-hide toolbar" preference (per browser, like the shortcuts). */
export const REMOTE_TOOLBAR_AUTO_HIDE_STORAGE_KEY = 'remote-desktop:toolbar-auto-hide';

/** The strip under the top edge of the stream that brings the hidden toolbar back. */
export const TOOLBAR_HOT_ZONE_PX = 12;
/** How long the pointer must rest in the hot zone before the toolbar slides in -
 *  a click on a remote window's title bar passes through without revealing it. */
export const TOOLBAR_REVEAL_DWELL_MS = 250;
/** Idle time, after the pointer left the toolbar, before it slides away. */
export const TOOLBAR_HIDE_DELAY_MS = 1500;

const PINNED_HOLD = 'pinned';

export interface AutoHideToolbar {
  /** False only while the toolbar is enabled to hide and nothing keeps it up. */
  visible: boolean;
  /** Show the toolbar now and start the idle countdown. */
  reveal: () => void;
  /**
   * Keep the toolbar up while `held` (the pointer is over it, a menu is open,
   * the settings modal is open, the chat has an unread message). Keys are
   * independent: the countdown starts once the last one is released.
   */
  hold: (key: string, held: boolean) => void;
  /** Put on the element the stream fills: reveals from the top-edge hot zone. */
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Auto-hide for the remote-session overlay toolbar. The toolbar is NOT a video
 * player's: a technician moves the mouse all session long, so "show on
 * movement, hide on idle" would keep it over the remote's title bars for as
 * long as they work. Instead it shows on mount (so the user sees where it
 * lives), hides after {@link TOOLBAR_HIDE_DELAY_MS}, and comes back when the
 * pointer rests in the top {@link TOOLBAR_HOT_ZONE_PX} of the stream - or on
 * keyboard focus, through `hold('focus', …)`.
 *
 * With `enabled` false the toolbar is simply always visible. `pinned` is the
 * declarative hold for state the page already has (the settings modal open, an
 * unread chat message): up while true, the countdown once it turns false.
 */
export function useAutoHideToolbar(enabled: boolean, pinned = false): AutoHideToolbar {
  const [shown, setShown] = useState(true);
  // Re-show when the preference flips on (so turning it on in Settings shows
  // the toolbar once more before it hides) and when the pin is released (the
  // countdown starts from a visible bar); adopted during render, not in an
  // effect, which would paint the stale state once first.
  const [lastEnabled, setLastEnabled] = useState(enabled);
  const [lastPinned, setLastPinned] = useState(pinned);
  if (enabled !== lastEnabled || pinned !== lastPinned) {
    setLastEnabled(enabled);
    setLastPinned(pinned);
    setShown(true);
  }

  const holdsRef = useRef<Set<string>>(new Set());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };
  const clearDwellTimer = () => {
    if (dwellTimerRef.current !== null) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
  };

  const scheduleHide = () => {
    clearHideTimer();
    if (holdsRef.current.size > 0) return;
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setShown(false);
    }, TOOLBAR_HIDE_DELAY_MS);
  };

  const reveal = () => {
    setShown(true);
    scheduleHide();
  };

  const hold = (key: string, held: boolean) => {
    if (held) {
      holdsRef.current.add(key);
      clearHideTimer();
      setShown(true);
    } else {
      holdsRef.current.delete(key);
      scheduleHide();
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const top = event.currentTarget.getBoundingClientRect().top;
    const inHotZone = event.clientY - top <= TOOLBAR_HOT_ZONE_PX;
    if (!inHotZone) {
      clearDwellTimer();
      return;
    }
    if (dwellTimerRef.current !== null) return;
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      reveal();
    }, TOOLBAR_REVEAL_DWELL_MS);
  };

  const onPointerLeave = () => clearDwellTimer();

  // The idle countdown after mount / after the preference flips on / after the
  // pin is released, and the timers' cleanup. Written out rather than through
  // scheduleHide so the effect depends on its two inputs alone; only the
  // timer's callback sets state. The pin is one more hold, so the event
  // handlers above see it too.
  useEffect(() => {
    if (pinned) holdsRef.current.add(PINNED_HOLD);
    else holdsRef.current.delete(PINNED_HOLD);
    if (!enabled) return undefined;
    if (holdsRef.current.size === 0) {
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setShown(false);
      }, TOOLBAR_HIDE_DELAY_MS);
    }
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
      if (dwellTimerRef.current !== null) clearTimeout(dwellTimerRef.current);
      hideTimerRef.current = null;
      dwellTimerRef.current = null;
    };
  }, [enabled, pinned]);

  return {
    visible: !enabled || shown,
    reveal,
    hold,
    onPointerMove,
    onPointerLeave,
  };
}
