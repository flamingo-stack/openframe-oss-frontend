import type { CSSProperties } from 'react';

/**
 * OpenFrame host-grid override for the lib `PageShell` padding. A lib page mounted
 * with `shell={false}` still wraps itself in `page-shell-content`, whose defaults are
 * the hub's wide-page spacing (`px-20 py-10` on desktop). Set as `--page-shell-*` CSS
 * vars on any ancestor, this makes it the app's own page padding instead — the
 * `px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]` every `PageLayout` page
 * carries: flat horizontal spacing, bottom-only vertical, no responsive bump.
 */
export const PAGE_SHELL_OVERRIDE: CSSProperties = {
  '--page-shell-px': 'var(--spacing-system-l)',
  '--page-shell-px-md': 'var(--spacing-system-l)',
  '--page-shell-pt': '0px',
  '--page-shell-pt-md': '0px',
  '--page-shell-pb': 'var(--spacing-system-l)',
  '--page-shell-pb-md': 'var(--spacing-system-l)',
} as CSSProperties;
