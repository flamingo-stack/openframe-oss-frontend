'use client';

import { CheckCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useId } from 'react';
import { type AiTopUp, CUSTOM_TOP_UP, TOP_UP_PRESETS_USD } from '../hooks/use-ai-top-up';
import { formatCompactCount, formatWholeCurrency } from '../lib/format';

/**
 * What the balance is. Stated wherever it is topped up — the billing page's
 * modal and the paywall's card — so it is a constant rather than part of the
 * fields.
 */
export const AI_BALANCE_EXPLANATION = 'One unified balance powers AI assistants across all supported models.';

interface AiTopUpFieldsProps {
  topUp: AiTopUp;
  /** The uppercase label over the amounts — what this top-up is for on this surface. */
  label: string;
  /** Blocks every control — a purchase in flight, or a catalog that has not landed. */
  disabled?: boolean;
}

/**
 * The top-up amount, as controls: three presets, a custom choice, and the field
 * behind it.
 *
 * Shared because the billing page's Manage AI Balance modal and the paywall's
 * AI Token Balance card ask the exact same question of the same catalog rate.
 * They differ only in what they do with the answer — everything the user sees
 * and does is here, once.
 */
export function AiTopUpFields({ topUp, label, disabled = false }: AiTopUpFieldsProps) {
  const customInputId = useId();

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
        <p className="text-ods-text-secondary text-h5">{label}</p>
        <div className="grid grid-cols-1 gap-[var(--spacing-system-xsf)] sm:grid-cols-2">
          {TOP_UP_PRESETS_USD.map(usd => {
            const tokens = topUp.tokensForUsd(usd);
            return (
              <TopUpTile
                key={usd}
                selected={topUp.selection === usd}
                disabled={disabled}
                title={formatWholeCurrency(usd)}
                // The count is a catalog figure: a bar holds its line until it
                // lands rather than letting the tile grow a second row.
                subtitle={tokens == null ? <Skeleton className="h-4 w-16" /> : `${formatCompactCount(tokens)} tokens`}
                onSelect={() => topUp.selectPreset(usd)}
              />
            );
          })}
          <TopUpTile
            selected={topUp.selection === CUSTOM_TOP_UP}
            disabled={disabled}
            title="Custom"
            subtitle="Enter Your Amount"
            onSelect={topUp.selectCustom}
          />
        </div>
      </div>

      {topUp.selection === CUSTOM_TOP_UP && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Input
            id={customInputId}
            label="Top Up Amount"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={topUp.customUsd}
            disabled={disabled}
            endAdornment={<span className="text-ods-text-secondary text-h6">USD</span>}
            onChange={event => topUp.setCustomUsd(event.target.value)}
          />
          {/* Holds its line whether or not there is an amount yet, so typing
              one does not push the rest of the form down. */}
          <p className="min-h-5 text-ods-text-secondary text-h6">
            {topUp.tokens != null ? `${formatCompactCount(topUp.tokens)} tokens` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

interface TopUpTileProps {
  selected: boolean;
  disabled: boolean;
  title: ReactNode;
  subtitle: ReactNode;
  onSelect: () => void;
}

/**
 * One amount, as a button rather than a radio: the grid is four independent
 * choices of the same shape, and the check mark on the chosen one is the whole
 * selected state — there is no list semantics here for a radio group to carry.
 */
function TopUpTile({ selected, disabled, title, subtitle, onSelect }: TopUpTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-16 items-center gap-[var(--spacing-system-xsf)] rounded-md border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] text-left transition-colors',
        selected ? 'border-ods-accent bg-ods-warning-secondary' : 'border-ods-border bg-ods-card hover:bg-ods-bg-hover',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-ods-text-primary text-h4">{title}</span>
        <span className={cn('truncate text-h6', selected ? 'text-ods-accent' : 'text-ods-text-secondary')}>
          {subtitle}
        </span>
      </span>
      {selected && <CheckCircleIcon className="size-6 shrink-0 text-ods-accent" />}
    </button>
  );
}
