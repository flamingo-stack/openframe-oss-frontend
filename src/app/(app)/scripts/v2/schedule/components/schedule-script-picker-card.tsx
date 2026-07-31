'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OS_PLATFORMS, ScriptArguments } from '@flamingo-stack/openframe-frontend-core';
import { DraggerIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { FocusEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { usePrefersReducedMotion } from '@/app/hooks/use-prefers-reduced-motion';
import { parseKeyValues } from '../../../utils/script-key-values';
import { envVarsToPairs, platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleScriptsAutocomplete } from '../hooks/use-schedule-scripts-autocomplete';
import type { EditScheduleFormData } from '../types/edit-schedule.types';

/** Fallback when the picked script carries no timeout of its own (design default). */
const DEFAULT_TIMEOUT_SECONDS = 90;

/** Sentinel for "no script picked yet" — the field is locked and renders empty. */
const UNSET_TIMEOUT = 0;

interface ScheduleScriptPickerCardProps {
  /** Sortable id — the `useFieldArray` field id, stable across reorders. */
  id: string;
  index: number;
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
        <p.icon key={p.id} className="w-3.5 h-3.5 text-ods-text-secondary opacity-60" />
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
 * Sorting runs on dnd-kit (`useSortable`), the same stack the core library's
 * board uses. Only the handle is an activator (`setActivatorNodeRef` +
 * `listeners`), so text selection inside the fields keeps working; dnd-kit's
 * `attributes` make that handle a full keyboard drag control (Space to lift,
 * arrows to move, Space to drop, Esc to cancel) with live-region announcements
 * wired up by the list — no separate keyboard affordance needed.
 *
 * ⚠ Timeout / arguments / env vars are editable but **not persisted yet**: the
 * schedule model has no per-script overrides (`scriptEntries` in
 * docs/script-schedules-v2-graphql-gaps.md §3). They are seeded from the picked
 * script's own defaults, which is exactly what a run uses today, so the card
 * shows the truth until the input lands.
 */
export function ScheduleScriptPickerCard({
  id,
  index,
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

  // dnd-kit drives the sortable slide from an inline style, which no CSS media
  // query can opt out of — so drop the transition for reduced-motion users and
  // let the cards snap into place instead.
  const prefersReducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    transition: prefersReducedMotion ? null : undefined,
  });

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
      setValue(
        `scripts.${index}`,
        { scriptId: '', name: '', supportedPlatforms: [], timeoutSeconds: UNSET_TIMEOUT, args: [], envVars: [] },
        { shouldValidate: true },
      );
      return;
    }
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;

    // Seed the run parameters from the script itself — that IS what the
    // schedule will run with, so the card never shows blanks for a real script.
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
      },
      { shouldValidate: true, shouldDirty: true },
    );
  };

  return (
    <div
      ref={setNodeRef}
      // `Translate` (not `Transform`): the card must slide, never scale — a
      // scaled form card would blur its inputs mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-ods-bg border rounded-[6px] p-[var(--spacing-system-lf)] flex flex-col gap-[var(--spacing-system-lf)] ${
        isDragging ? 'relative z-10 border-ods-accent shadow-lg' : 'border-ods-border'
      }`}
    >
      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] md:items-end">
        <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={`Reorder ${selected?.name || `script ${index + 1}`}`}
            // `touch-none` hands touch gestures to the pointer sensor instead of
            // letting the page scroll steal them.
            className={`size-12 shrink-0 flex items-center justify-center rounded-[6px] touch-none text-ods-text-secondary hover:text-ods-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ods-border-focus disabled:opacity-30 disabled:cursor-not-allowed ${
              isDragging ? 'cursor-grabbing text-ods-text-primary' : 'cursor-grab'
            }`}
          >
            <DraggerIcon size={24} />
          </button>

          <div
            className="flex-1 flex flex-col gap-[var(--spacing-system-xxs)] min-w-0"
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
                  renderOption={option => (
                    <span className="flex w-full min-w-0 items-center gap-[var(--spacing-system-xsf)]">
                      <span className="min-w-0 flex-1 truncate" title={option.label}>
                        {option.label}
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
        </div>

        <div className="flex-1 min-w-0 flex gap-[var(--spacing-system-xs)] items-end">
          <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-xxs)]">
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
                  endAdornment={<span className="text-h6 text-ods-text-secondary">Seconds</span>}
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                />
              )}
            />
          </div>

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
        </div>
      </div>

      {/* Arguments / env vars are the same class of field as Timeout — they
          belong to the picked script and are seeded from it — so they stay
          locked until there is a script to belong to. */}
      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)] items-start">
        <div className="flex-1 min-w-0 w-full">
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
        <div className="flex-1 min-w-0 w-full">
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
    </div>
  );
}
