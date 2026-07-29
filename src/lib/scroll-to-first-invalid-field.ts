/**
 * Attribute every invalid field carries. The core inputs (`Input`, `Textarea`,
 * `SelectTrigger`, `InputTrigger`, `Autocomplete`, the date pickers) set it from
 * their own `invalid` prop; app-side blocks that render an error without an
 * input of their own (a platform grid, a code editor) set it by hand.
 */
const INVALID_SELECTOR = '[data-invalid]';

const FOCUSABLE_SELECTOR = 'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])';

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
    const field = document.querySelector<HTMLElement>(INVALID_SELECTOR);
    if (!field) return;

    field.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });

    // Focus so the keyboard and screen readers land there too. `preventScroll`
    // keeps focus from cancelling the smooth scroll above with a jump. The
    // marker may be a wrapper rather than the control itself (an editor, a
    // button grid), so fall back to the first focusable thing inside it.
    const target = field.matches(FOCUSABLE_SELECTOR) ? field : field.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus({ preventScroll: true });
  });
}
