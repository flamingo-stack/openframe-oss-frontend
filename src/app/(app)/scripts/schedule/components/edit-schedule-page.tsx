'use client';
'use no memo';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { useEditScheduleForm } from '../hooks/use-edit-schedule-form';
import { type EditScheduleFormData, scheduleToFormValues } from '../types/edit-schedule.types';
import { ScheduleFormFields } from './schedule-form-fields';

/** What the page knows about the record it is editing. */
type ScheduleRecordState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; values: EditScheduleFormData | null };

const RECORD_LOADING: ScheduleRecordState = { status: 'loading' };
/** The create page owns no record: nothing to seed, and the form is live at once. */
const RECORD_NOT_NEEDED: ScheduleRecordState = { status: 'ready', values: null };

/**
 * The page's data island — and it renders NOTHING.
 *
 * Everything it feeds is already on screen: the form is mounted from the first
 * render and simply locked, so the island has no placeholder to stand in for
 * (`fallback={null}`) and no fields to remount when the answer lands. It reads
 * the schedule and hands it up; the page writes it into the form (see
 * `useSeedForm` for why the WRITE cannot happen here).
 *
 * This is also what removes the last guess from this page. The form BRANCHES on
 * the trigger — a DATE_TIME schedule shows Date / Time / Repeat where an
 * event-driven one collapses that row — and a skeleton had to pick one of the
 * two blind. Coming from the details page the schedule is already in the Relay
 * store, so the seed lands before the first paint and the right branch is simply
 * what gets drawn.
 */
function ScheduleRecordLoader({
  scheduleId,
  onResolved,
}: {
  scheduleId: string;
  onResolved: (state: ScheduleRecordState) => void;
}) {
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;

  const values = useMemo(() => (schedule ? scheduleToFormValues(schedule) : null), [schedule]);

  // Layout effect: the page seeds and unlocks the fields before the paint, so a
  // schedule Relay already had in its store is simply there.
  useLayoutEffect(() => {
    onResolved(values ? { status: 'ready', values } : { status: 'missing' });
  }, [values, onResolved]);

  return null;
}

/**
 * The page around the fields: the title, the Back button, the action bar and the
 * form instance itself. None of it reads the schedule, so all of it paints on the
 * first render and none of it is ever replaced by a placeholder.
 */
function ScheduleFormPage({ scheduleId }: { scheduleId: string | null }) {
  const { methods, showErrors, handleSave, isSaving, isEditMode, backFallback } = useEditScheduleForm({ scheduleId });
  const handleBack = useSafeBack(backFallback);

  // Nothing to wait for when creating. When editing, the loader below reports in
  // as soon as the schedule is there; until then the fields are locked, and so is
  // Save — it would otherwise act on an empty form and answer a page that is
  // still loading with complaints about fields nobody has seen.
  const [record, setRecord] = useState<ScheduleRecordState>(isEditMode ? RECORD_LOADING : RECORD_NOT_NEEDED);
  const isRecordReady = record.status === 'ready';

  // Seeded HERE rather than in the island that fetched it: this is the component
  // that owns the form, so its layout effect runs after every field below has
  // subscribed. See `useSeedForm`.
  useSeedForm(methods, record.status === 'ready' ? record.values : null);

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
        disabled: !isRecordReady || isSaving,
        loading: isSaving,
      },
    ],
    [isEditMode, handleSave, isSaving, handleBack, isRecordReady],
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
        {scheduleId && (
          // Suspends with nothing in its place: what it is loading is already
          // drawn below, locked.
          <Suspense fallback={null}>
            <ScheduleRecordLoader scheduleId={scheduleId} onResolved={setRecord} />
          </Suspense>
        )}

        {/* Locked fields are announced by nothing on their own — `disabled` reads
            as "unavailable", not "busy" — so the wait gets a line of its own.
            `sr-only` is out of flow, so it costs no layout.

            Mounted unconditionally, with only its TEXT switching: a live region
            that appears with its content already inside it is not reliably
            announced, and the emptied region is what retracts the message once
            the record lands. Gated on `loading` rather than `!isRecordReady`,
            which is also true for `missing` — that branch renders
            `NotFoundError` below, and announcing a load that never resolves
            next to it is the opposite of what the reader needs. */}
        <span role="status" className="sr-only">
          {record.status === 'loading' ? 'Loading schedule…' : ''}
        </span>

        {record.status === 'missing' ? (
          <NotFoundError message="Schedule not found" />
        ) : (
          <ScheduleFormFields showErrors={showErrors} disabled={!isRecordReady} />
        )}
      </PageLayout>
    </FormProvider>
  );
}

/**
 * Create + edit page for a script schedule (v2, Relay).
 *
 * Keyed by id: the router reuses this route segment when only `?id=` changes, so
 * without the key a hop from schedule A to B would keep A's form state.
 */
export function EditSchedulePage({ scheduleId }: { scheduleId: string | null }) {
  return <ScheduleFormPage key={scheduleId ?? 'new'} scheduleId={scheduleId} />;
}
