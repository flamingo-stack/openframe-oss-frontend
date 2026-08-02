'use client';

import { PageLayout, type ScriptArgument, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import { SelectButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  Label,
  type PageActionButton,
  RadioGroupBlock,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '../../../utils/script-utils';
import { TRIGGER_OPTIONS } from '../types/edit-schedule.types';

/** No script is picked yet, so the card's args/env blocks render empty. */
const NO_ARGUMENTS: ScriptArgument[] = [];
const NOOP = () => {};

/** A form control whose VALUE is the thing being loaded. `Input` box, to the pixel. */
function FieldSkeleton({ className }: { className?: string } = {}) {
  return <Skeleton className={`h-11 md:h-12 w-full rounded-[6px] ${className ?? ''}`} />;
}

/**
 * One "Scheduled Scripts" card. Its frame, its four labels and both argument
 * blocks are the same on every card — only what is IN the fields belongs to the
 * schedule, so only that is a bar.
 */
function ScriptCardSkeleton() {
  return (
    <div className="bg-ods-bg border border-ods-border rounded-[6px] p-[var(--spacing-system-lf)] flex flex-col gap-[var(--spacing-system-lf)]">
      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] md:items-end">
        <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
          {/* The drag handle's 48px box — it holds the row's left edge. */}
          <Skeleton className="size-12 shrink-0 rounded-[6px]" />
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Select Script</Label>
            <FieldSkeleton />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Timeout</Label>
            <FieldSkeleton />
          </div>
          {/* The remove button, same 48px square. */}
          <Skeleton className="size-11 md:size-12 shrink-0 rounded-[6px]" />
        </div>
      </div>

      {/* Real, and empty: a card with no script yet renders exactly this — the
          two titles and their disabled add-buttons. */}
      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] items-start">
        <div className="flex-1 min-w-0 w-full">
          <ScriptArguments
            arguments={NO_ARGUMENTS}
            onArgumentsChange={NOOP}
            keyPlaceholder="Key"
            valuePlaceholder="Enter Value (empty=flag)"
            addButtonLabel="Add Script Argument"
            titleLabel="Script Arguments"
            disabled
          />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <ScriptArguments
            arguments={NO_ARGUMENTS}
            onArgumentsChange={NOOP}
            keyPlaceholder="Key"
            valuePlaceholder="Enter Value"
            addButtonLabel="Add Environment Var"
            titleLabel="Environment Vars"
            disabled
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The edit form while the schedule is in flight.
 *
 * Everything that is NOT the record is the real thing: the title, both header
 * actions, every field label, the trigger options with their descriptions, the
 * platform picker, the section heading and "Add Script". Only the values wait —
 * the name, the note, the timing controls and the script cards — and those are
 * bars in the exact box their control occupies, so nothing moves when the
 * schedule lands.
 *
 * `inert` on the fields: they are real controls with no form behind them yet, so
 * they stay out of the tab order and can't be clicked. The header's Cancel is
 * outside it and works — a way out has to exist while the page is still loading.
 *
 * The create page needs none of this: it has no record to wait for.
 */
export function EditScheduleSkeleton({ scheduleId }: { scheduleId: string }) {
  const handleBack = useSafeBack(routes.scriptsV2.schedules.details(scheduleId));
  const isMdUp = useMdUp();

  // Mirrors the loaded page's pair, in the same order: the mobile-only Cancel
  // (which is Back, and works) and the disabled Save. Dropping either would
  // resize the mobile action bar the moment the form arrives.
  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    { label: 'Update Schedule', variant: 'accent', disabled: true },
  ];

  return (
    <PageLayout
      title="Edit Script Schedule"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-lf)]" inert>
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Label className="text-h4">Schedule Name</Label>
          <FieldSkeleton />
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Label className="text-h4">Note</Label>
          <Skeleton className="h-24 w-full rounded-[6px]" />
        </div>

        {/* Real: both trigger options are static copy. Which one is selected is
            the record's answer, so none is — the block's height is the same
            either way. */}
        <RadioGroupBlock variant="grouped" value="" onValueChange={NOOP} options={TRIGGER_OPTIONS} />

        {/* The timing row as `ScheduleTimingFields` lays it out. Drawn expanded:
            DATE_TIME is the common schedule, and an event-driven one collapses
            this row the moment it arrives. */}
        <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] md:items-end">
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Date</Label>
            <FieldSkeleton />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Time</Label>
            <FieldSkeleton />
          </div>
          {/* Real: the checkbox carries its own label, and unchecked is both the
              form's default and the shape a non-repeating schedule settles into. */}
          <div className="flex-1 min-w-0">
            <CheckboxBlock label="Repeat Script Run" checked={false} onCheckedChange={NOOP} className="w-full" />
          </div>
          <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
            <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
              <Label className="text-h4">Repeat in</Label>
              <FieldSkeleton />
            </div>
            {/* The unit select sits label-less beside it. */}
            <div className="flex-1 min-w-0">
              <FieldSkeleton />
            </div>
          </div>
        </div>

        {/* Real: the platforms are a fixed set with fixed labels and icons —
            only the selection is data, and nothing is selected yet. */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Label className="text-h4">Supported Platform</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--spacing-system-mf)]">
            {AVAILABLE_PLATFORMS.map(platform => {
              const comingSoon = DISABLED_PLATFORMS.includes(platform.id);
              return (
                <SelectButton
                  key={platform.id}
                  title={platform.name}
                  icon={<platform.icon className="w-5 h-5" />}
                  selected={false}
                  disabled={comingSoon}
                  tag={comingSoon ? (isMdUp ? 'Coming Soon' : 'Soon') : undefined}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-lf)]">
          <div className="flex items-end min-h-[72px] pt-[var(--spacing-system-l)]">
            <h2 className="text-h2 text-ods-text-primary">Scheduled Scripts</h2>
          </div>

          {/* One card: every schedule has at least one script, and a second
              placeholder would more often be wrong than right. */}
          <ScriptCardSkeleton />

          <Button
            type="button"
            variant="outline"
            size="small"
            disabled
            className="self-start"
            leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
          >
            Add Script
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
