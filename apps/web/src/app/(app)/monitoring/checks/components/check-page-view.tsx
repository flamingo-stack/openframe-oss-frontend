'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertTriangleClassicIcon, SlidersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  NoData,
  PageLayout,
  Switch,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { insightCheckPageQuery as CheckPageQueryType } from '@/__generated__/insightCheckPageQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { insightCheckPageQuery } from '@/graphql/insights/insight-check-page-query';
import { routes } from '@/lib/routes';
import { useCheckMutations } from '../hooks/use-check-mutations';
import { type Check, type CheckOverride, toCheck, toCheckOverride } from '../utils/check-transform';
import { type CheckDialog, CheckDialogs, toggleCheck } from './check-dialogs';
import {
  CheckDetails,
  DefaultThreshold,
  DefaultThresholdActions,
  ExceptionsActions,
  Section,
} from './check-page-sections';
import { OverridesTable, type OverrideTableRow } from './overrides-table';

const PRECEDENCE_NOTE =
  'The most specific exception wins: a device exception, then device tags, then the customer, then the default. New devices pick up exceptions as soon as they join the customer or get the tag.';

/** A built-in check's page: its default for every device and every exception that changes it. */
export function CheckPageView({ checkKey }: { checkKey: string }) {
  const retryKey = useRetryKey();
  return (
    <ContentErrorBoundary message="Couldn't load the check." resetKey={`${checkKey}:${retryKey}`}>
      <CheckPageIsland checkKey={checkKey} />
    </ContentErrorBoundary>
  );
}

function CheckPageIsland({ checkKey }: { checkKey: string }) {
  return (
    <LoadingSuspense label="Loading check">
      <CheckPage checkKey={checkKey} />
    </LoadingSuspense>
  );
}

function CheckPage({ checkKey }: { checkKey: string }) {
  if (useLoadingScope()) return <CheckPageContent />;
  return <CheckPageLive checkKey={checkKey} />;
}

function CheckPageLive({ checkKey }: { checkKey: string }) {
  const data = useLazyLoadQuery<CheckPageQueryType>(
    insightCheckPageQuery,
    { check: checkKey },
    { fetchPolicy: 'store-and-network' },
  );
  return (
    <CheckPageContent check={toCheck(data.insightCheck)} overrides={data.insightCheck.overrides.map(toCheckOverride)} />
  );
}

interface CheckPageContentProps {
  /** Absent while the check is read: the page draws itself with every read value a bar. */
  check?: Check;
  overrides?: CheckOverride[];
}

function CheckPageContent({ check, overrides }: CheckPageContentProps) {
  const handleBack = useSafeBack(routes.monitoring.checks);
  const canEdit = useAdminGate() === 'admin';
  const mutations = useCheckMutations();
  const [dialog, setDialog] = useState<CheckDialog | null>(null);
  const editable = Boolean(check) && canEdit;

  const enabledSwitch = (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      <Switch
        checked={check?.enabled ?? false}
        disabled={!check || !canEdit || mutations.isSaving}
        onCheckedChange={enabled => {
          if (check) toggleCheck(check, enabled, mutations, setDialog);
        }}
        aria-label="Enabled for all devices"
      />
      <span className="text-ods-text-primary text-h6">{check && !check.enabled ? 'Off' : 'Enabled'}</span>
    </div>
  );

  return (
    <PageLayout
      title={check?.name ?? ''}
      subtitle={check?.description}
      subtitleRow="while-loading"
      loading={!check}
      backButton={{ label: 'Back', onClick: handleBack }}
      selector={enabledSwitch}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {/* The header draws its selector from content-md up (PageActions); below that it opens the content. */}
        <div className="content-md:hidden">{enabledSwitch}</div>

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
          title={check && check.parameters.length === 0 ? 'Threshold' : 'Default threshold'}
          actions={
            editable && check && check.parameters.length > 0 ? (
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
            <NoData
              icon={<SlidersIcon />}
              title="No exceptions"
              description="Every device uses the default threshold."
              className="py-[var(--spacing-system-xl)]"
            />
          ) : (
            <OverridesTable rows={check && overrides ? overrideRows(check, overrides, editable, setDialog) : []} />
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

function overrideRows(
  check: Check,
  overrides: readonly CheckOverride[],
  editable: boolean,
  setDialog: (dialog: CheckDialog) => void,
): OverrideTableRow[] {
  return overrides.map(override => ({
    id: override.id,
    check,
    override,
    devices: devicesTarget(override),
    actions: editable
      ? {
          busy: false,
          edit: () => setDialog({ kind: 'override', editing: override }),
          delete: () => setDialog({ kind: 'delete-override', override }),
        }
      : null,
  }));
}

/** Where an exception's devices are: the customer's devices, or the device itself. A tag has nowhere to go yet. */
function devicesTarget(override: CheckOverride): { label: string; href: string } | null {
  if (override.scopeType === InsightCheckScopeType.CUSTOMER) {
    return { label: 'Open Devices', href: routes.devices.filtered({ organizationIds: [override.scopeId] }) };
  }
  if (override.scopeType === InsightCheckScopeType.DEVICE) {
    return { label: 'Open Device', href: routes.devices.details(override.scopeId) };
  }
  return null;
}
