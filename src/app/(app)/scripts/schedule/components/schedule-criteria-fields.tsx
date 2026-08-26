'use client';

import { CheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { AutocompleteOption, InfoCardData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  Autocomplete,
  InfoCard,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tag,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useMemo } from 'react';
import { useDeviceOrganizations } from '@/app/(app)/devices/hooks/use-device-organizations';
import type { DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { OrgAvatar } from '@/app/components/shared';
import type { ScheduleCriteria } from '../utils/schedule-criteria';

/**
 * "No constraint on this dimension" is an ANSWER, so both fields offer it as a
 * real, pickable row rather than leaving it as the shape of an empty control —
 * otherwise the only way back from a narrowed rule is to clear the field, which
 * reads as erasing an answer rather than choosing one.
 *
 * It needs a stand-in value either way: the rule stores "unconstrained" as an
 * empty list, and Radix `Select` reserves the empty string on top of that.
 * Neither sentinel leaves this module — both map back to `[]` on the way out.
 */
const ALL_OS_TYPES = '__all_os_types__';
const ALL_CUSTOMERS = '__all_customers__';

/** `MOBILE_DEVICE` -> `Mobile Device`. The schema ships the enum unlabelled. */
function humanizeDeviceType(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface ScheduleCriteriaFieldsProps {
  criteria: ScheduleCriteria;
  onChange: (next: ScheduleCriteria) => void;
  /** Facets over the WHOLE fleet — the only source of OS values, see below. */
  deviceFilters: DeviceFilters | null | undefined;
  disabled?: boolean;
}

/**
 * The rule editor for "Select Devices by Criteria" (design 460:85294) — a
 * customer whitelist and an OS constraint, `AND`ed across dimensions.
 *
 * The design lays the fields out as a four-column row, so they keep a field's
 * width instead of stretching to half the page each; the grid reproduces that by
 * simply not filling the remaining cells.
 *
 * The customer field is the picker from `/devices/new` — same `Autocomplete`,
 * same `OrgAvatar` rows — in its multi-select mode, since `organizationIds` is a
 * list. It reads the full customer list rather than the device facets, so a
 * customer with no devices yet can still be targeted: that is the whole point of
 * a forward-looking rule, and facets can only ever offer customers that already
 * own a machine.
 *
 * OS has no such source — `osType` is a free-form string with no enum to
 * enumerate — so it keeps taking its options from `deviceFilters`, queried
 * UNFILTERED. Options must not follow the current match: derived from what the
 * rule already resolves to, the list would shrink as the user narrows.
 *
 * The OS list can offer a platform this schedule does not support. Harmless —
 * the backend intersects `osTypes` with the schedule's `supportedPlatforms`, and
 * the preview under the fields shows that intersection, so an unsupported pick
 * visibly matches nothing.
 */
export function ScheduleCriteriaFields({ criteria, onChange, deviceFilters, disabled }: ScheduleCriteriaFieldsProps) {
  const organizations = useDeviceOrganizations(100);

  const orgOptions = useMemo<AutocompleteOption[]>(
    () => [
      { label: 'All Customers', value: ALL_CUSTOMERS },
      ...organizations.map(o => ({ label: o.name, value: o.organizationId })),
    ],
    [organizations],
  );

  const osOptions = useMemo(() => (deviceFilters?.osTypes ?? []).map(o => o.value), [deviceFilters]);

  const noCustomerConstraint = criteria.organizationIds.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-4">
        <Autocomplete
          multiple
          label="Customer"
          placeholder="All Customers"
          // "All Customers" is the VALUE of an unconstrained dimension, not a
          // prompt for one: an empty list means "every customer", which is an
          // answer, and the design renders it in primary text like any other.
          // The component's empty state is a placeholder, so it is recoloured
          // for exactly the case where it stands in for a value. Once customers
          // are picked the placeholder becomes the component's own "Add More…"
          // prompt, which IS a prompt, and reads as one again.
          className={noCustomerConstraint && !disabled ? '[&_input::placeholder]:text-ods-text-primary' : undefined}
          options={orgOptions}
          // The sentinel is a row, never a chip: as a selected value it would
          // render a removable tag whose X could only reset it to itself.
          value={criteria.organizationIds}
          onChange={next =>
            onChange({
              ...criteria,
              organizationIds: next.includes(ALL_CUSTOMERS) ? [] : next,
            })
          }
          disabled={disabled}
          renderOption={(option, isSelected) => {
            const isAll = option.value === ALL_CUSTOMERS;
            // The component reads selection off its `value`, which never holds
            // the sentinel — so the "All Customers" row states its own.
            const selected = isAll ? noCustomerConstraint : isSelected;
            const org = organizations.find(o => o.organizationId === option.value);
            return (
              <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xsf)]">
                <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
                  {!isAll && (
                    <OrgAvatar imageUrl={org?.imageUrl} hash={org?.imageHash} name={org?.name ?? option.label} />
                  )}
                  <div className="min-w-0">
                    <TruncateText className={cn(selected && 'text-ods-accent')}>{option.label}</TruncateText>
                  </div>
                </div>
                {selected && <CheckIcon className="shrink-0 text-ods-accent" size={20} />}
              </div>
            );
          }}
        />

        {/* One platform, not a list: `Select` is single-value by construction.
            `osTypes` stays an array at the boundary because that is the field's
            shape — this control just never fills it past one. */}
        <Select
          value={criteria.osTypes[0] ?? ALL_OS_TYPES}
          onValueChange={value => onChange({ ...criteria, osTypes: value === ALL_OS_TYPES ? [] : [value] })}
          disabled={disabled}
        >
          <SelectTrigger label="OS" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OS_TYPES}>All Platforms</SelectItem>
            {osOptions.map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CustomCriteriaField />
    </div>
  );
}

