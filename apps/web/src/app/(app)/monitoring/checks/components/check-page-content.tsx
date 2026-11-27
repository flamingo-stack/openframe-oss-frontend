'use client';

import { AlertTriangleClassicIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, AlertDescription, AlertTitle, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { toggleCheck } from '../hooks/check-actions';
import { useCheckMutations } from '../hooks/use-check-mutations';
import { PRECEDENCE_NOTE } from '../utils/check-messages';
import type { Check, CheckOverride } from '../utils/check-transform';
import { overrideRows } from '../utils/override-rows';
import { CheckDetails } from './check-details';
import { type CheckDialog, CheckDialogs } from './check-dialogs';
import { CheckEnabledSwitch } from './check-enabled-switch';
import { Section } from './check-section';
import { DefaultThreshold } from './default-threshold';
import { DefaultThresholdActions } from './default-threshold-actions';
import { ExceptionsActions } from './exceptions-actions';
import { NoExceptions } from './no-exceptions';
import { OverridesTable } from './overrides-table';

interface CheckPageContentProps {
  /** Absent while the check is read: the page draws itself with every read value a bar. */
  check?: Check;
  overrides?: CheckOverride[];
}

/** A built-in check's page: its details, its default threshold and its exceptions, with the dialogs they open. */
export function CheckPageContent({ check, overrides }: CheckPageContentProps) {
  const handleBack = useSafeBack(routes.monitoring.checks);
  const canEdit = useAdminGate() === 'admin';
  const mutations = useCheckMutations();
  const [dialog, setDialog] = useState<CheckDialog | null>(null);
  const editable = Boolean(check) && canEdit;
  const hasThreshold = Boolean(check && check.parameters.length > 0);

  return (
    <PageLayout
      title={check?.name ?? ''}
      subtitle={check?.description}
      subtitleRow="while-loading"
      loading={!check}
      backButton={{ label: 'Back', onClick: handleBack }}
      selector={
        <CheckEnabledSwitch
          enabled={check?.enabled}
          disabled={!check || !canEdit || mutations.isSaving}
          onToggle={enabled => {
            if (check) toggleCheck(check, enabled, mutations, setDialog);
          }}
        />
      }
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {check && !check.enabled && (
          <Alert variant="warning">
            <AlertTriangleClassicIcon className="size-5" />
            <AlertTitle>Turned off for all devices</AlertTitle>
            <AlertDescription>
              It still runs where an exception turns it on for a customer, a tag or a device.
            </AlertDescription>
          </Alert>
        )}

        <CheckDetails check={check} />

        <Section
          title={check && !hasThreshold ? 'Threshold' : 'Default threshold'}
          actions={
            editable && check && hasThreshold ? (
              <DefaultThresholdActions check={check} onDialog={setDialog} mutations={mutations} />
            ) : null
          }
        >
          <DefaultThreshold check={check} />
        </Section>

        <Section
          title="Exceptions"
          actions={
            editable ? (
              <ExceptionsActions hasExceptions={Boolean(overrides && overrides.length > 0)} onDialog={setDialog} />
            ) : null
          }
        >
          {check && overrides && overrides.length === 0 ? (
            <NoExceptions />
          ) : (
            <TableLayoutScope>
              <OverridesTable rows={check && overrides ? overrideRows(check, overrides, editable, setDialog) : []} />
            </TableLayoutScope>
          )}
          <p className="text-ods-text-secondary text-h6">{PRECEDENCE_NOTE}</p>
        </Section>
      </div>

      {check && (
        <CheckDialogs check={check} overrides={overrides} dialog={dialog} onDialog={setDialog} mutations={mutations} />
      )}
    </PageLayout>
  );
}
