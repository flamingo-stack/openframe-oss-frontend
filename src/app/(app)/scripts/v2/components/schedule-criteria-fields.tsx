'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  InputTrigger,
  Label,
  Tag,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
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

interface CriteriaSelectProps {
  label: string;
  /** Trigger text while the dimension is unconstrained — "All Customers" and friends. */
  allLabel: string;
  options: CriteriaOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * One dimension of the rule: a form-field-shaped trigger over a checkable list.
 *
 * Multi-select behind a control the design draws as a single select, because
 * the stored dimension IS a list — every `ScheduleDeviceCriteriaInput` field is
 * `[String!]`. The trigger reads as a VALUE, not a placeholder, when nothing is
 * picked: empty means "no constraint on this dimension", so "All Customers" is
 * an answer rather than the absence of one, and it renders in primary text
 * exactly as the design has it.
 */
function CriteriaSelect({ label, allLabel, options, selected, onChange, disabled }: CriteriaSelectProps) {
  // A value stored in the rule that no current device carries is absent from the
  // options — keep it in the trigger rather than quietly hiding a constraint
  // that is genuinely part of the rule.
  const selectedLabel = useMemo(() => {
    if (selected.length === 0) return allLabel;
    const byValue = new Map(options.map(o => [o.value, o.label]));
    return selected.map(v => byValue.get(v) ?? v).join(', ');
  }, [selected, options, allLabel]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <Label className="text-h4">{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <InputTrigger
            selectedLabel={selectedLabel}
            endIcon={<Chevron02DownIcon className="size-6" />}
            disabled={disabled}
          />
        </DropdownMenuTrigger>
        {/* Width matched to the trigger so the list lines up under the field,
            and scrollable because the customer list is as long as the fleet. */}
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
        >
          {options.length === 0 ? (
            // Reachable while the facets query is still in flight, and for good
            // on a fleet with nothing to offer on this dimension.
            <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] text-h6 text-ods-text-tertiary">
              No options available
            </div>
          ) : (
            options.map(option => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected.includes(option.value)}
                // One value is rarely the whole rule; without this the menu
                // closes after every tick and the second pick costs a reopen.
                onSelect={event => event.preventDefault()}
                onCheckedChange={() => toggle(option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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

interface ScheduleCriteriaFieldsProps {
  criteria: ScheduleCriteria;
  onChange: (next: ScheduleCriteria) => void;
  /** Facets over the WHOLE fleet — see the note on option scope below. */
  deviceFilters: DeviceFilters | null | undefined;
  disabled?: boolean;
}

/**
 * The rule editor for "Select Devices by Criteria" (design 460:85294) — three
 * whitelists over customer, device type and OS, `AND`ed across dimensions.
 *
 * The design lays the fields out as a four-column row with the last column left
 * empty, so they keep a field's width instead of stretching to a third of the
 * page each; the grid reproduces that by simply not filling the fourth cell.
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
 *   and the preview under the fields shows that intersection, so an unsupported
 *   pick visibly matches nothing.
 * - The customer list only holds customers that own at least one device, so a
 *   brand-new customer cannot be pre-targeted. `osType` is a free-form string
 *   with no enum to enumerate, and customers have no cheap complete source
 *   here; device types do, so those come from the schema instead.
 */
export function ScheduleCriteriaFields({ criteria, onChange, deviceFilters, disabled }: ScheduleCriteriaFieldsProps) {
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
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-4">
        <CriteriaSelect
          label="Customer"
          allLabel="All Customers"
          options={organizationOptions}
          selected={criteria.organizationIds}
          onChange={next => onChange({ ...criteria, organizationIds: next })}
          disabled={disabled}
        />
        <CriteriaSelect
          label="Type"
          allLabel="All Types"
          options={DEVICE_TYPE_OPTIONS}
          selected={criteria.deviceTypes}
          onChange={next => onChange({ ...criteria, deviceTypes: next })}
          disabled={disabled}
        />
        <CriteriaSelect
          label="OS"
          allLabel="All Platforms"
          options={osOptions}
          selected={criteria.osTypes}
          onChange={next => onChange({ ...criteria, osTypes: next })}
          disabled={disabled}
        />
      </div>

      {/* Drawn in the design as a working chip input, but there is nowhere to
          put what it collects: `ScheduleDeviceCriteriaInput` is closed at
          { organizationIds, deviceTypes, osTypes }, with no field for tags or
          any free-form term (docs/script-schedules-v2-graphql-gaps.md §7).
          Kept in place and disabled, tagged the way this screen already marks
          what is not built yet, rather than shipped as a control that swallows
          whatever the user types. */}
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <div className="flex items-center gap-[var(--spacing-system-xsf)]">
          <Label className="text-h4">Custom Criteria</Label>
          <Tag label="Coming Soon" variant="grey" />
        </div>
        <Input placeholder="Press enter after each criteria" disabled />
      </div>
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
