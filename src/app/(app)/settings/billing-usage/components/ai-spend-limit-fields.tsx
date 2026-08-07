'use client';

import { CheckCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CheckboxBlock, Input, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useId } from 'react';
import { type AiSpendLimit, CUSTOM_LIMIT, PRESET_TOKEN_LIMITS } from '../hooks/use-ai-spend-limit';
import { formatCompactCount, formatCurrency } from '../lib/format';

/**
 * What a limit does once it is reached. Stated wherever the limit is edited, but
 * in different places — above the fields in the modal, below them on the paywall
 * card — so it is a constant rather than part of the fields.
 */
export const AI_LIMIT_EXPLANATION =
  "When the limit is reached, Fae and Mingo pause until the next cycle. You'll be notified before that happens, and can raise the limit anytime in Settings.";

interface AiSpendLimitFieldsProps {
  limit: AiSpendLimit;
  /** Blocks every control — a save in flight, or a catalog that has not landed. */
  disabled?: boolean;
  /**
   * A choice was settled: a preset clicked, a custom amount finished, or the
   * limit switched off (`null`). Surfaces that write immediately hang the
   * mutation here; the modal leaves it out and saves from its own button.
   */
  onCommit?: (capUsd: number | null) => void;
}

/**
 * The AI spending limit, as controls: the switch, the four amounts, and the
 * custom figure.
 *
 * Shared because the billing page's modal and the paywall's AI card ask the
 * exact same question of the same subscription field. They differ only in when
 * they write the answer, which is what `onCommit` is for — everything the user
 * sees and does is here, once.
 */
export function AiSpendLimitFields({ limit, disabled = false, onCommit }: AiSpendLimitFieldsProps) {
  const customInputId = useId();
  const customUsd = limit.selection === CUSTOM_LIMIT && limit.tokens != null ? limit.tokensToUsd(limit.tokens) : null;
  /**
   * Every amount here is priced from the metered rate, so without one there is
   * nothing to choose between. The switch stays live regardless — a tenant whose
   * catalog is unavailable must still be able to lift its own limit.
   */
  const hasRate = limit.tokensToUsd(1) != null;

  const handleToggle = (checked: boolean) => {
    limit.setEnabled(checked);
    // Switching it off is a complete answer on its own; switching it on is not,
    // so nothing is written until an amount is picked.
    if (!checked) onCommit?.(null);
  };

  const handlePreset = (tokens: number) => {
    const usd = limit.tokensToUsd(tokens);
    if (usd == null) return;
    limit.selectPreset(tokens);
    onCommit?.(usd);
  };

  // On blur / Enter rather than per keystroke: every intermediate number a user
  // types past ("1", "10", "100") would otherwise be saved as their limit.
  const handleCustomCommit = () => {
    if (limit.selection !== CUSTOM_LIMIT || limit.capUsd == null) return;
    onCommit?.(limit.capUsd);
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <CheckboxBlock
        label="Limit my monthly AI spend"
        description="Keep invoices predictable"
        checked={limit.enabled}
        onCheckedChange={handleToggle}
        disabled={disabled}
      />

      {limit.enabled && (
        <>
          <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
            <p className="text-h5 text-ods-text-secondary">Set a monthly spending limit</p>
            <div className="grid grid-cols-1 gap-[var(--spacing-system-xsf)] sm:grid-cols-2">
              {PRESET_TOKEN_LIMITS.map(tokens => {
                const usd = limit.tokensToUsd(tokens);
                return (
                  <LimitTile
                    key={tokens}
                    selected={limit.selection === tokens}
                    disabled={disabled || !hasRate}
                    title={`${formatCompactCount(tokens)} tokens`}
                    // The price is a catalog figure: a bar holds its line until
                    // it lands rather than letting the tile grow a second row.
                    subtitle={usd == null ? <Skeleton className="h-4 w-16" /> : `~${formatCurrency(usd)}`}
                    onSelect={() => handlePreset(tokens)}
                  />
                );
              })}
              <LimitTile
                selected={limit.selection === CUSTOM_LIMIT}
                disabled={disabled || !hasRate}
                title="Custom"
                subtitle="Enter Your Amount"
                onSelect={limit.selectCustom}
              />
            </div>
          </div>

          {limit.selection === CUSTOM_LIMIT && (
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <Input
                id={customInputId}
                label="Custom Tokens Amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={limit.customMillions}
                disabled={disabled}
                endAdornment={<span className="text-h6 text-ods-text-secondary">million tokens</span>}
                onChange={event => limit.setCustomMillions(event.target.value.replace(/[^\d.]/g, ''))}
                onBlur={handleCustomCommit}
                onKeyDown={event => {
                  if (event.key === 'Enter') handleCustomCommit();
                }}
              />
              {/* Holds its line whether or not there is an amount yet, so typing
                  one does not push the rest of the form down. */}
              <p className="min-h-5 text-h6 text-ods-text-secondary">
                {customUsd != null ? `~${formatCurrency(customUsd)}` : ''}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface LimitTileProps {
  selected: boolean;
  disabled: boolean;
  title: ReactNode;
  subtitle: ReactNode;
  onSelect: () => void;
}

/**
 * One limit, as a button rather than a radio: the grid is four independent
 * choices of the same shape, and the check mark on the chosen one is the whole
 * selected state — there is no list semantics here for a radio group to carry.
 */
function LimitTile({ selected, disabled, title, subtitle, onSelect }: LimitTileProps) {
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
        <span className="truncate text-h4 text-ods-text-primary">{title}</span>
        <span className={cn('truncate text-h6', selected ? 'text-ods-accent' : 'text-ods-text-secondary')}>
          {subtitle}
        </span>
      </span>
      {selected && <CheckCircleIcon className="size-6 shrink-0 text-ods-accent" />}
    </button>
  );
}
