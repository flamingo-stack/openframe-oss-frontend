'use client';

import { CheckboxBlock, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useId } from 'react';
import { AUTO_TOP_UP } from '../lib/auto-top-up';

interface AutoTopUpCheckboxProps {
  /** Locks the control on top of its own lock — a purchase in flight, a catalog still loading. */
  disabled?: boolean;
}

/**
 * "Enable Auto Top-up", wherever the mockups put it: under the amounts in the
 * Manage AI Balance modal, and under them again on the paywall's AI Token
 * Balance card.
 *
 * Controlled and never toggled: the value is the backend's answer, and today
 * the backend has none (see `auto-top-up.ts`). The tag says why the box will
 * not tick, so a locked control does not read as a broken one.
 */
export function AutoTopUpCheckbox({ disabled = false }: AutoTopUpCheckboxProps) {
  const id = useId();

  return (
    <CheckboxBlock
      id={id}
      label="Enable Auto Top-up"
      description="Automatically refill your balance with the selected amount whenever it runs out."
      checked={AUTO_TOP_UP.enabled}
      disabled={!AUTO_TOP_UP.available || disabled}
      trailing={!AUTO_TOP_UP.available && <Tag as="span" variant="grey" label="Coming soon" />}
    />
  );
}
