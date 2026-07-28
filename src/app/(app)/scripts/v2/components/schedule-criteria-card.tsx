'use client';

import { Tag, TagSelectDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import type { DeviceFilters } from '@/app/(app)/devices/types/device.types';
// Value import: the generated module exports the enum as both a const and a
// type, so the full set of device types is enumerable here.
import { DeviceType } from '@/generated/schema-enums';
import { deduplicateFilterOptions } from '@/lib/filter-utils';
import type { ScheduleCriteria } from '../utils/schedule-criteria';

interface CriteriaOption {
  value: string;
  label: string;
}

interface CriteriaDimensionProps {
  title: string;
  /** What "no constraint" means for this dimension, in words. */
  unconstrainedText: string;
  addLabel: string;
  searchPlaceholder: string;
  options: CriteriaOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * One whitelist of the rule: its chips, and the dropdown that adds to them.
 *
 * The empty state is a sentence, not a blank: an empty dimension means "every
 * customer" / "every OS", which is the opposite of what an empty control
 * normally implies, so it has to be said out loud.
 */
function CriteriaDimension({
  title,
  unconstrainedText,
  addLabel,
  searchPlaceholder,
  options,
  selected,
  onChange,
  disabled,
}: CriteriaDimensionProps) {
  const dropdownOptions = useMemo(() => options.map(o => ({ id: o.value, label: o.label })), [options]);

  // A value stored in the rule that no current device carries is absent from the
  // facets — keep its chip, labelled with whatever it is, rather than dropping a
  // constraint that is genuinely part of the rule.
  const labelFor = useMemo(() => {
    const byValue = new Map(options.map(o => [o.value, o.label]));
    return (value: string) => byValue.get(value) ?? value;
  }, [options]);

  return (
    <div className="flex flex-col items-start gap-[var(--spacing-system-xsf)]">
      <p className="text-h5 text-ods-text-secondary">{title}</p>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {selected.map(value => (
            <Tag
              key={value}
              label={labelFor(value)}
              variant="outline"
              onClose={disabled ? undefined : () => onChange(selected.filter(v => v !== value))}
              className="max-w-full min-w-0"
              labelClassName="min-w-0"
            />
          ))}
        </div>
      ) : (
        <p className="text-h6 text-ods-text-tertiary">{unconstrainedText}</p>
      )}
      <TagSelectDropdown
        options={dropdownOptions}
        selectedIds={selected}
        onChange={onChange}
        triggerLabel={addLabel}
        searchPlaceholder={searchPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}

/** `MOBILE_DEVICE` -> `Mobile Device`. The schema ships the enum unlabelled. */
function humanizeDeviceType(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Every `DeviceType`, not just the ones some device currently has.
 *
 * A criteria rule is forward-looking — "include devices that match, including
 * ones registered later" — so offering only the types present in the fleet
 * today would make exactly the future-proofing case unexpressible: you could
 * not write "all servers" before the first server is enrolled.
 */
const DEVICE_TYPE_OPTIONS: CriteriaOption[] = Object.values(DeviceType).map(value => ({
  value,
  label: humanizeDeviceType(value),
}));

interface ScheduleCriteriaCardProps {
  criteria: ScheduleCriteria;
  onChange: (next: ScheduleCriteria) => void;
  /** Facets over the WHOLE fleet — see the note on option scope below. */
  deviceFilters: DeviceFilters | null | undefined;
  disabled?: boolean;
}

/**
 * The rule editor for "Select Devices by Criteria" — three whitelists over
 * customer, device type and OS, `AND`ed across dimensions.
 *
 * **Options must not follow the current match.** `deviceFilters` is queried
 * unfiltered, not with the rule applied: options derived from what the rule
 * currently matches would shrink as the user narrows, so picking a second
 * customer would be impossible after picking the first.
 *
 * Two consequences of taking options from facets at all, both accepted:
 *
 * - The OS list can offer a platform this schedule does not support. Harmless —
 *   the backend intersects `osTypes` with the schedule's `supportedPlatforms`,
 *   and the preview under the card shows that intersection, so an unsupported
 *   pick visibly matches nothing.
 * - The customer list only holds customers that own at least one device, so a
 *   brand-new customer cannot be pre-targeted. `osType` is a free-form string
 *   with no enum to enumerate, and customers have no cheap complete source
 *   here; device types do, so those come from the schema instead.
 */
export function ScheduleCriteriaCard({ criteria, onChange, deviceFilters, disabled }: ScheduleCriteriaCardProps) {
  const organizationOptions = useMemo<CriteriaOption[]>(
    () =>
      deduplicateFilterOptions(
        (deviceFilters?.organizationIds ?? []).map(o => ({ id: o.value, label: o.label, value: o.value })),
      ).map(o => ({ value: o.value, label: o.label })),
    [deviceFilters],
  );

  const osOptions = useMemo<CriteriaOption[]>(
    () => (deviceFilters?.osTypes ?? []).map(o => ({ value: o.value, label: o.value })),
    [deviceFilters],
  );

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] border-b border-ods-border p-[var(--spacing-system-m)] md:grid-cols-3">
      <CriteriaDimension
        title="Customers"
        unconstrainedText="All customers"
        addLabel="Add Customers"
        searchPlaceholder="Search customers..."
        options={organizationOptions}
        selected={criteria.organizationIds}
        onChange={next => onChange({ ...criteria, organizationIds: next })}
        disabled={disabled}
      />
      <CriteriaDimension
        title="Device Types"
        unconstrainedText="All device types"
        addLabel="Add Device Types"
        searchPlaceholder="Search device types..."
        options={DEVICE_TYPE_OPTIONS}
        selected={criteria.deviceTypes}
        onChange={next => onChange({ ...criteria, deviceTypes: next })}
        disabled={disabled}
      />
      <CriteriaDimension
        title="Operating Systems"
        unconstrainedText="All supported operating systems"
        addLabel="Add Operating Systems"
        searchPlaceholder="Search operating systems..."
        options={osOptions}
        selected={criteria.osTypes}
        onChange={next => onChange({ ...criteria, osTypes: next })}
        disabled={disabled}
      />
    </div>
  );
}

function SummaryDimension({
  title,
  unconstrainedText,
  values,
  labelFor,
}: {
  title: string;
  unconstrainedText: string;
  values: string[];
  labelFor?: (value: string) => string;
}) {
  return (
    <div className="flex flex-col items-start gap-[var(--spacing-system-xxs)]">
      <p className="text-h5 text-ods-text-secondary">{title}</p>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
          {values.map(value => (
            <Tag key={value} label={labelFor ? labelFor(value) : value} variant="outline" className="max-w-full" />
          ))}
        </div>
      ) : (
        <p className="text-h6 text-ods-text-tertiary">{unconstrainedText}</p>
      )}
    </div>
  );
}

