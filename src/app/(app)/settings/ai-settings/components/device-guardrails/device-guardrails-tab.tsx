'use client';
'use no memo';

import {
  LoadError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useTenantRemoteAccessPolicy,
  useUpdateTenantRemoteAccessPolicy,
} from '@/app/(app)/devices/hooks/use-remote-access-policy';
import {
  REMOTE_ACCESS_MODE_META,
  REMOTE_ACCESS_MODES,
  type TenantRemoteAccessPolicy,
} from '@/app/(app)/devices/types/remote-access';
import { InfoCell } from '@/app/components/shared/info-cell';

export const DEVICE_GUARDRAILS_FORM_ID = 'ai-settings-device-guardrails-form';

// TEMPORARY (decision 2026-09-18): the approval timeout, delivery timeout and
// the two fallback settings are hidden from this tab. The policy model keeps
// them (TenantRemoteAccessPolicy / CU-86akeqw6h) and Save carries the stored
// values through untouched, so bringing the fields back is a UI-only change.
const deviceGuardrailsSchema = z.object({
  mode: z.enum(REMOTE_ACCESS_MODES),
});

type DeviceGuardrailsFormValues = z.infer<typeof deviceGuardrailsSchema>;

interface DeviceGuardrailsTabProps {
  /** Driven by the shared AI Settings edit mode. */
  isEditMode: boolean;
  /** Called after a successful save so the parent can exit edit mode. */
  onSaved: () => void;
}

/**
 * "Device Guardrails" tab on AI Settings (CU-86akeqw8b): the tenant-default
 * remote access permission from the policy model on CU-86akeqw6h. Edit mode +
 * Save are owned by the shared AiSettingsLayout actions; Save submits this
 * form via DEVICE_GUARDRAILS_FORM_ID.
 *
 * The mode card follows the access-level designs. The timeout/fallback
 * settings of the same policy are temporarily hidden (see the schema note).
 */
export function DeviceGuardrailsTab({ isEditMode, onSaved }: DeviceGuardrailsTabProps) {
  const { data: policy, isLoading, error, refetch } = useTenantRemoteAccessPolicy();

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-md" />;
  }

  if (error || !policy) {
    return (
      <LoadError
        message="Couldn't load remote access settings. The service may be temporarily unavailable."
        onRetry={() => void refetch()}
      />
    );
  }

  return isEditMode ? (
    <DeviceGuardrailsForm policy={policy} onSaved={onSaved} />
  ) : (
    <DeviceGuardrailsView policy={policy} />
  );
}

function DeviceGuardrailsView({ policy }: { policy: TenantRemoteAccessPolicy }) {
  return (
    /* Same "table-cell" card as the customer tab: 60px/12px padding on
       mobile, 80px/16px from md (`--spacing-system-m` is that 12->16 step). */
    <div className="flex min-h-[60px] items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] md:min-h-20">
      <InfoCell value={REMOTE_ACCESS_MODE_META[policy.mode].label} label="Default Remote Access Permission" />
    </div>
  );
}

function DeviceGuardrailsForm({ policy, onSaved }: { policy: TenantRemoteAccessPolicy; onSaved: () => void }) {
  const { toast } = useToast();
  const { mutateAsync: updatePolicy } = useUpdateTenantRemoteAccessPolicy();

  const form = useForm<DeviceGuardrailsFormValues>({
    resolver: zodResolver(deviceGuardrailsSchema),
    defaultValues: { mode: policy.mode },
  });

  const handleSubmit = form.handleSubmit(async values => {
    try {
      // The hidden timeout/fallback fields are sent back as stored.
      await updatePolicy({ ...policy, ...values });
      toast({ title: 'Saved', description: 'Remote access settings updated', variant: 'success' });
      onSaved();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Failed to save remote access settings',
        variant: 'destructive',
      });
    }
  });

  return (
    <form id={DEVICE_GUARDRAILS_FORM_ID} onSubmit={handleSubmit}>
      <Controller
        name="mode"
        control={form.control}
        render={({ field, fieldState }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger label="Default Remote Access Permission" error={fieldState.error?.message}>
              {/* Children override Radix's default item mirror: the closed
                  trigger shows only the label (per the design), while the open
                  list keeps the two-line label + description items. */}
              <SelectValue placeholder="Select a permission">{REMOTE_ACCESS_MODE_META[field.value].label}</SelectValue>
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
        )}
      />
    </form>
  );
}
