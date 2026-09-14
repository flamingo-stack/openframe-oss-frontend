'use client';

import { useState } from 'react';
import { tokensForUsd } from '../lib/ai-token-price';

/**
 * The amounts offered as one click each, in whole dollars — the unit
 * `purchaseTokens` and `CheckoutInput.tokenAmountUsd` take. The tokens under
 * each are derived from the catalog rate, never the other way round.
 */
export const TOP_UP_PRESETS_USD = [20, 50, 100] as const;

export type TopUpPresetUsd = (typeof TOP_UP_PRESETS_USD)[number];

export const CUSTOM_TOP_UP = 'custom';

export type TopUpSelection = number | typeof CUSTOM_TOP_UP | null;

/** What the user has picked, before it means anything in tokens. */
interface TopUpChoice {
  selection: TopUpSelection;
  /** Free text, whole dollars — kept as typed so the field never fights the user. */
  customUsd: string;
}

export interface AiTopUp extends TopUpChoice {
  /** Dollars the current choice means; `null` while nothing valid is chosen. */
  amountUsd: number | null;
  /** What that buys at the catalog rate; `null` without a rate or an amount. */
  tokens: number | null;
  /** A preset, or a custom figure that parses — there is an amount to send. */
  isComplete: boolean;
  tokensForUsd: (usd: number) => number | null;
  selectPreset: (usd: TopUpPresetUsd) => void;
  selectCustom: () => void;
  setCustomUsd: (next: string) => void;
  /** Back to the opening choice (e.g. after a refused purchase). */
  reset: () => void;
}

interface UseAiTopUpOptions {
  /** $ per token from the AI product's metered option. `null` until it loads. */
  tokenPrice: number | null;
  /** What is picked before the user touches anything; nothing by default. */
  initial?: TopUpPresetUsd | null;
}

/**
 * Whole dollars only: the backend refuses cents ("the amount must be a whole
 * number of dollars"), so the field cannot produce them in the first place.
 */
function parseWholeUsd(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const usd = Number.parseInt(value, 10);
  return usd > 0 ? usd : null;
}

/**
 * The AI top-up as the user is choosing it.
 *
 * Two surfaces ask the same question — the billing page's Manage AI Balance
 * modal and the paywall's AI Token Balance card — and they differ only in what
 * they do with the answer: an invoice now (`purchaseTokens`), or a line on the
 * checkout (`tokenAmountUsd`). So the state and the dollar↔token arithmetic
 * live here, and neither surface owns them.
 */
export function useAiTopUp({ tokenPrice, initial = null }: UseAiTopUpOptions): AiTopUp {
  const [choice, setChoice] = useState<TopUpChoice>({ selection: initial, customUsd: '' });

  const amountUsd = choice.selection === CUSTOM_TOP_UP ? parseWholeUsd(choice.customUsd) : choice.selection;
  const forUsd = (usd: number): number | null => tokensForUsd(usd, tokenPrice);

  return {
    ...choice,
    amountUsd,
    tokens: amountUsd == null ? null : forUsd(amountUsd),
    isComplete: amountUsd != null,
    tokensForUsd: forUsd,
    selectPreset: usd => setChoice(current => ({ ...current, selection: usd })),
    selectCustom: () => setChoice(current => ({ ...current, selection: CUSTOM_TOP_UP })),
    // Digits only, so a pasted "$50" or "50.00" lands as the whole dollars it meant.
    setCustomUsd: next => setChoice(current => ({ ...current, customUsd: next.replace(/\D/g, '') })),
    reset: () => setChoice({ selection: initial, customUsd: '' }),
  };
}