/**
 * Read-only echo of the stored rule, for the schedule's Assigned Devices tab.
 *
 * Without it a criteria-driven assignment is indistinguishable from a hand-made
 * one — the tab lists machines either way — so devices appearing or vanishing
 * on their own would have no visible cause on the page that shows them.
 */
export function ScheduleCriteriaSummary({
  criteria,
  deviceFilters,
}: {
  criteria: ScheduleCriteria;
  deviceFilters: DeviceFilters | null | undefined;
}) {
  const customerLabel = useMemo(() => {
    const byId = new Map((deviceFilters?.organizationIds ?? []).map(o => [o.value, o.label]));
    return (value: string) => byId.get(value) ?? value;
  }, [deviceFilters]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
      <p className="text-h6 text-ods-text-secondary">
        Devices are selected by criteria — this list resolves live, so machines registered later that match are included
        automatically.
      </p>
      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] md:grid-cols-3">
        <SummaryDimension
          title="Customers"
          unconstrainedText="All customers"
          values={criteria.organizationIds}
          labelFor={customerLabel}
        />
        <SummaryDimension
          title="Device Types"
          unconstrainedText="All device types"
          values={criteria.deviceTypes}
          labelFor={humanizeDeviceType}
        />
        <SummaryDimension
          title="Operating Systems"
          unconstrainedText="All supported operating systems"
          values={criteria.osTypes}
        />
      </div>
    </div>
  );
}
