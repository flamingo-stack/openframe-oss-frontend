/**
 * Open or close the phone burger drawer (`AppLayout`'s `MobileBurgerMenu`) from outside it.
 *
 * The drawer's open state is `AppLayout`'s own: no prop opens or closes it, and only a
 * click on one of its NAV ROWS closes it on the way out. The Mingo-first shell needs
 * both directions the layout does not offer — the top bar's Chat history cell opens the
 * drawer on its history section, and a navigation started from the drawer's slots (a
 * chat row, New chat, an account menu item) has to close it. So this presses the top
 * bar's own burger toggle, whose accessible name says which way it goes; the click runs
 * the layout's handler exactly as a tap would.
 *
 * A no-op when there is nothing to press: from md up (the header draws no burger), and
 * when the drawer already is the way asked. Lib ask: a controlled `mobileMenuOpen` /
 * `onMobileMenuOpenChange` on `AppLayout` would retire this.
 */
export function setMobileMenuOpen(open: boolean): void {
  if (typeof document === 'undefined') return;
  const label = open ? 'Open menu' : 'Close menu';
  document.querySelector<HTMLButtonElement>(`button[aria-expanded][aria-label="${label}"]`)?.click();
}
