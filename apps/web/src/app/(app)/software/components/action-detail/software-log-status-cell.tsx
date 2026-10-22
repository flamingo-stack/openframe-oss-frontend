'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogStatusCell_execution$key } from '@/__generated__/softwareLogStatusCell_execution.graphql';
import { executionStatusVariant } from '@/app/(app)/scripts/shared/utils/execution-helpers';
import { formatDateTime } from '@/lib/format-date';
import { softwareRunStatusLabel } from './software-run-status';

const softwareLogStatusCellFragment = graphql`
  fragment softwareLogStatusCell_execution on ScriptExecution {
    status
    dispatchedAt
  }
`;

interface SoftwareLogStatusCellProps {
  execution: softwareLogStatusCell_execution$key;
  /** "Update" / "Install" — the first word of the cell. */
  actionLabel: string;
}

/** STATUS column: how this device's run ended (colours are the script lists' own), and when it was dispatched. */
export function SoftwareLogStatusCell({ execution, actionLabel }: SoftwareLogStatusCellProps) {
  // A row still being read (a loading scope) has no fragment to read: the tag and the date draw their bars, and so
  // does the action word until the run it names is read.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogStatusCellFragment, loading ? null : execution);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {actionLabel || !loading ? (
          <span className="text-ods-text-primary text-h4">{actionLabel}</span>
        ) : (
          <TextLineSkeleton type="h4" as="span" className="w-16" />
        )}
        <Tag label={data ? softwareRunStatusLabel(data.status) : ''} variant={executionStatusVariant(data?.status)} />
      </div>
      <TruncateText variant="h6" tone="secondary">
        {data ? formatDateTime(data.dispatchedAt) : ''}
      </TruncateText>
    </div>
  );
}
