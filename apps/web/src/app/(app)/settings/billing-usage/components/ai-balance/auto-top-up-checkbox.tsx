'use client';

import { CheckboxBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useId } from 'react';

interface AutoTopUpCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** A purchase or a save in flight, or a catalog that has not landed. */
  disabled?: boolean;
  /** Why the box is unticked when the customer did not untick it (a declined charge). */
  error?: string;
  /** What ticking it does, where the surface says it its own way (the modal's threshold, once ticked). */
  description?: string;
}

const DEFAULT_DESCRIPTION = 'Automatically refill your balance with the selected amount whenever it runs out.';

/**
 * "Enable Auto Top-up", wherever the mockups put it: under the amounts in the
 * Manage AI Balance modal, and under them again on the paywall's AI Token
 * Balance card. The amounts above it become the refill amount once it is on.
 */
export function AutoTopUpCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  error,
  description = DEFAULT_DESCRIPTION,
}: AutoTopUpCheckboxProps) {
  const id = useId();

  return (
    <CheckboxBlock
      id={id}
      label="Enable Auto Top-up"
      description={description}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      error={error}
    />
  );
}
