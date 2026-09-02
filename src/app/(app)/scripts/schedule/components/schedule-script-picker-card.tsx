'use client';

import { OS_PLATFORMS, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import { SortableMoveButtons, useSortableItem } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DraggerIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Autocomplete,
  Button,
  Input,
  Label,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FocusEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { parseKeyValues } from '../../shared/utils/script-key-values';
import { envVarsToPairs, platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleScriptsAutocomplete } from '../hooks/use-schedule-scripts-autocomplete';
import { type EditScheduleFormData, EMPTY_SCRIPT_ROW } from '../types/edit-schedule.types';
import { toEnvVarInputs } from '../utils/schedule-script-params';

/** Fallback when the picked script carries no timeout of its own (design default). */
const DEFAULT_TIMEOUT_SECONDS = 90;

/** Sentinel for "no script picked yet" — the field is locked and renders empty. */
const UNSET_TIMEOUT = 0;

interface ScheduleScriptPickerCardProps {
  index: number;
  /** How many cards the list has — disables the move buttons at the ends. */
  count: number;
  /** UI platform ids the schedule targets — narrows the script search server-side. */
  supportedPlatforms: string[];
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
  /**
   * Controls inline error visibility — the parent flips this true once the
   * user attempts Save, so errors stay hidden on a pristine form (mirrors
   * `ScriptFormFields.showErrors`).
   */
  showErrors?: boolean;
}

function ScriptPlatformIcons({ platforms }: { platforms: string[] }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {OS_PLATFORMS.filter(p => platforms.includes(p.id)).map(p => (
        <p.icon key={p.id} className="h-3.5 w-3.5 text-ods-text-secondary opacity-60" />
      ))}
    </span>
  );
}

/**
 * One card of the schedule's ordered script list: drag handle, script
 * autocomplete, timeout and the script's arguments / environment variables.
 *
 * **Order is the payload.** The card index IS the run order — the backend
 * stores `scriptIds: [ID!]` in run order, so reordering rewrites that array.
 *
 * Sorting runs on the core library's `SortableList` (`useSortableItem`), the
 * same Pragmatic stack the ticket board uses. Only the handle starts a drag,
 * so text selection inside the fields keeps working, and the handle carries
 * the keyboard path (Arrow Up / Arrow Down, one press one move) with
 * live-region announcements wired up by the list. On touch/narrow viewports
 * no drag exists at all — an up/down button pair renders beside the delete
 * button instead.
 *
 * Arguments and env vars ARE persisted, as this schedule's per-script override
 * (`scriptCustomParams`): they seed from the picked script's defaults, and only
 * a half the user moves off those defaults is written back — so leaving a card
 * untouched keeps the schedule following later edits to the script itself.
 *
 * ⚠ **Timeout is still editable but not persisted**: the override input carries
 * args and env vars only. It is
 * seeded from the script's own default, which is what the run actually uses, so
 * the card shows the truth — it just cannot be changed per schedule yet.
 */
