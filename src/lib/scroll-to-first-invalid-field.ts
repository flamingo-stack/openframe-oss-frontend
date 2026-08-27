/**
 * Attribute every invalid field carries. The core inputs (`Input`, `Textarea`,
 * `SelectTrigger`, `InputTrigger`, `Autocomplete`, the date pickers) set it from
 * their own `invalid` prop; app-side blocks that render an error without an
 * input of their own (a platform grid, a code editor) set it by hand.
 */
const INVALID_SELECTOR = '[data-invalid]';

const FOCUSABLE_SELECTOR = 'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Opt-in override for where focus should land inside a wrapper-level marker.
 * Only needed when the first focusable descendant is not the control the error
 * is about.
 */
const FOCUS_TARGET_SELECTOR = '[data-invalid-focus]';

/**
 * Brings the FIRST field that failed validation into view and focuses it.
 *
 * A long form scrolls the offending field off-screen, so a submit that only
 * raises a toast leaves the user hunting for what to fix. Call this from a form's
 * invalid-submit handler, alongside the toast.
 *
 * "First" is DOM order, which is reading order — not the order react-hook-form
 * happens to enumerate its errors in.
 *
 * Note this deliberately does NOT use react-hook-form's own `shouldFocusError`:
 * that only reaches inputs registered with a ref, and every field here is a
 * `Controller` around a core component that doesn't forward one.
 */
export function scrollToFirstInvalidField(): void {
  if (typeof document === 'undefined') return;

  // The attribute only lands after React commits the invalid props, which
  // happens in the same tick the submit handler rejects — so look on the next frame.
  requestAnimationFrame(() => {
    // The first RENDERED marker, not simply the first one. A field may mark
    // itself invalid in a subtree that is `display: none` at this breakpoint —
    // the schedule form's reconnect window renders its controls twice, one copy
    // for `md` and up and one below it, and both carry the same invalid state.
    // `scrollIntoView` on a box with no layout is a silent no-op, so picking the
    // hidden copy reads as "the scroll-to-error feature is broken" rather than
    // as anything a user could act on. `offsetParent` is null for exactly that
    // case (and for `position: fixed`, which the second test allows back in).
    const field = [...document.querySelectorAll<HTMLElement>(INVALID_SELECTOR)].find(
      el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed',
    );
    if (!field) return;

    field.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });

    // Focus so the keyboard and screen readers land there too. `preventScroll`
    // keeps focus from cancelling the smooth scroll above with a jump.
    //
    // The marker may be a WRAPPER rather than the control itself (an editor, a
    // button grid, a radio group with a field hanging off one of its options).
    // "First focusable inside it" is then a guess, and a bad one where the
    // offending control is not the first thing in the box: the schedule form's
    // offline block would hand focus to the "Skip this Run" radio while the
    // value to fix sits three controls further on. `data-invalid-focus` lets a
    // wrapper name the real target; the fallback is unchanged for every block
    // that has no reason to.
    const target = field.matches(FOCUSABLE_SELECTOR)
      ? field
      : (field.querySelector<HTMLElement>(FOCUS_TARGET_SELECTOR) ??
        field.querySelector<HTMLElement>(FOCUSABLE_SELECTOR));
    target?.focus({ preventScroll: true });
  });
}
