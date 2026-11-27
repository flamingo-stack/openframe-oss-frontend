import { InsightCheckScopeType } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { pluralize } from '@/lib/pluralize';
import { formatDefaultThreshold, formatOverrideThreshold, lowerFirst, thresholdScopeLabel } from './check-labels';
import { type Check, type CheckOverride, type OverrideScopeType, overridesKeepingItOn } from './check-transform';

/** Every write applies from the check's next run on each device. */
export const NEXT_RUN_NOTE = 'Applies on the next run of the check.';

/** How the most specific exception wins, under the exceptions table. */
export const PRECEDENCE_NOTE =
  'The most specific exception wins: a device exception, then device tags, then the customer, then the default. New devices pick up exceptions as soon as they join the customer or get the tag.';

function overrideName(override: CheckOverride): string {
  return override.name ?? 'a removed scope';
}

/** The toast after an exception is saved; adding one that turns the check off names where it is off. */
export function exceptionSavedToast(check: Check, offFor?: string | null): { title: string; description?: string } {
  if (offFor === undefined) return { title: 'Exception saved' };
  return {
    title: `${check.name} is off for ${offFor ?? 'this scope'}`,
    description: `Exception added for ${check.name}. ${NEXT_RUN_NOTE}`,
  };
}

/** Where an exception's devices go once it is deleted, by what it applied to. */
export function deleteExceptionSentence(check: Check, override: CheckOverride): string {
  const deleted = `The ${thresholdScopeLabel(override.scopeType, override.name)} exception for ${check.name} is deleted.`;
  const fallback = `the default (${lowerFirst(formatDefaultThreshold(check))})`;
  switch (override.scopeType) {
    case InsightCheckScopeType.CUSTOMER:
      return `${deleted} Its devices go back to ${fallback}. Devices with their own tag or device exception keep it.`;
    case InsightCheckScopeType.TAG:
      return `${deleted} These devices go back to their customer’s exception or ${fallback}. Devices with their own device exception keep it.`;
    default:
      return `${deleted} The device goes back to its tag or customer exception, or ${fallback}.`;
  }
}

/** "3 exceptions (NW-FS01, server, kiosk) are deleted. Every device goes back to the default: above 30 days." */
export function deleteAllExceptionsSentence(check: Check, overrides: readonly CheckOverride[] | null): string {
  const total = overrides?.length ?? check.overrideCount;
  const names =
    overrides && overrides.length > 0 ? ` (${overrides.map(item => item.name ?? EMPTY_VALUE).join(', ')})` : '';
  const deleted = `${pluralize(total, 'exception')}${names} ${total === 1 ? 'is' : 'are'} deleted.`;
  return `${deleted} Every device goes back to the default: ${lowerFirst(formatDefaultThreshold(check))}.`;
}

/** "Exceptions keep their own values: lab (above 60), kiosk (above 25). " Nothing when no exception sets a threshold. */
export function exceptionsKeepTheirValues(check: Check, overrides: readonly CheckOverride[]): string {
  const withValues = overrides.flatMap(override => {
    if (Object.keys(override.parameters).length === 0 || override.enabled === false) return [];
    return [`${overrideName(override)} (${lowerFirst(formatOverrideThreshold(check, override))})`];
  });
  return withValues.length > 0 ? `Exceptions keep their own values: ${withValues.join(', ')}. ` : '';
}

/** " Still running for: lab, kiosk." when exceptions keep the check on; nothing otherwise. */
export function stillRunningFor(overrides: readonly CheckOverride[] | null): string {
  const stillOn = overrides ? overridesKeepingItOn(overrides) : [];
  return stillOn.length > 0 ? ` Still running for: ${stillOn.map(overrideName).join(', ')}.` : '';
}

/** "Applies to 6 devices." / "Applies to this device only." */
export function appliesToLine(type: OverrideScopeType, deviceCount: number): string {
  if (type === InsightCheckScopeType.DEVICE) return 'Applies to this device only.';
  return `Applies to ${pluralize(deviceCount, 'device')}.`;
}

/** Why another exception takes over on some of the devices, by the kind of exception being added. */
const TAKEN_OVER_BECAUSE: Record<OverrideScopeType, (those: string) => string> = {
  CUSTOMER: those =>
    `Device and tag exceptions win over customer exceptions, so this exception does not apply on ${those}.`,
  TAG: those => `A device exception or another tag exception applies on ${those} instead of this one.`,
  DEVICE: () => 'On this device this exception replaces them.',
};

/** The warning over the devices another exception takes over; nothing when there are none. */
export function impactWarning(
  type: OverrideScopeType,
  deviceCount: number,
  affected: number,
): { title: string; description: string } | null {
  if (affected <= 0) return null;
  const title =
    type === InsightCheckScopeType.DEVICE
      ? 'This device has other exceptions'
      : `${affected} of ${pluralize(deviceCount, 'device')} ${affected === 1 ? 'has' : 'have'} other exceptions`;
  return { title, description: TAKEN_OVER_BECAUSE[type](affected === 1 ? 'that device' : 'those devices') };
}
