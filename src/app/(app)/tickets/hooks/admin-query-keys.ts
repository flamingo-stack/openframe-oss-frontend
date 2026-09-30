/**
 * Canonical base query keys for tickets/dialogs domains.
 *
 * MULTIPLA-004: all compound query keys for a domain must be built by
 * spreading a single named base key exported from this module, so that
 * invalidation call sites and query call sites stay consistent by
 * construction rather than by convention.
 */

export const DIALOGS_BASE_KEY = ['dialogs'] as const;

export const TICKETS_BASE_KEY = ['tickets'] as const;
