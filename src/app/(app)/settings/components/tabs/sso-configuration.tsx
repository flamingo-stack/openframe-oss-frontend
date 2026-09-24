'use client';

import {
  PasscodeIcon,
  PenEditIcon,
  PlusCircleIcon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Card,
  CheckboxWithDescription,
  type ColumnDef,
  DataTable,
  Input,
  PageError,
  PageLayout,
  type Row,
  Skeleton,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { routes } from '@/lib/routes';
import { type AvailableProvider, type ProviderConfig, useSsoConfig } from '../../hooks/use-sso-config';
import { type TenantDomainInfo, useTenantDomain } from '../../hooks/use-tenant-domain';
import { DisableOpenframeSsoModal } from '../disable-openframe-sso-modal';
import { SsoConfigModal } from '../edit-sso-config-modal';
import { SsoConfigurationDetailsModal } from '../sso-configuration-details-modal';

type UiProviderRow = {
  id: string;
  provider: string;
  displayName: string;
  status: { label: string; variant: 'success' | 'grey' };
  hasConfig: boolean;
  allowedDomains: string[];
  autoProvisionUsers: boolean;
  original?: { available: AvailableProvider; config?: ProviderConfig };
};

export function SsoConfigurationTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [providers, setProviders] = useState<UiProviderRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    providerKey: string;
    displayName: string;
    clientId?: string | null;
    clientSecret?: string | null;
    msTenantId?: string | null;
    autoProvisionUsers?: boolean;
    allowedDomains?: string[];
  } | null>(null);

  // Providers the backend offers that have no stored configuration yet —
  // the options behind "Add SSO Configuration".
  const [availableForCreate, setAvailableForCreate] = useState<AvailableProvider[]>([]);

  // Configuration Details flow: a row click opens the read-only view; disable
  // and delete go through their confirmation dialogs from there.
  const [detailsRow, setDetailsRow] = useState<UiProviderRow | null>(null);
  const [providerConfirm, setProviderConfirm] = useState<'disable' | 'delete' | null>(null);
  const [isProviderActionPending, setIsProviderActionPending] = useState(false);

  // Shared SSO provider state
  const [tenantDomain, setTenantDomain] = useState<TenantDomainInfo | null>(null);
  const [isDomainLoading, setIsDomainLoading] = useState(true);
  const [isAutoProvisionUpdating, setIsAutoProvisionUpdating] = useState(false);

  // Built-in OpenFrame login, backed by the 'openframe' pseudo-provider. `null`
  // means the backend doesn't support the toggle — the row is hidden then.
  const [openframeSso, setOpenframeSso] = useState<{ enabled: boolean } | null>(null);
  const [isOpenframeLoading, setIsOpenframeLoading] = useState(true);
  const [isOpenframeUpdating, setIsOpenframeUpdating] = useState(false);
  const [isDisableOpenframeOpen, setIsDisableOpenframeOpen] = useState(false);

  const {
    fetchAvailableProviders,
    fetchProviderConfig,
    updateProviderConfig,
    toggleProviderEnabled,
    deleteProviderConfig,
  } = useSsoConfig();
  const { fetchTenantDomain, updateSharedAutoProvision } = useTenantDomain();
  const { toast } = useToast();
  const handleBack = useSafeBack(routes.settings.root());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1) Fetch available providers
      const available = await fetchAvailableProviders();

      // 2) For each provider fetch its config in parallel
      const configs = await Promise.all(available.map(p => fetchProviderConfig(p.provider)));

      // The table lists stored configurations only; providers without one feed
      // the "Add SSO Configuration" dropdown instead.
      const rows: UiProviderRow[] = [];
      const unconfigured: AvailableProvider[] = [];
      available.forEach((p, idx) => {
        const cfg = configs[idx];
        if (!cfg) {
          unconfigured.push(p);
          return;
        }
        const isEnabled = cfg.enabled === true;
        rows.push({
          id: p.provider,
          provider: p.provider,
          displayName: p.displayName,
          status: {
            label: isEnabled ? 'ACTIVE' : 'INACTIVE',
            variant: isEnabled ? 'success' : 'grey',
          },
          hasConfig: Boolean(cfg.clientId || cfg.clientSecret),
          allowedDomains: cfg.allowedDomains || [],
          autoProvisionUsers: cfg.autoProvisionUsers || false,
          original: { available: p, config: cfg },
        });
      });

      setProviders(rows);
      setAvailableForCreate(unconfigured);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSO providers');
    } finally {
      setIsLoading(false);
    }
  }, [fetchAvailableProviders, fetchProviderConfig]);

  // Load tenant domain info for shared SSO provider
  const loadDomainData = useCallback(async () => {
    setIsDomainLoading(true);
    try {
      const domainInfo = await fetchTenantDomain();
      setTenantDomain(domainInfo);
    } catch (err) {
      console.error('Failed to load tenant domain:', err);
      // Don't set error state - shared SSO section will just not show
      setTenantDomain(null);
    } finally {
      setIsDomainLoading(false);
    }
  }, [fetchTenantDomain]);

  // The 'openframe' pseudo-provider backs the tenant-wide built-in login toggle.
  // Older backends 404 on it (fetchProviderConfig -> undefined); any other
  // failure also hides the row rather than blocking the page.
  const loadOpenframeSso = useCallback(async () => {
    setIsOpenframeLoading(true);
    try {
      const cfg = await fetchProviderConfig('openframe');
      setOpenframeSso(cfg ? { enabled: cfg.enabled === true } : null);
    } catch (err) {
      console.error('Failed to load OpenFrame SSO state:', err);
      setOpenframeSso(null);
    } finally {
      setIsOpenframeLoading(false);
    }
  }, [fetchProviderConfig]);

  const openDetails = useCallback((row: UiProviderRow) => setDetailsRow(row), []);

  // Enable (direct) and disable (after confirmation) for a provider from Configuration Details.
  const setProviderEnabled = useCallback(
    async (provider: string, displayName: string, enabled: boolean) => {
      setIsProviderActionPending(true);
      try {
        await toggleProviderEnabled(provider, enabled);
        toast({
          title: enabled ? 'SSO Enabled' : 'SSO Disabled',
          description: `${displayName} has been ${enabled ? 'enabled' : 'disabled'}`,
          variant: 'success',
        });
        setProviderConfirm(null);
        setDetailsRow(null);
        await loadData();
      } catch (err) {
        toast({
          title: 'Action failed',
          description: err instanceof Error ? err.message : `Failed to ${enabled ? 'enable' : 'disable'} SSO`,
          variant: 'destructive',
        });
      } finally {
        setIsProviderActionPending(false);
      }
    },
    [toggleProviderEnabled, toast, loadData],
  );

  // Deleting frees the provider — it returns to the "Add SSO Configuration" options.
  const deleteProvider = useCallback(
    async (provider: string, displayName: string) => {
      setIsProviderActionPending(true);
      try {
        await deleteProviderConfig(provider);
        toast({
          title: 'Configuration Deleted',
          description: `${displayName} configuration has been deleted`,
          variant: 'success',
        });
        setProviderConfirm(null);
        setDetailsRow(null);
        await loadData();
      } catch (err) {
        toast({
          title: 'Delete failed',
          description: err instanceof Error ? err.message : 'Failed to delete SSO configuration',
          variant: 'destructive',
        });
      } finally {
        setIsProviderActionPending(false);
      }
    },
    [deleteProviderConfig, toast, loadData],
  );

  const setOpenframeEnabled = useCallback(
    async (enabled: boolean) => {
      setIsOpenframeUpdating(true);
      try {
        await toggleProviderEnabled('openframe', enabled);
        setOpenframeSso({ enabled });
        setIsDisableOpenframeOpen(false);
        toast({
          title: enabled ? 'OpenFrame SSO Enabled' : 'OpenFrame SSO Disabled',
          description: enabled
            ? 'Users can sign up and sign in with an OpenFrame account again.'
            : 'The OpenFrame sign-in option is now hidden from the login page.',
          variant: 'success',
          duration: 4000,
        });
      } catch (err) {
        toast({
          title: 'Update Failed',
          description: err instanceof Error ? err.message : 'Failed to update OpenFrame SSO',
          variant: 'destructive',
          duration: 5000,
        });
      } finally {
        setIsOpenframeUpdating(false);
      }
    },
    [toggleProviderEnabled, toast],
  );

  // Re-enabling is immediate; disabling goes through the confirmation modal.
  const handleOpenframeCheckedChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        void setOpenframeEnabled(true);
      } else {
        setIsDisableOpenframeOpen(true);
      }
    },
    [setOpenframeEnabled],
  );

  // Handle shared auto provision toggle
  const handleAutoProvisionToggle = useCallback(
    async (enabled: boolean) => {
      if (!tenantDomain || tenantDomain.generic) return;

      setIsAutoProvisionUpdating(true);
      try {
        const result = await updateSharedAutoProvision(enabled);

        if (result.error) {
          toast({
            title: 'Auto Provision Failed',
            description: result.error.message,
            variant: 'destructive',
            duration: 5000,
          });
          return;
        }

        // Update local state
        setTenantDomain(prev => (prev ? { ...prev, autoAllow: enabled } : null));

        toast({
          title: enabled ? 'Open Access Enabled' : 'Open Access Disabled',
          description: enabled
            ? `Anyone with an account on ${tenantDomain.domain} can now sign in without an invitation.`
            : 'Open access for your domains has been disabled.',
          variant: 'success',
          duration: 4000,
        });
      } catch (err) {
        toast({
          title: 'Update Failed',
          description: err instanceof Error ? err.message : 'Failed to update auto provision setting',
          variant: 'destructive',
          duration: 5000,
        });
      } finally {
        setIsAutoProvisionUpdating(false);
      }
    },
    [tenantDomain, updateSharedAutoProvision, toast],
  );

  useEffect(() => {
    loadData();
    loadDomainData();
    loadOpenframeSso();
  }, [loadData, loadDomainData, loadOpenframeSso]);

  // Mobile keeps only the provider, status and the edit action; configuration folds
  // in at tablet and the allowed-domains list at desktop.
  const columns = useMemo<ColumnDef<UiProviderRow>[]>(
    () => [
      {
        accessorKey: 'provider',
        header: 'OAuth Provider',
        cell: ({ row }: { row: Row<UiProviderRow> }) => (
          <div className="flex min-w-0 items-center">
            <div className="flex min-w-0 flex-col justify-center">
              <TruncateText>{row.original.displayName}</TruncateText>
              <TruncateText variant="h5" tone="secondary">
                {row.original.provider}
              </TruncateText>
            </div>
          </div>
        ),
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: Row<UiProviderRow> }) => (
          <Tag className="self-start" label={row.original.status.label} variant={row.original.status.variant} />
        ),
        meta: { width: 'w-auto shrink-0 md:w-[120px]' },
      },
      {
        accessorKey: 'allowedDomains',
        header: 'Allowed Domains',
        cell: ({ row }: { row: Row<UiProviderRow> }) => (
          <TruncateText variant="h4" tone="secondary">
            {row.original.allowedDomains.length > 0 ? row.original.allowedDomains.join(', ') : 'none'}
          </TruncateText>
        ),
        meta: { width: 'w-[220px] shrink-0', hideAt: 'md' },
      },
      {
        accessorKey: 'hasConfig',
        header: 'Configuration',
        cell: ({ row }: { row: Row<UiProviderRow> }) => (
          <TruncateText variant="h4" tone="secondary">
            {row.original.hasConfig ? 'Configured' : 'Not configured'}
          </TruncateText>
        ),
        // The tablet keeps Allowed Domains and folds Configuration first (design 1614-66094).
        meta: { width: 'w-[140px] shrink-0', hideAt: 'lg' },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UiProviderRow> }) => {
          const openEditModal = () =>
            setModalState({
              open: true,
              mode: 'edit',
              providerKey: row.original.provider,
              displayName: row.original.displayName,
              clientId: row.original.original?.config?.clientId,
              clientSecret: row.original.original?.config?.clientSecret,
              msTenantId: row.original.original?.config?.msTenantId,
              autoProvisionUsers: row.original.autoProvisionUsers,
              allowedDomains: row.original.allowedDomains,
            });

          return (
            // A square edit icon button on every breakpoint (designs 1614-66071/66116);
            // it must not trigger the row's Configuration Details click.
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                variant="outline"
                size="icon"
                aria-label={`Edit ${row.original.displayName}`}
                onClick={openEditModal}
                leftIcon={<PenEditIcon />}
              />
            </div>
          );
        },
        enableSorting: false,
        meta: { width: 'w-11 shrink-0 md:w-16', align: 'right' },
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter(p => p.displayName.toLowerCase().includes(term) || p.provider.toLowerCase().includes(term));
  }, [providers, searchTerm]);

  const table = useDataTable<UiProviderRow>({
    data: filtered,
    columns,
    getRowId: (row: UiProviderRow) => row.id,
    enableSorting: false,
  });

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <PageLayout
      title="SSO Configurations"
      className="bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={
        availableForCreate.length > 0
          ? [
              {
                label: 'Add SSO Configuration',
                icon: <PlusCircleIcon />,
                variant: 'accent',
                onClick: () => setModalState({ open: true, mode: 'create', providerKey: '', displayName: '' }),
              },
            ]
          : undefined
      }
    >
      {/* Tenant-wide sign-in options: built-in OpenFrame login + open access for the tenant domain */}
      {isOpenframeLoading || isDomainLoading ? (
        <Card className="border-ods-border bg-ods-card p-4">
          <div className="flex flex-col gap-6">
            {[0, 1].map(row => (
              <div key={row} className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 shrink-0 rounded" />
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-5 w-48 md:w-64" />
                  <Skeleton className="h-4 w-full md:w-96" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        (openframeSso || tenantDomain) && (
          <Card className="overflow-hidden border-ods-border bg-ods-card">
            {openframeSso && (
              <CheckboxWithDescription
                id="openframe-sso-enabled"
                checked={openframeSso.enabled}
                onCheckedChange={handleOpenframeCheckedChange}
                disabled={isOpenframeUpdating}
                title="Enable OpenFrame SSO"
                description="Allow users to sign up and sign in with an OpenFrame account."
                className="items-center rounded-none border-0 bg-transparent [&>button]:mt-0 [&>button]:bg-transparent [&_label]:text-h4"
              />
            )}
            {tenantDomain && (
              <CheckboxWithDescription
                id="shared-auto-provision"
                checked={tenantDomain.autoAllow}
                onCheckedChange={handleAutoProvisionToggle}
                disabled={tenantDomain.generic || isAutoProvisionUpdating}
                title="Open access for your domains"
                description={
                  tenantDomain.generic
                    ? `Generic domains like ${tenantDomain.domain} cannot be used for open access.`
                    : 'Anyone with an account on your allowed domains can sign in to OpenFrame without an invitation. Their account is created automatically the first time they sign in.'
                }
                className={cn(
                  'items-center rounded-none border-0 bg-transparent [&>button]:mt-0 [&>button]:bg-transparent [&_label]:text-h4',
                  openframeSso && 'border-t border-ods-border',
                )}
              />
            )}
          </Card>
        )
      )}

      <Input
        startAdornment={<SearchIcon />}
        placeholder="Search for SSO"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full"
      />

      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount itemName="result" />} />
        <DataTable.Body
          loading={isLoading}
          emptyState={{
            icon: <PasscodeIcon />,
            title: 'No SSO configurations',
            description: 'Set up your first SSO provider',
          }}
          onRowClick={openDetails}
          rowClassName="mb-1"
        />
      </DataTable>
      <SsoConfigModal
        isOpen={Boolean(modalState?.open)}
        onClose={() => setModalState(null)}
        mode={modalState?.mode ?? 'edit'}
        providerOptions={availableForCreate}
        providerKey={modalState?.providerKey || ''}
        providerDisplayName={modalState?.displayName || ''}
        initialClientId={modalState?.clientId}
        initialClientSecret={modalState?.clientSecret}
        initialMsTenantId={modalState?.msTenantId}
        initialAutoProvisionUsers={modalState?.autoProvisionUsers}
        initialAllowedDomains={modalState?.allowedDomains}
        onSubmit={async ({ provider, clientId, clientSecret, msTenantId, autoProvisionUsers, allowedDomains }) => {
          if (!provider) return;
          await updateProviderConfig(provider, {
            clientId,
            clientSecret,
            msTenantId,
            autoProvisionUsers,
            allowedDomains,
          });
          // Also enable the provider after saving
          await toggleProviderEnabled(provider, true);
          // New onboarding has no SSO step, so the activation event fires on the
          // actual provider save+enable (SINGULAR — backend counts it once per user).
          trackDashboardActivity(EVENT_SUBTYPE.ADD_SSO_IDP);
          await loadData();
        }}
      />
      <DisableOpenframeSsoModal
        open={isDisableOpenframeOpen}
        onOpenChange={setIsDisableOpenframeOpen}
        isPending={isOpenframeUpdating}
        onConfirm={() => void setOpenframeEnabled(false)}
      />
      <SsoConfigurationDetailsModal
        isOpen={Boolean(detailsRow)}
        onClose={() => setDetailsRow(null)}
        details={
          detailsRow
            ? {
                provider: detailsRow.provider,
                displayName: detailsRow.displayName,
                isEnabled: detailsRow.status.label === 'ACTIVE',
                clientId: detailsRow.original?.config?.clientId,
                clientSecret: detailsRow.original?.config?.clientSecret,
                allowedDomains: detailsRow.allowedDomains,
              }
            : null
        }
        isPending={isProviderActionPending}
        onEnable={() => detailsRow && void setProviderEnabled(detailsRow.provider, detailsRow.displayName, true)}
        onDisableRequest={() => setProviderConfirm('disable')}
        onDeleteRequest={() => setProviderConfirm('delete')}
      />
      <ConfirmDialog
        open={providerConfirm === 'disable'}
        onOpenChange={open => {
          if (!open) setProviderConfirm(null);
        }}
        title="Confirm Disabling"
        description={
          <>
            Are you sure you want to deactivate <span className="text-ods-error">{detailsRow?.displayName}</span>? This
            SSO configuration will not be available for sign-in until you re-enable it.
          </>
        }
        confirmLabel="Disable Configuration"
        variant="destructive"
        isPending={isProviderActionPending}
        onConfirm={() => {
          if (detailsRow) void setProviderEnabled(detailsRow.provider, detailsRow.displayName, false);
        }}
      />
      <ConfirmDialog
        open={providerConfirm === 'delete'}
        onOpenChange={open => {
          if (!open) setProviderConfirm(null);
        }}
        title="Confirm Deleting"
        description={
          <>
            Are you sure you want to delete <span className="text-ods-error">{detailsRow?.displayName}</span>? This SSO
            configuration will instantly become unavailable for login.
          </>
        }
        confirmLabel="Delete Configuration"
        variant="destructive"
        isPending={isProviderActionPending}
        onConfirm={() => {
          if (detailsRow) void deleteProvider(detailsRow.provider, detailsRow.displayName);
        }}
      />
    </PageLayout>
  );
}
