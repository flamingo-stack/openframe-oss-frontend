'use client';

import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { INCIDENT_TYPE_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { ValueText } from '@/app/components/shared/value-text';
import type { useCheckMutations } from '../hooks/use-check-mutations';
import { formatRunsEvery, formatThreshold } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import { type CheckDialog, resetDefault } from './check-dialogs';

/**
 * The details panel: the design system's panel card, items with the label above the value. Stacked under each other
 * (a divider between them) in a narrow content area, one row from `content-md` up.
 */
function DetailsPanel({ columns, children }: { columns: 'one' | 'three' | 'four'; children: ReactNode }) {
  const grid = {
    one: 'grid-cols-1',
    three: 'grid-cols-1 content-md:grid-cols-3',
    four: 'grid-cols-1 content-md:grid-cols-4',
  }[columns];
  return (
    <Card variant="panel" className={`grid divide-y divide-ods-border overflow-hidden content-md:divide-y-0 ${grid}`}>
      {children}
    </Card>
  );
}

interface DetailsItemProps {
  label: string;
  /** A text value is a bar while it is read; any other value (a tag) draws its own loading form. */
  value: ReactNode;
  skeletonWidth?: string;
}

/** One item of the panel: its label, then its value. */
function DetailsItem({ label, value, skeletonWidth = 'w-24' }: DetailsItemProps) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-h-16 min-w-0 flex-col justify-center p-[var(--spacing-system-xsf)]">
      <p className="truncate text-ods-text-secondary text-h6">{label}</p>
      {typeof value === 'string' ? (
        <ValueText value={loading ? null : value} loading={loading} skeletonWidth={skeletonWidth} />
      ) : (
        <div className="flex min-h-6 min-w-0 items-center text-ods-text-primary text-h4">{value}</div>
      )}
    </div>
  );
}

/**
 * Severity, category, how often it runs and how many exceptions change it. The API has no open incidents,
 * devices checked, last run or last edit per check yet, so the design's other items are not drawn.
 */
export function CheckDetails({ check }: { check?: Check }) {
  return (
    <DetailsPanel columns="four">
      <DetailsItem label="Severity" value={<IncidentSeverityTag severity={check?.severity} />} />
      <DetailsItem
        label="Category"
        value={check ? labelOf(INCIDENT_TYPE_LABELS, check.type) : ''}
        skeletonWidth="w-16"
      />
      <DetailsItem
        label="Runs every"
        value={check ? formatRunsEvery(check.intervalSeconds) : ''}
        skeletonWidth="w-12"
      />
      <DetailsItem label="Exceptions" value={check ? String(check.overrideCount) : ''} skeletonWidth="w-8" />
    </DetailsPanel>
  );
}

/** The default each device is measured against, one item per threshold; an on/off check says it has none. */
export function DefaultThreshold({ check }: { check?: Check }) {
  if (check && check.parameters.length === 0) {
    return (
      <Alert>
        <InfoCircleIcon className="size-5 text-ods-text-secondary" />
        <AlertTitle>No threshold</AlertTitle>
        <AlertDescription>
          This check is either on or off. Turn it off for a customer, a device tag or one device with an exception.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <DetailsPanel columns={check && check.parameters.length > 1 ? 'three' : 'one'}>
      {check ? (
        <>
          {check.parameters.map(parameter => (
            <DetailsItem
              key={parameter.parameter}
              label={parameter.label}
              value={formatThreshold(parameter.value, parameter.unit, parameter.firesWhen)}
            />
          ))}
          {/* The API raises the incident when any one of the values is crossed. */}
          {check.parameters.length > 1 && (
            <DetailsItem
              label="Raises an incident when"
              value={check.parameters.length === 2 ? 'Either is true' : 'Any is true'}
            />
          )}
        </>
      ) : (
        <DetailsItem label="Threshold" value="" skeletonWidth="w-32" />
      )}
    </DetailsPanel>
  );
}

/** Edit the default; once it differs from the built-in one, a menu that can also reset it. */
export function DefaultThresholdActions({
  check,
  onDialog,
  mutations,
}: {
  check: Check;
  onDialog: (dialog: CheckDialog) => void;
  mutations: ReturnType<typeof useCheckMutations>;
}) {
  const changed = check.parameters.some(parameter => parameter.setForAllDevices);
  if (!changed) {
    return (
      <Button variant="outline" onClick={() => onDialog({ kind: 'edit-default' })}>
        Edit
      </Button>
    );
  }
  return (
    <ActionsMenuDropdown
      groups={[
        {
          items: [
            {
              id: 'edit',
              label: 'Edit',
              disabled: mutations.isSaving,
              onClick: () => onDialog({ kind: 'edit-default' }),
            },
            {
              id: 'reset',
              label: 'Reset to default',
              disabled: mutations.isSaving,
              onClick: () => resetDefault(check, mutations),
            },
          ],
        },
      ]}
    />
  );
}

/** Add Exception, and once there are exceptions, a menu that deletes them all. */
export function ExceptionsActions({
  hasExceptions,
  onDialog,
}: {
  hasExceptions: boolean;
  onDialog: (dialog: CheckDialog) => void;
}) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      <Button variant="outline" onClick={() => onDialog({ kind: 'override', editing: null })}>
        Add Exception
      </Button>
      {hasExceptions && (
        <ActionsMenuDropdown
          groups={[
            {
              items: [
                { id: 'delete-all', label: 'Delete All Exceptions', onClick: () => onDialog({ kind: 'delete-all' }) },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}

/** A titled block of the page: its uppercase label and actions on one row, its content under them. */
export function Section({ title, actions, children }: { title: string; actions: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex min-h-10 items-center justify-between gap-[var(--spacing-system-m)]">
        <h3 className="text-ods-text-secondary text-h5">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** No exception on the check: a card saying every device runs on the default. */
export function NoExceptions() {
  return (
    <Card variant="panel" className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-l)]">
      <p className="text-ods-text-primary text-h3">No exceptions</p>
      <p className="text-ods-text-secondary text-h6">Every device uses the default threshold.</p>
    </Card>
  );
}
