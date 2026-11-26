'use client';
'use no memo';

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ContentErrorBoundary } from '@/app/components/shared';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { OVERRIDE_SCOPE_LABELS } from '../utils/check-labels';
import {
  type Check,
  type CheckOverride,
  type CheckScope,
  type CheckSettingDraft,
  isOverrideScopeType,
  OVERRIDE_SCOPE_TYPES,
  type OverrideScopeType,
} from '../utils/check-transform';
import { OverrideImpact, type PickedScope } from './override-impact';
import { ScopeEntityPicker } from './scope-entity-picker';
import { ThresholdFields, thresholdsByParameter, thresholdsSchema } from './threshold-fields';

/** The entity field's label for each kind. */
const ENTITY_LABELS: Record<OverrideScopeType, string> = { CUSTOMER: 'Customer', TAG: 'Tag', DEVICE: 'Device' };

type OverrideFormValues = { enabled: boolean; thresholds: string[] };

function pickedOf(override: CheckOverride | null): PickedScope | null {
  if (!override || !isOverrideScopeType(override.scopeType)) return null;
  return { type: override.scopeType, id: override.scopeId, name: override.name };
}

interface OverrideModalProps {
  check: Check;
  /** Every exception the check has, so a scope that has one already is caught before saving; null while they load. */
  overrides: readonly CheckOverride[] | null;
  /** The exception being edited; null adds one. */
  editing: CheckOverride | null;
  isSaving: boolean;
  onClose: () => void;
  /** The scope's name rides along for the toast that says where the check is now off. */
  onSave: (scope: CheckScope, draft: CheckSettingDraft, scopeName: string | null) => void;
  /** Switch to editing the exception a picked scope already has. */
  onEditExisting: (override: CheckOverride) => void;
}

/**
 * Add or edit one exception (an override in the API): which customer, device tag or device it is for,
 * whether the check runs there, and its thresholds there. What is saved is everything it stores: the
 * switch and, while it is on, every threshold.
 */
export function OverrideModal({
  check,
  overrides,
  editing,
  isSaving,
  onClose,
  onSave,
  onEditExisting,
}: OverrideModalProps) {
  const [kind, setKind] = useState<OverrideScopeType | null>(pickedOf(editing)?.type ?? null);
  const [picked, setPicked] = useState<PickedScope | null>(pickedOf(editing));
  const form = useForm<OverrideFormValues>({
    resolver: zodResolver(z.object({ enabled: z.boolean(), thresholds: thresholdsSchema(check.parameters) })),
    defaultValues: {
      enabled: editing?.enabled ?? true,
      thresholds: check.parameters.map(parameter =>
        String(editing?.parameters[parameter.parameter] ?? parameter.value),
      ),
    },
  });
  const enabled = form.watch('enabled');
  const existing =
    picked && overrides
      ? (overrides.find(
          override =>
            override.scopeType === picked.type && override.scopeId === picked.id && override.id !== editing?.id,
        ) ?? null)
      : null;
  const canSave = Boolean(picked) && overrides !== null && !existing;

  const submit = form.handleSubmit(values => {
    if (!picked || !canSave) return;
    onSave(
      { type: picked.type, id: picked.id },
      {
        enabled: values.enabled,
        // Off, the check measures nothing against them: an exception that turns it off stores no thresholds.
        parameters: values.enabled ? thresholdsByParameter(check.parameters, values.thresholds) : {},
      },
      picked.name,
    );
  });

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title={editing ? 'Edit Exception' : 'Add Exception'}
      className="text-left md:max-w-[600px]"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            loading={isSaving}
            disabled={!canSave}
            onClick={submit}
            className="flex-1"
          >
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
        <p className="text-ods-text-primary text-h6">{check.name}</p>

        <AppliesToFields
          kind={kind}
          picked={picked}
          editing={Boolean(editing)}
          existing={existing}
          onKind={value => {
            setKind(value);
            setPicked(null);
          }}
          onPick={setPicked}
          onEditExisting={onEditExisting}
        />

        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => <EnabledField checked={field.value} onChange={field.onChange} />}
        />

        {enabled && (
          <ThresholdFields
            parameters={check.parameters}
            control={form.control}
            errors={form.formState.errors}
            defaultOf={parameter => parameter.value}
          />
        )}

        {picked && !existing && (
          <ContentErrorBoundary fallback={() => null}>
            <OverrideImpact check={check.check} scope={picked} />
          </ContentErrorBoundary>
        )}
      </form>
    </SimpleModal>
  );
}

interface AppliesToFieldsProps {
  kind: OverrideScopeType | null;
  picked: PickedScope | null;
  /** Editing: the scope is the override's own and cannot change. */
  editing: boolean;
  /** The override the picked scope already has, if any. */
  existing: CheckOverride | null;
  onKind: (kind: OverrideScopeType) => void;
  onPick: (picked: PickedScope | null) => void;
  onEditExisting: (override: CheckOverride) => void;
}

/** What the override is for: its kind, then the customer, tag or device, and a scope that has one already. */
function AppliesToFields({ kind, picked, editing, existing, onKind, onPick, onEditExisting }: AppliesToFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <Label className="text-ods-text-primary text-h4">Applies to</Label>
        <Select
          value={kind ?? undefined}
          disabled={editing}
          onValueChange={value => {
            if (isOverrideScopeType(value)) onKind(value);
          }}
        >
          <SelectTrigger aria-label="Applies to">
            <SelectValue placeholder="Select what it applies to" />
          </SelectTrigger>
          <SelectContent>
            {OVERRIDE_SCOPE_TYPES.map(type => (
              <SelectItem key={type} value={type}>
                {OVERRIDE_SCOPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {kind && (
        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <Label className="text-ods-text-primary text-h4">{ENTITY_LABELS[kind]}</Label>
          {editing ? (
            <p className="text-ods-text-primary text-h6">{picked?.name ?? picked?.id}</p>
          ) : (
            <ScopeEntityPicker
              key={kind}
              type={kind}
              value={picked?.id ?? null}
              selectedLabel={picked?.name ?? null}
              onChange={(id, name) => onPick(id ? { type: kind, id, name } : null)}
            />
          )}
          {existing && (
            <span className="text-ods-error text-h6">
              {existing.name ?? 'It'} already has an exception for this check.{' '}
              <button
                type="button"
                className="text-ods-accent underline hover:text-ods-accent-hover"
                onClick={() => onEditExisting(existing)}
              >
                Edit it
              </button>
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** Whether the check runs on the override's devices. */
function EnabledField({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start gap-[var(--spacing-system-s)]">
      <Switch id="override-enabled" checked={checked} onCheckedChange={onChange} aria-label="Enabled" />
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <Label htmlFor="override-enabled" className="text-ods-text-primary text-h4">
          Enabled
        </Label>
        <span className="text-ods-text-secondary text-h6">
          When off, this check raises no incidents on these devices. Measurements keep coming in.
        </span>
      </div>
    </div>
  );
}
