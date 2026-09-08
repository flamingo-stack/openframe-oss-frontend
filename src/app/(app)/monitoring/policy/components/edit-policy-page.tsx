'use client';
'use no memo';

import {
  CardLoader,
  Input,
  Label,
  LoadError,
  NotFoundError,
  PageLayout,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { DeviceSelector } from '@/app/components/shared/device-selector';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import type { Device } from '../../../devices/types/device.types';
import { getFleetHostId } from '../../../devices/utils/device-action-utils';
import { ScriptEditor } from '../../../scripts/shared/components/script-editor';
import { TestQuerySection } from '../../components/test-query-section';
import { usePolicies } from '../../hooks/use-policies';
import { usePolicyDetails } from '../hooks/use-policy-details';
import { usePolicyDevices } from '../hooks/use-policy-devices';
import { usePolicyHosts, useReplacePolicyHosts } from '../hooks/use-policy-hosts';

const policyFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  query: z.string(),
});

type PolicyFormData = z.infer<typeof policyFormSchema>;

interface EditPolicyPageProps {
  policyId: string | null;
}

const getDeviceKey = (d: Device) => {
  const id = getFleetHostId(d);
  return id !== undefined ? String(id) : undefined;
};

export function EditPolicyPage({ policyId }: EditPolicyPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const numericId = policyId ? parseInt(policyId, 10) : null;
  const isExistingPolicy = numericId !== null && !isNaN(numericId);

  const {
    policyDetails,
    isLoading: isLoadingPolicy,
    error: policyError,
  } = usePolicyDetails(isExistingPolicy ? numericId : null);
  const { createPolicy, isCreating, updatePolicy, isUpdating } = usePolicies();

  const { hosts: currentHosts, isLoading: isLoadingHosts } = usePolicyHosts(isExistingPolicy ? numericId : null);
  const replacePolicyHostsMutation = useReplacePolicyHosts();
  const { devices: policyDevices, isLoading: isLoadingDevices } = usePolicyDevices();

  const [selectedFleetHostIds, setSelectedFleetHostIds] = useState<Set<number>>(new Set());
  const [hostsInitialized, setHostsInitialized] = useState(false);

  // Initialize selected hosts from current assignment (edit mode)
  if (!hostsInitialized && !isLoadingHosts && isExistingPolicy && currentHosts.length > 0) {
    setSelectedFleetHostIds(new Set(currentHosts.map(h => h.id)));
    setHostsInitialized(true);
  }
  if (!hostsInitialized && !isLoadingHosts && (!isExistingPolicy || currentHosts.length === 0)) {
    setHostsInitialized(true);
  }

  const stringSelectedIds = useMemo(
    () => new Set(Array.from(selectedFleetHostIds).map(String)),
    [selectedFleetHostIds],
  );

  const handleDeviceSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedFleetHostIds(
      new Set(
        Array.from(ids)
          .map(Number)
          .filter(n => !Number.isNaN(n)),
      ),
    );
  }, []);

  const isSaving = isCreating || isUpdating || replacePolicyHostsMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      name: '',
      description: '',
      query: '',
    },
  });

  const [hasQuery, setHasQuery] = useState(false);
  const [hasName, setHasName] = useState(false);

  // Seeded when the fetched policy arrives (or is replaced), during render rather
  // than in an effect: an effect renders the empty form once after the data has
  // landed, which is a visible flash of blank fields on every load.
  //
  // `undefined` is a sentinel, NOT the initial value: `policyDetails` is
  // `Policy | null` and never `undefined`, so the block below also runs on the
  // FIRST render. Seeding the tracker with the current value instead would skip
  // it entirely whenever react-query already holds the record — the standard
  // Policy details -> Edit journey — and the form would open blank.
  const [seededFrom, setSeededFrom] = useState<typeof policyDetails | undefined>(undefined);
  if (policyDetails !== seededFrom) {
    setSeededFrom(policyDetails);
    if (policyDetails && isExistingPolicy) {
      reset({
        name: policyDetails.name,
        description: policyDetails.description || '',
        query: policyDetails.query || '',
      });
      setHasQuery(!!policyDetails.query?.trim());
      setHasName(!!policyDetails.name?.trim());
    }
  }

  const handleBack = useSafeBack(
    isExistingPolicy && numericId ? routes.monitoring.policy(numericId) : routes.monitoring.root({ tab: 'policies' }),
  );

  const onSubmit = useCallback(
    (data: PolicyFormData) => {
      const payload = {
        name: data.name,
        description: data.description,
        query: data.query,
        platform: undefined,
      };

      const hostIds = Array.from(selectedFleetHostIds);

      if (isExistingPolicy && numericId) {
        updatePolicy(numericId, payload, {
          onSuccess: async () => {
            try {
              await replacePolicyHostsMutation.mutateAsync({ policyId: numericId, hostIds });
            } catch {
              // Policy saved but hosts failed — error toast shown by mutation hook
            }
            safeBackOrReplace(router, routes.monitoring.policy(numericId));
          },
        });
      } else {
        createPolicy(payload, {
          onSuccess: async policy => {
            try {
              if (hostIds.length > 0) {
                await replacePolicyHostsMutation.mutateAsync({ policyId: policy.id, hostIds });
              }
            } catch {
              // Policy created but hosts failed — error toast shown by mutation hook
            }
            router.replace(routes.monitoring.root({ tab: 'policies' }));
          },
        });
      }
    },
    [isExistingPolicy, numericId, createPolicy, updatePolicy, router, selectedFleetHostIds, replacePolicyHostsMutation],
  );

  const onFormError = useCallback(
    (fieldErrors: Record<string, { message?: string }>) => {
      const firstError = Object.values(fieldErrors)[0];
      if (firstError?.message) {
        toast({ title: 'Validation error', description: firstError.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const getQuery = useCallback(() => getValues('query'), [getValues]);

  const actions = useMemo(
    () => [
      {
        label: 'Save Policy',
        onClick: handleSubmit(onSubmit, onFormError),
        variant: 'accent' as const,
        disabled: isSaving || !hasName,
      },
    ],
    [handleSubmit, onSubmit, onFormError, isSaving, hasName],
  );

  if (isLoadingPolicy && isExistingPolicy) {
    return <CardLoader items={4} />;
  }

  if (policyError && isExistingPolicy) {
    return <LoadError message={`Error loading policy: ${policyError}`} />;
  }

  if (isExistingPolicy && !policyDetails && !isLoadingPolicy) {
    return <NotFoundError message="Policy not found" />;
  }

  return (
    <PageLayout
      title={isExistingPolicy && policyDetails ? policyDetails.name : 'New Policy'}
      backButton={{
        label: 'Back',
        onClick: handleBack,
      }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="space-y-6 md:space-y-8">
        {/* Name */}
        <div className="md:max-w-[280px]">
          <Input
            {...register('name', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHasName(!!e.target.value.trim()),
            })}
            label="Name"
            placeholder="Enter Policy Name"
            error={errors.name?.message}
          />
        </div>

        {/* Description */}
        <Textarea {...register('description')} label="Description" rows={3} placeholder="Enter Policy Description" />

        {/* Query + inline test block */}
        <div className="space-y-1">
          <Label className="!mb-0">Query</Label>
          <Controller
            name="query"
            control={control}
            render={({ field }) => (
              <ScriptEditor
                value={field.value}
                onChange={val => {
                  field.onChange(val);
                  setHasQuery(!!val?.trim());
                }}
                shell="sql"
                height="300px"
              />
            )}
          />
          {/* 8px gap under the editor, matching the section's internal gap
              (the parent's space-y-1 would give 4px). */}
          <TestQuerySection
            getQuery={getQuery}
            hasQuery={hasQuery}
            devices={policyDevices}
            isLoadingDevices={isLoadingDevices}
            className="!mt-[var(--spacing-system-xsf)]"
          />
        </div>

        {/* Devices */}
        <div className="space-y-1">
          <h2 className="text-ods-text-primary text-h2">Devices</h2>
          <DeviceSelector
            devices={policyDevices}
            loading={isLoadingDevices}
            selectedIds={stringSelectedIds}
            getDeviceKey={getDeviceKey}
            onSelectionChange={handleDeviceSelectionChange}
            disabled={isSaving}
            addAllBehavior="merge"
            isDeviceDisabled={d => (getFleetHostId(d) === undefined ? 'Fleet agent is\nnot installed' : undefined)}
          />
        </div>
      </div>
    </PageLayout>
  );
}
