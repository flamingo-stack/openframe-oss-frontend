import { formatWholeCurrency } from '@/lib/format-currency';

/** The three figures of the arrangement as typed: whole dollars, kept as text so the fields never fight the user. */
export interface AutoTopUpSettingsValues {
  thresholdUsd: string;
  amountUsd: string;
  /** Empty is no limit. */
  spendLimitUsd: string;
}

export type AutoTopUpSettingsField = keyof AutoTopUpSettingsValues;

/** The floors the backend states (`AutoTopUpStatus`), in whole dollars. */
export interface AutoTopUpMinimums {
  minimumAmountUsd: number;
  minimumThresholdUsd: number;
}

/** What a save sends: every figure, the limit included — a limit left out of `updateAutoTopUp` is removed. */
export interface AutoTopUpSettingsInputValues {
  thresholdUsd: number;
  amountUsd: number;
  spendLimitUsd: number | null;
}

export type AutoTopUpSettingsValidation =
  | { ok: true; input: AutoTopUpSettingsInputValues }
  | { ok: false; errors: Partial<Record<AutoTopUpSettingsField, string>> };

/** Digits only, so a pasted "$50" or "50.00" lands as the whole dollars it meant. */
export function toWholeDollarsText(next: string): string {
  return next.replace(/\..*$/, '').replace(/\D/g, '');
}

function parseWholeDollars(text: string): number | null {
  if (text === '') return null;
  const usd = Number.parseInt(text, 10);
  return Number.isFinite(usd) ? usd : null;
}

/**
 * The backend's rules for the arrangement, said before it refuses them: whole
 * dollars, the amount and the threshold at or above their floors, the
 * threshold lower than the amount, and a limit — when there is one — at least
 * one top-up, or no refill could ever fit under it.
 */
export function validateAutoTopUpSettings(
  values: AutoTopUpSettingsValues,
  { minimumAmountUsd, minimumThresholdUsd }: AutoTopUpMinimums,
): AutoTopUpSettingsValidation {
  const errors: Partial<Record<AutoTopUpSettingsField, string>> = {};
  const amountUsd = parseWholeDollars(values.amountUsd);
  const thresholdUsd = parseWholeDollars(values.thresholdUsd);
  const spendLimitUsd = parseWholeDollars(values.spendLimitUsd);

  if (amountUsd == null) errors.amountUsd = 'Enter a top-up amount.';
  else if (amountUsd < minimumAmountUsd) {
    errors.amountUsd = `The minimum top-up is ${formatWholeCurrency(minimumAmountUsd)}.`;
  }

  if (thresholdUsd == null) errors.thresholdUsd = 'Enter a threshold.';
  else if (thresholdUsd < minimumThresholdUsd) {
    errors.thresholdUsd = `The minimum threshold is ${formatWholeCurrency(minimumThresholdUsd)}.`;
  } else if (amountUsd != null && thresholdUsd >= amountUsd) {
    errors.thresholdUsd = 'The threshold must be lower than the top-up amount.';
  }

  if (spendLimitUsd != null && amountUsd != null && spendLimitUsd < amountUsd) {
    errors.spendLimitUsd = 'The spend limit must be at least the top-up amount.';
  }

  if (amountUsd == null || thresholdUsd == null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { thresholdUsd, amountUsd, spendLimitUsd } };
}

/** The fields start from what is saved — kept while auto top-up is off, so turning it back on restores it. */
export function initialAutoTopUpSettingsValues(saved: {
  thresholdUsd: number | null;
  amountUsd: number | null;
  spendLimitUsd: number | null;
}): AutoTopUpSettingsValues {
  const text = (usd: number | null) => (usd == null ? '' : String(Math.round(usd)));
  return {
    thresholdUsd: text(saved.thresholdUsd),
    amountUsd: text(saved.amountUsd),
    spendLimitUsd: text(saved.spendLimitUsd),
  };
}
