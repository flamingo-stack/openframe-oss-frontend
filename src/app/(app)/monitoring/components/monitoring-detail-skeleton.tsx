'use client';

import { PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  Input,
  Label,
  type PageActionButton,
  PageLayout,
  type PanelRow,
  QueryReportTable,
  Select,
  SelectTrigger,
  SelectValue,
  StackedRowsPanel,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton, TabBarSkeleton, TableSkeleton } from '@/app/components/shared';
import { DeviceSelectorSkeleton } from '@/app/components/shared/device-selector';
import type { QueryDetailTab } from '@/lib/routes';
import { ScriptEditor } from '../../scripts/shared/components/script-editor';
import { POLICY_DEVICES_TABLE_COLUMNS, QUERY_DEVICES_TABLE_COLUMNS } from './monitoring-table-columns';

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
 * comes from the request. Almost nothing here is a hand-measured size: every box
 * is the real component in its own `loading`/`disabled` state, so it cannot
 * drift from what replaces it. `QUERY_TAB_WIDTHS` is the one exception, and it
 * is called out where it is declared.
 *
 * The action set is passed REAL and disabled rather than through
 * `loadingActions`: it does not depend on the record, so a placeholder would be
 * strictly less informative than the button it stands in for. Only the title has
 * to wait, and `PageLayout`'s own `loading` draws that line-box-accurate.
 */

/** Stable empty list so the loading table doesn't get a new `data` identity per render. */
const NO_REPORT_ROWS: never[] = [];

type MonitoringKind = 'policy' | 'query';

interface MonitoringSkeletonProps {
  kind: MonitoringKind;
  /** The view's own `useSafeBack` handler — the back button stays live while loading. */
  onBack: () => void;
  /**
   * Query detail only: the tab the URL asks for, already validated by the view.
   *
   * The panel under the tab bar is a different component per tab, so a skeleton
   * that always drew the default one would be the wrong shape for anyone
   * arriving on `?tab=devices` — a link, a bookmark, or a reload.
   */
  queryTab?: QueryDetailTab;
}

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

/**
 * Query detail tabs — `Query Results` / `Assigned Devices`.
 *
 * The only hand-set sizes in this file, because `TabNavigation` sizes each tab
 * to its own label and offers nothing to render `loading`. Measured with
 * `getBoundingClientRect()` on a loaded `/monitoring/query?id=`, which is the
 * only way to get them right — the first pair here was set by eye and put the
 * active-tab underline 8px and 19px off.
 *
 * They break whenever a label, its icon or the core lib's tab padding changes.
 * Re-measure rather than nudge:
 *
 *   ['Query Results', 'Assigned Devices'].map(t => {
 *     const el = [...document.querySelectorAll('button,[role=tab],a')]
 *       .find(n => n.textContent.trim() === t);
 *     return `${t}: ${Math.round(el.getBoundingClientRect().width)}px`;
 *   })
 */
const QUERY_TAB_WIDTHS = ['w-[178px]', 'w-[209px]'] as const;

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
    <div aria-busy="true" className="rounded-lg border border-ods-border bg-ods-card p-6">
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
export function MonitoringDetailSkeleton({ kind, onBack, queryTab = 'results' }: MonitoringSkeletonProps) {
  const isPolicy = kind === 'policy';

  return (
    <PageLayout
      loading
      backButton={{ label: 'Back', onClick: onBack }}
      actions={editActions(kind)}
      menuActions={deleteMenuActions(kind)}
      actionsVariant="menu-primary"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {isPolicy ? <StackedRowsPanel rows={policyInfoSkeletonRows()} /> : <QueryInfoSkeleton />}

      {/* `aria-busy` sits on each top-level section rather than on one page
          container: `PageLayout`'s content element is a `flex flex-col` with a
          gap, so an extra wrapper around these siblings would collapse the gaps
          it applies between them — the exact drift this skeleton exists to
          avoid. The policy info panel is the one section without it:
          `StackedRowsPanel` takes `rows`/`title`/`className` only and forwards
          no DOM props. Its labels are static real copy with empty values, which
          is accurate rather than misleading, so nothing is lost there. */}
      <div
        aria-busy="true"
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
        <div aria-busy="true" className="mt-6">
          <h1 className="pt-6 text-ods-text-primary text-h2">Devices</h1>
          <div className="pt-4">
            <TableSkeleton columns={POLICY_DEVICES_TABLE_COLUMNS} rows={8} />
          </div>
        </div>
      ) : (
        <div aria-busy="true" className="mt-6">
          <TabBarSkeleton widths={QUERY_TAB_WIDTHS} />
          <div className="mt-6">
            {queryTab === 'devices' ? (
              <TableSkeleton columns={QUERY_DEVICES_TABLE_COLUMNS} rows={8} />
            ) : (
              // Query Results is NOT a `DataTable`: `QueryReportTable` lays
              // itself out by hand and carries its own
              // `QueryReportTableSkeleton`, which the page shows again while
              // `isReportLoading`. So render the REAL table in its loading
              // state — the two loading frames are then the same element with
              // the same defaults (8 rows, 6 columns, 160px), and there is no
              // shape to drift. `emptyMessage`/`columnOrder` are left off on
              // purpose: with `loading` set and no rows, neither the empty
              // state nor `deriveColumns` is reached, so passing them would
              // only duplicate copy that can rot.
              <QueryReportTable data={NO_REPORT_ROWS} loading showExport={false} />
            )}
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
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div aria-busy="true" className="space-y-6 md:space-y-8">
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
