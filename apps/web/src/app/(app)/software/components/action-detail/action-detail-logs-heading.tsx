'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The "Update Logs" / "Install Logs" heading under the summary card. The heading names the action, which is read:
 * `null` while it is (or in a loading scope), drawn as a bar of the heading's line.
 */
export function ActionDetailLogsHeading({ text }: { text: string | null }) {
  const loading = useLoadingScope() || text == null;
  return (
    <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">
      {loading ? <TextLineSkeleton type="h2" as="span" className="w-48" /> : text}
    </h2>
  );
}
