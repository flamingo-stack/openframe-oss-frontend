'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import {
  BoxArchiveIcon,
  BracketCurlyIcon,
  Chevron02DownIcon,
  ClockHistoryIcon,
  InboxArrowUpIcon,
  LaptopIcon,
  ListBulletIcon,
  MonitorIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type PageActionButton,
  Skeleton,
  type TabItem,
  TabNavigation,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { archiveScriptScheduleMutation as ArchiveScheduleMutationType } from '@/__generated__/archiveScriptScheduleMutation.graphql';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import type {
  scriptScheduleDevicesRelay_schedule$data as ScheduleDevicesFragmentData,
  scriptScheduleDevicesRelay_schedule$key as ScheduleDevicesFragmentKey,
} from '@/__generated__/scriptScheduleDevicesRelay_schedule.graphql';
import type { scriptScheduleDevicesRelayPaginationQuery as ScheduleDevicesPaginationQueryType } from '@/__generated__/scriptScheduleDevicesRelayPaginationQuery.graphql';
import type { scriptScheduleDevicesRelayQuery as ScheduleDevicesQueryType } from '@/__generated__/scriptScheduleDevicesRelayQuery.graphql';
import type { unarchiveScriptScheduleMutation as UnarchiveScheduleMutationType } from '@/__generated__/unarchiveScriptScheduleMutation.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { ScheduleDeviceSelectionMode, ScriptStatus } from '@/generated/schema-enums';
import { archiveScriptScheduleMutation } from '@/graphql/scripts/archive-script-schedule-mutation';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import {
  scriptScheduleDevicesRelayFragment,
  scriptScheduleDevicesRelayQuery,
} from '@/graphql/scripts/script-schedule-devices-relay';
import { unarchiveScriptScheduleMutation } from '@/graphql/scripts/unarchive-script-schedule-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ScheduleInfoBarFromData } from '../../components/schedule/schedule-info-bar';
import { ScriptEditor } from '../../components/script/script-editor';
import {
  argsToParamRows,
  envPairsToParamRows,
  type ScriptParamRow,
  ScriptParamRows,
} from '../../components/script/script-param-rows';
import { initiatorName } from '../utils/execution-helpers';
import { machineToDevice } from '../utils/machine-to-device';
import { criteriaFromStored } from '../utils/schedule-criteria';
import { formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { envVarsToPairs, platformsToIds, shellToId } from '../utils/script-mappers';
import { ArchiveScheduleModal } from './archive-schedule-modal';
import { NotFoundSignal } from './not-found-boundary';
import { ScheduleCriteriaSummary } from './schedule-criteria-card';
import { type ScheduleDetailData, ScheduleDetailGate } from './schedule-detail-gate';
import { ScheduleDevicesTable } from './schedule-devices-table';
import { ScheduleExecutionsTab } from './schedule-executions-tab';
import { ScheduleRunsTab } from './schedule-runs-tab';
import { ScriptPageChrome } from './script-page-chrome';

/** How many assigned devices load per page in the Assigned Devices tab. */
const DEVICES_PAGE_SIZE = 20;

/**
 * Facets over the whole fleet — the criteria summary needs them only to turn
 * stored organization ids into customer names. Module-level to keep the
 * react-query key stable.
 */
const UNFILTERED: DeviceFilterInput = {};

// "Runs" is the aggregate (one row per fire of the schedule); "Execution
// History" is the flat per-script-per-device history under those fires.
const SCHEDULE_DETAIL_TABS: TabItem[] = [
  { id: 'scripts', label: 'Scheduled Scripts', icon: BracketCurlyIcon },
  { id: 'devices', label: 'Assigned Devices', icon: MonitorIcon },
  { id: 'runs', label: 'Schedule Runs', icon: ClockHistoryIcon },
  { id: 'executions', label: 'Execution History', icon: ListBulletIcon },
];

interface ScheduleDetailsViewProps {
  scheduleId: string;
}

// ----------------------------------------------------------------
// Header island — schedule info bar
// ----------------------------------------------------------------

/**
 * All islands read the same detail query with identical variables: Relay dedupes
 * identical in-flight requests, so mounting them in one commit still issues a
 * single network call; afterwards each renders from the store.
 */
function ScheduleHeaderSection({ scheduleId }: ScheduleDetailsViewProps) {
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;

  if (!schedule) {
    throw new NotFoundSignal();
  }

  const { date, time } = formatScheduleStartAt(schedule.startAt);

  // No name / note row here: the page title carries them (design node 260:44649).
  return (
    <ScheduleInfoBarFromData
      date={date}
      time={time}
      repeat={repeatToLabel(schedule.repeat)}
      platforms={platformsToIds(schedule.supportedPlatforms)}
      trigger={schedule.trigger}
      addedBy={initiatorName(schedule.author)}
    />
  );
}

/**
 * Cells of the timing row, in `ScheduleInfoBarFromData`'s order. Bar widths trace
 * the real strings ("Date" is short, "Supported Platform" is not); `divided` marks
 * the two cells that carry the mobile row divider in the real bar.
 */
const INFO_BAR_SKELETON_CELLS = [
  { key: 'date', value: 'w-24', label: 'w-10', divided: true },
  { key: 'time', value: 'w-20', label: 'w-10', divided: true },
  { key: 'repeat', value: 'w-16', label: 'w-14' },
  { key: 'platform', value: 'w-12', label: 'w-32' },
];

/** One value/label pair, sized by the real typography rather than by fixed bar heights. */
function InfoBarSkeletonCell({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]', className)}>
      <div className="text-h4">
        <Skeleton className={cn('inline-block h-3 md:h-4 max-w-full', value)} />
      </div>
      <div className="text-h6">
        <Skeleton className={cn('inline-block h-2.5 md:h-3 max-w-full', label)} />
      </div>
    </div>
  );
}

