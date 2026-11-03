'use client';

import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useId } from 'react';
import { formatCurrency } from '@/lib/format-currency';
import { formatCompactCount } from '@/lib/format-number';
import { tokensForUsd } from '../shared/ai-token-price';
import { type AutoTopUpSettingsField, type AutoTopUpSettingsValues, toWholeDollarsText } from './auto-top-up-settings';
import { spendLimitUsage } from './auto-top-up-status';
import { SpendLimitBar } from './spend-limit-bar';

/** What each field is for, under it while it has nothing wrong to say. */
const HELPER = {
  thresholdUsd: 'Balance that triggers a refill',
  spendLimitUsd: 'Auto top-ups stop once their total over the last 30 days reaches the limit',
} as const;

interface AutoTopUpSettingsFieldsProps {
  values: AutoTopUpSettingsValues;
  onChange: (field: AutoTopUpSettingsField, next: string) => void;
  /** Shown once a save has been tried, so the form stays quiet while it is filled in. */
  errors: Partial<Record<AutoTopUpSettingsField, string>>;
  /** $ per token from the AI product's option; `null` while unknown — the amount's token line stays empty. */
  tokenPrice: number | null;
  /** What auto top-ups charged over the last 30 days; `null` while the arrangement is on its way. */
  spentUsd: number | null;
  disabled?: boolean;
}

/**
 * The arrangement's three figures, as the Manage AI Balance modal asks them
 * once "Enable Auto Top-up" is ticked: the balance that triggers a refill, what
 * one refill buys, and the most the refills may charge over the last 30 days —
 * with how much of that the last 30 days have already used.
 */
export function AutoTopUpSettingsFields({
  values,
  onChange,
  errors,
  tokenPrice,
  spentUsd,
  disabled = false,
}: AutoTopUpSettingsFieldsProps) {
  const id = useId();
  const amount = Number.parseInt(values.amountUsd, 10);
  const tokens = Number.isFinite(amount) ? tokensForUsd(amount, tokenPrice) : null;
  // The bar measures the limit as typed, so raising it shows the room it makes before the save.
  const typedLimit = Number.parseInt(values.spendLimitUsd, 10);
  const limitUsd = Number.isFinite(typedLimit) ? typedLimit : null;
  const usage = spentUsd == null ? null : spendLimitUsage(spentUsd, limitUsd);

  // The line under each field is ours, not the input's message: that one is a single clipped line laid over what
  // follows, and these sentences wrap. It holds its height while empty, so a line appearing moves nothing.
  const field = (name: AutoTopUpSettingsField, label: string, helper: string) => (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <Input
        id={`${id}-${name}`}
        label={label}
        labelVariant="large"
        type="text"
        inputMode="numeric"
        placeholder={name === 'spendLimitUsd' ? 'No limit' : '0'}
        value={values[name]}
        disabled={disabled}
        invalid={errors[name] != null}
        // The lib's `invalid` draws the error border only; a screen reader is told here.
        aria-invalid={errors[name] != null || undefined}
        // The lib's field label is not tied to the input, and the adornment is: name it ourselves, not "USD".
        aria-label={`${label}, USD`}
        aria-describedby={`${id}-${name}-note`}
        endAdornment={<span className="text-ods-text-secondary text-h6">USD</span>}
        onChange={event => onChange(name, toWholeDollarsText(event.target.value))}
      />
      <p
        id={`${id}-${name}-note`}
        className={cn('min-h-5 text-h6', errors[name] ? 'text-ods-error' : 'text-ods-text-secondary')}
      >
        {errors[name] ?? helper}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-sf)]">
      <p className="text-ods-text-secondary text-h5">Auto Top-up Settings</p>
      <div className="flex flex-col gap-[var(--spacing-system-mf)]">
        <div className="grid grid-cols-1 items-start gap-[var(--spacing-system-mf)] content-sm:grid-cols-2">
          {field('thresholdUsd', 'Threshold', HELPER.thresholdUsd)}
          {field(
            'amountUsd',
            'Top-up Amount',
            tokens == null ? '' : `≈ ${formatCompactCount(tokens)} tokens per top-up`,
          )}
        </div>
        {field('spendLimitUsd', 'Spend Limit', HELPER.spendLimitUsd)}
        {spentUsd != null && (
          <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
            <div className="flex flex-wrap justify-between gap-x-[var(--spacing-system-mf)] text-ods-text-secondary text-h6">
              <span>Spent on auto top-ups in the last 30 days</span>
              <span>
                {formatCurrency(spentUsd)}
                {limitUsd != null && ` of ${formatCurrency(limitUsd)}`}
              </span>
            </div>
            {usage && (
              <SpendLimitBar
                percent={usage.percent}
                reached={usage.reached}
                label="Auto top-up spend over the last 30 days"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
