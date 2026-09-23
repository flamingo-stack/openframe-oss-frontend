'use client';

import { Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  const { status, dispatchedAt } = useFragment(softwareLogStatusCellFragment, execution);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <span className="text-ods-text-primary text-h4">{actionLabel}</span>
        <Tag label={softwareRunStatusLabel(status)} variant={executionStatusVariant(status)} />
      </div>
      <TruncateText variant="h6" tone="secondary">
        {formatDateTime(dispatchedAt)}
      </TruncateText>
    </div>
  );
}
