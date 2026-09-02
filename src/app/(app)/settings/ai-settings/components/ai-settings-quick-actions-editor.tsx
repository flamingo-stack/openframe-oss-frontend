'use client';

import {
  type SortableRowRenderArgs,
  TicketStatusConfigList,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DraggerIcon, PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxWithDescription,
  Input,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { type Control, Controller, type FieldValues, useFieldArray, useWatch } from 'react-hook-form';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import type { AiQuickAction } from '../types/ai-settings';
import type { QuickActionsFormValues } from '../types/quick-action.types';
import { AiSettingsQuickActions, type QuickActionsAgentConfig } from './ai-settings-quick-actions';

/** Wording + preview-header source for the "use default" checkbox. */
export interface QuickActionsDefaultCopy {
  /** Checkbox title. */
  title: string;
  /** Checkbox description. */
  description: string;
  /** Confirm-dialog body shown when re-enabling defaults over customs. */
  confirmDescription: string;
  /** Dimmed preview header: true → "OpenFrame …", false → "Organization …". */
  previewIsOpenFrame: boolean;
}

interface AiSettingsQuickActionsEditorProps<T extends QuickActionsFormValues & FieldValues> {
  control: Control<T>;
  title?: string;
  agentConfig: QuickActionsAgentConfig;
  /**
   * The default quick actions the host offers: OpenFrame's Product-Hub set on
   * the tenant-wide screens, the tenant-inherited set on the customer screen
   * (where "default" means "inherit the tenant config", not OpenFrame's set).
   * Rendered as the dimmed read-only preview while the checkbox is on, and used
   * to seed the editor rows on uncheck.
   */
  defaultActions: AiQuickAction[];
  /**
   * Overrides the "use default" wording + preview header. Omitted on the
   * tenant-wide screens (their default is literally OpenFrame's curated set);
   * the customer screen passes its own copy because there "default" inherits
   * the tenant's configured actions, which may be customs.
   */
  defaultActionsCopy?: QuickActionsDefaultCopy;
  className?: string;
}

/**
 * Shared quick actions editor for the Fae and Mingo settings forms.
 * Owns the `quickActions` field array + the `quickActionsIsDefault` flag; the
 * host form only needs fields matching QuickActionsFormValues in its schema.
 *
 * Checked → the hub defaults are shown read-only (dimmed); unchecking seeds
 * the rows with those defaults for editing; re-checking asks for confirmation
 * (customs are replaced on save).
 */
export function AiSettingsQuickActionsEditor<T extends QuickActionsFormValues & FieldValues>({
  control,
  title = 'Assistant Quick Actions',
  agentConfig,
  defaultActions,
  defaultActionsCopy,
  className,
}: AiSettingsQuickActionsEditorProps<T>) {
  // The generic constraint guarantees the form has compatible quick-action
  // fields; the cast narrows Control to that shape for type-safe field names.
  const quickActionsControl = control as unknown as Control<QuickActionsFormValues>;
  const { fields, append, remove, replace, move } = useFieldArray({
    control: quickActionsControl,
    name: 'quickActions',
  });
  const isDefault = useWatch({ control: quickActionsControl, name: 'quickActionsIsDefault' });

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Default wording = OpenFrame's Product-Hub set (the tenant-wide screens).
  const copy: QuickActionsDefaultCopy = defaultActionsCopy ?? {
    title: 'Use OpenFrame default actions',
    description: 'Recommended set of quick actions curated and approved by OpenFrame.',
    confirmDescription: `This replaces your customized quick actions with the standard ${agentConfig.agentLabel} set. Any actions you added or edited will be removed.`,
    previewIsOpenFrame: true,
  };

  const handleToggle = (checked: boolean, onChange: (value: boolean) => void) => {
    if (!checked) {
      onChange(false);
      // Seed the editor with the hub defaults (as new custom rows — no ids, the
      // BE assigns them on save). Only when the rows aren't already populated.
      if (fields.length === 0) {
        replace(defaultActions.map(action => ({ name: action.name, instructions: action.instructions })));
      }
      return;
    }
    // Turning defaults back on discards the customized rows — confirm first.
    setConfirmOpen(true);
  };

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-l)]', className)}>
      <span className="text-ods-text-primary text-h2">{title}</span>

      <Controller
        name="quickActionsIsDefault"
        control={quickActionsControl}
        render={({ field }) => (
          <>
            <CheckboxWithDescription
              id={`use-default-quick-actions-${agentConfig.agentSlug}`}
              checked={field.value}
              onCheckedChange={checked => handleToggle(checked, field.onChange)}
              title={copy.title}
              description={copy.description}
              // The lib block ships 14px Label + p-4; the mock (checkbox-block)
              // uses the same type ramp as the view banner: 18/24 title, 14/20
              // caption, 12px padding, centered 24px checkbox.
              className={cn(
                'items-center gap-[var(--spacing-system-s)] rounded-md p-[var(--spacing-system-sf)]',
                '[&_button]:mt-0 [&_button]:size-6',
                '[&>div>label]:mb-0 [&>div>label]:leading-6 [&>div>label]:text-h4',
                '[&>div>span]:leading-5 [&>div>span]:text-h6',
              )}
            />
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Use Default Actions"
              description={copy.confirmDescription}
              confirmLabel="Use Default"
              variant="destructive"
              onConfirm={() => {
                field.onChange(true);
                replace([]);
                setConfirmOpen(false);
              }}
            />
          </>
        )}
      />

      {isDefault ? (
        // Hub-defaults preview (fetched by the host, so it's available even
        // when the persisted config holds customs).
        defaultActions.length > 0 && (
          <AiSettingsQuickActions
            actions={defaultActions}
            isDefault={copy.previewIsOpenFrame}
            agentConfig={agentConfig}
            className="pointer-events-none opacity-50"
          />
        )
      ) : (
        <>
          {fields.length > 0 && (
            <Button
              type="button"
              variant="transparent"
              onClick={() => replace([])}
              className="!h-auto self-end !p-0 text-ods-error underline text-h6 hover:text-ods-error"
            >
              Delete All
            </Button>
          )}

          {/* Sortable list — drag on desktop, up/down buttons on touch. The
              reordered form-array order is exactly what the existing save
              mutation submits, so persisting the order needs no extra wiring.
              `field.id` is RHF's stable per-row key; the index is resolved by id
              because `renderRow` receives only the item. */}
          <TicketStatusConfigList
            items={fields}
            onReorder={move}
            getItemLabel={index => fields[index]?.name || undefined}
            className="gap-[var(--spacing-system-xs)]"
            renderRow={(field, dragArgs) => {
              const index = fields.findIndex(f => f.id === field.id);
              return (
                <QuickActionCard
                  index={index}
                  control={quickActionsControl}
                  onRemove={() => remove(index)}
                  drag={dragArgs}
                />
              );
            }}
          />

          <Button
            type="button"
            variant="transparent"
            onClick={() => append({ name: '', instructions: '' })}
            leftIcon={<PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />}
            className="self-start"
          >
            Add Quick Action
          </Button>
        </>
      )}
    </div>
  );
}

