'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useLazyLoadQuery, useMutation } from 'react-relay';
import type { runCommandMutation as RunCommandMutationType } from '@/__generated__/runCommandMutation.graphql';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import { EntityTagPicker, EntityTagPickerFallback } from '@/app/components/shared/tags';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { TagEntityType } from '@/generated/schema-enums';
import { runCommandMutation } from '@/graphql/scripts/run-command-mutation';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ExecutionStartedModal } from '../../../components/script/execution-started-modal';
import { ScriptFormFields } from '../../../components/script/script-form-fields';
import type { EditScriptFormData } from '../../../types/edit-script.types';
import { relayScriptToForm, shellToEnum } from '../../shared/utils/script-mappers';
import { SCRIPT_V2_SHELL_TYPES } from '../../shared/utils/shell-types';
import { useEditScriptForm } from '../hooks/use-edit-script-form';
import type { ScriptDetailData } from '../types/script-detail.types';
import { type SelectedTestDevice, TestScriptModal } from './test-script-modal';

interface ScriptTag {
  id: string;
  key: string;
}

interface EditScriptFormProps {
  scriptId: string | null;
  initialValues: EditScriptFormData | null;
  initialTags: ReadonlyArray<ScriptTag>;
}

function EditScriptForm({ scriptId, initialValues, initialTags }: EditScriptFormProps) {
  const isEditMode = Boolean(scriptId);
  const { toast } = useToast();
  const handleBack = useSafeBack(isEditMode && scriptId ? routes.scriptsV2.details(scriptId) : routes.scriptsV2.list);

  const { form, isSubmitting, handleSave } = useEditScriptForm({ scriptId, initialValues, isEditMode });

  // ONLY Save reveals inline errors. The form validates on every change, but
  // painting a half-filled form red before the user has claimed to be done is
  // premature — Test reports its own missing prerequisites in a toast instead.
  const [showErrors, setShowErrors] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testDispatched, setTestDispatched] = useState(false);
  const [commitRunCommand] = useMutation<RunCommandMutationType>(runCommandMutation);

  const handleSaveClick = useCallback(() => {
    setShowErrors(true);
    handleSave();
  }, [handleSave]);

  const watchedSupportedPlatforms = form.watch('supported_platforms');

  // The test (runCommand) only needs a shell, a non-empty body and at least one
  // platform (so the device picker has candidates). timeout / privilege have
  // defaults. Validate these BEFORE opening the device picker so the user is
  // never sent through device selection only to hit a dead-end.
  //
  // `shell` and `script_body` are validated via the resolver (`trigger`) so their
  // errors and clearing are fully owned by RHF — the form runs in `onChange`
  // mode, so the red state disappears the moment the field becomes valid.
  const validateTestPrereqs = useCallback(async () => {
    // Trigger every runnable prerequisite (incl. platforms) so each sets/clears its
    // own inline error via the resolver — Save's full-schema validation is a superset.
    const [shellOk, bodyOk, platformsOk] = await Promise.all([
      form.trigger('shell'),
      form.trigger('script_body'),
      form.trigger('supported_platforms'),
    ]);

    const missing: string[] = [];
    if (!shellOk) {
      missing.push('a shell type');
    }
    if (!bodyOk) {
      missing.push('script content');
    }
    if (!platformsOk) {
      missing.push('a supported platform');
    }

    if (missing.length > 0) {
      toast({
        title: 'Cannot test yet',
        description: `Add ${missing.join(', ')} before testing the script.`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [form, toast]);

  const handleOpenTest = useCallback(async () => {
    // Deliberately does NOT flip `showErrors`: Test is not a save attempt, and
    // its own toast already names what is missing. The `trigger` calls inside
    // still run — they keep RHF's error state current for the eventual Save.
    if (await validateTestPrereqs()) {
      setIsTestModalOpen(true);
    }
  }, [validateTestPrereqs]);

  const handleDeviceSelected = useCallback(
    async (device: SelectedTestDevice) => {
      // Prereqs were validated before the picker opened; re-check defensively in
      // case the form changed while it was open.
      if (!(await validateTestPrereqs())) {
        setIsTestModalOpen(false);
        return;
      }
      const values = form.getValues();

      commitRunCommand({
        variables: {
          input: {
            machineId: device.machineId,
            shell: shellToEnum(values.shell),
            command: values.script_body,
            privilegeLevel: values.run_as_user ? 'USER' : 'ADMIN',
            timeoutSeconds: values.default_timeout,
          },
        },
        onCompleted: () => setTestDispatched(true),
        onError: err => {
          toast({
            title: 'Test failed',
            description: getRelayErrorMessage(err, 'Failed to dispatch test'),
            variant: 'destructive',
          });
        },
      });
    },
    [form, commitRunCommand, toast, validateTestPrereqs],
  );

  // Test always dispatches `runCommand` (the current editor body may be unsaved),
  // so it carries no scriptId and never shows in `scriptExecutions(scriptId)` — the
  // results live in the activity logs, NOT the script's Execution History. Open in a
  // new tab so the user doesn't lose in-progress script edits.
  const handleViewLogs = useCallback(() => {
    setTestDispatched(false);
    window.open('/logs-page', '_blank', 'noopener,noreferrer');
  }, []);

  const actions = useMemo<PageActionButton[]>(
    () => [
      { label: 'Test Script', onClick: handleOpenTest, variant: 'outline' as const },
      {
        label: 'Save Script',
        onClick: handleSaveClick,
        variant: 'accent' as const,
        disabled: isSubmitting,
        loading: isSubmitting,
      },
    ],
    [handleSaveClick, isSubmitting, handleOpenTest],
  );

  return (
    <>
      <PageLayout
        title={isEditMode ? 'Edit Script' : 'New Script'}
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        // Form page: on mobile the actions belong in the fixed bottom bar, in
        // reach of the thumb — not folded into the header's "..." menu. Test +
        // Save already fill that bar, so no separate Cancel.
        actionsVariant="primary-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <ScriptFormFields
          form={form}
          shellTypes={SCRIPT_V2_SHELL_TYPES}
          hideCategory
          showErrors={showErrors}
          tagsField={
            <Controller
              name="tag_ids"
              control={form.control}
              render={({ field }) => (
                <Suspense fallback={<EntityTagPickerFallback />}>
                  <EntityTagPicker
                    entityType={TagEntityType.SCRIPT}
                    selectedIds={field.value}
                    onChange={field.onChange}
                    initialTags={initialTags}
                    deletable
                    entityLabel="script"
                  />
                </Suspense>
              )}
            />
          }
        />
      </PageLayout>

      <TestScriptModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onDeviceSelected={handleDeviceSelected}
        supportedPlatforms={watchedSupportedPlatforms}
      />

      <ExecutionStartedModal
        isOpen={testDispatched}
        onClose={() => setTestDispatched(false)}
        scriptName={form.getValues('name') || 'Script'}
        onViewResults={handleViewLogs}
        viewLabel="View Logs"
        resultsLocation="activity logs section"
      />
    </>
  );
}

/**
 * Edit mode: the script is resolved BEFORE the form mounts, so its fields (and
 * Monaco) are seeded on the first render and there is no window in which a
 * disabled, empty form stands in for the record. Suspends — the route renders
 * `EditScriptSkeleton` meanwhile.
 */
function EditScriptView({ scriptId }: { scriptId: string }) {
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-and-network' },
  );
  const script: ScriptDetailData | null = data.script;
  const initialValues = useMemo(() => (script ? relayScriptToForm(script) : null), [script]);
  const initialTags = useMemo(() => script?.tags?.map(t => ({ id: t.id, key: t.key })) ?? [], [script]);

  if (!script) {
    return <NotFoundError message="Script not found" />;
  }

  // Keyed by id: the router reuses this route segment when only `?id=` changes,
  // so without the key a hop from script A to B would keep A's form state.
  return <EditScriptForm key={scriptId} scriptId={scriptId} initialValues={initialValues} initialTags={initialTags} />;
}

/** Create + edit page for a script (v2, Relay). */
export function EditScriptPage({ scriptId }: { scriptId: string | null }) {
  if (!scriptId) {
    return <EditScriptForm scriptId={null} initialValues={null} initialTags={[]} />;
  }
  return <EditScriptView scriptId={scriptId} />;
}
