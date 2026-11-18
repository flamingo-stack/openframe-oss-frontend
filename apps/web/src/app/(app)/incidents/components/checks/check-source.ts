import { InsightCheckScopeType } from '@/generated/schema-enums';
import { INSIGHT_CHECK_SCOPE_LABELS } from '../../utils/incident-check-labels';
import {
  type CheckScope,
  type CheckValueSource,
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

/** What "inherit" means at a scope: the next less specific one. All devices inherit the built-in defaults. */
export function inheritLabel(scope: CheckScope): string {
  return scope.type === InsightCheckScopeType.GLOBAL ? 'Use default' : 'Inherit';
}
