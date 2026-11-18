import { InsightCheckScopeType } from '@/generated/schema-enums';
import { type CheckScope, type CheckValueSource, isSetHere } from '../../utils/incident-check-transform';

/**
 * Where a value shown at `scope` comes from, as a short line: "Set here", "Default", "From all devices",
 * "From customer", "From tag". The API names a source by id only, so an inherited customer or tag is
 * named by its kind (on a device it is the device's own customer, or one of its tags).
 */
export function sourceLabel(source: CheckValueSource, scope: CheckScope): string {
  if (isSetHere(source, scope)) return 'Set here';
  switch (source.type) {
    case InsightCheckScopeType.DEFAULT:
      return 'Default';
    case InsightCheckScopeType.GLOBAL:
      return 'From all devices';
    case InsightCheckScopeType.CUSTOMER:
      return 'From customer';
    case InsightCheckScopeType.TAG:
      return 'From tag';
    case InsightCheckScopeType.DEVICE:
      return 'From device';
    default:
      return `From ${source.type.toLowerCase()}`;
  }
}

/** What "inherit" means at a scope: the next less specific one. All devices inherit the built-in defaults. */
export function inheritLabel(scope: CheckScope): string {
  return scope.type === InsightCheckScopeType.GLOBAL ? 'Use default' : 'Inherit';
}
