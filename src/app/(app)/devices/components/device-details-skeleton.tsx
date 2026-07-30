'use client';

import {
  type ActionsMenuGroup,
  Input,
  type PageActionButton,
  PageLayout,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core';
import {
  ArrowRightUpIcon,
  BracketCurlyIcon,
  ComputerMouseIcon,
  SearchIcon,
  TerminalIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  Skeleton,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useMemo } from 'react';
import { LogsTableSkeleton } from '@/app/(app)/logs-page/components/logs-table-skeleton';
import { DEVICE_TICKET_COLUMNS } from '@/app/(app)/tickets/components/ticket-table-layout';
import {
  PoliciesTable,
  type PolicyTableRow,
  QueriesTable,
  type QueryTableRow,
  skeletonColumnDefs,
  type TableSkeletonColumn,
} from '@/app/components/shared';
import { SOFTWARE_TAB_COLUMNS, USERS_TAB_COLUMNS, VULNERABILITIES_TAB_COLUMNS } from './tabs/device-tab-columns';
import { DEVICE_TABS } from './tabs/device-tabs';

const noop = () => {};

const EMPTY_POLICY_ROWS: PolicyTableRow[] = [];
const EMPTY_QUERY_ROWS: QueryTableRow[] = [];

/**
 * Static placeholder actions so the REAL `PageActions` renders during load — pixel-perfect
 * and fully responsive (it collapses to the "…" menu on small screens by itself). Mirrors the
 * device header: Remote Control (+ open arrow), Remote Shell (CMD/PowerShell submenu), and "…".
 */
const SKELETON_MENU_ACTIONS: ActionsMenuGroup[] = [
  {
    items: [
      {
        id: 'run-script',
        label: 'Run Script',
        icon: <BracketCurlyIcon className="w-6 h-6 text-ods-text-secondary" />,
        onClick: noop,
        disabled: true,
      },
    ],
  },
];

const SKELETON_ACTIONS: PageActionButton[] = [
  {
    label: 'Remote Control',
    variant: 'outline',
    disabled: true,
    icon: <ComputerMouseIcon className="text-ods-text-secondary" />,
    onClick: noop,
    iconAction: {
      // Uncolored, like the loaded header's trailing arrow: the split button's icon
      // half inherits primary (white), and the leading icons are the muted ones.
      icon: <ArrowRightUpIcon />,
      'aria-label': 'Open Remote Control',
      onClick: noop,
      disabled: true,
    },
  },
  {
    label: 'Remote Shell',
    variant: 'outline',
    disabled: true,
    icon: <TerminalIcon className="text-ods-text-secondary" />,
    // A SPLIT button, like Remote Control above — not a `submenu`, which is what
    // this used to be. The two are different components in `PageActions`
    // (`iconAction` → `SplitButton`, `submenu` → `Button` + `splitIcon`), and the
    // loaded header picks between them by the device's OS: Windows gets the
    // CMD/PowerShell submenu, everything else the open-in-new-tab arrow. The OS is
    // exactly what is still loading, so hardcoding the Windows shape here was a
    // guess that was wrong on every mac and Linux device.
    //
    // Split is the shape to stand in with: it is the geometry of both variants, so a
    // Windows device differs only in the trailing glyph rather than in the component.
    // The two shapes also used to disagree on glyph SIZE — `SplitButton` scales its
    // icons 16/24 while the `Button` split slots were a flat 20px, and since both are
    // `[&_svg]:h-*` descendant rules they outrank whatever the icon carries itself —
    // so the button changed its leading icon size on handoff too. That one is fixed in
    // the lib: both shapes now share `splitGlyphSizeClasses`.
    onClick: noop,
    iconAction: {
      // Deliberately a placeholder, not an arrow or a chevron: which one this
      // becomes is the OS answer we don't have yet. The cell it reserves is what
      // matters.
      icon: <Skeleton className="h-4 w-4 md:h-6 md:w-6 rounded" />,
      'aria-label': 'Remote Shell',
      onClick: noop,
      disabled: true,
    },
  },
];

// --- Reusable helpers ---

/**
 * Universal text skeleton — sized to the EXACT line box of a typography token.
 *
 * The wrapper carries the real typography class (e.g. `text-h2`) plus an invisible
 * character, so its outer height equals the rendered text's line height; the bar is
 * centered inside it. This is the fix for the header height jump: any container that
 * mixes real text and skeletons (title `text-h2` + subtitle `text-h6` + `Tag`) stays
 * pixel-identical in height whether it shows the skeleton or the live value.
 */
function TextSkeleton({ typography, width, className }: { typography: string; width: string; className?: string }) {
  return (
    <span className={cn('relative inline-block align-middle', typography, width, className)}>
      {/* Invisible char establishes the real line-box height for `typography`. */}
      <span className="invisible" aria-hidden>
        &nbsp;
      </span>
      <Skeleton className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[0.85em] rounded-[6px]" />
    </span>
  );
}

/** Matches the real `Tag` box exactly: `h-8 rounded-md` pill (only the label is skeletoned). */
function TagSkeleton({ width = 'w-20' }: { width?: string }) {
  return <Skeleton className={cn('h-8 rounded-md shrink-0', width)} />;
}

/** Section heading — matches `h3.text-h5.text-ods-text-secondary.mb-4` (line-box accurate). */
function SectionHeadingSkeleton({ width = 'w-24' }: { width?: string }) {
  return (
    <div className="mb-4">
      <TextSkeleton typography="text-h5" width={width} />
    </div>
  );
}

/**
 * InfoCard skeleton — mirrors the real core InfoCard: `p-m`, the header (title + optional
 * subtitle, h-6 lines) and body (h-6 rows + optional progress) are two groups separated by
 * `gap-l`; rows use `gap-xs`. Each row is label + divider + value.
 */
function InfoCardSkeleton({
  itemCount = 2,
  showProgress = false,
  showSubtitle = false,
  showTitle = true,
  className = '',
}: {
  itemCount?: number;
  showProgress?: boolean;
  showSubtitle?: boolean;
  showTitle?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-l)] w-full',
        className,
      )}
    >
      {(showTitle || showSubtitle) && (
        <div className="flex flex-col items-start w-full">
          {showTitle && (
            <div className="h-6 flex items-center">
              <Skeleton className="h-5 w-32" />
            </div>
          )}
          {showSubtitle && (
            <div className="h-6 flex items-center">
              <Skeleton className="h-5 w-40" />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-[var(--spacing-system-xs)] w-full">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} className="flex h-6 gap-[var(--spacing-system-xs)] items-center w-full">
            <Skeleton className="h-5 w-24 shrink-0" />
            <div className="flex-1 h-px bg-ods-border" />
            <Skeleton className="h-5 w-20 shrink-0" />
          </div>
        ))}
        {showProgress && <Skeleton className="h-1.5 w-full rounded-full" />}
      </div>
    </div>
  );
}

