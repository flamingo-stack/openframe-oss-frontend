'use client';

import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  LoadError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  useOrganizationRemoteAccessPolicy,
  useSetOrganizationRemoteAccessMode,
  useTenantRemoteAccessPolicy,
} from '@/app/(app)/devices/hooks/use-remote-access-policy';
import {
  REMOTE_ACCESS_MODE_META,
  REMOTE_ACCESS_MODES,
  type RemoteAccessMode,
} from '@/app/(app)/devices/types/remote-access';
import { InfoCell } from '@/app/components/shared/info-cell';
import { routes } from '@/lib/routes';

export interface CustomerDeviceGuardrailsHandle {
  /** Persist the selection; the parent "Save Customer" drives this. */
  commit: () => Promise<void>;
}

interface CustomerDeviceGuardrailsSettingsProps {
  organizationId: string;
}

/**
 * "Customer Device Guardrails" block on the customer edit page
 * (CU-86akeqw8b, mockups 505-13898 / 505-13814): the per-organization remote
 * access permission override. Follows the AI guardrails block pattern - a
 * "use default" checkbox with the mode select underneath, no Save button of
 * its own; the page-level "Save Customer" calls `commit()` through the ref.
 */
export const CustomerDeviceGuardrailsSettings = forwardRef<
  CustomerDeviceGuardrailsHandle,
  CustomerDeviceGuardrailsSettingsProps
>(function CustomerDeviceGuardrailsSettingsInner({ organizationId }, ref) {
  const router = useRouter();
  const tenant = useTenantRemoteAccessPolicy();
  const organization = useOrganizationRemoteAccessPolicy(organizationId);
  const { mutateAsync: setOrganizationMode } = useSetOrganizationRemoteAccessMode();

  // null until the user touches the controls; the server value renders
  // underneath so a background refetch can't overwrite an in-progress choice.
  const [choice, setChoice] = useState<{ useDefault: boolean; mode: RemoteAccessMode } | null>(null);

  // isPending, not isLoading: the queries wait for the feature flags to answer, and that wait is loading too.
  const isLoading = tenant.isPending || organization.isPending;
  const savedMode = organization.data?.mode ?? null;
  const tenantMode = tenant.data?.mode ?? 'APPROVAL_REQUIRED';

  const useDefault = choice ? choice.useDefault : savedMode === null;
  const selectedMode: RemoteAccessMode = choice ? choice.mode : (savedMode ?? tenantMode);

  useImperativeHandle(ref, () => ({
    commit: async () => {
      if (!choice || isLoading) return; // untouched - nothing to persist
      const next = choice.useDefault ? null : choice.mode;
      if (next === savedMode) return;
      await setOrganizationMode({ organizationId, mode: next });
    },
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  }

  if (tenant.error || organization.error) {
    return (
      <LoadError
        message="Couldn't load customer device guardrails. The service may be temporarily unavailable."
        onRetry={() => {
          void tenant.refetch();
          void organization.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <CheckboxBlock
        id="use-default-device-guardrails"
        label="Use the default device guardrails"
        description="Inherits all guardrail settings from your global configuration."
        checked={useDefault}
        onCheckedChange={checked => setChoice({ useDefault: Boolean(checked), mode: selectedMode })}
        trailing={
          <Button
            type="button"
            variant="outline"
            onClick={e => {
              e.preventDefault();
              router.push(routes.settings.aiSettings({ tab: 'device-guardrails', edit: true }));
            }}
            leftIcon={<PenEditIcon className="size-5 text-ods-text-secondary" />}
            className="w-full md:w-auto"
          >
            Edit Default Guardrails
          </Button>
        }
      />

      {useDefault ? (
        <div className="flex min-h-[60px] items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] md:min-h-20">
          <InfoCell
            value={<span className="text-ods-text-secondary">{REMOTE_ACCESS_MODE_META[tenantMode].label}</span>}
            label="Default Remote Access Permission"
          />
        </div>
      ) : (
        <div className="md:w-1/2">
          <Select
            value={selectedMode}
            onValueChange={value => setChoice({ useDefault: false, mode: value as RemoteAccessMode })}
          >
            <SelectTrigger label="Default Remote Access Permission">
              {/* Children override Radix's item mirror: label only when closed. */}
              <SelectValue>{REMOTE_ACCESS_MODE_META[selectedMode].label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REMOTE_ACCESS_MODES.map(mode => (
                <SelectItem key={mode} value={mode}>
                  <span className="flex flex-col text-left">
                    <span>{REMOTE_ACCESS_MODE_META[mode].label}</span>
                    <span className="text-ods-text-secondary text-h6">{REMOTE_ACCESS_MODE_META[mode].description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
});