/**
 * Drawn in the design as a working chip input, but there is nowhere to put what
 * it collects: `ScheduleDeviceCriteriaInput` is closed at { organizationIds,
 * deviceTypes, osTypes }, with no field for tags or any free-form term
 * (docs/script-schedules-graphql-gaps.md §7). Kept in place and disabled,
 * tagged the way this screen already marks what is not built yet, rather than
 * shipped as a control that swallows whatever the user types.
 *
 * Nothing about it depends on a request, so the loading state renders it
 * verbatim rather than as a placeholder.
 */
function CustomCriteriaField() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <Label className="text-h4">Custom Criteria</Label>
        <Tag label="Coming Soon" variant="grey" />
      </div>
      <Input placeholder="Press enter after each criteria" disabled />
    </div>
  );
}

/**
 * The rule editor while its option queries are still in flight.
 *
 * Only the two dropdowns wait on a request, so only they are placeholders — the
 * labels and the Custom Criteria block are static and render for real. The
 * boxes carry the fields' own `h-11 md:h-12`, and the labels the `text-h4 mb-1`
 * that `FieldWrapper` gives them, so the editor doesn't resize under the user
 * when the options land.
 */
export function ScheduleCriteriaFieldsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-4">
        {['Customer', 'OS'].map(label => (
          <div key={label} className="flex w-full flex-col">
            <span className="mb-1 text-h4 text-ods-text-primary">{label}</span>
            <Skeleton className="h-11 w-full rounded-[6px] md:h-12" />
          </div>
        ))}
      </div>

      <CustomCriteriaField />
    </div>
  );
}

/**
 * Read-only echo of the stored rule, above the list it produces on the
 * schedule's Assigned Devices tab (design 1:49430).
 *
 * Without it a criteria-driven assignment is indistinguishable from a hand-made
 * one — the tab lists machines either way — so devices appearing or vanishing
 * on their own would have no visible cause on the page that shows them.
 *
 * The design draws it as the ODS Info-card: one `label — leader line — value`
 * row per dimension, which `InfoCard` already implements down to the divider
 * and the `text-h4` on both sides.
 *
 * An unconstrained dimension keeps its row and says so ("All Customers"), in
 * the editor's own wording. Dropping the row instead would read as the rule not
 * covering that dimension at all, which is the opposite of what empty means.
 *
 * Customer names come from the same list the editor picks from, so a rule
 * naming a customer that owns no devices still reads as a name here rather than
 * as a raw id.
 */
export function ScheduleCriteriaSummary({ criteria }: { criteria: ScheduleCriteria }) {
  const organizations = useDeviceOrganizations(100);

  const items = useMemo<InfoCardData['items']>(() => {
    const byId = new Map(organizations.map(o => [o.organizationId, o.name]));
    return [
      {
        label: 'Customer',
        value: criteria.organizationIds.length
          ? criteria.organizationIds.map(id => byId.get(id) ?? id).join(', ')
          : 'All Customers',
      },
      // Device type is no longer editable here, so an "All Types" line would be
      // permanent furniture. Shown only when a stored rule actually carries the
      // constraint — the editor round-trips it untouched, so it can still
      // arrive from elsewhere.
      ...(criteria.deviceTypes.length
        ? [{ label: 'Type', value: criteria.deviceTypes.map(humanizeDeviceType).join(', ') }]
        : []),
      { label: 'OS', value: criteria.osTypes.length ? criteria.osTypes.join(', ') : 'All Platforms' },
      // The design's fourth row, "Custom Criteria", has no field behind it —
      // `ScheduleDeviceCriteriaInput` is closed at the three dimensions above
      // (docs/script-schedules-graphql-gaps.md §7). A row that could only
      // ever read empty is left out rather than shipped as furniture; the
      // editor is where the gap is marked, with its "Coming Soon" tag.
    ];
  }, [criteria, organizations]);

  return <InfoCard data={{ items }} />;
}
