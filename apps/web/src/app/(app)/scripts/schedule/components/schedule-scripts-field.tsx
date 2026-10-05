'use client';
'use no memo';

import { SortableList } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { type EditScheduleFormData, EMPTY_SCRIPT_ROW } from '../types/edit-schedule.types';
import { ScheduleScriptPickerCard } from './schedule-script-picker-card';

/**
 * "Scheduled Scripts" — the ordered list of script cards. Card order IS the run
 * order: it is submitted as `scriptIds` verbatim, so a reorder is a real,
 * persisted change.
 *
 * Reordering runs on the core library's `SortableList` (Pragmatic drag and
 * drop): drag on desktop, an up/down button pair per card on touch/narrow
 * viewports, where no DnD is initialized at all. The list owns the live-region
 * announcements (`getItemLabel`) and the keyboard path on the handle.
 */
export function ScheduleScriptsField({ showErrors, disabled = false }: { showErrors: boolean; disabled?: boolean }) {
  const { control, getValues } = useFormContext<EditScheduleFormData>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'scripts' });
  const supportedPlatforms = useWatch({ control, name: 'supportedPlatforms' });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      <div className="flex min-h-[72px] items-end pt-[var(--spacing-system-l)]">
        <h2 className="text-ods-text-primary text-h2">Scheduled Scripts</h2>
      </div>

      {/* Rows are keyed by the `useFieldArray` field id, stable across reorders
          and safe for duplicate scripts; the reorder itself is DOM-order based. */}
      <SortableList
        onReorder={move}
        disabled={disabled}
        getItemLabel={index => getValues(`scripts.${index}.name`) || `script ${index + 1}`}
        className="flex flex-col gap-[var(--spacing-system-lf)]"
      >
        {fields.map((field, index) => (
          <ScheduleScriptPickerCard
            key={field.id}
            index={index}
            count={fields.length}
            supportedPlatforms={supportedPlatforms}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
            disabled={disabled}
            showErrors={showErrors}
          />
        ))}
      </SortableList>

      <Button
        type="button"
        variant="outline"
        size="small"
        onClick={() => append(EMPTY_SCRIPT_ROW)}
        disabled={disabled}
        className="self-start"
        leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
      >
        Add Script
      </Button>
    </div>
  );
}
