'use client';

/**
 * Inline "this section didn't load" strip, sitting above content that survives
 * the failure — a section's cards, or a table that still shows its toolbar.
 *
 * Deliberately not core-lib's `LoadError`: that renders a bordered card with an
 * icon and a title, i.e. a state that REPLACES the content. Here the content
 * stays on screen with nothing in it, and this only explains why and offers the
 * retry. A section with no surviving content (see `customers-overview.tsx`)
 * wants `LoadError` instead.
 *
 * `onRetry` is optional because retrying is pointless while the query is PAUSED
 * on a known-offline link — the strip then just explains the wait.
 */
export interface SectionLoadErrorProps {
  message: string;
  /** Omitted when retrying cannot work — see `loadErrorProps` in `lib/query-state.ts`. */
  onRetry?: () => void;
}

export function SectionLoadError({ message, onRetry }: SectionLoadErrorProps) {
  return (
    <div role="status" className="flex items-center gap-[var(--spacing-system-xs)] pb-[var(--spacing-system-xs)]">
      <span className="text-ods-text-secondary text-h6">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label={`Retry: ${message}`}
          className="text-ods-accent underline transition-colors text-h6 hover:text-ods-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
        >
          Retry
        </button>
      )}
    </div>
  );
}
