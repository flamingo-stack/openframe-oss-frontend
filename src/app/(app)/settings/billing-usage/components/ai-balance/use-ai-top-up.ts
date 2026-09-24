'use client';

import { useState } from 'react';
import { formatWholeCurrency } from '@/lib/format-currency';
import { tokensForUsd } from '../shared/ai-token-price';

/**
 * The amounts offered as one click each, in whole dollars — the unit
 * `purchaseTokens`, `updateAutoTopUp` and `CheckoutInput.tokenAmountUsd` take.
 * The tokens under each are derived from the catalog rate, never the other way
 * round.
 */
export const TOP_UP_PRESETS_USD = [20, 50, 100] as const;

export type TopUpPresetUsd = (typeof TOP_UP_PRESETS_USD)[number];

export const CUSTOM_TOP_UP = 'custom';

export type TopUpSelection = number | typeof CUSTOM_TOP_UP | null;

/**
 * The smallest top-up that can be sent, in whole dollars.
 *
 * A product rule stated here because the schema does not state it: the
 * purchase, the arrangement and the checkout all speak of "a configured
 * minimum" and expose no field carrying it, so without this the form would
 * learn the floor from the server's refusal. Every preset clears it; only a
 * custom figure can fall under it. If the backend ever exposes its minimum,
 * read that instead of this.
 */
export const MIN_TOP_UP_USD = 10;

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
  /** A preset, or a custom figure in range — there is an amount to send. */
  isComplete: boolean;
  /**
   * Why there is no amount to send, in the user's words — shown only once a
   * submit has been tried (`validate`), so the form stays quiet while it is
   * still being filled in. `null` when there is nothing to say, or not yet.
   */
  error: string | null;
  tokensForUsd: (usd: number) => number | null;
  selectPreset: (usd: TopUpPresetUsd) => void;
  selectCustom: () => void;
  setCustomUsd: (next: string) => void;
  /**
   * The submit's check: reveals the problem in the fields, if there is one, and
   * returns it so the caller can say it too. `null` means the amount can go.
   */
  validate: () => string | null;
  /** Back to the opening choice (e.g. after a refused purchase). */
  reset: () => void;
}

interface UseAiTopUpOptions {
  /** $ per token from the AI product's metered option. `null` until it loads. */
  tokenPrice: number | null;
  /**
   * Whole dollars picked before the user touches anything; nothing by default.
   * A preset lands on its tile, any other figure on Custom with the field filled.
   */
  initial?: number | null;
}

function isPreset(usd: number): usd is TopUpPresetUsd {
  return (TOP_UP_PRESETS_USD as readonly number[]).includes(usd);
}

function initialChoice(initial: number | null | undefined): TopUpChoice {
  if (initial == null) return { selection: null, customUsd: '' };
  if (isPreset(initial)) return { selection: initial, customUsd: '' };
  return { selection: CUSTOM_TOP_UP, customUsd: String(initial) };
}

/**
 * What the choice comes to, or why it comes to nothing.
 *
 * Whole dollars only: the backend refuses cents ("the amount must be a whole
 * number of dollars"), and the field cannot produce them in the first place —
 * so the checks left are an empty field and the floor.
 */
function resolveChoice(choice: TopUpChoice): { amountUsd: number | null; problem: string | null } {
  if (choice.selection == null) return { amountUsd: null, problem: 'Choose a top-up amount.' };

  const usd = choice.selection === CUSTOM_TOP_UP ? Number.parseInt(choice.customUsd, 10) : choice.selection;
  if (!Number.isFinite(usd)) return { amountUsd: null, problem: 'Enter a top-up amount.' };
  if (usd < MIN_TOP_UP_USD) {
    return { amountUsd: null, problem: `The minimum top-up is ${formatWholeCurrency(MIN_TOP_UP_USD)}.` };
  }
  return { amountUsd: usd, problem: null };
}

/**
 * The AI top-up as the user is choosing it.
 *
 * Two surfaces ask the same question — the billing page's Manage AI Balance
 * modal and the paywall's AI Token Balance card — and they differ only in what
 * they do with the answer: an invoice now, a refill arrangement, or a line on
 * the checkout. So the state and the dollar-to-token arithmetic live here, and
 * neither surface owns them.
 */
export function useAiTopUp({ tokenPrice, initial = null }: UseAiTopUpOptions): AiTopUp {
  const [choice, setChoice] = useState<TopUpChoice>(() => initialChoice(initial));
  // Set by the first submit and kept: from then on the fields answer every edit
  // at once, which is the moment the user is looking at them.
  const [attempted, setAttempted] = useState(false);

  const { amountUsd, problem } = resolveChoice(choice);
  const forUsd = (usd: number): number | null => tokensForUsd(usd, tokenPrice);

  return {
    ...choice,
    amountUsd,
    tokens: amountUsd == null ? null : forUsd(amountUsd),
    isComplete: problem == null,
    error: attempted ? problem : null,
    tokensForUsd: forUsd,
    selectPreset: usd => setChoice(current => ({ ...current, selection: usd })),
    selectCustom: () => setChoice(current => ({ ...current, selection: CUSTOM_TOP_UP })),
    // Digits only, so a pasted "$50" or "50.00" lands as the whole dollars it meant.
    setCustomUsd: next => setChoice(current => ({ ...current, customUsd: next.replace(/\D/g, '') })),
    validate: () => {
      setAttempted(true);
      return problem;
    },
    reset: () => {
      setChoice(initialChoice(initial));
      setAttempted(false);
    },
  };
}
