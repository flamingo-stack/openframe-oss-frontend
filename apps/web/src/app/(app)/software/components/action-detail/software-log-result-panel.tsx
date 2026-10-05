'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogResultPanel_execution$key } from '@/__generated__/softwareLogResultPanel_execution.graphql';
import { executionOutput } from '@/app/(app)/scripts/shared/utils/execution-helpers';

const softwareLogResultPanelFragment = graphql`
  fragment softwareLogResultPanel_execution on ScriptExecution {
    stdout
    stderr
    error
  }
`;

interface SoftwareLogResultPanelProps {
  execution: softwareLogResultPanel_execution$key;
  expanded: boolean;
  /** The collapse transition finished — the panel can unmount. */
  onCollapsed: () => void;
}

/**
 * What "Show Result" unfolds: the execution's whole output (see `executionOutput`).
 *
 * Rows animate on grid-template-rows (0fr ↔ 1fr), the app's collapse idiom (see
 * `onboarding-accordion.tsx`), so the panel needs no measured height; the output
 * itself scrolls past 400px, per the design.
 */
export function SoftwareLogResultPanel({ execution, expanded, onCollapsed }: SoftwareLogResultPanelProps) {
  const { stdout, stderr, error } = useFragment(softwareLogResultPanelFragment, execution);
  const output = executionOutput({ stdout, stderr, error });

  return (
    <div
      data-no-row-click
      className={cn(
        'pointer-events-auto grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
      onTransitionEnd={e => {
        if (e.target === e.currentTarget && !expanded) onCollapsed();
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto p-[var(--spacing-system-m)]">
          {output ? (
            <div className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{output}</div>
          ) : (
            <span className="text-ods-text-secondary text-h4">No output</span>
          )}
        </div>
      </div>
    </div>
  );
}
