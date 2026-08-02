'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { FormProvider } from 'react-hook-form';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { useEditScheduleForm } from '../hooks/use-edit-schedule-form';
import { type EditScheduleFormData, scheduleToFormValues } from '../types/edit-schedule.types';
import { ScheduleFormFields } from './schedule-form-fields';

interface ScheduleFormPageProps {
  scheduleId: string | null;
  initialValues: EditScheduleFormData | null;
}

/** The form itself, identical for create and edit — only its seed differs. */
function ScheduleFormPage({ scheduleId, initialValues }: ScheduleFormPageProps) {
  const { methods, showErrors, handleSave, isSaving, isEditMode, backFallback } = useEditScheduleForm({
    scheduleId,
    initialValues,
  });
  const handleBack = useSafeBack(backFallback);

  // Save is the only other action, so on a phone the bar would be one full-width
  // button with the way out off-screen at the top of the page — hence the
  // mobile-only Cancel, which IS the Back navigation.
  const actions = useMemo<PageActionButton[]>(
    () => [
      { label: 'Cancel', onClick: handleBack, variant: 'outline' as const, showOnlyMobile: true },
      {
        label: isEditMode ? 'Update Schedule' : 'Save & Continue',
        onClick: handleSave,
        variant: 'accent' as const,
        disabled: isSaving,
        loading: isSaving,
      },
    ],
    [isEditMode, handleSave, isSaving, handleBack],
  );

  return (
    <FormProvider {...methods}>
      <PageLayout
        title={isEditMode ? 'Edit Script Schedule' : 'New Script Schedule'}
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        actionsVariant="primary-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <ScheduleFormFields showErrors={showErrors} />
      </PageLayout>
    </FormProvider>
  );
}

/**
 * Edit mode: the schedule is resolved BEFORE the form mounts, so the fields are
 * seeded through `defaultValues` and there is no window in which a disabled,
 * empty form stands in for the record. Suspends — the route renders
 * `EditScheduleSkeleton` meanwhile.
 */
function EditScheduleView({ scheduleId }: { scheduleId: string }) {
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;
  const initialValues = useMemo(() => (schedule ? scheduleToFormValues(schedule) : null), [schedule]);

  if (!schedule) {
    return <NotFoundError message="Schedule not found" />;
  }

  // Keyed by id: the router reuses this route segment when only `?id=` changes,
  // so without the key a hop from schedule A to B would keep A's form state.
  return <ScheduleFormPage key={scheduleId} scheduleId={scheduleId} initialValues={initialValues} />;
}

/** Create + edit page for a script schedule (v2, Relay). */
export function EditSchedulePage({ scheduleId }: { scheduleId: string | null }) {
  if (!scheduleId) {
    return <ScheduleFormPage scheduleId={null} initialValues={null} />;
  }
  return <EditScheduleView scheduleId={scheduleId} />;
}