/**
 * Mirrors `ScheduleInfoBarFromData` as the details page uses it: timing row + "Added by".
 *
 * The bars sit INSIDE elements carrying the real typography classes and are shorter
 * than the line they sit on, so the cell is sized by `text-h4`/`text-h6` line-height
 * — exactly what sizes the loaded bar — instead of by the bars themselves. That is
 * what makes it hold at every breakpoint: the previous fixed `h-6 mb-1` + `h-5` pair
 * measured 72px against the real 60px on mobile, and with three rows the page
 * dropped ~36px the moment the schedule landed. Desktop never showed it, because
 * `md:h-[80px]` pins the cells there.
 */
export function ScheduleInfoBarSkeleton() {
  return (
    <div className="flex flex-col gap-0 bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-ods-border">
        {INFO_BAR_SKELETON_CELLS.map(cell => (
          <InfoBarSkeletonCell
            key={cell.key}
            value={cell.value}
            label={cell.label}
            className={cell.divided ? 'border-b md:border-b-0 border-ods-border' : undefined}
          />
        ))}
      </div>
      <InfoBarSkeletonCell value="w-24" label="w-16" />
    </div>
  );
}

// ----------------------------------------------------------------
// "Scheduled Scripts" tab — expandable card per script
// ----------------------------------------------------------------

type ScheduleScript = ScheduleDetailData['scripts'][number];

/** Design default when a script carries no timeout of its own. */
const DEFAULT_TIMEOUT_SECONDS = 90;

/**
 * One half of a script card's footer: a titled list of `key ——— value` lines.
 *
 * Deliberately not the core `InfoCard`: that draws its own bordered, rounded
 * card, while the design splits the script card itself into two flat panels
 * divided by a single rule. The lines themselves are the shared
 * {@link ScriptParamRows}, so they read identically to the script page's.
 */
