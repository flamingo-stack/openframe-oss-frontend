'use client';

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useId, useMemo } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { type EditScheduleFormData, EMPTY_SCRIPT_ROW } from '../types/edit-schedule.types';
import { ScheduleScriptPickerCard } from './schedule-script-picker-card';

/**
 * The list is one vertical column, so horizontal drift is noise — pin the drag
 * to the Y axis. (Inlined rather than pulling in `@dnd-kit/modifiers` for a
 * one-liner; this is that package's `restrictToVerticalAxis` verbatim.)
 */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const dragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder this script, press Space or Enter to pick it up, then Arrow Up / Arrow Down to move it. ' +
    'Press Space or Enter again to drop it, or Escape to cancel.',
};

/**
 * "Scheduled Scripts" — the ordered list of script cards. Card order IS the run
 * order: it is submitted as `scriptIds` verbatim, so a drag is a real, persisted
 * change.
 */
export function ScheduleScriptsField({ showErrors, disabled = false }: { showErrors: boolean; disabled?: boolean }) {
  const { control, getValues } = useFormContext<EditScheduleFormData>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'scripts' });
  const supportedPlatforms = useWatch({ control, name: 'supportedPlatforms' });

  // Without an `id`, dnd-kit names its screen-reader description element from a
  // MODULE-level counter (`DndDescribedBy-0`, `-1`, …). That counter is per
  // JS runtime, not per render: the server's has already been advanced by
  // earlier renders while the browser's starts at zero, so the id it puts on
  // the description — and the `aria-describedby` every drag handle points at —
  // comes out different on the two sides and hydration mismatches. `useId` is
  // the one generator React keeps in step across server and client.
  const dndId = useId();

  // Reordering: dnd-kit, same sensors as the core library's board. The pointer
  // sensor needs a small activation distance so a click on the handle (or a
  // touch-scroll started over it) isn't read as a drag; the keyboard sensor is
  // what makes the handle a real drag control for non-pointer users.
  const sortableIds = useMemo(() => fields.map(field => field.id), [fields]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const from = sortableIds.indexOf(String(active.id));
      const to = sortableIds.indexOf(String(over.id));
      if (from !== -1 && to !== -1) move(from, to);
    },
    [sortableIds, move],
  );

  // Live-region announcements. The array only changes on drop, so an id's
  // position is its index in `sortableIds` throughout the gesture.
  const dragAnnouncements = useMemo<Announcements>(() => {
    const label = (id: string | number) => {
      const index = sortableIds.indexOf(String(id));
      const name = getValues(`scripts.${index}.name`);
      return { position: index + 1, name: name || `script ${index + 1}` };
    };
    const total = sortableIds.length;
    return {
      onDragStart: ({ active }) => {
        const { name, position } = label(active.id);
        return `Picked up ${name}. It is in position ${position} of ${total}.`;
      },
      onDragOver: ({ over }) => (over ? `Moved to position ${label(over.id).position} of ${total}.` : undefined),
      onDragEnd: ({ over }) =>
        over
          ? `Dropped in position ${label(over.id).position} of ${total}.`
          : 'Reorder cancelled. The script stayed in its original position.',
      onDragCancel: ({ active }) =>
        `Reorder cancelled. ${label(active.id).name} stayed in position ${label(active.id).position} of ${total}.`,
    };
  }, [sortableIds, getValues]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      <div className="flex items-end min-h-[72px] pt-[var(--spacing-system-l)]">
        <h2 className="text-h2 text-ods-text-primary">Scheduled Scripts</h2>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements: dragAnnouncements, screenReaderInstructions: dragInstructions }}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-[var(--spacing-system-lf)]">
            {fields.map((field, index) => (
              <ScheduleScriptPickerCard
                key={field.id}
                id={field.id}
                index={index}
                supportedPlatforms={supportedPlatforms}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
                disabled={disabled}
                showErrors={showErrors}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