/**
 * The REAL search input — fixed chrome, so we render the actual core `Input` (enabled, icon +
 * placeholder) during load instead of a grey bar, matching the tab's live search field.
 */
function SearchInputSkeleton({ placeholder }: { placeholder: string }) {
  return (
    <Input
      placeholder={placeholder}
      className="w-full"
      startAdornment={<SearchIcon className="w-4 h-4 md:w-6 md:h-6" />}
    />
  );
}

const EMPTY_TABLE_ROWS: unknown[] = [];

/**
 * Standard table-tab skeleton — the app-wide loading pattern (see `customer-details-skeleton`):
 * a search bar + an empty real `DataTable` with `loading`, which renders the real
 * `DataTableSkeleton` (all columns, correct header height, responsive condensing). Headers are
 * rendered for real; the search input is a plain bar (not a disabled input).
 */
function TableTabSkeleton({ columns, placeholder }: { columns: readonly TableSkeletonColumn[]; placeholder: string }) {
  const colDefs = useMemo<ColumnDef<unknown>[]>(() => skeletonColumnDefs<unknown>(columns), [columns]);

  const table = useDataTable<unknown>({
    data: EMPTY_TABLE_ROWS,
    columns: colDefs,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <SearchInputSkeleton placeholder={placeholder} />
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading skeletonRows={10} emptyMessage="" rowClassName="mb-1" />
      </DataTable>
    </div>
  );
}

/**
 * Mirrors the real `InfoCell`: a column with [row(optional inline icon + value), label].
 * Only the value is a skeleton; the label is the real static text. `iconClass` matches the
 * live icon box (Device `w-5/7`, Type/UUID `w-4/6`).
 */
function InfoCellSkeleton({
  label,
  valueWidth = 'w-32',
  iconClass,
}: {
  label: string;
  valueWidth?: string;
  iconClass?: string;
}) {
  return (
    <div className="flex flex-col justify-center min-w-0 flex-1">
      <div className="flex items-center gap-[var(--spacing-system-xxs)] min-w-0">
        {iconClass && <Skeleton className={cn(iconClass, 'shrink-0 rounded-[6px]')} />}
        <TextSkeleton typography="text-h4" width={valueWidth} />
      </div>
      <span className="text-ods-text-secondary text-h6 truncate mt-1">{label}</span>
    </div>
  );
}

/** Mirrors the Customer cell: a 40px avatar beside the [value, "Customer ID (Site)"] column. */
function CustomerCellSkeleton() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)] flex-1 min-w-0">
      <Skeleton className="size-10 shrink-0 rounded-md" />
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <TextSkeleton typography="text-h4" width="w-28" />
        <span className="text-ods-text-secondary text-h6 truncate mt-1">Customer ID (Site)</span>
      </div>
    </div>
  );
}

