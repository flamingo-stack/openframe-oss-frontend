'use client';

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { OVERRIDE_ENTITY_LABELS, OVERRIDE_SCOPE_LABELS } from '../utils/check-labels';
import {
  type CheckOverride,
  isOverrideScopeType,
  OVERRIDE_SCOPE_TYPES,
  type OverrideScopeType,
  type PickedScope,
} from '../utils/check-transform';
import { ScopeEntityPicker } from './scope-entity-picker';

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
export function AppliesToFields({
  kind,
  picked,
  editing,
  existing,
  onKind,
  onPick,
  onEditExisting,
}: AppliesToFieldsProps) {
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
          <Label className="text-ods-text-primary text-h4">{OVERRIDE_ENTITY_LABELS[kind]}</Label>
          {editing ? (
            <p className="text-ods-text-primary text-h6">{picked?.name ?? picked?.id}</p>
          ) : (
            <ScopeEntityPicker
              key={kind}
              type={kind}
              value={picked?.id ?? null}
              selectedLabel={picked?.name ?? null}
              onChange={(id, name) => onPick(id ? { type: kind, id, name } : null)}
              invalid={Boolean(existing)}
            />
          )}
          {existing && (
            <span className="text-ods-error text-h6">
              {existing.name ?? 'It'} already has an exception for this check.{' '}
              <Button type="button" variant="link" size="compact" noPaddingX onClick={() => onEditExisting(existing)}>
                Edit it
              </Button>
            </span>
          )}
        </div>
      )}
    </>
  );
}
