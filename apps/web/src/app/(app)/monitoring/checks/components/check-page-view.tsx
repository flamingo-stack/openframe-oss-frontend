'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  AlertTriangleClassicIcon,
  PenEditIcon,
  PlusCircleIcon,
  Refresh01LeftIcon,
  SlidersIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  NoData,
  PageLayout,
  Switch,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { insightCheckPageQuery as CheckPageQueryType } from '@/__generated__/insightCheckPageQuery.graphql';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { INCIDENT_TYPE_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { insightCheckPageQuery } from '@/graphql/insights/insight-check-page-query';
import { routes } from '@/lib/routes';
import { useCheckMutations } from '../hooks/use-check-mutations';
import { formatCheckInterval, formatThreshold } from '../utils/check-labels';
import { type Check, type CheckOverride, toCheck, toCheckOverride } from '../utils/check-transform';
import { type CheckDialog, CheckDialogs, resetDefault, toggleCheck } from './check-dialogs';
import { OverridesTable, type OverrideTableRow } from './overrides-table';

const PRECEDENCE_NOTE =
  'The most specific override wins: a device override, then device tags, then the customer, then the default. New devices pick up overrides as soon as they join the customer or get the tag.';

/** A built-in check's page: its default for every device and every override that changes it. */
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
  const router = useRouter();
  const handleBack = useSafeBack(routes.monitoring.root({ tab: 'checks' }));
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
              It still runs where an override turns it on for a customer, a tag or a device.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-[var(--spacing-system-l)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-l)] content-md:grid-cols-4">
          <InfoCell label="Severity" value={<IncidentSeverityTag severity={check?.severity} />} />
          <InfoCell
            label="Category"
            value={check ? labelOf(INCIDENT_TYPE_LABELS, check.type) : ''}
            skeletonWidth="w-16"
          />
          <InfoCell
            label="Runs every"
            value={check ? formatCheckInterval(check.intervalSeconds).replace(/^Every /, '') : ''}
            skeletonWidth="w-16"
          />
          <InfoCell label="Overrides" value={check ? String(check.overrideCount) : ''} skeletonWidth="w-8" />
        </div>

        {(!check || check.parameters.length > 0) && (
          <Section
            title="Default threshold"
            actions={
              editable && check ? (
                <DefaultThresholdActions check={check} onDialog={setDialog} mutations={mutations} />
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-[var(--spacing-system-l)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-l)] content-md:grid-cols-2">
              {check ? (
                check.parameters.map(parameter => (
                  <InfoCell
                    key={parameter.parameter}
                    label={parameter.label}
                    value={formatThreshold(parameter.value, parameter.unit, parameter.firesWhen)}
                  />
                ))
              ) : (
                <InfoCell label="Threshold" value="" skeletonWidth="w-32" />
              )}
            </div>
          </Section>
        )}

        <Section
          title="Overrides"
          actions={
            editable && check ? (
              <div className="flex items-center gap-[var(--spacing-system-xs)]">
                <Button
                  variant="outline"
                  leftIcon={<PlusCircleIcon className="size-6 text-ods-text-secondary" />}
                  onClick={() => setDialog({ kind: 'override', editing: null })}
                >
                  Add Override
                </Button>
                <ActionsMenuDropdown
                  groups={[
                    {
                      items: [
                        {
                          id: 'delete-all',
                          label: 'Delete All Overrides',
                          icon: <TrashIcon className="size-6" />,
                          danger: true,
                          disabled: !overrides || overrides.length === 0,
                          onClick: () => setDialog({ kind: 'delete-all' }),
                        },
                      ],
                    },
                  ]}
                />
              </div>
            ) : null
          }
        >
          {check && overrides && overrides.length === 0 ? (
            <NoData
              icon={<SlidersIcon />}
              title="No overrides"
              description="Every device uses the default threshold."
              className="py-[var(--spacing-system-xl)]"
            />
          ) : (
            <OverridesTable
              rows={check && overrides ? overrideRows(check, overrides, editable, setDialog, router) : []}
            />
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
  router: ReturnType<typeof useRouter>,
): OverrideTableRow[] {
  return overrides.map(override => ({
    id: override.id,
    check,
    override,
    actions: editable
      ? {
          busy: false,
          edit: () => setDialog({ kind: 'override', editing: override }),
          delete: () => setDialog({ kind: 'delete-override', override }),
          open: openTarget(override, router),
        }
      : null,
  }));
}

/** Where "Open devices" goes: the customer's devices, or the device itself. A tag has nowhere to go yet. */
function openTarget(
  override: CheckOverride,
  router: ReturnType<typeof useRouter>,
): { label: string; go: () => void } | null {
  if (override.scopeType === InsightCheckScopeType.CUSTOMER) {
    return {
      label: 'Open devices',
      go: () => router.push(routes.devices.filtered({ organizationIds: [override.scopeId] })),
    };
  }
  if (override.scopeType === InsightCheckScopeType.DEVICE) {
    return { label: 'Open device', go: () => router.push(routes.devices.details(override.scopeId)) };
  }
  return null;
}

function DefaultThresholdActions({
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
              icon: <PenEditIcon className="size-6 text-ods-text-secondary" />,
              disabled: mutations.isSaving,
              onClick: () => onDialog({ kind: 'edit-default' }),
            },
            {
              id: 'reset',
              label: 'Reset to default',
              icon: <Refresh01LeftIcon className="size-6 text-ods-text-secondary" />,
              disabled: mutations.isSaving,
              onClick: () => resetDefault(check, mutations),
            },
          ],
        },
      ]}
    />
  );
}

/** A titled block of the page: its uppercase label and actions on one row, its content under them. */
function Section({ title, actions, children }: { title: string; actions: ReactNode; children: ReactNode }) {
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
