'use client';

import {
  type ActionsMenuGroup,
  CardLoader,
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  QueryReportTable,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core';
import {
  CheckCircleIcon,
  MonitorIcon,
  PenEditIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { ScriptEditor } from '../../../scripts/shared/components/script-editor';
import { ConfirmDeleteMonitoringModal } from '../../components/confirm-delete-monitoring-modal';
import { TestQuerySection } from '../../components/test-query-section';
import { useQueries } from '../../hooks/use-queries';
import { usePolicyDevices } from '../../policy/hooks/use-policy-devices';
import { useQueryDetails } from '../hooks/use-query-details';
import { useQueryReport } from '../hooks/use-query-report';
import { QueryDevicesTable } from './query-devices-table';

const QUERY_TABS: TabItem[] = [
  { id: 'results', label: 'Query Results', icon: CheckCircleIcon },
  { id: 'devices', label: 'Assigned Devices', icon: MonitorIcon },
];
const QUERY_TAB_IDS = QUERY_TABS.map(t => t.id);
const DEFAULT_QUERY_TAB = 'results';

function formatInterval(seconds: number): string {
  if (seconds === 0) return 'Manual';
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `Every ${Math.floor(seconds / 3600)}h`;
  return `Every ${Math.floor(seconds / 86400)}d`;
}

interface QueryDetailsViewProps {
  queryId: string;
}

export function QueryDetailsView({ queryId }: QueryDetailsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const numericId = parseInt(queryId, 10);
  const isValidId = !isNaN(numericId);

  const { queryDetails, isLoading, error } = useQueryDetails(isValidId ? numericId : null);
  const { rows, isLoading: isReportLoading } = useQueryReport(isValidId ? numericId : null);
  const { deleteQuery, isDeleting } = useQueries();
  const { devices: queryDevices, isLoading: isLoadingDevices } = usePolicyDevices();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Stable reference for TestQuerySection (query is read-only on this page).
  const queryText = queryDetails?.query || '';
  const getQuery = useCallback(() => queryText, [queryText]);

  const requestedTab = searchParams.get('tab') ?? DEFAULT_QUERY_TAB;
  const activeTab = QUERY_TAB_IDS.includes(requestedTab) ? requestedTab : DEFAULT_QUERY_TAB;

  // Controlled tabs: the URL `?tab=` param is the single source of truth.
  const handleTabChange = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Register this query as the Mingo "open view" (passive context) so the agent
  // gets the user's working context on the next message; cleared → recent views.
  useTrackOpenView(queryDetails ? { type: CONTEXT_ENTITY_KIND.QUERY, id: queryId, label: queryDetails.name } : null);

  const handleBack = useSafeBack(routes.monitoring.root({ tab: 'queries' }));

  const handleEditQuery = () => {
    router.push(routes.monitoring.queryEdit(queryId));
  };

  const handleDeleteQuery = () => {
    deleteQuery(numericId, {
      onSuccess: () => router.push(routes.monitoring.root({ tab: 'queries' })),
    });
  };

  if (isLoading) {
    return <CardLoader items={4} />;
  }

  if (error) {
    return <LoadError message={`Error loading query: ${error}`} />;
  }

  if (!queryDetails) {
    return <NotFoundError message="Query not found" />;
  }

  const actions: PageActionButton[] = [
    {
      label: 'Edit Query',
      icon: <PenEditIcon size={24} className="text-ods-text-secondary" />,
      variant: 'outline',
      onClick: handleEditQuery,
    },
  ];

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        {
          id: 'delete-query',
          label: 'Delete Query',
          icon: <TrashIcon />,
          onClick: () => setIsDeleteModalOpen(true),
          disabled: isDeleting,
        },
      ],
    },
  ];

  return (
    <PageLayout
      title={queryDetails.name}
      backButton={{
        label: 'Back',
        onClick: handleBack,
      }}
      actions={actions}
      menuActions={menuActions}
      actionsVariant="menu-primary"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {/* Query Info */}
      <div className="bg-ods-card border border-ods-border rounded-lg p-6">
        {queryDetails.description && (
          <div className="mb-6">
            <p className="text-h4 text-ods-text-primary">{queryDetails.description}</p>
            <p className="text-h6 text-ods-text-secondary mt-1">Description</p>
          </div>
        )}

        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 ${queryDetails.description ? 'border-t border-ods-border pt-4' : ''}`}
        >
          <div>
            <p className="text-h4 text-ods-text-primary">{formatInterval(queryDetails.interval)}</p>
            <p className="text-h6 text-ods-text-secondary mt-1">Frequency</p>
          </div>
        </div>
      </div>

      {/* Query + inline test block */}
      {queryDetails.query && (
        <div className="mt-6 space-y-[var(--spacing-system-xxs)]">
          <h3 className="text-h5 text-ods-text-secondary">QUERY</h3>
          <ScriptEditor value={queryDetails.query} shell="sql" readOnly height="300px" />
          {/* 8px gap under the editor, matching the section's internal gap
              (the parent's space-y would give 4px). */}
          <TestQuerySection
            getQuery={getQuery}
            hasQuery={Boolean(queryText.trim())}
            devices={queryDevices}
            isLoadingDevices={isLoadingDevices}
            className="!mt-[var(--spacing-system-xsf)]"
          />
        </div>
      )}

      {/* Tabs: Query Results / Assigned Devices */}
      <div className="mt-6">
        <TabNavigation tabs={QUERY_TABS} activeTab={activeTab} onTabChange={handleTabChange}>
          {tabId => (
            <div className="mt-6">
              {tabId === 'devices' ? (
                <QueryDevicesTable queryId={numericId} query={queryText} />
              ) : (
                <QueryReportTable
                  data={rows}
                  loading={isReportLoading}
                  emptyMessage="No report results available"
                  columnOrder={['host_name', 'last_fetched']}
                  showExport={false}
                />
              )}
            </div>
          )}
        </TabNavigation>
      </div>
      <ConfirmDeleteMonitoringModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        itemName={queryDetails.name}
        itemType="query"
        onConfirm={handleDeleteQuery}
      />
    </PageLayout>
  );
}
