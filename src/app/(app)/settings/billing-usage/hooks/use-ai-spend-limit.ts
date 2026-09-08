'use client';

import { useState } from 'react';

/** The unit the custom limit is entered in — "50" means 50 million tokens. */
export const TOKENS_PER_MILLION = 1_000_000;

/**
 * The limits offered as one click each. Token counts rather than dollars because
 * that is the unit the product is metered in and the one the free grant is
 * stated in — the money under each is derived from the catalog rate. The cap the
 * backend stores is USD (`aiSpendCapUsd`), so every choice is converted on the
 * way out and back.
 */
export const PRESET_TOKEN_LIMITS = [2_000_000, 5_000_000, 10_000_000] as const;

export const CUSTOM_LIMIT = 'custom';

export type AiLimitSelection = number | typeof CUSTOM_LIMIT | null;

/** What the user has picked, before it means anything in dollars. */
interface LimitChoice {
  enabled: boolean;
  selection: AiLimitSelection;
  /** Free text, in millions — kept as typed so a half-entered "1." survives. */
  customMillions: string;
}

export interface AiSpendLimit extends LimitChoice {
  /** Tokens the current choice means; `null` when nothing valid is chosen yet. */
  tokens: number | null;
  /**
   * What `updateAiSpendCap` would be sent for this choice: `null` removes the
   * cap. Also `null` while an enabled limit has no figure behind it — read it
   * together with `isComplete`, which tells the two apart.
   */
  capUsd: number | null;
  /** The choice is finished: either no limit, or a limit with a figure. */
  isComplete: boolean;
  /**
   * The finished choice differs from what the subscription already stores — so
   * there is something to send. Surfaces that save on a button read this to
   * decide whether to issue the mutation at all.
   */
  changed: boolean;
  /** What a token count costs, or `null` until the metered rate is known. */
  tokensToUsd: (tokens: number) => number | null;
  setEnabled: (next: boolean) => void;
  selectPreset: (tokens: number) => void;
  selectCustom: () => void;
  setCustomMillions: (next: string) => void;
  /** Drop local edits and show what the server holds (e.g. a refused save). */
  reset: () => void;
}

interface UseAiSpendLimitOptions {
  /** The cap stored on the subscription, in USD. `null` = uncapped. */
  capUsd: number | null;
  /** $ per token from the AI product's metered option. `null` until it loads. */
  tokenPrice: number | null;
}

/** Tokens from the millions field: digits with at most one decimal point. */
function parseMillions(value: string): number | null {
  const millions = Number.parseFloat(value);
  if (!Number.isFinite(millions) || millions <= 0) return null;
  return Math.round(millions * TOKENS_PER_MILLION);
}

/**
 * The stored cap, told back in the unit this picker speaks. Without a rate a USD
 * cap cannot be converted, so the limit shows as on with no tile selected — the
 * reseed below picks one the moment the catalog lands.
 */
function seedFromServer(capUsd: number | null, tokenPrice: number | null): LimitChoice {
  if (capUsd == null) return { enabled: false, selection: null, customMillions: '' };
  if (!tokenPrice) return { enabled: true, selection: null, customMillions: '' };

  const tokens = Math.round(capUsd / tokenPrice);
  const preset = PRESET_TOKEN_LIMITS.find(option => option === tokens);
  if (preset != null) return { enabled: true, selection: preset, customMillions: '' };

  return { enabled: true, selection: CUSTOM_LIMIT, customMillions: String(tokens / TOKENS_PER_MILLION) };
}

/**
 * The AI spending limit as the user is editing it, seeded from what the
 * subscription already holds.
 *
 * Two surfaces edit the same setting — the billing page's modal and the
 * paywall's AI card — and they differ only in WHEN they write it (a Save button
 * vs. immediately). So the state and the token↔dollar arithmetic live here and
 * neither owns them, while committing stays with the caller.
 *
 * Local edits are dropped whenever the server's answer changes: after a
 * successful save the two agree, so nothing moves; after a refused one `reset()`
 * puts back what is actually stored.
 */
export function useAiSpendLimit({ capUsd, tokenPrice }: UseAiSpendLimitOptions): AiSpendLimit {
  const [choice, setChoice] = useState<LimitChoice>(() => seedFromServer(capUsd, tokenPrice));

  // Reseed during render rather than in an effect: the values arrive from a
  // query, and an effect would paint one frame of the stale choice first.
  const serverKey = `${capUsd ?? ''}|${tokenPrice ?? ''}`;
  const [seededFrom, setSeededFrom] = useState(serverKey);
  if (serverKey !== seededFrom) {
    setSeededFrom(serverKey);
    setChoice(seedFromServer(capUsd, tokenPrice));
  }

  // Rounded to cents, which is the granularity the cap is billed and stored at.
  // Without it a preset read back from the server (`capUsd / price` → tokens →
  // `tokens * price`) lands a float epsilon away from the value it came from,
  // and `changed` below would report every untouched limit as edited.
  const tokensToUsd = (tokens: number): number | null =>
    tokenPrice == null ? null : Math.round(tokens * tokenPrice * 100) / 100;

  const tokens = choice.selection === CUSTOM_LIMIT ? parseMillions(choice.customMillions) : choice.selection;
  const resolvedCapUsd = choice.enabled && tokens != null ? tokensToUsd(tokens) : null;
  const isComplete = !choice.enabled || resolvedCapUsd != null;

  return {
    ...choice,
    tokens,
    capUsd: resolvedCapUsd,
    isComplete,
    changed: isComplete && resolvedCapUsd !== capUsd,
    tokensToUsd,
    // Turning the limit on chooses nothing by itself — the tiles are the choice.
    setEnabled: next => setChoice({ enabled: next, selection: null, customMillions: '' }),
    selectPreset: preset => setChoice(current => ({ ...current, selection: preset })),
    selectCustom: () => setChoice(current => ({ ...current, selection: CUSTOM_LIMIT })),
    setCustomMillions: next => setChoice(current => ({ ...current, customMillions: next })),
    reset: () => setChoice(seedFromServer(capUsd, tokenPrice)),
  };
}
