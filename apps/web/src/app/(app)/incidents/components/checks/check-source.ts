import { InsightCheckScopeType } from '@/generated/schema-enums';
import { INSIGHT_CHECK_SCOPE_LABELS } from '../../utils/incident-check-labels';
import {
  type CheckScope,
  type CheckValueSource,
  type IncidentCheck,
  isSetHere,
  isWritableScopeType,
} from '../../utils/incident-check-transform';

/**
 * Where a value shown at `scope` comes from, as a short line: "Set here", "Default", "From all devices",
 * "From customer · Acme", "From tag · servers", "From device · MacBook". On a device the customer is
 * its own and the tag one of its tags.
 */
export function sourceLabel(source: CheckValueSource, scope: CheckScope): string {
  if (isSetHere(source, scope)) return 'Set here';
  switch (source.type) {
    case InsightCheckScopeType.DEFAULT:
      return 'Default';
    case InsightCheckScopeType.GLOBAL:
      return 'From all devices';
    default:
      return source.name ? `From ${scopeWord(source.type)} · ${source.name}` : `From ${scopeWord(source.type)}`;
  }
}

function scopeWord(type: string): string {
  return isWritableScopeType(type) ? INSIGHT_CHECK_SCOPE_LABELS[type].toLowerCase() : type.toLowerCase();
}

const PRECEDENCE: Readonly<Record<string, number>> = { DEFAULT: 0, GLOBAL: 1, TAG: 2, CUSTOMER: 3, DEVICE: 4 };

/**
 * A check's setting at `scope` in a line and its detail, for the table: "Set here" (with "Some values
 * inherited" when not all are), "Default", or "Inherited" from the most specific scope it takes a value
 * from. The edit form shows each value's own source.
 */
export function settingSummary(check: IncidentCheck, scope: CheckScope): { value: string; detail: string | null } {
  const inherited = [check.enabledSource, ...check.parameters.map(parameter => parameter.source)].filter(
    source => !isSetHere(source, scope),
  );
  if (check.customized) return { value: 'Set here', detail: inherited.length > 0 ? 'Some values inherited' : null };
  const nearest = inherited.reduce<CheckValueSource | null>(
    (best, source) => (!best || (PRECEDENCE[source.type] ?? 0) > (PRECEDENCE[best.type] ?? 0) ? source : best),
    null,
  );
  if (!nearest || nearest.type === InsightCheckScopeType.DEFAULT) return { value: 'Default', detail: null };
  return { value: 'Inherited', detail: sourceLabel(nearest, scope) };
}

/** What "inherit" means at a scope: the next less specific one. All devices inherit the built-in defaults. */
export function inheritLabel(scope: CheckScope): string {
  return scope.type === InsightCheckScopeType.GLOBAL ? 'Use default' : 'Inherit';
}
