'use client';

import { TicketStatusTag } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { DashboardInfoCard } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Single source of truth for the dashboard section skeletons.
 *
 * Both the route-level `loading.tsx` and each overview section's own loading
 * branch render THESE components, so the skeleton shown before the route resolves
 * is byte-identical to the one shown while the section fetches its data — no
 * shape-shift flash between the two phases, and no drift over time.
 *
 * Principle: show as much NON-query-dependent information as possible. Every
 * static label is rendered as its REAL text/element — the section titles
 * ("Devices Overview", …), each info card's title
 * ("Online Devices", …) and the ticket status tags — and only the values that
 * actually come from the request (counts, percentages, the progress ring, and
 * the per-customer rows) are skeletons. Because the real elements are used, the
 * loading card is pixel-identical in height to the loaded one and nothing jumps
 * when the data arrives.
 */

const DEVICE_CARDS = ['Online Devices', 'Offline Devices', 'Pending Devices', 'Archived Devices'] as const;
const CUSTOMER_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const;

// Exact wrapper of the core `DashboardInfoCard` (its `baseClassName`), for the customer card, which
// has no static title. The status cards are `DashboardInfoCard` itself, in its `loading` state.
const INFO_CARD_CLASS =
  'flex h-16 items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] transition-all content-md:h-[104px] content-md:gap-[var(--spacing-system-m)] content-md:p-[var(--spacing-system-m)]';

/**
 * Customer `DashboardInfoCard` skeleton — the whole card is per-customer data
 * (logo, name, device count, website), so it stays a skeleton. Mirrors the real
 * card's icon slot (32 → 56px tile) and the name/subtitle rows.
 */
function CustomerInfoCardSkeleton() {
  return (
    <div className={cn(INFO_CARD_CLASS, 'col-span-2')}>
      {/* logo tile — mirrors the DashboardInfoCard icon slot */}
      <UnifiedSkeleton className="size-8 shrink-0 rounded-sm content-md:size-14" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-ods-text-primary text-h3">
          <UnifiedSkeleton as="span" className="inline-block max-w-full align-middle h-4 w-40" />
        </p>
        <p className="text-ods-text-secondary text-h6">
          <UnifiedSkeleton as="span" className="inline-block max-w-full align-middle h-3 w-24" />
        </p>
      </div>
    </div>
  );
}

/**
 * Overview section header in loading state. Faithfully mirrors the FROZEN
 * `TitleBlock` so it doesn't jump when the real header mounts. The section title is
 * static, so it renders as its REAL text and there is nothing here to skeleton.
 *
 * No subtitle line: the live sections dropped theirs ("N Devices in Total"), and a
 * placeholder that keeps one would make the header taller while loading and collapse
 * on handoff.
 */
function OverviewHeaderSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[var(--spacing-system-m)]',
        'content-md:flex-col content-md:items-start content-md:justify-start content-lg:flex-row content-lg:items-end content-lg:justify-between',
        'mb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xs)] content-md:min-h-12">
        <div className="flex w-full min-w-0 items-center gap-[var(--spacing-system-m)]">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h1 className="truncate text-ods-text-primary text-h2">{title}</h1>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Devices Overview loading state — real header + 4 info-card skeletons with real titles. */
export function DevicesOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading devices overview">
      <OverviewHeaderSkeleton title="Devices Overview" />
      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] content-lg:grid-cols-4">
        {DEVICE_CARDS.map(title => (
          <DashboardInfoCard
            key={title}
            loading
            value=""
            title={title}
            showProgress
            loadingShowsPercentage
            percentageDisplay="plain"
          />
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Tickets Overview loading state — real header + 4 ticket cards with their real status tags. */
export function TicketsOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading tickets overview">
      <OverviewHeaderSkeleton title="Tickets Overview" />
      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2 content-lg:grid-cols-4">
        <DashboardInfoCard loading value="" titleSlot={<TicketStatusTag status="AI_ASSISTANCE" />} />
        <DashboardInfoCard
          loading
          value=""
          titleSlot={
            <TicketStatusTag
              status="TECH_REQUIRED"
              className="bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning"
            />
          }
        />
        <DashboardInfoCard loading value="" titleSlot={<TicketStatusTag status="RESOLVED" />} />
        <DashboardInfoCard
          loading
          value=""
          titleSlot={
            <span className="flex h-8 items-center uppercase text-ods-text-secondary text-h5">Other Statuses</span>
          }
        />
      </div>
    </LoadingRegion>
  );
}

/** The row list for Customers Overview — 3 rows of [customer card, 2 info cards with real titles]. */
function CustomersRowsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      {CUSTOMER_ROW_KEYS.map(key => (
        <div key={key} className="grid grid-cols-2 items-stretch gap-[var(--spacing-system-mf)] content-lg:grid-cols-4">
          <CustomerInfoCardSkeleton />
          <DashboardInfoCard
            loading
            value=""
            title="Online Devices"
            showProgress
            loadingShowsPercentage
            percentageDisplay="plain"
          />
          <DashboardInfoCard
            loading
            value=""
            title="Offline Devices"
            showProgress
            loadingShowsPercentage
            percentageDisplay="plain"
          />
        </div>
      ))}
    </div>
  );
}

/** Customers Overview loading state — real header + the row skeletons. */
export function CustomersOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading customers overview">
      <OverviewHeaderSkeleton title="Customers Overview" />
      <CustomersRowsSkeleton />
    </LoadingRegion>
  );
}
