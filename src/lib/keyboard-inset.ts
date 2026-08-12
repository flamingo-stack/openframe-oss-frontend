import { keyboardPlugin } from './native-shell';

/**
 * Publishes the software keyboard's height as `--of-keyboard-inset` on <html>.
 *
 * Nothing shrinks the LAYOUT viewport when a mobile keyboard opens. WKWebView
 * keeps its frame (Capacitor's iOS core has no keyboard handling at all, and
 * the shell runs the Keyboard plugin in `resize: 'none'` so the app's own
 * `--native-safe-*` pipeline stays valid); on Android the window is edge-to-edge
 * for targetSdk 35+, where `adjustResize` is inert and the IME arrives as a
 * WindowInsets type. So `100dvh`, `inset-0` and every percentage height keep
 * reporting the full screen, and anything bottom-anchored or viewport-centered
 * — every modal on mobile — opens behind the keyboard.
 *
 * Exactly one signal drives the variable: the native plugin where the shell has
 * it, `visualViewport` otherwise. Consumers are the overlay primitives in
 * openframe-frontend-core (modal-v2, dialog, alert-dialog), which fall back to
 * 0px wherever this never runs.
 */

const CSS_VAR = '--of-keyboard-inset';

/** Keep in sync with ModalV2's `transition-[padding] duration-200` in the core lib. */
const INSET_TRANSITION_MS = 200;

let initialized = false;
let publishedInset = 0;
let pendingReassert = 0;

function publish(height: number): void {
  const inset = Math.max(0, Math.round(height));
  if (inset === publishedInset) return;
  const opening = publishedInset === 0;
  publishedInset = inset;
  document.documentElement.style.setProperty(CSS_VAR, `${inset}px`);
  // Any newer state supersedes a re-assert still waiting to fire. Without this,
  // a modal dismissed inside the window below scrolls the page behind it: Radix
  // hands focus back to the trigger on close, and the pending callback then
  // scrolls that trigger into view.
  window.clearTimeout(pendingReassert);
  // Only on the closed -> open edge. The visual viewport also reports a changed
  // inset while the user pans with the keyboard already up, and re-asserting
  // there would yank the caret back mid-scroll.
  if (!opening) return;
  // Browsers scroll the focused field into view on focus, but they do it before
  // the keyboard exists — against the un-inset layout — so on a long form the
  // field can still land under the keyboard once the panel shrinks around it.
  //
  // Deliberately not a rAF: ModalV2 animates the inset in over 200ms, and a
  // callback one frame later measures a panel that has barely started shrinking,
  // so `block: 'nearest'` concludes the field is still visible and scrolls
  // nothing. Re-assert once that transition has settled.
  pendingReassert = window.setTimeout(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.scrollIntoView({ block: 'nearest' });
  }, INSET_TRANSITION_MS + 50);
}

/**
 * Prefers `keyboardWillShow`/`keyboardWillHide` over the `Did` pair: iOS emits
 * them before the show animation and Android at animation start, so the modal
 * travels with the keyboard instead of snapping into place after it.
 * Returns false when the shell has no Keyboard plugin, so the caller can fall back.
 */
function initNativeKeyboardEvents(): boolean {
  const keyboard = keyboardPlugin();
  if (!keyboard) return false;
  try {
    const registrations = [
      keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => publish(keyboardHeight)),
      keyboard.addListener('keyboardWillHide', () => publish(0)),
    ];
    // The natively-injected bridge proxy returns a bare synchronous handle from
    // addListener, not the Promise the plugin types advertise; Promise.resolve
    // absorbs both shapes (see native-back.ts, where chaining directly on the
    // sync handle crashed the shell initializer at boot).
    // No `initialized = false` retry here, unlike initNativeBack: that one has
    // no other way to get the back button, whereas a synchronous failure below
    // returns false and lands on the visualViewport fallback. Re-arming on one
    // rejected registration of the pair would only re-register the one that
    // succeeded.
    for (const registration of registrations) {
      void Promise.resolve(registration).catch(error => {
        console.error('[Keyboard Inset] listener registration failed:', error);
      });
    }
    return true;
  } catch (error) {
    console.error('[Keyboard Inset] listener registration failed:', error);
    return false;
  }
}

/**
 * Mobile web / PWA. Gated on a coarse pointer because `visualViewport` also
 * shrinks under desktop pinch-zoom, which is not a keyboard and must not push
 * modals around.
 */
function initVisualViewportFallback(): void {
  const viewport = window.visualViewport;
  if (!viewport || !window.matchMedia('(pointer: coarse)').matches) return;
  const sync = () => {
    // Pinch-zoom shrinks the visual viewport exactly the way a keyboard does,
    // and the web build leaves zoom enabled (only the static export pins
    // maximum-scale), so a zoomed page would otherwise publish a keyboard-sized
    // inset and shove every overlay up the screen. Publish 0 rather than just
    // bailing — returning early would strand the last inset and leave overlays
    // lifted for a keyboard that is no longer there.
    //
    // The cost is that a keyboard opened while the user is pinch-zoomed reports
    // nothing. Focus does not itself zoom — `input, textarea, select` are pinned
    // to 16px in the core lib's app-globals.css, which is what WebKit's
    // focus-auto-zoom threshold keys off — so this needs a deliberate pinch.
    if (viewport.scale > 1) {
      publish(0);
      return;
    }
    // The layout viewport is unchanged, so what the visual one has lost at the
    // bottom is the keyboard. offsetTop covers the case where the page is
    // scrolled within it.
    publish(document.documentElement.clientHeight - (viewport.height + viewport.offsetTop));
  };
  viewport.addEventListener('resize', sync);
  viewport.addEventListener('scroll', sync);
  sync();
}

/** Wire the keyboard inset once per document. Safe to call on every platform. */
export function initKeyboardInset(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (initNativeKeyboardEvents()) return;
  initVisualViewportFallback();
}
