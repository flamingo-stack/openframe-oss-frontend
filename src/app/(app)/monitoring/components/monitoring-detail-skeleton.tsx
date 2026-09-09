'use client';

import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  Input,
  Label,
  type PageActionButton,
  PageLayout,
  type PanelRow,
  Select,
  SelectTrigger,
  SelectValue,
  StackedRowsPanel,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton, TabBarSkeleton, TableSkeleton } from '@/app/components/shared';
import { DeviceSelectorSkeleton } from '@/app/components/shared/device-selector';
import { ScriptEditor } from '../../scripts/shared/components/script-editor';
import { POLICY_DEVICES_COLUMNS, QUERY_REPORT_COLUMNS } from './monitoring-table-columns';

/**
 * Loading states for the four monitoring detail routes — `/monitoring/policy`,
 * `/monitoring/query` and their `/edit` siblings.
 *
 * The two detail routes used to return `<CardLoader items={4} />` — four
 * identical grey cards and nothing else, so the header, the query editor and the
 * devices table all appeared at once when Fleet answered and the page was built
 * from scratch rather than filled in. The two edit routes drew the same four
 * cards, for a page that is a form.
 *
 * These follow the principle the rest of the app's skeletons use (see
 * `page-skeleton-primitives.tsx`): render the REAL chrome — `PageLayout`, its
 * back button, the action set, the section headings, the form controls, the
 * `ScriptEditor` frame, the `DataTable` header — and skeleton only what actually
 * comes from the request. Nothing here is a hand-measured height: every box is
 * the real component in its own `loading`/`disabled` state, so it cannot drift
 * from what replaces it.
 *
 * The action set is passed REAL and disabled rather than through
 * `loadingActions`: it does not depend on the record, so a placeholder would be
 * strictly less informative than the button it stands in for. Only the title has
 * to wait, and `PageLayout`'s own `loading` draws that line-box-accurate.
 */

type MonitoringKind = 'policy' | 'query';

interface MonitoringSkeletonProps {
  kind: MonitoringKind;
  /** The view's own `useSafeBack` handler — the back button stays live while loading. */
  onBack: () => void;
}

/** The container padding all four views pass. */
const PAGE_CLASS = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]';

const COPY = {
  policy: {
    edit: 'Edit Policy',
    delete: 'Delete Policy',
    save: 'Save Policy',
    namePlaceholder: 'Enter Policy Name',
    descriptionPlaceholder: 'Enter Policy Description',
  },
  query: {
    edit: 'Edit Query',
    delete: 'Delete Query',
    save: 'Save Query',
    namePlaceholder: 'Enter Query Name',
    descriptionPlaceholder: 'Enter Query Description',
  },
} as const;

/** Query detail tabs — `Query Results` / `Assigned Devices`. */
const QUERY_TAB_WIDTHS = ['w-[170px]', 'w-[190px]'] as const;

function editActions(kind: MonitoringKind): PageActionButton[] {
  return [
    {
      label: COPY[kind].edit,
      variant: 'outline',
      disabled: true,
      icon: <PenEditIcon size={24} className="text-ods-text-secondary" />,
    },
  ];
}

function deleteMenuActions(kind: MonitoringKind): ActionsMenuGroup[] {
  return [
    {
      items: [
        {
          id: `delete-${kind}`,
          label: COPY[kind].delete,
          icon: <TrashIcon />,
          disabled: true,
          danger: true,
        },
      ],
    },
  ];
}

/**
 * The editor frame at its loaded height. `ScriptEditor`'s `loading` keeps its own
 * placeholder up — that placeholder replicates the editor's geometry to the
 * pixel, so this needs no height of its own.
 *
 * `TestQuerySection` is deliberately left out of both callers: it is a collapsed
 * disclosure, and drawing an inert copy of a control the user cannot open is the
 * thing the table funnels' own rule warns against.
 */
function QueryEditorSkeleton() {
  return <ScriptEditor value="" shell="sql" readOnly height="300px" loading />;
}

/**
 * Policy info panel: labels are static, only the values wait on the request.
 * Mirrors `policyInfoRows` in `PolicyDetailsView` — Severity + Status + Author on
 * one row from `lg`, split across two below it. The Description row is omitted
 * for the reason the real one is conditional: it exists only when the record has
 * one, which the skeleton cannot know yet.
 */
