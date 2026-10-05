'use client';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { SNOOZE_MAX_AMOUNT, SNOOZE_UNITS, type SnoozeUnit, snoozeUnitLabel, snoozeUntil } from '../utils/snooze-until';

interface SnoozeIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the moment the incident should return to the working set. */
  onConfirm: (until: Date) => void;
  isPending?: boolean;
}

/**
 * "Snooze Incident": an amount + unit picker ("Resume Notifications after 1
 * Hour"). The caller keys this on the incident so the picker resets per target.
 */
export function SnoozeIncidentModal({ open, onOpenChange, onConfirm, isPending = false }: SnoozeIncidentModalProps) {
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<SnoozeUnit>('hour');

  // `Number`, not `parseInt`: "1.5" must fail the integer check, not truncate to 1.
  const parsedAmount = Number(amount);
  const isValid = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= SNOOZE_MAX_AMOUNT;

  return (
    <SimpleModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Snooze Incident"
      className="text-left md:max-w-[600px]"
      footer={
        <Button
          type="button"
          variant="accent"
          disabled={!isValid}
          loading={isPending}
          onClick={() => onConfirm(snoozeUntil(parsedAmount, unit))}
          className="flex-1"
        >
          Confirm
        </Button>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <Label className="text-ods-text-primary text-h4">Resume Notifications after</Label>
        <div className="flex gap-[var(--spacing-system-m)]">
          <Input
            type="number"
            min={1}
            max={SNOOZE_MAX_AMOUNT}
            step={1}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            aria-label="Snooze amount"
            className="flex-1"
          />
          <Select value={unit} onValueChange={value => setUnit(value as SnoozeUnit)}>
            <SelectTrigger className="flex-1" aria-label="Snooze unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SNOOZE_UNITS.map(option => (
                <SelectItem key={option} value={option}>
                  {snoozeUnitLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SimpleModal>
  );
}
