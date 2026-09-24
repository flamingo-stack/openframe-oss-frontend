/**
 * The chip for software behind its latest version — the same state whether it
 * is the fleet-wide title or one device's copy, so it reads and colours the
 * same: a warning (needs attention), not an error (nothing failed).
 */
export const OUTDATED_TAG = { label: 'Outdated', variant: 'warning' } as const;
