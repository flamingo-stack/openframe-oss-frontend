'use client';
'use no memo';

import {
  LoadError,
  LoadingWhen,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useLoadingScope,
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
import { PolicyValueCard } from '@/app/components/shared/policy-value-card';

export const DEVICE_GUARDRAILS_FORM_ID = 'ai-settings-device-guardrails-form';

// The approval timeout, the delivery timeout and the two fallback settings are
// fixed backend constants: the tenant
// policy carries the mode alone, so this form is the mode selector alone.
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
 * "Device Guardrails" tab on AI Settings: the tenant-default remote access
 * permission from the policy model. Edit mode +
 * Save are owned by the shared AiSettingsLayout actions; Save submits this
 * form via DEVICE_GUARDRAILS_FORM_ID.
 *
 * The mode card follows the access-level designs.
 */
export function DeviceGuardrailsTab({ isEditMode, onSaved }: DeviceGuardrailsTabProps) {
  // isPending, not isLoading: the query waits for the feature flags to answer, and that wait is loading too. A page's
  // loading scope is loading as well.
  const { data: policy, isPending, error, refetch } = useTenantRemoteAccessPolicy();
  const loading = useLoadingScope() || isPending;

  // An error is said only once the read has answered.
  if (!loading && (error || !policy)) {
    return (
      <LoadError
        message="Couldn't load remote access settings. The service may be temporarily unavailable."
        onRetry={() => void refetch()}
      />
    );
  }

  // Always mounted, so nothing remounts when the read answers: the card (or, in edit mode, the form's Select) draws its
  // own bar while loading.
  return (
    <LoadingWhen loading={loading} label="Loading remote access settings">
      {isEditMode ? (
        <DeviceGuardrailsForm policy={loading ? null : (policy ?? null)} onSaved={onSaved} />
      ) : (
        <DeviceGuardrailsPolicyCard policy={loading ? null : (policy ?? null)} />
      )}
    </LoadingWhen>
  );
}

const MODE_LABEL = 'Default Remote Access Permission';

/** The policy's mode as a read-only card; with no policy yet, its value is a bar. */
function DeviceGuardrailsPolicyCard({ policy }: { policy: TenantRemoteAccessPolicy | null }) {
  return <PolicyValueCard label={MODE_LABEL} value={policy ? REMOTE_ACCESS_MODE_META[policy.mode].label : null} />;
}

/** The mode selector; with no policy yet (in the tab's loading scope) the Select's value is a bar. */
function DeviceGuardrailsForm({ policy, onSaved }: { policy: TenantRemoteAccessPolicy | null; onSaved: () => void }) {
  const { toast } = useToast();
  const { mutateAsync: updatePolicy } = useUpdateTenantRemoteAccessPolicy();

  const form = useForm<DeviceGuardrailsFormValues>({
    resolver: zodResolver(deviceGuardrailsSchema),
    // `values`, not `defaultValues`: the form is mounted before the policy answers and takes it when it does.
    values: policy ? { mode: policy.mode } : undefined,
  });

  const handleSubmit = form.handleSubmit(async values => {
    try {
      await updatePolicy(values);
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
            <SelectTrigger label={MODE_LABEL} error={fieldState.error?.message}>
              {/* Children override Radix's item mirror, so the closed trigger
                  reads the label straight from the mode, not from a mounted item. */}
              <SelectValue placeholder="Select a permission">
                {field.value ? REMOTE_ACCESS_MODE_META[field.value].label : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REMOTE_ACCESS_MODES.map(mode => (
                <SelectItem key={mode} value={mode} description={REMOTE_ACCESS_MODE_META[mode].description}>
                  {REMOTE_ACCESS_MODE_META[mode].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </form>
  );
}