function policyInfoSkeletonRows(): PanelRow[] {
  const severity = { key: 'severity', value: <InlineSkeleton className="h-5 w-16" />, label: 'Severity' };
  const status = { key: 'status', value: <InlineSkeleton className="h-6 w-24 rounded-full" />, label: 'Status' };
  const author = { key: 'author', value: <InlineSkeleton className="h-5 w-32" />, label: 'Author' };

  return [
    { id: 'meta-desktop', className: 'hidden lg:flex lg:border-b-0', columns: [severity, status, author] },
    { id: 'meta-severity-status', className: 'lg:hidden', columns: [severity, status] },
    { id: 'meta-author', className: 'lg:hidden', columns: [author, { key: 'author-spacer' }] },
  ];
}

/**
 * Query info card — hand-mirrored rather than shared because `QueryDetailsView`
 * builds this one inline instead of going through `StackedRowsPanel`.
 */
function QueryInfoSkeleton() {
  return (
    <div className="rounded-lg border border-ods-border bg-ods-card p-6">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <p className="text-ods-text-primary text-h4">
            <InlineSkeleton className="h-5 w-24" />
          </p>
          <p className="mt-1 text-ods-text-secondary text-h6">Frequency</p>
        </div>
      </div>
    </div>
  );
}

/** `/monitoring/policy` and `/monitoring/query`. */
export function MonitoringDetailSkeleton({ kind, onBack }: MonitoringSkeletonProps) {
  const isPolicy = kind === 'policy';

  return (
    <PageLayout
      loading
      backButton={{ label: 'Back', onClick: onBack }}
      actions={editActions(kind)}
      menuActions={deleteMenuActions(kind)}
      actionsVariant="menu-primary"
      className={PAGE_CLASS}
    >
      {isPolicy ? <StackedRowsPanel rows={policyInfoSkeletonRows()} /> : <QueryInfoSkeleton />}

      <div
        className={
          isPolicy
            ? 'mt-[var(--spacing-system-l)] space-y-[var(--spacing-system-xxs)]'
            : 'mt-6 space-y-[var(--spacing-system-xxs)]'
        }
      >
        <h3 className="text-ods-text-secondary text-h5">QUERY</h3>
        <QueryEditorSkeleton />
      </div>

      {isPolicy ? (
        <div className="mt-6">
          <h1 className="pt-6 text-ods-text-primary text-h2">Devices</h1>
          <div className="pt-4">
            <TableSkeleton columns={POLICY_DEVICES_COLUMNS} rows={8} />
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <TabBarSkeleton widths={QUERY_TAB_WIDTHS} />
          <div className="mt-6">
            <TableSkeleton columns={QUERY_REPORT_COLUMNS} rows={8} />
          </div>
        </div>
      )}
    </PageLayout>
  );
}

/**
 * `/monitoring/policy/edit` and `/monitoring/query/edit`.
 *
 * Only reached with an `?id=` — the `/new` routes mount the same form with no
 * request behind it, so they never render this.
 *
 * The controls are the REAL `Input`/`Textarea`/`Select` rendered disabled: their
 * labels and placeholders are static copy, so they carry more than a grey box
 * would, and their height is the loaded height by construction.
 */
export function MonitoringEditSkeleton({ kind, onBack }: MonitoringSkeletonProps) {
  const isQuery = kind === 'query';

  return (
    <PageLayout
      loading
      backButton={{ label: 'Back', onClick: onBack }}
      actions={[{ label: COPY[kind].save, variant: 'accent', disabled: true }]}
      actionsVariant="primary-buttons"
      className={PAGE_CLASS}
    >
      <div className="space-y-6 md:space-y-8">
        {/* Name — and, on the query form, Frequency beside it. */}
        <div className={isQuery ? 'flex flex-col gap-4 md:flex-row md:items-end' : 'md:max-w-[280px]'}>
          <div className={isQuery ? 'w-full md:max-w-[280px]' : undefined}>
            <Input label="Name" placeholder={COPY[kind].namePlaceholder} disabled />
          </div>
          {isQuery && (
            <div className="space-y-1">
              <Label className="!mb-0">Frequency</Label>
              <div className="flex gap-3">
                <Input type="number" placeholder="0" className="w-[120px]" disabled />
                <Select disabled>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                </Select>
              </div>
            </div>
          )}
        </div>

        <Textarea label="Description" rows={3} placeholder={COPY[kind].descriptionPlaceholder} disabled />

        <div className="space-y-1">
          <Label className="!mb-0">Query</Label>
          <QueryEditorSkeleton />
        </div>

        <div className="space-y-1">
          <h2 className="text-ods-text-primary text-h2">Devices</h2>
          <DeviceSelectorSkeleton />
        </div>
      </div>
    </PageLayout>
  );
}
