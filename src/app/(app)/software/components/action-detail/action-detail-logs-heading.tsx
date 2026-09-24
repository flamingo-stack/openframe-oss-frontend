import type { ReactNode } from 'react';

/** The "Update Logs" / "Install Logs" heading under the summary card. */
export function ActionDetailLogsHeading({ children }: { children: ReactNode }) {
  return <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">{children}</h2>;
}
