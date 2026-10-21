'use client';

import {
  type ActionsMenuGroup,
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  type PanelRow,
  StackedRowsPanel,
  Tag,
} from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { getPolicyStatus, POLICY_STATUS_CONFIG } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, TagSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { ScriptEditor } from '../../../scripts/shared/components/script-editor';
import { ConfirmDeleteMonitoringModal } from '../../components/confirm-delete-monitoring-modal';
import { TestQuerySection } from '../../components/test-query-section';
import { usePolicies } from '../../hooks/use-policies';
import type { Policy } from '../../types/policies.types';
import { usePolicyDetails } from '../hooks/use-policy-details';
import { usePolicyDevices } from '../hooks/use-policy-devices';
import { PolicyDevicesTable } from './policy-devices-table';

function PolicyStatusTag({ policy }: { policy: Policy }) {
  const config = POLICY_STATUS_CONFIG[getPolicyStatus(policy)];
  return <Tag label={config.label} variant={config.variant} />;
}

interface PolicyDetailsViewProps {
  policyId: string;
}

export function PolicyDetailsView({ policyId }: PolicyDetailsViewProps) {
  const router = useRouter();
  const numericId = parseInt(policyId, 10);
  const isValidId = !isNaN(numericId);

  const { policyDetails, isLoading, error } = usePolicyDetails(isValidId ? numericId : null);
  const { deletePolicy, isDeleting } = usePolicies();
  const { devices: policyDevices, isLoading: isLoadingDevices } = usePolicyDevices();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Stable reference for TestQuerySection (query is read-only on this page).
  const policyQuery = policyDetails?.query || '';
  const getQuery = useCallback(() => policyQuery, [policyQuery]);

  // Register this policy as the Mingo "open view" (passive context) so the agent
  // gets the user's working context on the next message; cleared → recent views.
  useTrackOpenView(
    policyDetails ? { type: CONTEXT_ENTITY_KIND.POLICY, id: policyId, label: policyDetails.name } : null,
  );

  const handleBack = useSafeBack(routes.monitoring.root({ tab: 'policies' }));

  const handleEditPolicy = () => {
    router.push(routes.monitoring.policyEdit(policyId));
  };

  const handleDeletePolicy = () => {
    deletePolicy(numericId, {
      onSuccess: () => router.push(routes.monitoring.root({ tab: 'policies' })),
    });
  };

  if (error) {
    return <LoadError message={`Error loading policy: ${error}`} />;
  }

  if (!isLoading && !policyDetails) {
    return <NotFoundError message="Policy not found" />;
  }
  // While the policy loads the page draws itself without it: every read value is its own bar.
  const policy = isLoading ? null : policyDetails;

  const actions: PageActionButton[] = [
    {
      label: 'Edit Policy',
      icon: <PenEditIcon size={24} className="text-ods-text-secondary" />,
      variant: 'outline',
      onClick: handleEditPolicy,
      disabled: !policy,
    },
  ];

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        {
          id: 'delete-policy',
          label: 'Delete Policy',
          icon: <TrashIcon />,
          onClick: () => setIsDeleteModalOpen(true),
          disabled: isDeleting || !policy,
          danger: true,
        },
      ],
    },
  ];

  const severityColumn = {
    key: 'severity',
    value: policy ? policy.critical ? 'Critical' : 'Low' : <TextLineSkeleton type="h4" as="span" className="w-16" />,
    label: 'Severity',
  };
  const statusColumn = {
    key: 'status',
    value: policy ? <PolicyStatusTag policy={policy} /> : <TagSkeleton />,
    label: 'Status',
  };
  const authorColumn = {
    key: 'author',
    value: policy ? policy.author_name : <TextLineSkeleton type="h4" as="span" className="w-32" />,
    label: 'Author',
  };

  // The meta fields render as one row on desktop and as two separate rows on
  // tablet/mobile. Each is a distinct PanelRow toggled by breakpoint so every
  // line keeps its own divider and padding (matching the Figma responsive specs).
  const policyInfoRows: PanelRow[] = [
    ...(policy?.description
      ? [
          {
            id: 'description',
            columns: [{ key: 'description', value: policy.description, label: 'Description' }],
          },
        ]
      : []),
    // Desktop (lg+): Severity + Status + Author on a single row → 2 rows total.
    {
      id: 'meta-desktop',
      className: 'hidden content-lg:flex content-lg:border-b-0',
      columns: [severityColumn, statusColumn, authorColumn],
    },
    // Tablet & mobile (< lg): split into two rows — Severity + Status, then Author
    // on its own third row. The empty spacer keeps Author at the standard row height.
    {
      id: 'meta-severity-status',
      className: 'content-lg:hidden',
      columns: [severityColumn, statusColumn],
    },
    {
      id: 'meta-author',
      className: 'content-lg:hidden',
      columns: [authorColumn, { key: 'author-spacer' }],
    },
  ];

  return (
    <LoadingWhen loading={!policy}>
      <PageLayout
        title={policy?.name ?? ''}
        backButton={{
          label: 'Back',
          onClick: handleBack,
        }}
        actions={actions}
        menuActions={menuActions}
        actionsVariant="menu-primary"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        {/* Policy Info */}
        <StackedRowsPanel rows={policyInfoRows} />

        {/* Query + inline test block */}
        {(!policy || policy.query) && (
          <div className="mt-[var(--spacing-system-l)] space-y-[var(--spacing-system-xxs)]">
            <h3 className="text-ods-text-secondary text-h5">QUERY</h3>
            <ScriptEditor value={policy?.query ?? ''} shell="sql" readOnly height="300px" />
            {/* 8px gap under the editor, matching the section's internal gap
              (the parent's space-y-1 would give 4px). */}
            <TestQuerySection
              getQuery={getQuery}
              hasQuery={Boolean(policyQuery.trim())}
              devices={policyDevices}
              isLoadingDevices={isLoadingDevices}
              className="!mt-[var(--spacing-system-xsf)]"
            />
          </div>
        )}

        {/* Policy Devices */}
        <div className="mt-6">
          <h1 className="pt-6 text-ods-text-primary text-h2">Devices</h1>
          <div className="pt-4">
            <PolicyDevicesTable
              policyId={numericId}
              assignedHostIds={policy?.hosts_include_any}
              policyQuery={policy?.query}
            />
          </div>
        </div>
        <ConfirmDeleteMonitoringModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          itemName={policy?.name ?? ''}
          itemType="policy"
          onConfirm={handleDeletePolicy}
        />
      </PageLayout>
    </LoadingWhen>
  );
}
