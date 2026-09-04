'use client';
'use no memo';

import {
  Label,
  ScriptArguments,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core';
import { SelectButton } from '@flamingo-stack/openframe-frontend-core/components/features';
import { CheckboxBlock, Input, Textarea, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { SHELL_TYPES, type ShellTypeDefinition } from '@flamingo-stack/openframe-frontend-core/types';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn, useFormState } from 'react-hook-form';
import { ScriptEditor } from '../../shared/components/script-editor';
import { CATEGORIES, type EditScriptFormData } from '../../shared/types/edit-script.types';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '../../shared/utils/script-utils';

interface ScriptFormFieldsProps {
  form: UseFormReturn<EditScriptFormData>;
  /** Restrict the Shell Type options to these ids. Omit to show every SHELL_TYPES entry. */
  allowedShellIds?: string[];
  /**
   * Provide a custom Shell Type option list (label + icon). Takes precedence over
   * `allowedShellIds`. Scripts v2 passes its host-owned `SCRIPT_SHELL_TYPES`.
   */
  shellTypes?: ShellTypeDefinition[];
  /** Hide the Category field (the native API has no such concept). */
  hideCategory?: boolean;
  /** Hide the "Run as User" toggle (not a stored script field on the native API). */
  hideRunAsUser?: boolean;
  /**
   * Optional tags picker rendered after the description. Passed by scripts v2
   * (owns the Relay tag fetching); legacy callers omit it.
   */
  tagsField?: ReactNode;
  /**
   * Disable every control (inputs, selects, platform cards, args, editor).
   * Used by the edit page while the script query is still loading, so the real
   * empty form doubles as the loading state — no skeleton swap, no remount.
   */
  disabled?: boolean;
  /**
   * Controls inline error visibility. The parent flips this true once the user
   * attempts an action (Save or Test) so errors stay hidden on a pristine form,
   * then track validation live. Which fields actually carry an error is decided
   * by the caller's `form.trigger` scope per action — Save validates everything,
   * Test only its runnable prerequisites. Defaults to true (always show) for
   * legacy callers that validate eagerly.
   */
  showErrors?: boolean;
}

export function ScriptFormFields({
  form,
  allowedShellIds,
  shellTypes: shellTypesProp,
  hideCategory,
  hideRunAsUser,
  tagsField,
  disabled = false,
  showErrors = true,
}: ScriptFormFieldsProps) {
  const { control, watch, setValue, getValues } = form;
  const watchedSupportedPlatforms = watch('supported_platforms');
  const isMdUp = useMdUp();
  // Subscribe to errors so the platform inline message tracks validation live.
  const { errors } = useFormState({ control });

  const shellTypes =
    shellTypesProp ?? (allowedShellIds ? SHELL_TYPES.filter(s => allowedShellIds.includes(s.value)) : SHELL_TYPES);

  return (
    <>
      {/* Supported Platform Section */}
      {/* `data-invalid`: the block has no input of its own, so it carries the
          marker itself — that is what `scrollToFirstInvalidField` looks for. */}
      <div className="relative" data-invalid={(showErrors && !!errors.supported_platforms) || undefined}>
        <Label className="text-ods-text-primary text-h4">Supported Platform</Label>
        <div className="mt-1 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {AVAILABLE_PLATFORMS.map(p => {
            const isDisabled = DISABLED_PLATFORMS.includes(p.id);
            return (
              <SelectButton
                key={p.id}
                title={p.name}
                icon={<p.icon className="h-5 w-5" />}
                selected={!isDisabled && watchedSupportedPlatforms.includes(p.id)}
                disabled={isDisabled || disabled}
                tag={isDisabled ? (isMdUp ? 'Coming Soon' : 'Soon') : undefined}
                onClick={
                  isDisabled
                    ? undefined
                    : () => {
                        const current = getValues('supported_platforms');
                        const has = current.includes(p.id);
                        // Allow deselecting any item, including the last one — the
                        // "at least one platform" rule is enforced by validation on submit.
                        setValue('supported_platforms', has ? current.filter(id => id !== p.id) : [...current, p.id], {
                          shouldValidate: true,
                        });
                      }
                }
              />
            );
          })}
          {!hideRunAsUser && (
            <Controller
              name="run_as_user"
              control={control}
              render={({ field }) => (
                <CheckboxBlock
                  checked={field.value}
                  onCheckedChange={checked => field.onChange(checked)}
                  label="Run as User"
                  disabled={disabled}
                  // Match the SelectButton card height (h-11 md:h-16) — the block's
                  // own min-height is shorter, so override it on the inner label.
                  className="[&>label]:h-11 [&>label]:min-h-0 md:[&>label]:h-16"
                />
              )}
            />
          )}
        </div>
        {showErrors && errors.supported_platforms && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full">
            <TruncateText variant="h6" className="text-ods-error">
              {errors.supported_platforms.message ?? ''}
            </TruncateText>
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-1">
              <Label className="text-ods-text-primary text-h4">Name</Label>
              <Input
                type="text"
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                placeholder="Enter Script Name Here"
                error={showErrors ? fieldState.error?.message : undefined}
                invalid={showErrors && !!fieldState.error}
              />
            </div>
          )}
        />

        <Controller
          name="shell"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-1">
              <Label className="text-ods-text-primary text-h4">Shell Type</Label>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                >
                  <SelectValue placeholder="Select Shell Type" />
                </SelectTrigger>
                <SelectContent>
                  {shellTypes.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <s.icon className="h-5 w-5" />
                        <span>{s.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />

        {!hideCategory && (
          <Controller
            name="category"
            control={control}
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <Label className="text-ods-text-primary text-h4">Category</Label>
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger
                    error={showErrors ? fieldState.error?.message : undefined}
                    invalid={showErrors && !!fieldState.error}
                  >
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        )}

        <Controller
          name="default_timeout"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-1">
              <Label className="text-ods-text-primary text-h4">Timeout</Label>
              <Input
                type="number"
                value={field.value}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : '')}
                disabled={disabled}
                placeholder="90"
                endAdornment={<span className="text-ods-text-secondary text-h6">Seconds</span>}
                error={showErrors ? fieldState.error?.message : undefined}
                invalid={showErrors && !!fieldState.error}
              />
            </div>
          )}
        />
      </div>

      {/* Description */}
      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <div>
            <Label className="text-ods-text-primary text-h4">Description</Label>
            <Textarea
              value={field.value}
              onChange={field.onChange}
              rows={4}
              disabled={disabled}
              placeholder="Enter Script Description"
            />
          </div>
        )}
      />

      {/* Tags */}
      {tagsField}

      {/* Script Arguments and Environment Variables */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <Controller
          name="args"
          control={control}
          render={({ field }) => (
            <ScriptArguments
              arguments={field.value}
              onArgumentsChange={field.onChange}
              keyPlaceholder="Enter Argument"
              valuePlaceholder="Enter Value (empty=flag)"
              addButtonLabel="Add Script Argument"
              titleLabel="Script Arguments"
              disabled={disabled}
              className="flex-1"
            />
          )}
        />
        <Controller
          name="env_vars"
          control={control}
          render={({ field }) => (
            <ScriptArguments
              arguments={field.value}
              onArgumentsChange={field.onChange}
              keyPlaceholder="Enter Environment Var"
              valuePlaceholder="Enter Value"
              addButtonLabel="Add Environment Var"
              titleLabel="Environment Vars"
              disabled={disabled}
              className="flex-1"
            />
          )}
        />
      </div>

      {/* Syntax/Script Content */}
      <Controller
        name="script_body"
        control={control}
        render={({ field, fieldState }) => (
          // The editor is not a focusable control the marker can sit on, so the
          // wrapper carries it (the scroll helper falls back to scrolling).
          <div data-invalid={(showErrors && !!fieldState.error) || undefined}>
            <Label className="text-ods-text-primary text-h4">Syntax</Label>
            <ScriptEditor
              value={field.value}
              onChange={field.onChange}
              shell={getValues('shell')}
              readOnly={disabled}
              // `disabled` on this form means "the record is still in flight",
              // so the editor holds its placeholder until the body arrives
              // rather than being revealed empty and filled a moment later.
              loading={disabled}
              height="600px"
              invalid={showErrors && !!fieldState.error}
            />
            {showErrors && fieldState.error && (
              <div className="mt-1">
                <TruncateText variant="h6" className="text-ods-error">
                  {fieldState.error.message ?? ''}
                </TruncateText>
              </div>
            )}
          </div>
        )}
      />
    </>
  );
}
