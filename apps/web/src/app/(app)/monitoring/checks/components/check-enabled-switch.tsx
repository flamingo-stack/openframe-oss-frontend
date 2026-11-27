'use client';

import { Switch } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface CheckEnabledSwitchProps {
  /** Undefined while the check is read: the switch is drawn off and inert. */
  enabled: boolean | undefined;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/** The check's switch for every device, in the page title's selector slot. */
export function CheckEnabledSwitch({ enabled, disabled, onToggle }: CheckEnabledSwitchProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      <Switch
        checked={enabled ?? false}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label="Enabled for all devices"
      />
      <span className="text-ods-text-primary text-h6">{enabled === false ? 'Off' : 'Enabled'}</span>
    </div>
  );
}
