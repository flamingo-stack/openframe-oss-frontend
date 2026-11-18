import { readInlineData } from 'react-relay';
import type {
  insightCheckFields_insightCheck$data,
  insightCheckFields_insightCheck$key,
} from '@/__generated__/insightCheckFields_insightCheck.graphql';
import type { UpdateInsightCheckSettingInput } from '@/__generated__/updateInsightCheckSettingMutation.graphql';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { insightCheckFieldsFragment } from '@/graphql/insights/insight-check-fields';

/** The scopes a setting can be written at: everything but the built-in DEFAULT. */
export type WritableScopeType = Exclude<InsightCheckScopeType, 'DEFAULT'>;

export const WRITABLE_SCOPE_TYPES: readonly WritableScopeType[] = [
  InsightCheckScopeType.GLOBAL,
  InsightCheckScopeType.CUSTOMER,
  InsightCheckScopeType.TAG,
  InsightCheckScopeType.DEVICE,
];

export function isWritableScopeType(value: string): value is WritableScopeType {
  return WRITABLE_SCOPE_TYPES.some(type => type === value);
}

/**
 * The scope the Checks tab shows: the whole workspace, or one customer (`organizationId`), tag
 * (`Tag.id`) or device (`machineId`). `id` is null only for GLOBAL.
 */
export interface CheckScope {
  type: WritableScopeType;
  id: string | null;
}

export const GLOBAL_SCOPE: CheckScope = { type: InsightCheckScopeType.GLOBAL, id: null };

/** Where a value was taken from. `type` keeps the artifact's union: a scope this build does not know still renders. */
export interface CheckValueSource {
  type: insightCheckFields_insightCheck$data['enabledScopeType'];
  id: string | null;
  /** The customer's name, the tag's key or the device's name; null for DEFAULT and GLOBAL. */
  name: string | null;
}

type CheckData = insightCheckFields_insightCheck$data;

export interface IncidentCheckParameter {
  parameter: string;
  label: string;
  firesWhen: CheckData['parameters'][number]['firesWhen'];
  unit: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  source: CheckValueSource;
}

export interface IncidentCheck {
  /** The check at the scope asked about (Relay id): a mutation's answer at that scope carries the same one. */
  id: string;
  /** The stable key the mutations take, e.g. `resource-win-disk-low`. */
  check: string;
  name: string;
  platform: CheckData['platform'];
  description: string;
  /** The severity its incident opens with, and the one it can rise to far past the threshold (else null). */
  severity: CheckData['severity'];
  escalatedSeverity: CheckData['escalatedSeverity'];
  /** How often it runs on each device, in seconds. */
  intervalSeconds: number;
  enabled: boolean;
  enabledSource: CheckValueSource;
  /** The scope asked about stores something of its own: there is something to reset. */
  customized: boolean;
  /** Empty for an on/off check. */
  parameters: IncidentCheckParameter[];
}

export function toIncidentCheck(ref: insightCheckFields_insightCheck$key): IncidentCheck {
  const node = readInlineData(insightCheckFieldsFragment, ref);
  return {
    id: node.id,
    check: node.check,
    name: node.title,
    platform: node.platform,
    description: node.description,
    severity: node.severity,
    escalatedSeverity: node.escalatedSeverity ?? null,
    intervalSeconds: node.intervalSeconds,
    enabled: node.enabled,
    enabledSource: {
      type: node.enabledScopeType,
      id: node.enabledScopeId ?? null,
      name: node.enabledScopeName ?? null,
    },
    customized: node.customized,
    parameters: node.parameters.map(parameter => ({
      parameter: parameter.parameter,
      label: parameter.label,
      firesWhen: parameter.firesWhen,
      unit: parameter.unit,
      value: parameter.value,
      defaultValue: parameter.defaultValue,
      min: parameter.min,
      max: parameter.max,
      source: { type: parameter.scopeType, id: parameter.scopeId ?? null, name: parameter.scopeName ?? null },
    })),
  };
}

/** The list in the API's order, which is the catalog's. Kept stable for a row's place on the page. */
export function toIncidentChecks(refs: readonly insightCheckFields_insightCheck$key[]): IncidentCheck[] {
  return refs.map(toIncidentCheck);
}

/** Was this value written at the scope being shown (not inherited from a less specific one)? */
export function isSetHere(source: CheckValueSource, scope: CheckScope): boolean {
  if (source.type !== scope.type) return false;
  return scope.type === InsightCheckScopeType.GLOBAL || source.id === scope.id;
}

/**
 * What one scope stores for a check, as the edit form holds it: `enabled` null and a parameter
 * left out both mean "inherit".
 */
export interface CheckSettingDraft {
  enabled: boolean | null;
  parameters: Readonly<Record<string, number>>;
}

/** What the scope stores now, read back off the effective values: the ones whose source is this scope. */
export function storedDraft(check: IncidentCheck, scope: CheckScope): CheckSettingDraft {
  const parameters: Record<string, number> = {};
  for (const parameter of check.parameters) {
    if (isSetHere(parameter.source, scope)) parameters[parameter.parameter] = parameter.value;
  }
  return { enabled: isSetHere(check.enabledSource, scope) ? check.enabled : null, parameters };
}

/** A draft that stores nothing: the write is a reset, since the API refuses an update with nothing in it. */
export function isEmptyDraft(draft: CheckSettingDraft): boolean {
  return draft.enabled === null && Object.keys(draft.parameters).length === 0;
}

/** The scope's fields of a mutation input: no `scopeId` for GLOBAL, which the API refuses one for. */
export function scopeInput(scope: CheckScope): { scopeType: WritableScopeType; scopeId?: string } {
  return scope.type === InsightCheckScopeType.GLOBAL || scope.id === null
    ? { scopeType: scope.type }
    : { scopeType: scope.type, scopeId: scope.id };
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

/** The same draft with `enabled` set at this scope, every threshold it stores kept: the row's switch. */
export function withEnabled(check: IncidentCheck, scope: CheckScope, enabled: boolean): CheckSettingDraft {
  return { ...storedDraft(check, scope), enabled };
}

/** A scope is complete when it names its entity; GLOBAL always is. */
export function isCompleteScope(scope: CheckScope): boolean {
  return scope.type === InsightCheckScopeType.GLOBAL || scope.id !== null;
}
