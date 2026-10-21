'use client';

import { LoadError } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { InfoCircleIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useOrganizationRemoteAccessPolicy } from '@/app/(app)/devices/hooks/use-remote-access-policy';
import { REMOTE_ACCESS_MODE_META } from '@/app/(app)/devices/types/remote-access';
import { InfoCell } from '@/app/components/shared/info-cell';
import { routes } from '@/lib/routes';

interface CustomerDeviceGuardrailsTabProps {
  organizationId: string;
}

/**
 * "Customer Device Guardrails" tab on the customer details page: the
 * organization's remote access permission - the tenant
 * default while the org inherits (with the "Using Default Settings" banner
 * per the design), the org's own mode otherwise. Read-only, like the AI
 * guardrails tab; a per-customer edit flow can build on
 * `setOrganizationMode` once the BE lands.
 */
export function CustomerDeviceGuardrailsTab({ organizationId }: CustomerDeviceGuardrailsTabProps) {
  const router = useRouter();
  const organization = useOrganizationRemoteAccessPolicy(organizationId);

  // isPending, not isLoading: the query waits for the feature flags to answer, and that wait is loading too.
  // While it loads (or the page around it does) the tab draws itself: the static banner for real (most customers
  // inherit the default), the permission card with its label and the mode as a bar.
  const loading = useLoadingScope() || organization.isPending;

  if (!loading && (organization.error || !organization.data)) {
    return (
      <LoadError
        message="Couldn't load customer device guardrails. The service may be temporarily unavailable."
        onRetry={() => {
          void organization.refetch();
        }}
      />
    );
  }

  const data = loading ? undefined : organization.data;
  const inheritsDefault = data ? data.mode === null : true;
  const modeLabel = data ? REMOTE_ACCESS_MODE_META[data.effectiveMode].label : '';

  return (
    <LoadingWhen loading={loading}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {/* One row on every breakpoint (mobile mockup 505-14963): the text column
          shrinks and wraps, the button keeps its full label on the right. */}
        {inheritsDefault && (
          <div className="flex flex-row items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-s)]">
              {/* 16px on mobile, 24px from md - per mockups 505-14963 / 505-13932. */}
              <InfoCircleIcon className="size-4 shrink-0 text-ods-text-secondary content-md:size-6" />
              <div className="flex min-w-0 flex-col">
                <p className="text-ods-text-primary text-h4">Using Default Settings</p>
                <p className="text-ods-text-secondary text-h6">This customer follows guardrails defaults.</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push(routes.settings.aiSettings({ tab: 'device-guardrails', edit: true }))}
              leftIcon={<PenEditIcon className="size-5 text-ods-text-secondary" />}
              className="shrink-0"
            >
              Edit Default Guardrails
            </Button>
          </div>
        )}

        {/* 60px tall with 12px padding on mobile, 80px with 16px from md - the
          `--spacing-system-m` token carries exactly that 12->16 step. */}
        <div className="flex min-h-[60px] items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] content-md:min-h-20">
          <InfoCell
            value={
              !data ? (
                <TextLineSkeleton type="h4" className="w-40" />
              ) : inheritsDefault ? (
                <span className="text-ods-text-secondary">{modeLabel}</span>
              ) : (
                modeLabel
              )
            }
            label="Default Remote Access Permission"
          />
        </div>
      </div>
    </LoadingWhen>
  );
}
