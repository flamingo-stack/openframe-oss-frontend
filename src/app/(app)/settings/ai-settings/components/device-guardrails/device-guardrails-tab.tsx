'use client';
'use no memo';

import {
  Input,
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
import { type Control, Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useTenantRemoteAccessPolicy,
  useUpdateTenantRemoteAccessPolicy,
} from '@/app/(app)/devices/hooks/use-remote-access-policy';
import {
  REMOTE_ACCESS_FALLBACK_META,
  REMOTE_ACCESS_FALLBACKS,
  REMOTE_ACCESS_MODE_META,
  REMOTE_ACCESS_MODES,
  type RemoteAccessFallback,
  type TenantRemoteAccessPolicy,
} from '@/app/(app)/devices/types/remote-access';
import { InfoCell } from '@/app/components/shared/info-cell';

export const DEVICE_GUARDRAILS_FORM_ID = 'ai-settings-device-guardrails-form';

const timeoutField = (min: number, max: number) =>
  z
    .number('Enter a number of seconds')
    .int('Whole seconds only')
    .min(min, `At least ${min}s`)
    .max(max, `At most ${max}s`);

const deviceGuardrailsSchema = z.object({
  mode: z.enum(REMOTE_ACCESS_MODES),
  approvalTimeoutSeconds: timeoutField(10, 600),
  deliveryTimeoutSeconds: timeoutField(1, 60),
  noClientFallback: z.enum(REMOTE_ACCESS_FALLBACKS),
  noAnswerFallback: z.enum(REMOTE_ACCESS_FALLBACKS),
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
 * remote access permission plus the approval timeout/fallback settings from
 * the policy model on CU-86akeqw6h. Edit mode + Save are owned by the shared
 * AiSettingsLayout actions; Save submits this form via DEVICE_GUARDRAILS_FORM_ID.
 *
 * The mode card follows the access-level designs; the timeout/fallback form
 * has no mockups by design decision - it reuses the guardrails panel layout.
 */
export function DeviceGuardrailsTab({ isEditMode, onSaved }: DeviceGuardrailsTabProps) {
  const { data: policy, isLoading, error, refetch } = useTenantRemoteAccessPolicy();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
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
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {/* Same "table-cell" card as the customer tab: 60px/12px padding on
          mobile, 80px/16px from md (`--spacing-system-m` is that 12->16 step). */}
      <div className="flex min-h-[60px] items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] md:min-h-20">
        <InfoCell value={REMOTE_ACCESS_MODE_META[policy.mode].label} label="Default Remote Access Permission" />
      </div>

      <div className="grid grid-cols-1 gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)] md:grid-cols-2">
        <InfoCell value={`${policy.approvalTimeoutSeconds} seconds`} label="Approval Timeout" />
        <InfoCell value={`${policy.deliveryTimeoutSeconds} seconds`} label="Delivery Timeout" />
        <InfoCell
          value={REMOTE_ACCESS_FALLBACK_META[policy.noClientFallback].label}
          label="If No Client Is Connected"
        />
        <InfoCell
          value={REMOTE_ACCESS_FALLBACK_META[policy.noAnswerFallback].label}
          label="If The User Does Not Answer"
        />
      </div>
    </div>
  );
}

function DeviceGuardrailsForm({ policy, onSaved }: { policy: TenantRemoteAccessPolicy; onSaved: () => void }) {
  const { toast } = useToast();
  const { mutateAsync: updatePolicy } = useUpdateTenantRemoteAccessPolicy();

  const form = useForm<DeviceGuardrailsFormValues>({
    resolver: zodResolver(deviceGuardrailsSchema),
    defaultValues: policy,
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
    <form
      id={DEVICE_GUARDRAILS_FORM_ID}
      onSubmit={handleSubmit}
      className="flex flex-col gap-[var(--spacing-system-l)]"
    >
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

      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:gap-[var(--spacing-system-l)]">
        <div className="min-w-0 flex-1">
          <TimeoutInput name="approvalTimeoutSeconds" label="Approval Timeout (seconds)" control={form.control} />
        </div>
        <div className="min-w-0 flex-1">
          <TimeoutInput name="deliveryTimeoutSeconds" label="Delivery Timeout (seconds)" control={form.control} />
        </div>
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:gap-[var(--spacing-system-l)]">
        <div className="min-w-0 flex-1">
          <FallbackSelect name="noClientFallback" label="If No Client Is Connected" control={form.control} />
        </div>
        <div className="min-w-0 flex-1">
          <FallbackSelect name="noAnswerFallback" label="If The User Does Not Answer" control={form.control} />
        </div>
      </div>
    </form>
  );
}

function TimeoutInput({
  name,
  label,
  control,
}: {
  name: 'approvalTimeoutSeconds' | 'deliveryTimeoutSeconds';
  label: string;
  control: Control<DeviceGuardrailsFormValues>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Input
          type="number"
          label={label}
          value={Number.isNaN(field.value) ? '' : field.value}
          // An empty field must fail validation as "missing", not coerce to 0.
          onChange={e => field.onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

function FallbackSelect({
  name,
  label,
  control,
}: {
  name: 'noClientFallback' | 'noAnswerFallback';
  label: string;
  control: Control<DeviceGuardrailsFormValues>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Select value={field.value} onValueChange={value => field.onChange(value as RemoteAccessFallback)}>
          <SelectTrigger label={label} error={fieldState.error?.message}>
            <SelectValue placeholder="Select a fallback" />
          </SelectTrigger>
          <SelectContent>
            {REMOTE_ACCESS_FALLBACKS.map(fallback => (
              <SelectItem key={fallback} value={fallback}>
                {REMOTE_ACCESS_FALLBACK_META[fallback].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