/**
 * Mirrors the live DeviceInfoSection 1:1 across breakpoints — same responsive row structure
 * (mobile/tablet/desktop), real labels + avatar, only the values are skeletons.
 */
function DeviceInfoSectionSkeleton() {
  const rowClass =
    'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 md:min-h-20 border-b border-ods-border';

  const hostname = <InfoCellSkeleton label="Hostname" valueWidth="w-28" />;
  const device = <InfoCellSkeleton label="Device" valueWidth="w-44" iconClass="w-5 h-5 md:w-7 md:h-7" />;
  const type = <InfoCellSkeleton label="Type" valueWidth="w-24" iconClass="w-4 h-4 md:w-6 md:h-6" />;
  const serial = <InfoCellSkeleton label="Serial Number" valueWidth="w-52" />;
  const registered = <InfoCellSkeleton label="Registered" valueWidth="w-40" />;
  const updated = <InfoCellSkeleton label="Updated" valueWidth="w-40" />;
  const uuid = <InfoCellSkeleton label="UUID" valueWidth="w-48" iconClass="w-4 h-4 md:w-6 md:h-6" />;
  const customer = <CustomerCellSkeleton />;

  return (
    <div className="bg-ods-card border border-ods-border rounded-md flex flex-col">
      {/* ===== Mobile + Tablet (< lg) ===== */}
      <div className="lg:hidden flex flex-col">
        <div className={rowClass}>
          {hostname}
          {device}
        </div>
        <div className={rowClass}>
          {type}
          {serial}
        </div>
        {/* Mobile (< md): customer as a full-width row */}
        <div className="md:hidden flex items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-m)] min-h-14 border-b border-ods-border">
          {customer}
        </div>
        {/* Tablet (md to lg): customer in one row */}
        <div className="hidden md:flex md:items-center md:gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-20 border-b border-ods-border">
          <div className="flex items-center gap-[var(--spacing-system-xs)] flex-1 min-w-0">{customer}</div>
        </div>
        <div className={rowClass}>
          {registered}
          {updated}
        </div>
        <div className="flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 md:min-h-20">
          {uuid}
        </div>
      </div>

      {/* ===== Desktop (lg+) — 2 rows of 4 ===== */}
      <div className="hidden lg:flex lg:flex-col">
        <div className={rowClass}>
          {hostname}
          {device}
          {type}
          <div className="flex items-center gap-[var(--spacing-system-xs)] flex-1 min-w-0">{customer}</div>
        </div>
        <div className="flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-20">
          {uuid}
          {serial}
          {registered}
          {updated}
        </div>
      </div>
    </div>
  );
}

// --- Tab-specific skeletons ---

/** One hardware block skeleton: heading (text-h5) above an InfoCard. */
function HardwareBlockSkeleton({
  showTitle = false,
  showSubtitle = false,
  items = 4,
  showProgress = false,
}: {
  showTitle?: boolean;
  showSubtitle?: boolean;
  items?: number;
  showProgress?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] h-full [&>*:last-child]:flex-1">
      <div className="h-5 flex items-center">
        <Skeleton className="h-4 w-20" />
      </div>
      <InfoCardSkeleton
        itemCount={items}
        showTitle={showTitle}
        showSubtitle={showSubtitle}
        showProgress={showProgress}
      />
    </div>
  );
}

function HardwareTabSkeleton() {
  // Mirrors the real Hardware tab rows: System/Boot/CPU share one 3-col row; Memory and
  // Storage each get their own row.
  const row = 'grid grid-cols-1 lg:grid-cols-3 gap-[var(--spacing-system-l)]';
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className={row}>
        <HardwareBlockSkeleton showTitle showSubtitle items={4} />
        <HardwareBlockSkeleton items={4} />
        <HardwareBlockSkeleton showTitle items={4} />
      </div>
      <div className={row}>
        <HardwareBlockSkeleton items={1} />
      </div>
      <div className={row}>
        <HardwareBlockSkeleton showTitle showSubtitle items={4} showProgress />
      </div>
    </div>
  );
}

function OsTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* OPERATING SYSTEM — single card (title + subtitle + items) in a 3-col grid */}
      <div>
        <SectionHeadingSkeleton width="w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={5} showSubtitle />
        </div>
      </div>
      {/* BOOT & TIME — single card with items */}
      <div>
        <SectionHeadingSkeleton width="w-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={5} />
        </div>
      </div>
    </div>
  );
}

function NetworkTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Full-width Public IP card */}
      <InfoCardSkeleton itemCount={1} />
      {/* Local IPv4 / IPv6 addresses — 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCardSkeleton itemCount={4} />
        <InfoCardSkeleton itemCount={4} />
      </div>
    </div>
  );
}

function SecurityTabSkeleton() {
  return (
    <div>
      {/* SECURITY POSTURE — 3 cards */}
      <div>
        <SectionHeadingSkeleton width="w-40" />
        <SectionHeadingSkeleton width="w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={2} />
          <InfoCardSkeleton itemCount={4} />
          <InfoCardSkeleton itemCount={2} />
        </div>
      </div>
      {/* USER SESSIONS — 1 card inside 3-col grid */}
      <div className="pt-6">
        <SectionHeadingSkeleton width="w-32" />
        <SectionHeadingSkeleton width="w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={4} />
        </div>
      </div>
      {/* SECURITY AGENTS — 3 cards */}
      <div className="pt-6">
        <SectionHeadingSkeleton width="w-36" />
        <SectionHeadingSkeleton width="w-36" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={2} />
          <InfoCardSkeleton itemCount={2} />
          <InfoCardSkeleton itemCount={2} />
        </div>
      </div>
      {/* NETWORK SECURITY — 1 card */}
      <div className="pt-6">
        <SectionHeadingSkeleton width="w-40" />
        <SectionHeadingSkeleton width="w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={3} />
        </div>
      </div>
      {/* ALERT CONFIGURATION — 2 cards */}
      <div className="pt-6">
        <SectionHeadingSkeleton width="w-44" />
        <SectionHeadingSkeleton width="w-44" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={4} />
          <InfoCardSkeleton itemCount={2} />
        </div>
      </div>
      {/* SYSTEM BOOT INFORMATION — 1 card */}
      <div className="pt-6">
        <SectionHeadingSkeleton width="w-52" />
        <SectionHeadingSkeleton width="w-52" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCardSkeleton itemCount={3} />
        </div>
      </div>
    </div>
  );
}

/** Matches AgentsTab: 3-col grid, each card has an absolute ToolBadge (top-left) and info icon (top-right),
 * wrapping an InfoCard with pt-16 to make room. */
function AgentsTabSkeleton() {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      {/* Matches the real "Agent Versions" heading (`h3.text-h5`). */}
      <TextSkeleton typography="text-h5" width="w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-system-l)] items-stretch">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="relative flex flex-col">
            <div className="absolute top-4 left-4 z-10">
              <Skeleton className="h-6 w-24 rounded-[6px]" />
            </div>
            <div className="absolute top-4 right-4 z-10">
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="bg-ods-card border border-ods-border rounded-[6px] p-4 pt-16 flex flex-col flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center w-full">
                  <Skeleton className="h-5 w-14 shrink-0" />
                  <div className="flex-1 h-px bg-ods-border" />
                  <Skeleton className="h-5 w-20 shrink-0" />
                </div>
                <div className="flex gap-2 items-center w-full">
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <div className="flex-1 h-px bg-ods-border" />
                  <Skeleton className="h-5 w-32 shrink-0" />
                </div>
                <div className="flex gap-2 items-center w-full">
                  <Skeleton className="h-5 w-8 shrink-0" />
                  <div className="flex-1 h-px bg-ods-border" />
                  <Skeleton className="h-5 w-40 shrink-0" />
                </div>
                <div className="flex gap-2 items-center w-full">
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <div className="flex-1 h-px bg-ods-border" />
                  <Skeleton className="h-5 w-14 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsersTabSkeleton() {
  return <TableTabSkeleton columns={USERS_TAB_COLUMNS} placeholder="Search for User" />;
}

function SoftwareTabSkeleton() {
  return <TableTabSkeleton columns={SOFTWARE_TAB_COLUMNS} placeholder="Search for Software" />;
}

function VulnerabilitiesTabSkeleton() {
  return <TableTabSkeleton columns={VULNERABILITIES_TAB_COLUMNS} placeholder="Search for Vulnerability" />;
}