export function ScheduleScriptPickerCard({
  index,
  count,
  supportedPlatforms,
  onRemove,
  canRemove,
  disabled = false,
  showErrors = true,
}: ScheduleScriptPickerCardProps) {
  const { control, setValue, watch } = useFormContext<EditScheduleFormData>();
  const selected = watch(`scripts.${index}`);

  // Timeout / arguments / env vars all belong to the picked script and are
  // seeded from it, so they stay locked until there is a script to belong to.
  const runParamsLocked = disabled || !selected?.scriptId;

  const { itemRef, dragHandleProps, isDragging, dragAndDropEnabled } = useSortableItem();
  // Mobile folds the args/env editors into accordions; `undefined` (SSR/first
  // render) keeps the expanded variant and settles before first paint.
  const isMdUp = useMdUp();

  const { scripts, isLoading, inputValue, onInputChange, onOpen, onClose } =
    useScheduleScriptsAutocomplete(supportedPlatforms);

  // Fires only when focus leaves the entire autocomplete widget (not on internal focus moves).
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
  };

  // Every script stays offered in every card: the same script may legitimately
  // appear in a schedule more than once (the run order is the payload, so
  // "A, B, A" is a real recipe). Rows are keyed by the `useFieldArray` field id,
  // not by `scriptId`, so duplicates never collide in React or in dnd-kit.
  //
  // The selected script may not be in the current search page — prepend it so
  // the Autocomplete can always render its label (edit mode, stale searches).
  const options = scripts.map(s => ({ label: s.name, value: s.id }));
  if (selected?.scriptId && !options.some(o => o.value === selected.scriptId)) {
    options.unshift({ label: selected.name, value: selected.scriptId });
  }

  const handleScriptChange = (scriptId: string | null) => {
    if (!scriptId) {
      // Back to the locked state: the run parameters belong to the script, so
      // clearing the script clears them rather than leaving a stale timeout.
      setValue(`scripts.${index}`, EMPTY_SCRIPT_ROW, { shouldValidate: true });
      return;
    }
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;

    // Seed the run parameters from the script itself — that IS what the
    // schedule will run with, so the card never shows blanks for a real script.
    // A freshly picked script therefore starts UNCUSTOMISED: the defaults ride
    // along beside the editable copy, and submit writes an override only for a
    // half the user actually moved off them.
    const defaultEnvVars = toEnvVarInputs(script.envVars);
    setValue(
      `scripts.${index}`,
      {
        scriptId: script.id,
        name: script.name,
        // Carried into the form so the schedule-vs-script platform check can run
        // on submit without re-reading the (search-scoped, paged) picker list.
        supportedPlatforms: platformsToIds(script.supportedPlatforms),
        timeoutSeconds: script.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
        args: parseKeyValues(script.defaultArgs, ' '),
        envVars: envVarsToPairs(script.envVars),
        defaultArgs: script.defaultArgs ? [...script.defaultArgs] : [],
        defaultEnvVars,
      },
      { shouldValidate: true, shouldDirty: true },
    );
  };

  return (
    <div
      ref={itemRef}
      // No inline style here — the list writes `transform` straight onto this
      // node during a drag (see `SortableList`).
      className={`flex flex-col gap-[var(--spacing-system-sf)] rounded-[6px] border bg-ods-bg p-[var(--spacing-system-l)] md:gap-[var(--spacing-system-lf)] ${
        isDragging ? 'relative z-10 border-ods-accent shadow-lg' : 'border-ods-border'
      }`}
    >
      {/* Touch (no DnD): the mock stacks the rows on every width and puts the
          move buttons + delete in the Select Script row, spaced by a fixed 8px;
          with DnD the approved desktop layout stays — handle beside the select,
          delete beside the timeout, the two halves side by side from md. */}
      <div
        className={`flex flex-col gap-[var(--spacing-system-sf)] md:gap-[var(--spacing-system-lf)] ${dragAndDropEnabled ? 'md:flex-row md:items-end' : ''}`}
      >
        <div
          className={`flex min-w-0 flex-1 items-end ${
            dragAndDropEnabled ? 'gap-[var(--spacing-system-xs)]' : 'gap-[var(--spacing-system-xsf)]'
          }`}
        >
          {dragAndDropEnabled && (
            <button
              type="button"
              {...dragHandleProps}
              disabled={disabled}
              aria-label={`Reorder ${selected?.name || `script ${index + 1}`}`}
              className={`flex size-12 shrink-0 items-center justify-center rounded-[6px] text-ods-text-secondary hover:text-ods-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ods-border-focus disabled:cursor-not-allowed disabled:opacity-30 ${
                isDragging ? 'cursor-grabbing text-ods-text-primary' : 'cursor-grab'
              }`}
            >
              <DraggerIcon size={24} />
            </button>
          )}

          <div
            className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]"
            onFocus={onOpen}
            onBlur={handleBlur}
          >
            <Label className="text-h4">Select Script</Label>
            <Controller
              name={`scripts.${index}.scriptId`}
              control={control}
              render={({ fieldState }) => (
                <Autocomplete<string>
                  options={options}
                  value={selected?.scriptId || null}
                  onChange={handleScriptChange}
                  placeholder="Select a script..."
                  disableClientFilter
                  onInputChange={onInputChange}
                  loading={isLoading}
                  loadingText="Searching scripts..."
                  noOptionsText={inputValue ? 'No scripts match your search' : 'No scripts available'}
                  disabled={disabled}
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                  // Mirrors the Autocomplete's own option layout (flex row,
                  // truncated label with a title) — overriding `renderOption`
                  // opts out of it, which is what let long script names wrap.
                  renderOption={(option, isSelected) => (
                    <span className="flex w-full min-w-0 items-center gap-[var(--spacing-system-xsf)]">
                      <span className="min-w-0 flex-1">
                        <TruncateText className={isSelected ? 'text-ods-accent' : undefined}>
                          {option.label}
                        </TruncateText>
                      </span>
                      <ScriptPlatformIcons
                        platforms={platformsToIds(scripts.find(s => s.id === option.value)?.supportedPlatforms)}
                      />
                    </span>
                  )}
                />
              )}
            />
          </div>

          {!dragAndDropEnabled && (
            <>
              <SortableMoveButtons index={index} count={count} label={selected?.name || `script ${index + 1}`} />
              <Button
                variant="outline"
                size="icon"
                onClick={onRemove}
                disabled={!canRemove || disabled}
                aria-label="Remove script from schedule"
                className="text-ods-error disabled:opacity-30"
              >
                <TrashIcon size={20} />
              </Button>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-xs)]">
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Timeout</Label>
            <Controller
              name={`scripts.${index}.timeoutSeconds`}
              control={control}
              render={({ field, fieldState }) => (
                // Locked until a script is picked: the timeout belongs to the
                // script, so the field stays EMPTY until there is one — the
                // sentinel is a "nothing here yet" marker, and rendering it as
                // a literal 0 would read as a real (and invalid) timeout.
                // Picking a script writes its own timeout in.
                <Input
                  type="number"
                  min={1}
                  className="w-full"
                  value={field.value ? String(field.value) : ''}
                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : UNSET_TIMEOUT)}
                  disabled={runParamsLocked}
                  endAdornment={<span className="text-ods-text-secondary text-h6">Seconds</span>}
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                />
              )}
            />
          </div>

          {dragAndDropEnabled && (
            <Button
              variant="outline"
              size="icon"
              onClick={onRemove}
              disabled={!canRemove || disabled}
              aria-label="Remove script from schedule"
              className="text-ods-error disabled:opacity-30"
            >
              <TrashIcon size={20} />
            </Button>
          )}
        </div>
      </div>

      {/* Arguments / env vars are the same class of field as Timeout — they
          belong to the picked script and are seeded from it — so they stay
          locked until there is a script to belong to.
          Mobile folds the two editors into "Edit Default …" accordions (per the
          mock); from md up they stay expanded side by side. The editors are the
          only difference — both branches render the same controlled fields. */}
      {isMdUp === false ? (
        <Accordion type="multiple" className="overflow-hidden rounded-[6px] border border-ods-border">
          <AccordionItem value="args" className="border-ods-border data-[state=closed]:bg-ods-card">
            <AccordionTrigger className="h-14 px-[var(--spacing-system-sf)] py-0 text-ods-text-primary text-h6 hover:no-underline [&>svg]:text-ods-text-secondary">
              Edit Default Script Arguments
            </AccordionTrigger>
            {/* The editor's own title would duplicate the trigger — an empty
                titleLabel renders an empty <label>, hidden by :empty. */}
            <AccordionContent className="px-[var(--spacing-system-sf)] [&_label:empty]:hidden">
              <Controller
                name={`scripts.${index}.args`}
                control={control}
                render={({ field }) => (
                  <ScriptArguments
                    arguments={field.value}
                    onArgumentsChange={field.onChange}
                    keyPlaceholder="Key"
                    valuePlaceholder="Enter Value (empty=flag)"
                    addButtonLabel="Add Script Argument"
                    titleLabel=""
                    disabled={runParamsLocked}
                  />
                )}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="env" className="border-b-0 border-ods-border data-[state=closed]:bg-ods-card">
            <AccordionTrigger className="h-14 px-[var(--spacing-system-sf)] py-0 text-ods-text-primary text-h6 hover:no-underline [&>svg]:text-ods-text-secondary">
              Edit Default Environment Vars
            </AccordionTrigger>
            <AccordionContent className="px-[var(--spacing-system-sf)] [&_label:empty]:hidden">
              <Controller
                name={`scripts.${index}.envVars`}
                control={control}
                render={({ field }) => (
                  <ScriptArguments
                    arguments={field.value}
                    onArgumentsChange={field.onChange}
                    keyPlaceholder="Key"
                    valuePlaceholder="Enter Value"
                    addButtonLabel="Add Environment Var"
                    titleLabel=""
                    disabled={runParamsLocked}
                  />
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <div className="flex flex-col items-start gap-[var(--spacing-system-lf)] md:flex-row">
          <div className="w-full min-w-0 flex-1 [&_label]:text-h4">
            <Controller
              name={`scripts.${index}.args`}
              control={control}
              render={({ field }) => (
                <ScriptArguments
                  arguments={field.value}
                  onArgumentsChange={field.onChange}
                  keyPlaceholder="Key"
                  valuePlaceholder="Enter Value (empty=flag)"
                  addButtonLabel="Add Script Argument"
                  titleLabel="Script Arguments"
                  disabled={runParamsLocked}
                />
              )}
            />
          </div>
          <div className="w-full min-w-0 flex-1 [&_label]:text-h4">
            <Controller
              name={`scripts.${index}.envVars`}
              control={control}
              render={({ field }) => (
                <ScriptArguments
                  arguments={field.value}
                  onArgumentsChange={field.onChange}
                  keyPlaceholder="Key"
                  valuePlaceholder="Enter Value"
                  addButtonLabel="Add Environment Var"
                  titleLabel="Environment Vars"
                  disabled={runParamsLocked}
                />
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
