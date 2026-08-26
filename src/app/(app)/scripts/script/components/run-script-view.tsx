'use client';

import { NotFoundError, PageLayout, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import {
  CheckboxBlock,
  Input,
  Label,
  type PageActionButton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLazyLoadQuery, useMutation } from 'react-relay';
import { z } from 'zod';
import type { batchRunScriptMutation as BatchRunScriptMutationType } from '@/__generated__/batchRunScriptMutation.graphql';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { batchRunScriptMutation } from '@/graphql/scripts/batch-run-script-mutation';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import type { Device } from '../../../devices/types/device.types';
import { CONTEXT_ENTITY_KIND } from '../../../mingo/context/context-types';
import { useTrackOpenView } from '../../../mingo/context/use-track-open-view';
import { scriptArgumentSchema } from '../../shared/types/edit-script.types';
import { getDevicePrimaryId } from '../../shared/utils/device-helpers';
import { initiatorName } from '../../shared/utils/execution-helpers';
import { parseKeyValues, serializeKeyValues } from '../../shared/utils/script-key-values';
import { envVarsToInput, envVarsToPairs, platformsToIds, shellToId } from '../../shared/utils/script-mappers';
import { runDeviceFilter } from '../../shared/utils/script-utils';
import type { ScriptDetailData } from '../types/script-detail.types';
import { ExecutionStartedModal } from './execution-started-modal';
import { ScriptSummaryCard } from './script-summary-card';

interface RunScriptViewProps {
  scriptId: string;
}

const runFormSchema = z.object({
  timeout: z.number().min(1, 'Timeout must be at least 1 second').max(86400, 'Timeout cannot exceed 24 hours'),
  runAsUser: z.boolean(),
  scriptArgs: z.array(scriptArgumentSchema),
  envVars: z.array(scriptArgumentSchema),
});

type RunFormData = z.infer<typeof runFormSchema>;

function getMachineId(device: Device): string | undefined {
  return device.machineId || undefined;
}

interface RunScriptFormProps {
  scriptId: string;
  script: ScriptDetailData;
}

function RunScriptForm({ scriptId, script }: RunScriptFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const handleBack = useSafeBack(routes.scripts.details(scriptId));

  // Keep this script as the Mingo "open view" while on the run surface (the detail
  // page unmounted on navigation). Raw db id — the route's `scriptId` is the Relay
  // global id (SCRIPT is GraphQL-resolved; the chip re-encodes it for `node(id:)`).
  const scriptDbId = useMemo(() => decodeGlobalId(scriptId)?.rawId ?? scriptId, [scriptId]);
  useTrackOpenView(
    script ? { type: CONTEXT_ENTITY_KIND.SCRIPT, id: scriptDbId, label: script.name || scriptDbId } : null,
  );

  const supportedPlatforms = useMemo(() => platformsToIds(script?.supportedPlatforms), [script?.supportedPlatforms]);

  const deviceFilter = useMemo(() => runDeviceFilter(supportedPlatforms), [supportedPlatforms]);

  // Selection as DEVICES, not ids: the device list lives behind the Suspense
  // boundary below, so this component has nothing to resolve ids against.
  const [selection, setSelection] = useState<Device[]>([]);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [commitBatchRun] = useMutation<BatchRunScriptMutationType>(batchRunScriptMutation);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<RunFormData>({
    resolver: zodResolver(runFormSchema),
    defaultValues: { timeout: 90, runAsUser: false, scriptArgs: [], envVars: [] },
  });

  useEffect(() => {
    // `!isDirty` guard: `store-and-network` re-delivers the script (new snapshot
    // identity) after the store read; once the user has touched the run config, a
    // late delivery must not clobber it. `reset` marks the form pristine, so the
    // initial seed always passes the guard.
    if (script && !isDirty) {
      const parsedArgs = parseKeyValues(script.defaultArgs ? [...script.defaultArgs] : [], ' ');
      const parsedEnv = envVarsToPairs(script.envVars);
      reset({
        timeout: script.defaultTimeoutSeconds ?? 90,
        // Seed from the script's saved privilege; the user can still toggle it per run.
        runAsUser: script.privilegeLevel === 'USER',
        // No placeholder rows when the script has none — the "Add" buttons are the
        // affordance; rows appear only when the script defines defaults or the user adds one.
        scriptArgs: parsedArgs,
        envVars: parsedEnv,
      });
    }
  }, [script, reset, isDirty]);

  // One dispatch to every selected machine under a single shared executionId
  // (batchRunScript), instead of a runScript per device.
  const dispatchBatch = useCallback(
    (
      machineIds: string[],
      args: string[],
      timeoutSeconds: number,
      envVars: ReturnType<typeof envVarsToInput>,
      runAsUser: boolean,
    ) =>
      new Promise<void>((resolve, reject) => {
        commitBatchRun({
          variables: {
            input: {
              machineIds,
              scriptId,
              privilegeLevel: runAsUser ? 'USER' : 'ADMIN',
              args,
              timeoutSeconds,
              envVars,
            },
          },
          onCompleted: () => resolve(),
          onError: err => reject(err),
        });
      }),
    [commitBatchRun, scriptId],
  );

  const onSubmit = useCallback(
    async (formData: RunFormData) => {
      if (selection.length === 0) {
        toast({
          title: 'No devices selected',
          description: 'Please select at least one device.',
          variant: 'destructive',
        });
        return;
      }

      const machineIds = selection.map(getMachineId).filter((id): id is string => !!id);

      if (machineIds.length === 0) {
        toast({
          title: 'No compatible devices',
          description: 'Selected devices have no machine ID.',
          variant: 'destructive',
        });
        return;
      }

      const args = serializeKeyValues(formData.scriptArgs, ' ');
      const envVars = envVarsToInput(formData.envVars);

      try {
        await dispatchBatch(machineIds, args, formData.timeout, envVars, formData.runAsUser);
        setShowExecutionModal(true);
      } catch (e) {
        toast({
          title: 'Submission failed',
          description: getRelayErrorMessage(e, 'Failed to dispatch script'),
          variant: 'destructive',
        });
      }
    },
    [selection, toast, dispatchBatch],
  );

  const onFormError = useCallback(
    (formErrors: Record<string, { message?: string }>) => {
      const firstError = Object.values(formErrors)[0];
      if (firstError?.message) {
        toast({ title: 'Validation error', description: firstError.message, variant: 'destructive' });
      }
      // The offending field is usually scrolled off-screen by now — take the user to it.
      scrollToFirstInvalidField();
    },
    [toast],
  );

  const handleViewHistory = useCallback(() => {
    setShowExecutionModal(false);
    router.push(routes.scripts.details(scriptId, { tab: 'executions' }));
  }, [router, scriptId]);

  const actions = useMemo<PageActionButton[]>(
    () => [
      // Run is the only other action, so on a phone the bar would be one
      // full-width button with the way out off-screen at the top of the page —
      // hence the mobile-only Cancel, which IS the Back navigation.
      { label: 'Cancel', onClick: handleBack, variant: 'outline' as const, showOnlyMobile: true },
      {
        label: 'Run Script',
        onClick: handleSubmit(onSubmit, onFormError),
        variant: 'accent' as const,
        disabled: selection.length === 0,
        loading: isSubmitting,
      },
    ],
    [handleSubmit, onSubmit, onFormError, selection.length, isSubmitting, handleBack],
  );

  return (
    <>
      <PageLayout
        title="Run Script"
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        actionsVariant="primary-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <ScriptSummaryCard
          name={script.name}
          description={script.description}
          shellId={shellToId(script.shell)}
          platforms={supportedPlatforms}
          author={script.author ? initiatorName(script.author) : null}
          showTimeout={false}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)] items-end">
          <div>
            <Label className="text-ods-text-primary text-h3">Timeout</Label>
            <Controller
              name="timeout"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  className="w-full"
                  value={field.value}
                  onChange={e => field.onChange(Number(e.target.value) || 0)}
                  endAdornment={<span className="text-ods-text-secondary text-h6">Seconds</span>}
                />
              )}
            />
          </div>

          <Controller
            name="runAsUser"
            control={control}
            render={({ field }) => (
              <CheckboxBlock
                checked={field.value}
                onCheckedChange={checked => field.onChange(checked === true)}
                label="Run as User"
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)]">
          <Controller
            name="scriptArgs"
            control={control}
            render={({ field }) => (
              <ScriptArguments
                arguments={field.value}
                onArgumentsChange={field.onChange}
                keyPlaceholder="Key"
                valuePlaceholder="Enter Value (empty=flag)"
                addButtonLabel="Add Script Argument"
                titleLabel="Script Arguments"
              />
            )}
          />
          <Controller
            name="envVars"
            control={control}
            render={({ field }) => (
              <ScriptArguments
                arguments={field.value}
                onArgumentsChange={field.onChange}
                keyPlaceholder="Key"
                valuePlaceholder="Enter Value"
                addButtonLabel="Add Environment Var"
                titleLabel="Environment Vars"
              />
            )}
          />
        </div>

        <div className="space-y-[var(--spacing-system-xxs)]">
          <DeviceListPicker
            filter={deviceFilter}
            selected={selection}
            onSelectionChange={setSelection}
            getDeviceKey={getDevicePrimaryId}
            showSelectionModeRadio={false}
            addAllBehavior="replace"
            isDeviceDisabled={(d: Device) => (!getMachineId(d) ? 'Agent is not\nconnected' : undefined)}
          />
        </div>
      </PageLayout>

      <ExecutionStartedModal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
        scriptName={script?.name || 'Script'}
        onViewResults={handleViewHistory}
      />
    </>
  );
}

/**
 * "Run Script" — the per-run config (timeout, privilege, args, env) over the
 * device picker. Suspends on the script query; the route renders
 * `RunScriptSkeleton` while that is in flight, so the form mounts once, already
 * seeded (no editor here, but the same contract as the edit page).
 */
export function RunScriptView({ scriptId }: RunScriptViewProps) {
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network' },
  );

  if (!data.script) {
    return <NotFoundError message="Script not found" />;
  }

  // Keyed by id: the router reuses this route segment when only `?id=` changes,
  // so without the key a hop from script A to B would keep A's run config.
  return <RunScriptForm key={scriptId} scriptId={scriptId} script={data.script} />;
}

export default RunScriptView;
