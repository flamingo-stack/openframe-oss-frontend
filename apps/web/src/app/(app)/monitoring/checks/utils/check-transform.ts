import { graphql, readInlineData } from 'react-relay';
import type {
  checkTransform_insightCheck$data,
  checkTransform_insightCheck$key,
} from '@/__generated__/checkTransform_insightCheck.graphql';
import type {
  checkTransform_override$data,
  checkTransform_override$key,
} from '@/__generated__/checkTransform_override.graphql';
import type { checkTransform_withOverrides$key } from '@/__generated__/checkTransform_withOverrides.graphql';
import type { UpdateInsightCheckSettingInput } from '@/__generated__/useCheckMutationsUpdateMutation.graphql';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';

/**
 * One built-in check as a scope sees it: whether it runs and its thresholds, each with the scope it was taken from.
 * The list, the check page and the writes spread it; `toCheck` reads it. `id` is the check at the scope asked about,
 * so an answer at GLOBAL replaces the list's row and the page.
 */
export const checkFragment = graphql`
  fragment checkTransform_insightCheck on InsightCheck @inline {
    id
    check
    title
    platform
    description
    severity
    intervalSeconds
    enabled
    enabledScopeType
    type
    overrideCount
    parameters {
      parameter
      label
      unit
      firesWhen
      value
      defaultValue
      min
      max
      scopeType
    }
  }
`;

/** What one customer, tag or device stores for a check. Spread by the check page's reads; `toCheckOverride` reads it. */
export const overrideFragment = graphql`
  fragment checkTransform_override on InsightCheckOverride @inline {
    id
    scopeType
    scopeId
    scopeName
    enabled
    parameters {
      parameter
      value
    }
    deviceCount
    updatedAt
    updatedBy {
      firstName
      lastName
      email
    }
  }
`;

/** A check and every exception it has: the check page's read, and what a write reads again. */
export const checkWithOverridesFragment = graphql`
  fragment checkTransform_withOverrides on InsightCheck @inline {
    ...checkTransform_insightCheck
    overrides {
      ...checkTransform_override
    }
  }
`;

/** The scopes an override is set at: a customer, a device tag or one device. */
export type OverrideScopeType = Extract<InsightCheckScopeType, 'CUSTOMER' | 'TAG' | 'DEVICE'>;

export const OVERRIDE_SCOPE_TYPES: readonly OverrideScopeType[] = [
  InsightCheckScopeType.CUSTOMER,
  InsightCheckScopeType.TAG,
  InsightCheckScopeType.DEVICE,
];

export function isOverrideScopeType(value: string): value is OverrideScopeType {
  return OVERRIDE_SCOPE_TYPES.some(type => type === value);
}

/**
 * Where a setting is written: GLOBAL (the check's default for every device, no id) or one customer
 * (`organizationId`), tag (`Tag.id`) or device (`machineId`).
 */
export type CheckScope =
  { type: typeof InsightCheckScopeType.GLOBAL; id: null } | { type: OverrideScopeType; id: string };

export const GLOBAL_SCOPE: CheckScope = { type: InsightCheckScopeType.GLOBAL, id: null };

/** The customer, tag or device an exception is for, with its name for the lines that say it. */
export interface PickedScope {
  type: OverrideScopeType;
  id: string;
  name: string | null;
}

type CheckData = checkTransform_insightCheck$data;
type ParameterData = CheckData['parameters'][number];

export type CheckParameter = Pick<
  ParameterData,
  'parameter' | 'label' | 'firesWhen' | 'unit' | 'value' | 'defaultValue' | 'min' | 'max'
> & {
  /** The default was changed for this tenant (stored at GLOBAL), not the built-in one. */
  setForAllDevices: boolean;
};

/** One built-in check as it runs at GLOBAL: its default for every device without an override. */
export type Check = Pick<
  CheckData,
  'id' | 'check' | 'platform' | 'description' | 'severity' | 'type' | 'intervalSeconds' | 'enabled' | 'overrideCount'
> & {
  name: string;
  /** `enabled` is stored at GLOBAL (it was turned off or back on), so a write there keeps it. */
  enabledSetForAllDevices: boolean;
  /** Empty for an on/off check. */
  parameters: CheckParameter[];
};

export function toCheck(ref: checkTransform_insightCheck$key): Check {
  const node = readInlineData(checkFragment, ref);
  return {
    id: node.id,
    check: node.check,
    name: node.title,
    platform: node.platform,
    description: node.description,
    severity: node.severity,
    type: node.type,
    intervalSeconds: node.intervalSeconds,
    enabled: node.enabled,
    enabledSetForAllDevices: node.enabledScopeType === InsightCheckScopeType.GLOBAL,
    overrideCount: node.overrideCount,
    parameters: node.parameters.map(parameter => ({
      parameter: parameter.parameter,
      label: parameter.label,
      firesWhen: parameter.firesWhen,
      unit: parameter.unit,
      value: parameter.value,
      defaultValue: parameter.defaultValue,
      min: parameter.min,
      max: parameter.max,
      setForAllDevices: parameter.scopeType === InsightCheckScopeType.GLOBAL,
    })),
  };
}

