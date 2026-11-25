import { readInlineData } from 'react-relay';
import type {
  insightCheckFields_insightCheck$data,
  insightCheckFields_insightCheck$key,
} from '@/__generated__/insightCheckFields_insightCheck.graphql';
import type { insightCheckOverrideFields_override$key } from '@/__generated__/insightCheckOverrideFields_override.graphql';
import type { UpdateInsightCheckSettingInput } from '@/__generated__/updateInsightCheckSettingMutation.graphql';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { insightCheckFieldsFragment } from '@/graphql/insights/insight-check-fields';
import { insightCheckOverrideFieldsFragment } from '@/graphql/insights/insight-check-override-fields';
import type { Instant } from '@/lib/graphql-scalars';

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

type CheckData = insightCheckFields_insightCheck$data;

export interface CheckParameter {
  parameter: string;
  label: string;
  firesWhen: CheckData['parameters'][number]['firesWhen'];
  unit: string;
  /** The value at GLOBAL: the tenant's default, else the built-in one. */
  value: number;
  /** The built-in value, the one "Reset to default" goes back to. */
  defaultValue: number;
  min: number;
  max: number;
  /** The default was changed for this tenant (stored at GLOBAL), not the built-in one. */
  setForAllDevices: boolean;
}

/** One built-in check as it runs at GLOBAL: its default for every device without an override. */
export interface Check {
  /** The check at GLOBAL (Relay id): an answer at GLOBAL carries the same one. */
  id: string;
  /** The stable key the API takes, e.g. `resource-win-disk-low`; the check page's `?id=`. */
  check: string;
  name: string;
  platform: CheckData['platform'];
  description: string;
  severity: CheckData['severity'];
  /** The category of the incident it opens (IT, Security). */
  type: CheckData['type'];
  /** How often it runs on each device, in seconds. */
  intervalSeconds: number;
  /** Whether it runs on a device no override covers. */
  enabled: boolean;
  /** `enabled` is stored at GLOBAL (it was turned off or back on), so a write there keeps it. */
  enabledSetForAllDevices: boolean;
  /** Something is stored at GLOBAL: a changed default threshold or the switch. */
  customized: boolean;
  overrideCount: number;
  /** Empty for an on/off check. */
  parameters: CheckParameter[];
}

export function toCheck(ref: insightCheckFields_insightCheck$key): Check {
  const node = readInlineData(insightCheckFieldsFragment, ref);
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
    customized: node.customized,
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

/** What one customer, tag or device stores for a check. */
export interface CheckOverride {
  /** Stable for the check and scope across reads. */
  id: string;
  /** The scope type keeps the artifact's union: a scope this build does not know still renders. */
  scopeType: string;
  scopeId: string;
  /** The customer's name, the tag's key or the device's name; null once it is gone. */
  name: string | null;
  /** As stored here; null keeps whatever a less specific scope says. */
  enabled: boolean | null;
  /** Only the thresholds stored here, by parameter key. */
  parameters: Readonly<Record<string, number>>;
  /** Connected devices on the check's platform it covers now. */
  deviceCount: number;
  updatedAt: Instant | null;
  /** Who last changed it: their name, else their email; null when unknown. */
  updatedBy: string | null;
}

export function toCheckOverride(ref: insightCheckOverrideFields_override$key): CheckOverride {
  const node = readInlineData(insightCheckOverrideFieldsFragment, ref);
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
