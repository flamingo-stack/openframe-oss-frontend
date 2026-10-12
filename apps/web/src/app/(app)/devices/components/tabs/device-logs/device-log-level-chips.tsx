'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { KeyboardEvent } from 'react';
import type { DeviceLogLevel } from '@/generated/schema-enums';
import { DEVICE_LOG_LEVELS, deviceLogLevelVariant } from '../../../utils/device-log-level';

interface DeviceLogLevelChipsProps {
  /** Empty = every level. */
  selectedLevels: ReadonlyArray<DeviceLogLevel>;
  onToggleLevel: (level: DeviceLogLevel) => void;
  disabled?: boolean;
}

/** The DEBUG · INFO · WARN · ERROR toggles, in severity order. Shared by the device tab and the Troubleshooting page. */
export function DeviceLogLevelChips({ selectedLevels, onToggleLevel, disabled = false }: DeviceLogLevelChipsProps) {
  const chipKeyDown = (level: DeviceLogLevel) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleLevel(level);
    }
  };

  return (
    <div role="group" aria-label="Log levels" className="flex flex-wrap gap-[var(--spacing-system-xxs)]">
      {DEVICE_LOG_LEVELS.map(level => {
        const on = selectedLevels.length === 0 || selectedLevels.includes(level);
        return (
          <Tag
            key={level}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={on}
            label={<span>{level}</span>}
            variant={on ? deviceLogLevelVariant(level) : 'outline'}
            disabled={disabled}
            onClick={disabled ? undefined : () => onToggleLevel(level)}
            onKeyDown={disabled ? undefined : chipKeyDown(level)}
            className={cn(!disabled && 'cursor-pointer', !on && 'opacity-50')}
          />
        );
      })}
    </div>
  );
}
