'use client';

import {
  ChatsIcon,
  FileContentIcon,
  MonitorShieldIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ImageUploader,
  PageLayout,
  type TabItem,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes, TAB_IDS } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import { useCustomerForm } from '../hooks/use-customer-form';
import { useCustomerLogo } from '../hooks/use-customer-logo';
import { CustomerAiAssistantAppearance } from './ai-assistant-appearance/customer-ai-assistant-appearance';
import { CustomerAiConfiguration } from './customer-ai-configuration/customer-ai-configuration';
import { CustomerDeviceGuardrailsSettings } from './customer-device-guardrails-settings';
import { CustomerFormFields } from './customer-form-fields';
import { CustomerGuardrailsSettings } from './customer-guardrails-settings';

interface NewCustomerPageProps {
  organizationId: string | null;
}

const [DETAILS_TAB, AI_CONFIGURATION_TAB, GUARDRAILS_TAB, DEVICE_GUARDRAILS_TAB] = TAB_IDS.customerEdit;

/**
 * Create / edit customer. The form lives in `useCustomerForm` (react-hook-form
 * + zod) and `CustomerFormFields`; this page owns the tabs, the logo and the
 * sub-panels. It is compiled by the React Compiler on purpose, so it only
 * passes `form` through and reads the primitives the hook returns — never
 * `form.formState` / `watch()` / `getValues()` in render. Mount it with
 * `key={organizationId}`: the seed is remembered per mount, so switching the
 * `?id=` in place would keep the previous customer's edits.
 */
