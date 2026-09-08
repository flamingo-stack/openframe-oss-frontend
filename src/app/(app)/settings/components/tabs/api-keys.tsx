'use client';

import { DocumentIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  BannedIcon,
  CheckCircleIcon,
  EyeIcon,
  PenEditIcon,
  Refresh02VrIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  type ColumnDef,
  DataTable,
  type PageActionButton,
  PageLayout,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDate, formatTime } from '@/lib/format-date';
import { getErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ApiKeyCreatedModal } from '../../components/api-key-created-modal';
import { ApiKeyDetailsModal } from '../../components/api-key-details-modal';
import { CreateApiKeyModal } from '../../components/create-api-key-modal';
import { DisableApiKeyModal } from '../../components/disable-api-key-modal';
import { RegenerateApiKeyModal } from '../../components/regenerate-api-key-modal';
import { type ApiKeyRecord, useApiKeys } from '../../hooks/use-api-keys';

const MENU_ICON = 'w-6 h-6 text-ods-text-secondary';

export function ApiKeysTab() {
  const handleBack = useSafeBack(routes.settings.root());
  const { toast } = useToast();
  const { items, isLoading, error, fetchApiKeys, createApiKey, updateApiKey, regenerateApiKey, setApiKeyEnabled } =
    useApiKeys();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [createdFullKey, setCreatedFullKey] = useState<string | null>(null);
  const [isCreatedOpen, setIsCreatedOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyRecord | null>(null);
  const [isRegenOpen, setIsRegenOpen] = useState(false);
  const [isDisableOpen, setIsDisableOpen] = useState(false);

  useEffect(() => {
    // The hook rethrows; the failure is surfaced through `error` in the table's empty state.
    fetchApiKeys().catch(() => {});
  }, [fetchApiKeys]);

  const openDetails = useCallback((apiKey: ApiKeyRecord) => {
    setSelectedKey(apiKey);
    setDetailsOpen(true);
  }, []);

  // Enabling is applied immediately; disabling goes through a confirmation modal.
  const enableApiKey = useCallback(
    async (apiKey: ApiKeyRecord) => {
      try {
        await setApiKeyEnabled(apiKey.id, true);
        await fetchApiKeys();
        toast({ title: 'API Key Enabled', description: `${apiKey.name} is active again.`, variant: 'success' });
      } catch (err) {
        toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
      }
    },
    [setApiKeyEnabled, fetchApiKeys, toast],
  );

  const renderRowActions = useCallback(
    (apiKey: ApiKeyRecord) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'details',
              label: 'Details',
              icon: <EyeIcon className={MENU_ICON} />,
              onClick: () => openDetails(apiKey),
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: <PenEditIcon className={MENU_ICON} />,
              onClick: () => {
                setSelectedKey(apiKey);
                setIsEditOpen(true);
              },
            },
            {
              id: 'regenerate',
              label: 'Regenerate',
              icon: <Refresh02VrIcon className={MENU_ICON} />,
              onClick: () => {
                setSelectedKey(apiKey);
                setIsRegenOpen(true);
              },
            },
            apiKey.enabled
              ? {
                  id: 'disable',
                  label: 'Disable',
                  // No color class — `danger` paints label and icon via currentColor.
                  icon: <BannedIcon className="h-6 w-6" />,
                  danger: true,
                  onClick: () => {
                    setSelectedKey(apiKey);
                    setIsDisableOpen(true);
                  },
                }
              : {
                  id: 'enable',
                  label: 'Enable',
                  icon: <CheckCircleIcon className={MENU_ICON} />,
                  onClick: () => enableApiKey(apiKey),
                },
          ],
        },
      ];

      return <ActionsMenuDropdown groups={groups} />;
    },
    [openDetails, enableApiKey],
  );

  // Mobile keeps only name/description, status and the actions menu; the rest
  // fold in at tablet (expires), desktop (usage, created) and wide desktop (key id).
  const columns = useMemo<ColumnDef<ApiKeyRecord>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <div className="flex min-w-0 flex-col">
            <TruncateText>{row.original.name}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.description || '—'}
            </TruncateText>
          </div>
        ),
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <Tag
            className="self-start"
            label={row.original.enabled ? 'ACTIVE' : 'INACTIVE'}
            variant={row.original.enabled ? 'success' : 'grey'}
          />
        ),
        meta: { width: 'w-auto shrink-0 md:w-[120px]' },
      },
      {
        accessorKey: 'id',
        header: 'Key ID',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => <TruncateText mono>{row.original.id}</TruncateText>,
        meta: { width: 'w-[240px] shrink-0', hideAt: 'xl' },
      },
      {
        accessorKey: 'totalRequests',
        header: 'Usage',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <TruncateText>{row.original.totalRequests.toLocaleString()}</TruncateText>
        ),
        meta: { width: 'w-[100px] shrink-0', hideAt: 'lg' },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <div className="flex min-w-0 flex-col">
            <TruncateText>{formatDate(row.original.createdAt)}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {formatTime(row.original.createdAt)}
            </TruncateText>
          </div>
        ),
        meta: { width: 'w-[140px] shrink-0', hideAt: 'lg' },
      },
      {
        accessorKey: 'expiresAt',
        header: 'Expires',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <div className="flex min-w-0 flex-col">
            <TruncateText>{row.original.expiresAt ? formatDate(row.original.expiresAt) : '—'}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.expiresAt ? formatTime(row.original.expiresAt) : '—'}
            </TruncateText>
          </div>
        ),
        meta: { width: 'w-[140px] shrink-0', hideAt: 'md' },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<ApiKeyRecord> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
      },
    ],
    [renderRowActions],
  );

  const table = useDataTable<ApiKeyRecord>({
    data: items,
    columns,
    getRowId: (row: ApiKeyRecord) => row.id,
    enableSorting: false,
  });

  const actions: PageActionButton[] = [
    {
      label: 'API Documentation',
      icon: <DocumentIcon className="h-5 w-5" />,
      variant: 'outline',
      onClick: () => window.open('/swagger-ui/index.html#/', '_blank', 'noopener,noreferrer'),
    },
    {
      label: 'Create API Key',
      icon: <PlusCircleIcon iconSize={20} whiteOverlay />,
      variant: 'outline',
      onClick: () => setIsCreateOpen(true),
    },
  ];

  return (
    <PageLayout
      title="API Keys"
      actions={actions}
      className="bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
    >
      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount itemName="API key" />} />
        <DataTable.Body loading={isLoading} emptyMessage={error || 'No API keys found.'} onRowClick={openDetails} />
      </DataTable>
      <CreateApiKeyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        create={createApiKey}
        onCreated={async ({ fullKey }) => {
          setIsCreateOpen(false);
          setCreatedFullKey(fullKey);
          setIsCreatedOpen(true);
          await fetchApiKeys();
        }}
      />
      <ApiKeyCreatedModal
        isOpen={isCreatedOpen}
        fullKey={createdFullKey}
        onClose={() => {
          setIsCreatedOpen(false);
          setCreatedFullKey(null);
        }}
      />
      {/* Edit API Key reuse create modal */}
      <CreateApiKeyModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedKey(null);
        }}
        mode="edit"
        initial={
          selectedKey
            ? {
                id: selectedKey.id,
                name: selectedKey.name,
                description: selectedKey.description,
                expiresAt: selectedKey.expiresAt,
              }
            : undefined
        }
        update={updateApiKey}
        onUpdated={async () => {
          setIsEditOpen(false);
          await fetchApiKeys();
        }}
      />
      <ApiKeyDetailsModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedKey(null);
        }}
        apiKey={selectedKey}
      />
      <RegenerateApiKeyModal
        isOpen={isRegenOpen}
        onClose={() => {
          setIsRegenOpen(false);
        }}
        apiKeyName={selectedKey?.name}
        onConfirm={async () => {
          if (!selectedKey) return;
          try {
            const result = await regenerateApiKey(selectedKey.id);
            await fetchApiKeys();
            setIsRegenOpen(false);
            setCreatedFullKey(result.fullKey);
            setIsCreatedOpen(true);
          } catch (err) {
            toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
          }
        }}
      />
      <DisableApiKeyModal
        isOpen={isDisableOpen}
        onClose={() => {
          setIsDisableOpen(false);
        }}
        apiKeyName={selectedKey?.name}
        onConfirm={async () => {
          if (!selectedKey) return;
          try {
            await setApiKeyEnabled(selectedKey.id, false);
            await fetchApiKeys();
            setIsDisableOpen(false);
            toast({
              title: 'API Key Disabled',
              description: `${selectedKey.name} will stop working until you re-enable it.`,
              variant: 'success',
            });
          } catch (err) {
            toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
          }
        }}
      />
    </PageLayout>
  );
}
