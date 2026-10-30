'use client';

import {
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  TabContent,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core';
import {
  BoxArchiveIcon,
  PenEditIcon,
  Refresh01RightIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useTenantManagementGate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { getFullImageUrl } from '@/lib/image-url';
import { type CustomerDetailTab, type CustomerEditTab, routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { useCustomerArchive } from '../hooks/use-customer-archive';
import { customerDetailsQueryKeys, useCustomerDetails } from '../hooks/use-customer-details';
import { customersQueryKeys } from '../hooks/use-customers';
import { ArchiveCustomerModal } from './archive-customer-modal';
import {
  CUSTOM_AI_ASSISTANT_TAB_ID,
  CUSTOMER_DEVICE_GUARDRAILS_TAB_ID,
  CUSTOMER_GUARDRAILS_TAB_ID,
  CUSTOMER_GROUPS_TAB_ID,
  CUSTOMER_USERS_TAB_ID,
  getCustomerTabComponent,
  getCustomerTabs,
} from './details-tabs/customer-tabs';
import { RestoreCustomerModal } from './restore-customer-modal';

interface CustomerDetailsViewProps {
  id: string;
}

// Details-page tabs with a counterpart on the edit page ("Edit Customer"
// deep-links into it); unmapped tabs land on the edit page's Details tab.
const DETAIL_TO_EDIT_TAB: Partial<Record<CustomerDetailTab, CustomerEditTab>> = {
  [CUSTOM_AI_ASSISTANT_TAB_ID]: 'ai-configuration',
  [CUSTOMER_GUARDRAILS_TAB_ID]: 'guardrails',
  [CUSTOMER_DEVICE_GUARDRAILS_TAB_ID]: 'device-guardrails',
};

export function CustomerDetailsView({ id }: CustomerDetailsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get('tab') ?? 'devices';

  // Controlled mode for TabNavigation: derive activeTab from URL directly.
  // This avoids a flicker bug in TabNavigation's `urlSync` mode where its
  // internal URL-sync effect fires after an urgent state update but before
  // `router.replace` has propagated, briefly resetting the active tab to the
  // URL's previous value.
  const handleTabChange = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const { organization, isLoading, error } = useCustomerDetails(id);

  // The customer AI-assistant and guardrails tabs read per-org settings from the
  // openframe-saas-ai-agent service (/chat/graphql), so they're saas-tenant only.
  const isSaasTenant = runtimeEnv.appMode() === 'saas-tenant';
  // Remote access policy: not saas-gated - MeshCentral runs in
  // the OSS tenant too. Tri-state gate: the tab is kept while the gate reads (its likely answer; a deep link to it
  // draws it in a loading scope below); it hides only on 'off'.
  const deviceGuardrailsGate = useRemoteAccessApprovalGate();
  const deviceGuardrailsGateLoading = deviceGuardrailsGate === 'loading';
  const showDeviceGuardrails = deviceGuardrailsGate !== 'off';
  // Directory users and groups: the same tri-state treatment, and SaaS only — the flag is never on for an OSS tenant, which
  // must not see the tabs while the flag reads.
  const directoryGate = useTenantManagementGate();
  const directoryGateLoading = directoryGate === 'loading';
  const showDirectory = isSaasTenant && directoryGate !== 'off';
  const tabs = useMemo(
    () =>
      getCustomerTabs({
        showDirectory,
        showCustomAiAssistant: isSaasTenant,
        showGuardrails: isSaasTenant,
        showDeviceGuardrails,
      }),
    [showDirectory, isSaasTenant, showDeviceGuardrails],
  );
  const activeTab = (tabs.some(tab => tab.id === requestedTab) ? requestedTab : 'devices') as CustomerDetailTab;

  // Register this organization as the Mingo "open view".
  useTrackOpenView(
    organization ? { type: CONTEXT_ENTITY_KIND.ORGANIZATION, id, label: organization.name || id } : null,
    { loading: isLoading },
  );
  const { checkCanArchive, archiveOrganization, restoreOrganization } = useCustomerArchive();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [canArchive, setCanArchive] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const isArchived = organization?.status === 'ARCHIVED';

  const handleBack = useSafeBack(isArchived ? routes.customers.list({ tab: 'archived' }) : routes.customers.list());

  const handleArchiveClick = useCallback(async () => {
    if (!organization) return;
    setIsChecking(true);
    try {
      const result = await checkCanArchive(organization.organizationId);
      setCanArchive(result);
      setArchiveModalOpen(true);
    } catch {
      setCanArchive(false);
      setArchiveModalOpen(true);
    } finally {
      setIsChecking(false);
    }
  }, [organization, checkCanArchive]);

  const handleArchiveConfirm = useCallback(async () => {
    if (!organization) return;
    setIsPending(true);
    try {
      await archiveOrganization(organization.organizationId);
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: customerDetailsQueryKeys.detail(id) });
      toast({ title: 'Customer archived', description: `${organization.name} was archived` });
      router.push(routes.customers.list({ tab: 'archived' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to archive customer';
      toast({ title: 'Archive failed', description: msg, variant: 'destructive' });
    } finally {
      setIsPending(false);
    }
  }, [organization, archiveOrganization, queryClient, id, toast, router]);

  const handleRestoreConfirm = useCallback(async () => {
    if (!organization) return;
    setIsPending(true);
    try {
      await restoreOrganization(organization.organizationId);
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: customerDetailsQueryKeys.detail(id) });
      toast({ title: 'Customer restored', description: `${organization.name} was restored` });
      router.push(routes.customers.list());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to restore customer';
      toast({ title: 'Restore failed', description: msg, variant: 'destructive' });
    } finally {
      setIsPending(false);
    }
  }, [organization, restoreOrganization, queryClient, id, toast, router]);

  const actions = useMemo<PageActionButton[]>(() => {
    if (!organization) return [];
    const archiveAction: PageActionButton = isArchived
      ? {
          label: 'Restore Customer',
          variant: 'outline',
          icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
          onClick: () => setRestoreModalOpen(true),
          disabled: organization.isDefault,
        }
      : {
          label: 'Archive Customer',
          variant: 'outline',
          icon: <BoxArchiveIcon className="h-5 w-5 text-ods-text-secondary" />,
          onClick: handleArchiveClick,
          disabled: organization.isDefault || isChecking,
          loading: isChecking,
        };

    // Land on the edit tab matching the currently open details tab; tabs
    // without an edit counterpart fall back to the edit page's default.
    const editHref = routes.customers.edit(id, { tab: DETAIL_TO_EDIT_TAB[activeTab] });
    // A client-side push, not `href`: the save on the edit page returns with
    // `router.back()`, and only an in-document navigation keeps the details
    // page on the query cache the save has just updated. A link that opens a
    // new document comes back from the browser's back-forward cache instead,
    // with the values from before the save.
    const editAction: PageActionButton = {
      label: 'Edit Customer',
      variant: 'outline',
      icon: <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />,
      onClick: () => router.push(editHref),
    };

    return [archiveAction, editAction];
  }, [organization, isArchived, isChecking, handleArchiveClick, id, activeTab, router]);

  // While the customer loads the page draws itself in a loading scope (`LoadingWhen` below): the header its own
  // skeleton, the tab strip for real (static labels), and the open tab its own loading state. A tab that needs only
  // the id has it from the URL, so its read starts at once.
  const loading = useLoadingScope() || isLoading;

  if (!loading && error) {
    return <LoadError message={`Error loading customer: ${error}`} />;
  }

  if (!loading && !organization) {
    return <NotFoundError message="Customer not found" />;
  }

  const subtitleParts = [organization?.website, organization?.industry].filter(Boolean);
  // `''` while loading: the header draws the subtitle row as a skeleton.
  const subtitle = loading ? '' : subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined;

  const logoSrc = organization ? getFullImageUrl(organization.imageUrl, organization.imageHash) : undefined;

  return (
    <>
      <LoadingWhen loading={loading}>
        <PageLayout
          loading={loading}
          loadingActions={loading}
          title={organization ? organization.name || 'Customer' : ''}
          subtitle={subtitle}
          image={{ src: logoSrc || '', alt: organization?.name || 'Customer' }}
          className="content-md:px-[var(--spacing-system-l)] content-md:pb-[var(--spacing-system-l)]"
          backButton={{
            label: 'Back',
            onClick: handleBack,
          }}
          actions={actions}
          contentClassName="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] content-md:px-0 content-md:pb-0"
          headerVariant="card"
        >
          <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} staticLabels>
            {tab => (
              <LoadingWhen
                loading={
                  (tab === CUSTOMER_DEVICE_GUARDRAILS_TAB_ID && deviceGuardrailsGateLoading) ||
                  ((tab === CUSTOMER_USERS_TAB_ID || tab === CUSTOMER_GROUPS_TAB_ID) && directoryGateLoading)
                }
              >
                <TabContent
                  activeTab={tab}
                  TabComponent={getCustomerTabComponent(tab)}
                  componentProps={{ organizationId: id, organization }}
                />
              </LoadingWhen>
            )}
          </TabNavigation>
        </PageLayout>
      </LoadingWhen>

      <ArchiveCustomerModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        canArchive={canArchive}
        onConfirm={handleArchiveConfirm}
        isPending={isPending}
      />

      <RestoreCustomerModal
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        onConfirm={handleRestoreConfirm}
        isPending={isPending}
      />
    </>
  );
}