export function NewCustomerPage({ organizationId }: NewCustomerPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleBack = useSafeBack(organizationId ? routes.customers.details(organizationId) : routes.customers.list());

  const isSaasTenant = runtimeEnv.appMode() === 'saas-tenant';
  const showImageUploader = isSaasTenant;

  // Per-customer AI blocks: SaaS-only (they rely on the openframe-saas-ai-agent
  // service, absent in self-hosted) and edit-mode only (they need an org id to
  // scope the override). When any is visible, the page renders as tabs
  // (Details / AI Configuration / Guardrails).
  //
  // `customer-ai-configuration` switches the AI tab's flow: on → the full
  // Customer AI Configuration (provider/model, answer style, quick actions);
  // off (default) → the legacy appearance-only block, which keeps its original
  // `customer-ai-assistant-settings` gate (pre-session behavior).
  const isFullAiConfig = useFeatureFlag('customer-ai-configuration');
  const customizationEnabled = useFeatureFlag('customer-ai-assistant-settings');
  const guardrailsEnabled = useFeatureFlag('customer-guardrails');
  const showAiConfig = !!organizationId && isSaasTenant && (isFullAiConfig || customizationEnabled);
  const showGuardrails = !!organizationId && isSaasTenant && guardrailsEnabled;
  // Remote access policy (CU-86akeqw8b): not saas-gated - MeshCentral runs in
  // the OSS tenant too. Tri-state gate; `loading` keeps the tab hidden.
  const remoteAccessGate = useRemoteAccessApprovalGate();
  const showDeviceGuardrails = !!organizationId && remoteAccessGate === 'on';
  const showTabs = showAiConfig || showGuardrails || showDeviceGuardrails;

  const editTabs = useMemo<TabItem[]>(
    () => [
      { id: DETAILS_TAB, label: 'Details', icon: FileContentIcon },
      ...(showAiConfig
        ? [
            {
              id: AI_CONFIGURATION_TAB,
              label: isFullAiConfig ? 'Customer AI Configuration' : 'AI-Assistant Appearance',
              icon: ChatsIcon,
            },
          ]
        : []),
      ...(showGuardrails ? [{ id: GUARDRAILS_TAB, label: 'Customer AI Guardrails', icon: ShieldCheckIcon }] : []),
      ...(showDeviceGuardrails
        ? [{ id: DEVICE_GUARDRAILS_TAB, label: 'Customer Device Guardrails', icon: MonitorShieldIcon }]
        : []),
    ],
    [showAiConfig, isFullAiConfig, showGuardrails, showDeviceGuardrails],
  );

  // Tab rides the URL (controlled mode, mirroring customer-details-view) so
  // "Edit Customer" from a details-page tab lands on the matching edit tab and
  // a refresh keeps the current one. Unknown or flag-hidden tab ids fall back
  // to Details. Panels stay mounted across switches, so form state survives.
  const requestedTab = searchParams?.get('tab') ?? DETAILS_TAB;
  const activeTab = editTabs.some(tab => tab.id === requestedTab) ? requestedTab : DETAILS_TAB;
  const handleTabChange = useCallback(
    (tabId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // An invalid submit while another tab is showing: bring Details forward and
  // scroll to the field once its panel is visible. The switch rides the URL, so
  // it lands on a later render — and the scroll helper skips hidden markers.
  const pendingScrollRef = useRef(false);
  const handleInvalid = useCallback(() => {
    if (activeTab === DETAILS_TAB) return;
    pendingScrollRef.current = true;
    handleTabChange(DETAILS_TAB);
  }, [activeTab, handleTabChange]);
  useLayoutEffect(() => {
    if (activeTab !== DETAILS_TAB || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    scrollToFirstInvalidField();
  }, [activeTab]);

  const logo = useCustomerLogo({ organizationId });
  const { form, isEditMode, customerLoaded, isSubmitting, showErrors, handleSave, refs } = useCustomerForm({
    organizationId,
    flushPendingLogo: logo.flushPendingUpload,
    onInvalid: handleInvalid,
  });

  // Editing an existing customer requires its record to have actually arrived;
  // the fields wait with the button. Creating one does not — there is nothing
  // to overwrite.
  const recordPending = isEditMode && !customerLoaded;

  const detailsForm = (
    <CustomerFormFields
      form={form}
      disabled={recordPending}
      showErrors={showErrors}
      logoSlot={
        showImageUploader ? (
          <ImageUploader
            value={logo.displayedImage}
            onChange={logo.handleImageChange}
            onRemove={logo.handleImageRemove}
            objectFit="contain"
            label="Customer Logo"
            description="(Click here or drag and drop)"
          />
        ) : undefined
      }
    />
  );

  return (
    <PageLayout
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      title={organizationId ? 'Edit Customer' : 'New Customer'}
      backButton={{
        label: 'Back',
        onClick: handleBack,
      }}
      actionsVariant="primary-buttons"
      actions={[
        {
          label: isSubmitting ? 'Saving...' : 'Save Customer',
          variant: 'accent',
          onClick: handleSave,
          disabled: isSubmitting || recordPending,
          loading: isSubmitting,
        },
      ]}
    >
      {showTabs && organizationId ? (
        <TabNavigation tabs={editTabs} activeTab={activeTab} onTabChange={handleTabChange}>
          {activeId => (
            // Every panel stays mounted (inactive ones hidden via CSS): the
            // details form state and the AI blocks' imperative refs must
            // survive tab switches so one "Save Customer" persists them all.
            <div className="pt-[var(--spacing-system-l)]">
              <div className={activeId === DETAILS_TAB ? undefined : 'hidden'}>{detailsForm}</div>
              {showAiConfig && (
                <div className={activeId === AI_CONFIGURATION_TAB ? undefined : 'hidden'}>
                  {isFullAiConfig ? (
                    <CustomerAiConfiguration ref={refs.aiConfigurationRef} organizationId={organizationId} />
                  ) : (
                    <CustomerAiAssistantAppearance ref={refs.appearanceRef} organizationId={organizationId} />
                  )}
                </div>
              )}
              {showGuardrails && (
                <div className={activeId === GUARDRAILS_TAB ? undefined : 'hidden'}>
                  <CustomerGuardrailsSettings ref={refs.guardrailsRef} organizationId={organizationId} />
                </div>
              )}
              {showDeviceGuardrails && (
                <div className={activeId === DEVICE_GUARDRAILS_TAB ? undefined : 'hidden'}>
                  <CustomerDeviceGuardrailsSettings ref={refs.deviceGuardrailsRef} organizationId={organizationId} />
                </div>
              )}
            </div>
          )}
        </TabNavigation>
      ) : (
        detailsForm
      )}
    </PageLayout>
  );
}