interface QuickActionCardProps {
  index: number;
  control: Control<QuickActionsFormValues>;
  onRemove: () => void;
  drag: SortableRowRenderArgs;
}

/** Offset that skips a field label (h4 line + its mb-1) so rail content centers
 *  on the input below — 24px mobile / 28px from tablet up, per the mock. */
const LABEL_OFFSET_CLASS = 'pt-[calc(var(--font-line-space-h4-body)+0.25rem)]';

/**
 * Card layout per the mock (icon field ships with the SVG-icons follow-up):
 * - desktop (lg+):     [handle] [Action Name] [Action Instructions] [delete] in one row
 * - mobile/tablet:     [handle] [Action Name] [delete], Instructions on the next
 *                      row indented to the Name column
 * On touch/narrow viewports (`drag.moveButtons` set) the drag rail disappears
 * and the up/down pair renders beside the delete button instead.
 * Transparent background — only the border outlines the card.
 */
function QuickActionCard({ index, control, onRemove, drag }: QuickActionCardProps) {
  // Touch mode: no drag rail column, reorder buttons live beside delete.
  const touchReorder = drag.moveButtons != null;
  return (
    <div
      className={cn(
        touchReorder
          ? // Touch: the mock spaces name / move buttons / delete by the same
            // fixed 8px, so the grid gap matches the controls-cluster gap.
            'grid grid-cols-[minmax(0,1fr)_auto] gap-x-[var(--spacing-system-xsf)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
          : 'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-[var(--spacing-system-xs)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]',
        'items-start gap-y-[var(--spacing-system-m)]',
        'rounded-md border border-ods-border p-[var(--spacing-system-m)]',
        drag.isDragging && 'bg-ods-bg opacity-70 shadow-lg',
      )}
    >
      {/* Drag rail: a 44/48px hit box matching the input height, icon 16/24. */}
      {!touchReorder && (
        <div className={cn('col-start-1 row-start-1', LABEL_OFFSET_CLASS)}>
          <button
            type="button"
            aria-label="Drag to reorder"
            className="flex size-11 cursor-grab items-center justify-center rounded-sm text-ods-text-secondary outline-none hover:text-ods-text-primary focus-visible:ring-2 focus-visible:ring-ods-focus active:cursor-grabbing md:size-12"
            {...drag.dragHandleProps}
          >
            <DraggerIcon className="size-4 md:size-6" />
          </button>
        </div>
      )}

      <div className={cn('row-start-1 min-w-0', touchReorder ? 'col-start-1' : 'col-start-2')}>
        <Controller
          name={`quickActions.${index}.name`}
          control={control}
          render={({ field, fieldState }) => (
            <Input {...field} label="Action Name" labelVariant="large" error={fieldState.error?.message} />
          )}
        />
      </div>

      <div
        className={cn(
          'col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:row-start-1',
          touchReorder ? 'col-start-1 lg:col-start-2' : 'col-start-2 lg:col-start-3',
        )}
      >
        <Controller
          name={`quickActions.${index}.instructions`}
          control={control}
          render={({ field, fieldState }) => (
            <Textarea
              {...field}
              label="Action Instructions"
              labelVariant="large"
              error={fieldState.error?.message}
              rows={4}
            />
          )}
        />
      </div>

      <div
        className={cn(
          'row-start-1 flex items-center gap-[var(--spacing-system-xsf)]',
          touchReorder ? 'col-start-2 lg:col-start-3' : 'col-start-3 lg:col-start-4',
          LABEL_OFFSET_CLASS,
        )}
      >
        {drag.moveButtons}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          aria-label="Remove quick action"
          leftIcon={<TrashIcon />}
          className="[&_svg]:!text-ods-error"
        />
      </div>
    </div>
  );
}
