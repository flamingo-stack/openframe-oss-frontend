'use client';

import { useState } from 'react';
import { formatWholeCurrency } from '@/lib/format-currency';
import { tokensForUsd } from '../shared/ai-token-price';
import { FALLBACK_MIN_TOP_UP_USD } from './auto-top-up-status';

/**
 * The amounts offered as one click each, in whole dollars — the unit
 * `purchaseTokens`, `updateAutoTopUp` and `CheckoutInput.tokenAmountUsd` take.
 * The tokens under each are derived from the catalog rate, never the other way
 * round. A surface may offer its own (`UseAiTopUpOptions.presets`); these are
 * the ones every surface offered before the paywall's prepaid year had its own.
 */
export const TOP_UP_PRESETS_USD: readonly number[] = [20, 50, 100];

export const CUSTOM_TOP_UP = 'custom';

/**
 * "Don't top up": a choice of nothing, where a surface allows one
 * (`UseAiTopUpOptions.allowNone`). It is complete, and its amount is 0.
 */
export const NO_TOP_UP = 'none';

export type TopUpSelection = number | typeof CUSTOM_TOP_UP | typeof NO_TOP_UP | null;

/** What the user has picked, before it means anything in tokens. */
interface TopUpChoice {
  selection: TopUpSelection;
  /** Free text, whole dollars — kept as typed so the field never fights the user. */
  customUsd: string;
}

export interface AiTopUp extends TopUpChoice {
  /** The amounts this surface offers as tiles, in the order drawn. */
  presets: readonly number[];
  /** Whether "Don't top up" is one of the tiles, before the presets. */
  allowNone: boolean;
  /** Dollars the current choice means: 0 for "Don't top up", `null` while nothing valid is chosen. */
  amountUsd: number | null;
  /** What that buys at the catalog rate; `null` without a rate or an amount. */
  tokens: number | null;
  /**
   * The catalog states a rate, so an amount can be shown in tokens. False both
   * while the catalog is on its way and when it answered without one — the
   * fields tell the two apart by their own `loading`.
   */
  hasRate: boolean;
  /** A preset, or a custom figure in range — there is an amount to send. */
  isComplete: boolean;
  /**
   * Why there is no amount to send, in the user's words — shown only once a
   * submit has been tried (`validate`), so the form stays quiet while it is
   * still being filled in. `null` when there is nothing to say, or not yet.
   */
  error: string | null;
  tokensForUsd: (usd: number) => number | null;
  selectPreset: (usd: number) => void;
  selectNone: () => void;
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
  /** $ per token from the AI product's option; `null` while the catalog is on its way, or when it states no rate. */
  tokenPrice: number | null;
  /**
   * What is picked before the user touches anything; nothing by default. A
   * preset lands on its tile, any other figure on Custom with the field filled,
   * `NO_TOP_UP` on "Don't top up". Followed until the first pick, so a surface
   * may derive it from data that lands after the form mounts.
   */
  initial?: number | typeof NO_TOP_UP | null;
  /**
   * The smallest amount that can be sent, in whole dollars: the backend's
   * figure where the surface has read it (`AutoTopUpStatus.minimumAmountUsd`),
   * else the floor every surface shares today.
   */
  minimumUsd?: number;
  /** The tiles, `TOP_UP_PRESETS_USD` unless given. May change between renders — see the hook. */
  presets?: readonly number[];
  /** Offer "Don't top up" before the presets. May change between renders, as `presets` may. */
  allowNone?: boolean;
}

function initialChoice(initial: number | typeof NO_TOP_UP | null | undefined, presets: readonly number[]): TopUpChoice {
  if (initial == null) return { selection: null, customUsd: '' };
  if (initial === NO_TOP_UP || presets.includes(initial)) return { selection: initial, customUsd: '' };
  return { selection: CUSTOM_TOP_UP, customUsd: String(initial) };
}

/** Whether the grid drawn now has a tile for `selection`. */
function isOffered(selection: TopUpSelection, presets: readonly number[], allowNone: boolean): boolean {
  if (selection === NO_TOP_UP) return allowNone;
  if (typeof selection === 'number') return presets.includes(selection);
  return true;
}

/**
 * What the choice comes to, or why it comes to nothing.
 *
 * Whole dollars only: the backend refuses cents ("the amount must be a whole
 * number of dollars"), and the field cannot produce them in the first place —
 * so the checks left are an empty field and the floor.
 */
function resolveChoice(choice: TopUpChoice, minimumUsd: number): { amountUsd: number | null; problem: string | null } {
  if (choice.selection == null) return { amountUsd: null, problem: 'Choose a top-up amount.' };
  if (choice.selection === NO_TOP_UP) return { amountUsd: 0, problem: null };

  const usd = choice.selection === CUSTOM_TOP_UP ? Number.parseInt(choice.customUsd, 10) : choice.selection;
  if (!Number.isFinite(usd)) return { amountUsd: null, problem: 'Enter a top-up amount.' };
  if (usd < minimumUsd) {
    return { amountUsd: null, problem: `The minimum top-up is ${formatWholeCurrency(minimumUsd)}.` };
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
 *
 * The grid may change under a choice: the paywall offers one set of tiles for a
 * prepaid year and another for pay-as-you-go. A choice the grid drawn now has no
 * tile for reads as the opening choice, without being forgotten — so switching
 * back to the plan it was made on brings it back.
 */
export function useAiTopUp({
  tokenPrice,
  initial = null,
  minimumUsd = FALLBACK_MIN_TOP_UP_USD,
  presets = TOP_UP_PRESETS_USD,
  allowNone = false,
}: UseAiTopUpOptions): AiTopUp {
  // `null` until the user picks: the opening choice is read from `initial` on every render until then.
  const [picked, setChoice] = useState<TopUpChoice | null>(null);
  // Set by the first submit and kept: from then on the fields answer every edit
  // at once, which is the moment the user is looking at them.
  const [attempted, setAttempted] = useState(false);

  const opening = initialChoice(initial, presets);
  const stored = picked ?? opening;
  const choice: TopUpChoice = isOffered(stored.selection, presets, allowNone)
    ? stored
    : {
        ...stored,
        selection: isOffered(opening.selection, presets, allowNone) ? opening.selection : null,
      };

  const { amountUsd, problem } = resolveChoice(choice, minimumUsd);
  const forUsd = (usd: number): number | null => tokensForUsd(usd, tokenPrice);

  return {
    ...choice,
    presets,
    allowNone,
    amountUsd,
    tokens: amountUsd == null || amountUsd === 0 ? null : forUsd(amountUsd),
    hasRate: tokenPrice != null && tokenPrice > 0,
    isComplete: problem == null,
    error: attempted ? problem : null,
    tokensForUsd: forUsd,
    selectPreset: usd => setChoice(current => ({ ...(current ?? opening), selection: usd })),
    selectNone: () => setChoice(current => ({ ...(current ?? opening), selection: NO_TOP_UP })),
    selectCustom: () => setChoice(current => ({ ...(current ?? opening), selection: CUSTOM_TOP_UP })),
    // Digits only, so a pasted "$50" or "50.00" lands as the whole dollars it meant.
    setCustomUsd: next => setChoice(current => ({ ...(current ?? opening), customUsd: next.replace(/\D/g, '') })),
    validate: () => {
      setAttempted(true);
      return problem;
    },
    reset: () => {
      setChoice(null);
      setAttempted(false);
    },
  };
}
