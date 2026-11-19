'use client';
'use no memo';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { InsightCheckScopeType, InsightThresholdDirection } from '@/generated/schema-enums';
import { formatThreshold, parameterUnitSuffix } from '../../utils/incident-check-labels';
import {
  type CheckScope,
  type CheckSettingDraft,
  type IncidentCheck,
  type IncidentCheckParameter,
  isSetHere,
  storedDraft,
} from '../../utils/incident-check-transform';
import { inheritLabel, sourceLabel } from './check-source';

const RUN_CHOICES = ['inherit', 'on', 'off'] as const;
type RunChoice = (typeof RUN_CHOICES)[number];

/** One threshold of the form: kept from the scope above, or set here to `value`. */
const parameterSchema = z.object({ setHere: z.boolean(), value: z.string() });

type EditCheckFormValues = {
  run: RunChoice;
  parameters: Array<z.infer<typeof parameterSchema>>;
};

/** The form's schema for one check: a threshold set here is a whole number within the check's bounds. */
function editCheckSchema(parameters: readonly IncidentCheckParameter[]) {
  return z.object({ run: z.enum(RUN_CHOICES), parameters: z.array(parameterSchema) }).superRefine((values, ctx) => {
    values.parameters.forEach((entry, index) => {
      const parameter = parameters[index];
      if (!parameter || !entry.setHere) return;
      const value = Number(entry.value);
      if (entry.value.trim() === '' || !Number.isInteger(value) || value < parameter.min || value > parameter.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['parameters', index, 'value'],
          message: `Enter a whole number from ${parameter.min} to ${parameter.max}`,
        });
      }
    });
  });
}

function defaultValues(check: IncidentCheck, scope: CheckScope): EditCheckFormValues {
  const stored = storedDraft(check, scope);
  return {
    run: stored.enabled === null ? 'inherit' : stored.enabled ? 'on' : 'off',
    parameters: check.parameters.map(parameter => ({
      setHere: isSetHere(parameter.source, scope),
      value: String(parameter.value),
    })),
  };
}

/** "Opens an incident below this value. From 1 to 50, default 10." */
function parameterHint(parameter: IncidentCheckParameter): string {
  const side = `Opens an incident ${parameter.firesWhen === InsightThresholdDirection.BELOW ? 'below' : 'above'} this value. `;
  return `${side}From ${parameter.min} to ${parameter.max}, default ${parameter.defaultValue}.`;
}

function toDraft(check: IncidentCheck, values: EditCheckFormValues): CheckSettingDraft {
  const parameters: Record<string, number> = {};
  values.parameters.forEach((entry, index) => {
    const parameter = check.parameters[index];
    if (parameter && entry.setHere) parameters[parameter.parameter] = Number(entry.value);
  });
  return { enabled: values.run === 'inherit' ? null : values.run === 'on', parameters };
}

interface EditCheckModalProps {
  check: IncidentCheck;
  scope: CheckScope;
  /** "All devices" / the picked customer's, tag's or device's name: the modal's subtitle. */
  scopeName: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: CheckSettingDraft) => void;
}

/**
 * Edit one check at one scope: whether it runs and each threshold, each one either kept from the
 * scope above ("Inherit", with the value it would take) or set here. What is saved is the whole of
 * what the scope stores; nothing set here at all resets it. The caller keys it on the check.
 */
export function EditCheckModal({ check, scope, scopeName, isSaving, onClose, onSave }: EditCheckModalProps) {
  const form = useForm<EditCheckFormValues>({
    resolver: zodResolver(editCheckSchema(check.parameters)),
    defaultValues: defaultValues(check, scope),
  });
  const parameters = form.watch('parameters');
  const inherit = inheritLabel(scope);
  // What "inherit" would give right now: the effective value when it is not set here.
  const inheritedRun = isSetHere(check.enabledSource, scope) ? null : check.enabled;

  const submit = form.handleSubmit(values => onSave(toDraft(check, values)));

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title={`Edit ${check.name}`}
      className="text-left md:max-w-[600px]"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="button" variant="accent" loading={isSaving} onClick={submit} className="flex-1">
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-[var(--spacing-system-l)]"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-ods-text-secondary text-h6">
          {check.description} Applies to {scopeName}.
        </p>

        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <Label className="text-ods-text-primary text-h4">Run this check</Label>
          <Controller
            control={form.control}
            name="run"
            render={({ field }) => (
              <Select value={field.value} onValueChange={value => field.onChange(value as RunChoice)}>
                <SelectTrigger aria-label="Run this check">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    {inheritedRun === null ? inherit : `${inherit} (${inheritedRun ? 'on' : 'off'})`}
                  </SelectItem>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {check.parameters.map((parameter, index) => {
          const setHere = parameters[index]?.setHere ?? false;
          // What inheriting gives now, under the field: the select itself stays short enough to read.
          const threshold = formatThreshold(parameter.value, parameter.unit, parameter.firesWhen);
          const inheritedNow =
            isSetHere(parameter.source, scope) || parameter.source.type === InsightCheckScopeType.DEFAULT
              ? ''
              : `Currently ${threshold.charAt(0).toLowerCase()}${threshold.slice(1)} (${sourceLabel(parameter.source, scope)}). `;
          const error = form.formState.errors.parameters?.[index]?.value?.message;
          return (
            <div key={parameter.parameter} className="flex flex-col gap-[var(--spacing-system-xs)]">
              <Label className="text-ods-text-primary text-h4">{parameter.label}</Label>
              <div className="flex gap-[var(--spacing-system-m)]">
                <Controller
                  control={form.control}
                  name={`parameters.${index}.setHere`}
                  render={({ field }) => (
                    <Select
                      value={field.value ? 'here' : 'inherit'}
                      onValueChange={value => field.onChange(value === 'here')}
                    >
                      <SelectTrigger className="flex-1" aria-label={`${parameter.label}: inherit or set here`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">{inherit}</SelectItem>
                        <SelectItem value="here">Set here</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <Controller
                  control={form.control}
                  name={`parameters.${index}.value`}
                  render={({ field }) => (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={parameter.min}
                      max={parameter.max}
                      step={1}
                      value={field.value}
                      onChange={event => field.onChange(event.target.value)}
                      onBlur={field.onBlur}
                      disabled={!setHere}
                      invalid={Boolean(error)}
                      endAdornment={parameterUnitSuffix(parameter.unit)}
                      aria-label={parameter.label}
                      className="flex-1"
                    />
                  )}
                />
              </div>
              <span className={error ? 'text-ods-error text-h6' : 'text-ods-text-secondary text-h6'}>
                {error ?? `${setHere ? '' : inheritedNow}${parameterHint(parameter)}`}
              </span>
            </div>
          );
        })}
      </form>
    </SimpleModal>
  );
}