function ScriptParamsPanel({
  title,
  rows,
  emptyText,
  footer,
  className,
}: {
  title: string;
  rows: ScriptParamRow[];
  emptyText: string;
  /** Rendered below the rows, in the panel's own 12px rhythm. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-sf)] p-[var(--spacing-system-m)]',
        // Desktop layers the panels over the card (1:49182); the phone (1:49002)
        // flattens the whole card to one tone and lets the rules do the dividing.
        'bg-ods-bg md:bg-ods-card',
        className,
      )}
    >
      <span className="text-h4 text-ods-text-primary truncate" title={title}>
        {title}
      </span>
      <ScriptParamRows rows={rows} emptyText={emptyText} />
      {footer}
    </div>
  );
}

/**
 * One script of the schedule. The chevron opens a different thing per
 * breakpoint, and that is the design's intent, not a shortcut:
 *
 * - **Desktop (1:49182)** — the argument / env-var panels are always visible
 *   (they are what tells two entries of the same script apart), and the chevron
 *   reveals the source above them.
 * - **Phone (1:49002 open / 1:49009 closed)** — the closed card is the header
 *   row alone; opening it gives the panels and a full-width way into the script.
 *   No source at any point: a 400px editor on a 390px-wide screen is a worse
 *   read than the script page it links to.
 */
function ScheduleScriptCard({ script }: { script: ScheduleScript }) {
  const router = useRouter();
  const isMdUp = useMdUp();
  const [isExpanded, setIsExpanded] = useState(false);
  // Monaco is expensive and a schedule lists several cards. The editor is built
  // on the first expand and kept afterwards, so collapsed cards cost nothing and
  // re-opening one is instant. On a phone it is never built at all.
  const [hasExpanded, setHasExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
    setHasExpanded(true);
  }, []);

  const handleScriptDetails = useCallback(() => {
    router.push(routes.scriptsV2.details(script.id));
  }, [router, script.id]);

  const argRows = argsToParamRows(script.defaultArgs ?? []);
  const envRows = envPairsToParamRows(envVarsToPairs(script.envVars));

  return (
    <div className="bg-ods-card border border-ods-border rounded-[8px] overflow-clip flex flex-col">
      {/* Desktop splits the header down the middle — Name owns one half, and the
          actions ride the end of the Timeout half. Mobile drops "Script Details"
          (it moves down into the Environment Vars panel), so the row is a flat
          Name | Timeout | chevron and the card sizes to its padding instead of a
          fixed 80px. */}
      <div
        className={cn(
          'flex items-center gap-[var(--spacing-system-s)] md:gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] md:h-[80px] md:py-0',
          // Tone follows the STATE, not the breakpoint. Closed, the header is
          // the card's own face and keeps its tone (1:49009). Open, it becomes
          // chrome over the source and drops to the darker background tone
          // (1:49002, 1:49182) — the same tone the editor below it paints, so
          // the two read as one block instead of two stacked cards.
          isExpanded && 'bg-ods-bg',
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-h4 text-ods-text-primary truncate" title={script.name}>
            {script.name}
          </span>
          <span className="text-h6 text-ods-text-secondary truncate">Script</span>
        </div>

        {/* `contents` on mobile: the wrapper exists only to make the right half a
            single flex child on desktop. Dissolving it below `md` lets Timeout
            share the row's width with Name evenly, as the mobile mock has it. */}
        <div className="contents md:flex md:flex-1 md:min-w-0 md:items-center md:gap-[var(--spacing-system-m)]">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-h4 text-ods-text-primary truncate">
              {script.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS} Seconds
            </span>
            <span className="text-h6 text-ods-text-secondary truncate">Timeout</span>
          </div>

          <Button variant="outline" onClick={handleScriptDetails} className="hidden md:flex">
            Script Details
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleToggle}
            // Deliberately not "source": the same chevron opens the source on
            // desktop and the parameters on a phone.
            aria-label={isExpanded ? 'Collapse script details' : 'Expand script details'}
            aria-expanded={isExpanded}
            leftIcon={
              <span className={`inline-flex transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <Chevron02DownIcon size={24} />
              </span>
            }
          />
        </div>
      </div>

      {/* The source: desktop only, and what the chevron opens there. `hidden`
          keeps it out of the phone layout entirely; `isMdUp` keeps Monaco from
          being built for a viewport that will never show it. */}
      <div
        className="hidden md:grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        // `0fr` + `overflow-hidden` only clips: the editor keeps its focusable
        // content, so without this a desktop user tabs from the chevron into an
        // invisible Monaco while `aria-expanded` says collapsed.
        inert={!isExpanded}
      >
        <div className="overflow-hidden min-h-0">
          {hasExpanded && isMdUp && (
            <div className="border-t border-ods-border">
              <ScriptEditor
                value={script.scriptBody}
                shell={shellToId(script.shell)}
                readOnly
                height="400px"
                // The card already draws the edges around this block.
                className="rounded-none border-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* The panels: what the chevron opens on a phone, and permanent furniture
          on desktop. One instance serving both — the `!` is what lets the
          desktop rule beat the inline row template, which is otherwise
          unreachable from CSS. Rendering two copies behind `md:hidden` would
          duplicate the whole list for assistive tech instead. */}
      <div
        className="grid md:!grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        // Only on a phone, where this region actually collapses — on desktop it
        // is pinned open and its contents must stay reachable. `isMdUp` is
        // `undefined` until the media query resolves; inerting for that first
        // frame is harmless, since the only focusable thing inside is the
        // `md:hidden` button, which desktop does not render anyway.
        inert={!isExpanded && !isMdUp}
      >
        <div className="overflow-hidden min-h-0">
          {/* Two equal panels split by a single rule (it becomes a horizontal
              one once they stack). Both always render, so an empty half still
              holds its column instead of letting the other one span the card. */}
          <div className="flex flex-col md:flex-row items-stretch border-t border-ods-border">
            <ScriptParamsPanel
              title="Script Arguments"
              rows={argRows}
              emptyText="No script arguments"
              className="border-b border-ods-border md:border-b-0 md:border-r"
            />
            <ScriptParamsPanel
              title="Environment Vars"
              rows={envRows}
              emptyText="No environment variables"
              // Phone only (1:49002): the header has no room for "Script
              // Details", so the way into the script sits at the foot of the
              // last panel.
              footer={
                <Button variant="outline" onClick={handleScriptDetails} className="w-full md:hidden">
                  Show Script Details
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleScriptsTabSection({ scheduleId }: ScheduleDetailsViewProps) {
  // `store-or-network`: the header island already revalidated this exact query
  // on page load; this island remounts per tab switch and reads the store.
  const data = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-or-network' },
  );
  const schedule = data.scriptSchedule;

  // Not-found is escalated (full-page) by the header island; render nothing here.
  if (!schedule) {
    return null;
  }

  if (schedule.scripts.length === 0) {
    return <div className="text-h6 text-ods-text-secondary">No scripts in this schedule yet.</div>;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {schedule.scripts.map((script, position) => (
        // A schedule may run the same script more than once ("A, B, A" is a
        // valid recipe), so `script.id` is NOT unique here — the RUN POSITION is
        // what identifies an entry. The list is read-only and ordered by the
        // server, so position is stable for as long as the data is.
        <ScheduleScriptCard key={`${script.id}-${position}`} script={script} />
      ))}
    </div>
  );
}

/** A collapsed {@link ScheduleScriptCard} — which on a phone is the header alone. */
function ScheduleScriptCardSkeleton() {
  return (
    <div className="bg-ods-card border border-ods-border rounded-[8px] overflow-clip flex flex-col">
      <div className="flex items-center gap-[var(--spacing-system-s)] md:gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] md:h-[80px] md:py-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <Skeleton className="h-6 w-44 mb-1" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="contents md:flex md:flex-1 md:min-w-0 md:items-center md:gap-[var(--spacing-system-m)]">
          <div className="flex-1 min-w-0 flex flex-col">
            <Skeleton className="h-6 w-24 mb-1" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-12 w-[130px] rounded-[6px] hidden md:block" />
          <Skeleton className="h-11 w-11 md:h-12 md:w-12 rounded-[6px]" />
        </div>
      </div>

      {/* Desktop keeps the panels open at all times, so the skeleton has to hold
          their height or the list jumps when data lands. A phone starts closed
          (1:49009) — there the header alone IS the collapsed card. */}
      <div className="hidden md:flex flex-col md:flex-row items-stretch border-t border-ods-border">
        {['args', 'env'].map((panel, panelIndex) => (
          <div
            key={panel}
            className={cn(
              'flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-sf)] p-[var(--spacing-system-m)] bg-ods-bg md:bg-ods-card',
              panelIndex === 0 && 'border-b border-ods-border md:border-b-0 md:border-r',
            )}
          >
            <div className="text-h4">
              <Skeleton className="inline-block h-4 w-32 max-w-full" />
            </div>
            {['a', 'b'].map(row => (
              <div key={row} className="flex h-6 w-full items-center gap-[var(--spacing-system-xs)]">
                <Skeleton className="h-4 w-20" />
                <span className="h-px min-w-4 flex-1 bg-ods-divider" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleScriptsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {['a', 'b'].map(key => (
        <ScheduleScriptCardSkeleton key={key} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// "Assigned Devices" tab — read-only device list
// ----------------------------------------------------------------

export type AssignedMachine = ScheduleDevicesFragmentData['assignedDevices']['edges'][number]['node'];

/**
 * The stored rule, above the list it produces. Its own component so the facets
 * query (needed only to name customers) is mounted with it — a SPECIFIC
 * schedule never issues it.
 */
function ScheduleCriteriaSummarySection({ schedule }: { schedule: ScheduleDetailData }) {
  const { data: filterOptions } = useDeviceFilters(UNFILTERED);
  return (
    <ScheduleCriteriaSummary criteria={criteriaFromStored(schedule.deviceCriteria)} deviceFilters={filterOptions} />
  );
}

function ScheduleDevicesTabSection({
  scheduleId,
  schedule,
}: ScheduleDetailsViewProps & { schedule: ScheduleDetailData | undefined }) {
  // Dedicated query — the heavy machine resolution loads only when this tab
  // mounts, never with the page itself.
  const queryData = useLazyLoadQuery<ScheduleDevicesQueryType>(
    scriptScheduleDevicesRelayQuery,
    { id: scheduleId, first: DEVICES_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ScheduleDevicesPaginationQueryType,
    ScheduleDevicesFragmentKey
  >(scriptScheduleDevicesRelayFragment, queryData.scriptSchedule ?? null);

  const rows = useMemo<Device[]>(() => {
    const edges = data?.assignedDevices?.edges ?? [];
    // Defensive null-node guard: skip any dangling edge instead of crashing the
    // tab on a store-evicted record.
    return edges.flatMap(edge => (edge?.node ? [machineToDevice(edge.node)] : []));
  }, [data?.assignedDevices?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(DEVICES_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  const isCriteria = schedule?.selectionMode === ScheduleDeviceSelectionMode.CRITERIA;

  // Not-found is escalated (full-page) by the header island; render nothing here.
  if (!queryData.scriptSchedule) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {isCriteria && schedule && <ScheduleCriteriaSummarySection schedule={schedule} />}
      <ScheduleDevicesTable
        devices={rows}
        totalCount={data?.assignedDevices?.filteredCount ?? undefined}
        infiniteScroll={{
          hasNextPage: hasNext,
          isFetchingNextPage: isLoadingNext,
          onLoadMore: fetchNextPage,
          skeletonRows: 2,
        }}
      />
    </div>
  );
}

function ScheduleDevicesTabSkeleton() {
  return <ScheduleDevicesTable devices={[]} loading />;
}

// ----------------------------------------------------------------
// Page shell — chrome renders immediately, data islands suspend
// ----------------------------------------------------------------

/**
 * The page chrome (title, Back, Archive / Edit actions, tab bar) depends only on
 * the route's `scheduleId` — except the Archive action, which has to know
 * whether the schedule is already archived. That comes from
 * {@link ScheduleDetailGate}: it renders this chrome IMMEDIATELY with
 * `schedule === undefined` and pours the record in when the query lands, so the
 * page still paints before any data (only the islands suspend into skeletons).
 * A missing schedule is escalated as {@link NotFoundSignal} and swaps the whole
 * page for the full-page not-found state.
 */
function ScheduleDetailsChrome({
  scheduleId,
  schedule,
}: ScheduleDetailsViewProps & { schedule: ScheduleDetailData | undefined }) {
  const { toast } = useToast();
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  const [commitArchive, isArchiving] = useMutation<ArchiveScheduleMutationType>(archiveScriptScheduleMutation);
  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScheduleMutationType>(unarchiveScriptScheduleMutation);
  const isArchivePending = isArchiving || isUnarchiving;
  const archived = schedule?.status === ScriptStatus.ARCHIVED;

  const handleArchiveToggle = useCallback(() => {
    if (!schedule) return;
    const commit = archived ? commitUnarchive : commitArchive;
    commit({
      // No connection to prune from here — the lists own their own connections
      // and refetch on navigation (`store-and-network`). The payload's `status`
      // is what updates this page.
      variables: { id: schedule.id, connections: [] },
      onCompleted: () => {
        setConfirmArchiveOpen(false);
        toast(
          archived
            ? {
                title: 'Schedule unarchived',
                description: `"${schedule.name}" was moved back to Scripts Schedules.`,
                variant: 'success',
              }
            : {
                title: 'Schedule archived',
                description: `"${schedule.name}" was moved to Archived Schedules.`,
                variant: 'success',
              },
        );
      },
      onError: error => {
        setConfirmArchiveOpen(false);
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, `Failed to ${archived ? 'unarchive' : 'archive'} schedule`),
          variant: 'destructive',
        });
      },
    });
  }, [schedule, archived, commitArchive, commitUnarchive, toast]);

  // An archived schedule runs on nothing, so editing it is meaningless — the
  // one thing worth offering is putting it back (design node 1:24107).
  const actions = useMemo<PageActionButton[]>(
    () =>
      archived
        ? [
            {
              label: 'Unarchive',
              variant: 'outline' as const,
              onClick: handleArchiveToggle,
              icon: <InboxArrowUpIcon className="text-ods-text-secondary" />,
              disabled: isArchivePending,
              loading: isArchivePending,
            },
          ]
        : [
            {
              label: 'Archive',
              variant: 'outline' as const,
              // Archiving stops the schedule from running, so it asks first;
              // unarchiving above only puts it back and needs no confirmation.
              onClick: () => setConfirmArchiveOpen(true),
              icon: <BoxArchiveIcon className="text-ods-text-secondary" />,
              // Until the record lands there is no status to act on.
              disabled: !schedule || isArchivePending,
              loading: isArchivePending,
            },
            {
              label: 'Edit Devices',
              variant: 'outline' as const,
              href: routes.scriptsV2.schedules.devices(scheduleId),
              icon: <LaptopIcon className="text-ods-text-secondary" />,
            },
            {
              label: 'Edit Schedule',
              variant: 'outline' as const,
              href: routes.scriptsV2.schedules.edit(scheduleId),
              icon: <PenEditIcon className="text-ods-text-secondary" />,
            },
          ],
    [scheduleId, archived, handleArchiveToggle, schedule, isArchivePending],
  );

  return (
    <>
      <ScriptPageChrome
        // The schedule names its own page (design node 1:48789). Until the record
        // lands, `loading` swaps the title/description text for inline skeletons and
        // `loadingActions` does the same for the buttons (their set depends on the
        // status). `while-loading` rather than `always`: the description line is
        // drawn while the header is loading, but a schedule that has no description
        // settles one line shorter instead of keeping an empty row forever.
        title={schedule?.name ?? ''}
        subtitle={schedule?.description ?? undefined}
        subtitleRow="while-loading"
        loading={!schedule}
        loadingActions={!schedule}
        titleAdornment={archived ? <Tag label="Archived" variant="grey" /> : undefined}
        // Back follows the list the schedule actually belongs to, so Back from
        // an archived schedule doesn't land the user on a list without it.
        backFallback={archived ? routes.scriptsV2.schedules.archived : routes.scriptsV2.schedules.list}
        actions={actions}
        actionsVariant="icon-buttons"
      >
        <div className="flex flex-col gap-[var(--spacing-system-lf)]">
          <Suspense fallback={<ScheduleInfoBarSkeleton />}>
            <ScheduleHeaderSection scheduleId={scheduleId} />
          </Suspense>

          <TabNavigation tabs={SCHEDULE_DETAIL_TABS} urlSync defaultTab="scripts">
            {activeTab => {
              if (activeTab === 'devices') {
                return (
                  <Suspense fallback={<ScheduleDevicesTabSkeleton />}>
                    <ScheduleDevicesTabSection scheduleId={scheduleId} schedule={schedule} />
                  </Suspense>
                );
              }
              if (activeTab === 'runs') {
                return <ScheduleRunsTab scheduleId={scheduleId} />;
              }
              if (activeTab === 'executions') {
                return <ScheduleExecutionsTab scheduleId={scheduleId} />;
              }
              return (
                <Suspense fallback={<ScheduleScriptsTabSkeleton />}>
                  <ScheduleScriptsTabSection scheduleId={scheduleId} />
                </Suspense>
              );
            }}
          </TabNavigation>
        </div>
      </ScriptPageChrome>

      <ArchiveScheduleModal
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        onConfirm={handleArchiveToggle}
        isPending={isArchiving}
      />
    </>
  );
}

/**
 * Schedule details page. The gate supplies the record the chrome's Archive
 * action needs (and owns the not-found boundary) without making the page wait
 * for it — see {@link ScheduleDetailsChrome}.
 */
export function ScheduleDetailsView({ scheduleId }: ScheduleDetailsViewProps) {
  return (
    <ScheduleDetailGate scheduleId={scheduleId}>
      {schedule => <ScheduleDetailsChrome scheduleId={scheduleId} schedule={schedule} />}
    </ScheduleDetailGate>
  );
}