/** What one customer, tag or device stores for a check. `scopeType` keeps the artifact's union: an unknown one renders. */
export type CheckOverride = Pick<checkTransform_override$data, 'id' | 'scopeType' | 'scopeId' | 'deviceCount'> & {
  /** The customer's name, the tag's key or the device's name; null once it is gone. */
  name: string | null;
  /** As stored here; null keeps whatever a less specific scope says. */
  enabled: boolean | null;
  /** Only the thresholds stored here, by parameter key. */
  parameters: Readonly<Record<string, number>>;
  updatedAt: Instant | null;
  /** Who last changed it: their name, else their email; null when unknown. */
  updatedBy: string | null;
};

export function toCheckOverride(ref: checkTransform_override$key): CheckOverride {
  const node = readInlineData(overrideFragment, ref);
  const user = node.updatedBy;
  const userName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || null : null;
  return {
    id: node.id,
    scopeType: node.scopeType,
    scopeId: node.scopeId,
    name: node.scopeName ?? null,
    enabled: node.enabled ?? null,
    parameters: Object.fromEntries(node.parameters.map(parameter => [parameter.parameter, parameter.value])),
    deviceCount: node.deviceCount,
    updatedAt: node.updatedAt ?? null,
    updatedBy: userName,
  };
}

export function toCheckWithOverrides(ref: checkTransform_withOverrides$key): {
  check: Check;
  overrides: CheckOverride[];
} {
  const node = readInlineData(checkWithOverridesFragment, ref);
  return { check: toCheck(node), overrides: node.overrides.map(toCheckOverride) };
}

/** The scope an override is written at; null for a scope type this build does not know. */
export function overrideScope(override: CheckOverride): CheckScope | null {
  return isOverrideScopeType(override.scopeType) ? { type: override.scopeType, id: override.scopeId } : null;
}

/**
 * What one scope stores for a check, as a form holds it: `enabled` null and a parameter left out
 * both mean "take it from a less specific scope".
 */
export interface CheckSettingDraft {
  enabled: boolean | null;
  parameters: Readonly<Record<string, number>>;
}

/** What GLOBAL stores now: the switch when it was set, and every default threshold that was changed. */
export function storedDefaultDraft(check: Check): CheckSettingDraft {
  const parameters: Record<string, number> = {};
  for (const parameter of check.parameters) {
    if (parameter.setForAllDevices) parameters[parameter.parameter] = parameter.value;
  }
  return { enabled: check.enabledSetForAllDevices ? check.enabled : null, parameters };
}

/** The default thresholds Edit Default stores: only what differs from the built-in value is a change. */
export function changedDefaults(check: Check, thresholds: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    check.parameters.flatMap(parameter => {
      const value = thresholds[parameter.parameter];
      return value === undefined || value === parameter.defaultValue ? [] : [[parameter.parameter, value]];
    }),
  );
}

/** A draft that stores nothing: the write is a reset, since the API refuses an update with nothing in it. */
export function isEmptyDraft(draft: CheckSettingDraft): boolean {
  return draft.enabled === null && Object.keys(draft.parameters).length === 0;
}

/** The scope's fields of a mutation input: no `scopeId` for GLOBAL, which the API refuses one for. */
export function scopeInput(scope: CheckScope): { scopeType: CheckScope['type']; scopeId?: string } {
  return scope.id === null ? { scopeType: scope.type } : { scopeType: scope.type, scopeId: scope.id };
}

/** The update for a non-empty draft. The update REPLACES what the scope stores, so the draft is the whole of it. */
export function toUpdateInput(
  check: string,
  scope: CheckScope,
  draft: CheckSettingDraft,
): UpdateInsightCheckSettingInput {
  return {
    check,
    ...scopeInput(scope),
    enabled: draft.enabled,
    parameters: Object.entries(draft.parameters).map(([parameter, value]) => ({ parameter, value })),
  };
}

/** The overrides that keep the check running while it is off for every device: the "Still running for" list. */
export function overridesKeepingItOn(overrides: readonly CheckOverride[]): CheckOverride[] {
  return overrides.filter(override => override.enabled === true);
}

/** The override a picked scope already has, other than the one being edited; null when it has none. */
export function existingOverride(
  overrides: readonly CheckOverride[] | null,
  scope: PickedScope | null,
  editingId: string | null,
): CheckOverride | null {
  if (!scope || !overrides) return null;
  return (
    overrides.find(
      override => override.scopeType === scope.type && override.scopeId === scope.id && override.id !== editingId,
    ) ?? null
  );
}
