'use client';

import { Label, LoadError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { useMemo, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useEditScriptForm } from '../../hooks/use-edit-script-form';
import { useScriptDetails } from '../../hooks/use-script-details';
import { useTestRuns } from '../../hooks/use-test-runs';
import { EditScriptSkeleton } from './edit-script-skeleton';
import { ScriptFormFields } from './script-form-fields';
import { TestRunCard } from './test-run-card';
import { type SelectedTestDevice, TestScriptModal } from './test-script-modal';

interface EditScriptPageProps {
  scriptId: string | null;
}

export function EditScriptPage({ scriptId }: EditScriptPageProps) {
  const isEditMode = Boolean(scriptId);
  const handleBackToList = useSafeBack(routes.scripts.list());
  const handleBackToDetails = useSafeBack(scriptId ? routes.scripts.details(scriptId) : routes.scripts.list());
  const backButton = useMemo(
    () => (isEditMode ? { label: 'Back', onClick: handleBackToDetails } : { label: 'Back', onClick: handleBackToList }),
    [isEditMode, handleBackToDetails, handleBackToList],
  );

  const {
    scriptDetails,
    isLoading: isLoadingScript,
    isOffline: isScriptOffline,
    hasData: scriptLoaded,
    error: scriptError,
    refetch: refetchScript,
  } = useScriptDetails(scriptId || '');
  const { form, isSubmitting, handleSave } = useEditScriptForm({ scriptId, scriptDetails, isEditMode });
  const { testRun, handleRunTest, handleStopRun, clearTestRun } = useTestRuns(form.getValues);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const watchedSupportedPlatforms = form.watch('supported_platforms');

  const handleDeviceSelected = (device: SelectedTestDevice) => {
    handleRunTest(device);
  };

  const actions = useMemo(
    () => [
      {
        label: 'Test Script',
        onClick: () => setIsTestModalOpen(true),
        variant: 'outline' as const,
      },
      {
        label: 'Save Script',
        onClick: handleSave,
        variant: 'accent' as const,
        disabled: isSubmitting,
        loading: isSubmitting,
      },
    ],
    [handleSave, isSubmitting],
  );

  if (isLoadingScript) {
    return <EditScriptSkeleton />;
  }

  // Edit mode with no record: the form below would render at `useForm` defaults,
  // the title would flip to "New Script", and Save would still dispatch the
  // UPDATE path over the real script. `scriptError` already means "failed with no
  // data", so it implies `!scriptLoaded` — the two failures share one exit.
  if (isEditMode && !scriptLoaded && (isScriptOffline || scriptError)) {
    return (
      <PageLayout title="Edit Script" backButton={backButton}>
        <LoadError {...loadErrorProps(isScriptOffline, "Couldn't load this script.", () => refetchScript())} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isEditMode ? 'Edit Script' : 'New Script'}
      backButton={backButton}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {testRun && (
        <div>
          <Label className="text-h5 text-ods-text-primary">Script Testing</Label>
          <TestRunCard
            run={testRun}
            onStop={handleStopRun}
            onTestAgain={() => setIsTestModalOpen(true)}
            onClose={clearTestRun}
          />
        </div>
      )}

      <ScriptFormFields form={form} />

      <TestScriptModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onDeviceSelected={handleDeviceSelected}
        supportedPlatforms={watchedSupportedPlatforms}
      />
    </PageLayout>
  );
}
