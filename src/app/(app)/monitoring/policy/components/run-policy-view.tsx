'use client';

import {
  CardLoader,
  LoadError,
  NotFoundError,
  PageLayout,
  type PanelRow,
  StackedRowsPanel,
} from '@flamingo-stack/openframe-frontend-core';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ScriptEditor } from '../../../scripts/components/script/script-editor';
import { usePolicyDetails } from '../hooks/use-policy-details';

interface RunPolicyViewProps {
  policyId: string;
}

export function RunPolicyView({ policyId }: RunPolicyViewProps) {
  const numericId = parseInt(policyId, 10);
  const isValidId = !Number.isNaN(numericId);

  const { policyDetails, isLoading, error } = usePolicyDetails(isValidId ? numericId : null);

  const handleBack = useSafeBack(
    isValidId ? routes.monitoring.policy(numericId) : routes.monitoring.root({ tab: 'policies' }),
  );

  if (isLoading) {
    return <CardLoader items={3} />;
  }

  if (error) {
    return <LoadError message={`Error loading policy: ${error}`} />;
  }

  if (!policyDetails) {
    return <NotFoundError message="Policy not found" />;
  }

  const policyInfoRows: PanelRow[] = [
    {
      id: 'policy',
      columns: [{ key: 'policy', value: policyDetails.name, label: 'Policy' }],
    },
    ...(policyDetails.description
      ? [
          {
            id: 'description',
            columns: [{ key: 'description', value: policyDetails.description, label: 'Description' }],
          },
        ]
      : []),
    {
      id: 'severity',
      columns: [{ key: 'severity', value: policyDetails.critical ? 'Critical' : 'Low', label: 'Severity' }],
    },
  ];

  return (
    <PageLayout
      title="Run Policy"
      backButton={{
        label: 'Back',
        onClick: handleBack,
      }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <StackedRowsPanel rows={policyInfoRows} />

      {policyDetails.query && (
        <div className="mt-6">
          <h3 className="text-h5 text-ods-text-secondary">QUERY</h3>
          <ScriptEditor value={policyDetails.query} shell="sql" readOnly height="300px" />
        </div>
      )}

      {/* Target selection and live results are added in the follow-up run-flow steps. */}
    </PageLayout>
  );
}