/**
 * Policies and Queries render the REAL shared tables in their loading state
 * instead of a column copy: both already reserve the actions column while
 * `isLoading` (see `PoliciesTable`), and the column set depends on props the tab
 * passes — the device tab omits `showPlatform`, so the copy here used to draw a
 * PLATFORM column the loaded table never renders.
 */
function PoliciesTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <SearchInputSkeleton placeholder="Search for Policies" />
      <PoliciesTable rows={EMPTY_POLICY_ROWS} isLoading emptyMessage="" />
    </div>
  );
}

function QueriesTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <SearchInputSkeleton placeholder="Search for Query" />
      <QueriesTable rows={EMPTY_QUERY_ROWS} isLoading emptyMessage="" />
    </div>
  );
}

function TicketsTabSkeleton() {
  return <TableTabSkeleton columns={DEVICE_TICKET_COLUMNS} placeholder="Search for Tickets" />;
}

/** Matches embedded LogsTable: full-width search input + the real log columns (header labels static). */
/**
 * Matches OverviewTab: the device info grid, the Device Tags section, and the logs table.
 * For the logs area we reuse the REAL `LogsTableSkeleton` (the same fallback `LogsTable`
 * renders inside its own Suspense). That way: (1) a logs skeleton is visible during the
 * device-details load (when `LogsTable` isn't mounted yet), and (2) once `LogsTable` mounts
 * and suspends, its fallback is the identical skeleton — no jarring swap, no double-skeleton.
 */
function OverviewTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <DeviceInfoSectionSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-8 w-40 rounded-[6px]" />
          <Skeleton className="h-8 w-36 rounded-[6px]" />
          <Skeleton className="h-8 w-44 rounded-[6px]" />
        </div>
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <SearchInputSkeleton placeholder="Search for Logs" />
        <LogsTableSkeleton />
      </div>
    </div>
  );
}

// --- Tab skeleton resolver ---

function getTabSkeleton(activeTab: string) {
  switch (activeTab) {
    case 'overview':
      return <OverviewTabSkeleton />;
    case 'hardware':
      return <HardwareTabSkeleton />;
    case 'os':
      return <OsTabSkeleton />;
    case 'network':
      return <NetworkTabSkeleton />;
    case 'security':
      return <SecurityTabSkeleton />;
    case 'agents':
      return <AgentsTabSkeleton />;
    case 'users':
      return <UsersTabSkeleton />;
    case 'software':
      return <SoftwareTabSkeleton />;
    case 'vulnerabilities':
      return <VulnerabilitiesTabSkeleton />;
    case 'policies':
      return <PoliciesTabSkeleton />;
    case 'queries':
      return <QueriesTabSkeleton />;
    case 'tickets':
      return <TicketsTabSkeleton />;
    default:
      return <OverviewTabSkeleton />;
  }
}

// --- Main skeleton ---

interface DeviceDetailsSkeletonProps {
  activeTab?: string;
}

/**
 * Renders through the REAL `PageLayout` used by DeviceDetailsView — same props (back button,
 * disabled actions, `actionsVariant`, `titleAdornment`, `className`) — so the header is
 * pixel-identical to the loaded page by construction. `loading` swaps only the title/subtitle
 * text for line-box-accurate skeletons; the status `Tag` adornment is a `TagSkeleton`. The tab
 * bar (static, with the active tab highlighted) and the active tab's body skeleton are children.
 */
export function DeviceDetailsSkeleton({ activeTab = 'overview' }: DeviceDetailsSkeletonProps) {
  return (
    <PageLayout
      loading
      // The real header always renders a subtitle ("Updated X ago"), so this
      // skeleton has to reserve that line too — otherwise the loading header is
      // shorter than the loaded one and the page jumps once the device lands.
      subtitleRow="always"
      backButton={{ label: 'Back', onClick: noop }}
      actions={SKELETON_ACTIONS}
      menuActions={SKELETON_MENU_ACTIONS}
      actionsVariant="menu-primary"
      titleAdornment={<TagSkeleton />}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {/* Reuse the REAL `TabNavigation` (not a copy) so the tab bar is pixel-identical to
          the loaded page and can't drift. `pointer-events-none` keeps it non-interactive
          while loading; `onTabChange` is a required no-op in controlled mode. */}
      <TabNavigation tabs={DEVICE_TABS} activeTab={activeTab} onTabChange={noop} className="pointer-events-none">
        {() => getTabSkeleton(activeTab)}
      </TabNavigation>
    </PageLayout>
  );
}
