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

/**
 * Digits and the first decimal point: a pasted "$1,000" lands as 1000, and cents stay visible so the save can say
 * they are not taken instead of dropping them unseen.
 */
export function toDollarsText(next: string): string {
  const [whole = '', ...rest] = next.replace(/[^\d.]/g, '').split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
}

const NOT_WHOLE = 'Whole dollars only.';

/** `null` for an empty field, `NaN` for one with cents ("50.00" is still whole). */
function parseWholeDollars(text: string): number | null {
  if (text === '' || text === '.') return null;
  return /^\d+(\.0*)?$/.test(text) ? Number.parseInt(text, 10) : Number.NaN;
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
  // A field with cents is NaN, and every comparison with NaN is false: it gets its own message and no other.
  const amountUsd = parseWholeDollars(values.amountUsd);
  const thresholdUsd = parseWholeDollars(values.thresholdUsd);
  const spendLimitUsd = parseWholeDollars(values.spendLimitUsd);

  if (amountUsd == null) errors.amountUsd = 'Enter a top-up amount.';
  else if (Number.isNaN(amountUsd)) errors.amountUsd = NOT_WHOLE;
  else if (amountUsd < minimumAmountUsd) {
    errors.amountUsd = `The minimum top-up is ${formatWholeCurrency(minimumAmountUsd)}.`;
  }

  if (thresholdUsd == null) errors.thresholdUsd = 'Enter a threshold.';
  else if (Number.isNaN(thresholdUsd)) errors.thresholdUsd = NOT_WHOLE;
  else if (thresholdUsd < minimumThresholdUsd) {
    errors.thresholdUsd = `The minimum threshold is ${formatWholeCurrency(minimumThresholdUsd)}.`;
  } else if (amountUsd != null && thresholdUsd >= amountUsd) {
    errors.thresholdUsd = 'The threshold must be lower than the top-up amount.';
  }

  if (spendLimitUsd != null && Number.isNaN(spendLimitUsd)) errors.spendLimitUsd = NOT_WHOLE;
  else if (spendLimitUsd != null && amountUsd != null && spendLimitUsd < amountUsd) {
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
