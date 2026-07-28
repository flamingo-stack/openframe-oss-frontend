'use client';

import {
  RadioGroupBlock,
  type RadioGroupBlockOption,
  Tag,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { DeviceSelectionMode } from './device-selector.types';

/**
 * The two assignment modes (design 460:71430).
 *
 * The copy stays generic ("this selection") rather than the design's "this
 * script schedule": this block also renders on the monitoring query and policy
 * pages, where naming a schedule would simply be wrong.
 */
const SPECIFIC_MODE_OPTION: RadioGroupBlockOption = {
  value: 'specific',
  label: 'Select Specific Devices',
  description: 'Choose individual devices to include in this selection',
};

const CRITERIA_MODE_DESCRIPTION =
  'Automatically include all devices (current and future) that match your defined criteria';

/**
 * "By criteria" is only offered where a consumer can actually store a rule —
 * i.e. where `value` / `onChange` are wired up. Everywhere else it keeps the
 * design's "Coming Soon" treatment: a tag rather than a dimmed row is how the
 * design says so, and `disabled` is what keeps it unselectable and out of the
 * tab order.
 */
const SELECTION_MODE_OPTIONS: RadioGroupBlockOption[] = [
  SPECIFIC_MODE_OPTION,
  {
    value: 'criteria',
    label: 'Select Devices by Criteria',
    description: CRITERIA_MODE_DESCRIPTION,
    disabled: true,
    trailing: <Tag label="Coming Soon" variant="grey" />,
  },
];

const SELECTION_MODE_OPTIONS_ENABLED: RadioGroupBlockOption[] = [
  SPECIFIC_MODE_OPTION,
  {
    value: 'criteria',
    label: 'Select Devices by Criteria',
    description: CRITERIA_MODE_DESCRIPTION,
  },
];

export interface DeviceSelectionModeRadioProps {
  /** Omit for the uncontrolled, criteria-disabled block. */
  value?: DeviceSelectionMode;
  onChange?: (mode: DeviceSelectionMode) => void;
  disabled?: boolean;
}

/**
 * The mode block above a device picker.
 *
 * Its own component, and not just markup inside `DeviceSelector`, because a
 * page whose two modes are separate data islands has to keep it OUTSIDE the
 * subtree that swaps: mounted inside, the radio unmounts and remounts with the
 * content, restarting its own transitions — the switch you just clicked blinks.
 * Such a page renders this directly and passes `showSelectionModeRadio={false}`.
 */
export function DeviceSelectionModeRadio({ value, onChange, disabled }: DeviceSelectionModeRadioProps) {
  return (
    <RadioGroupBlock
      name="selectionMode"
      variant="grouped"
      // Controlled only when the consumer can store the answer; otherwise the
      // radio keeps its old decorative behaviour.
      {...(value ? { value, onValueChange: onChange } : { defaultValue: 'specific' })}
      disabled={disabled}
      options={value ? SELECTION_MODE_OPTIONS_ENABLED : SELECTION_MODE_OPTIONS}
      // Design 460:71430 rows are 68px — a 24px title over a 20px description
      // with 12px above and below. The grouped variant pads `py-xs` (8px on
      // desktop) by default, which would come out 8px short.
      itemClassName="py-[var(--spacing-system-sf)]"
    />
  );
}
