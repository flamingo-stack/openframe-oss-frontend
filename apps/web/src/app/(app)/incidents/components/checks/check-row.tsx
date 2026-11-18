'use client';

import { Button, Switch, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useId } from 'react';
import { LoadingLine } from '@/app/components/shared/loading-line';
import { formatThreshold, INSIGHT_CHECK_PLATFORM_LABELS } from '../../utils/incident-check-labels';
import type { CheckScope, IncidentCheck } from '../../utils/incident-check-transform';
import { labelOf } from '../../utils/incident-labels';
import { sourceLabel } from './check-source';

interface CheckRowProps {
  /** Absent while the list loads: the row draws its own bars. */
  check?: IncidentCheck;
  scope: CheckScope;
  /** Admins and owners change checks; everyone else reads them. */
  canEdit: boolean;
  /** A write for this row is on its way. */
  busy?: boolean;
  onToggle?: (check: IncidentCheck, enabled: boolean) => void;
  onEdit?: (check: IncidentCheck) => void;
  onReset?: (check: IncidentCheck) => void;
}

/**
 * One built-in check: its name, platform and what it looks for; its thresholds, each with where
 * it comes from; whether it runs, with where that comes from; and Edit / Reset. Reset is offered
 * only where the scope stores something of its own.
 */
export function CheckRow({ check, scope, canEdit, busy = false, onToggle, onEdit, onReset }: CheckRowProps) {
  const switchId = useId();

  if (!check) return <CheckRowLoading />;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)] last:border-b-0 content-lg:flex-row content-lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
          <span className="text-ods-text-primary text-h4">{check.name}</span>
          <Tag size="compact" variant="grey" label={labelOf(INSIGHT_CHECK_PLATFORM_LABELS, check.platform)} />
        </div>
        <p className="text-ods-text-secondary text-h6">{check.description}</p>
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-xs)] content-lg:w-64">
        {check.parameters.length === 0 ? (
          <span className="text-ods-text-secondary text-h6">No threshold: on or off</span>
        ) : (
          check.parameters.map(parameter => (
            <div key={parameter.parameter} className="flex flex-col">
              <span className="text-ods-text-secondary text-h6">{parameter.label}</span>
              <span className="text-ods-text-primary text-h4">
                {formatThreshold(parameter.value, parameter.unit, parameter.comparison)}
              </span>
              <span className="text-ods-text-secondary text-h6">{sourceLabel(parameter.source, scope)}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-[var(--spacing-system-s)] content-lg:w-44">
        <Switch
          id={switchId}
          checked={check.enabled}
          onCheckedChange={enabled => onToggle?.(check, enabled)}
          disabled={!canEdit || busy}
          aria-label={`Run ${check.name}`}
        />
        <label htmlFor={switchId} className="flex flex-col">
          <span className="text-ods-text-primary text-h6">{check.enabled ? 'On' : 'Off'}</span>
          <span className="text-ods-text-secondary text-h6">{sourceLabel(check.enabledSource, scope)}</span>
        </label>
      </div>

      {canEdit && (
        <div className="flex items-center gap-[var(--spacing-system-xs)] content-lg:w-48 content-lg:justify-end">
          <Button variant="outline" size="small" onClick={() => onEdit?.(check)} disabled={busy}>
            Edit
          </Button>
          {check.customized && (
            <Button variant="outline" size="small" onClick={() => onReset?.(check)} disabled={busy}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The row before its check is read: the name, description and one threshold as bars, the switch locked. */
function CheckRowLoading() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)] last:border-b-0 content-lg:flex-row content-lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
        <LoadingLine type="h4" className="w-48" />
        <LoadingLine type="h6" className="w-full max-w-[480px]" />
      </div>
      <div className="flex flex-col content-lg:w-64">
        <LoadingLine type="h6" className="w-32" />
        <LoadingLine type="h4" className="w-24" />
      </div>
      <div className="flex items-center gap-[var(--spacing-system-s)] content-lg:w-44">
        <Switch checked={false} disabled aria-label="Loading check" />
        <LoadingLine type="h6" className="w-16" />
      </div>
      <div className="hidden content-lg:block content-lg:w-48" />
    </div>
  );
}
