'use client';

import { Skeleton, TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Single source of truth for the dashboard section skeletons.
 *
 * Both the route-level `loading.tsx` and each overview section's own loading
 * branch render THESE components, so the skeleton shown before the route resolves
 * is byte-identical to the one shown while the section fetches its data — no
 * shape-shift flash between the two phases, and no drift over time.
 *
 * This is a FULL skeleton — no real text anywhere. The section HEADER (title +
 * subtitle) renders through the real core `TitleBlock` with its `loading` prop, so
 * the title ("Devices Overview", …) and subtitle are line-box-accurate skeleton
 * bars yet still pixel-identical in height to the loaded header. Inside the cards,
 * every label — the info-card titles ("Online Devices", …) and the ticket status
 * tags — is a skeleton bar too; the card frame is fixed-height so nothing jumps.
 */

const DEVICE_CARD_KEYS = ['online', 'offline', 'pending', 'archived'] as const;
const TICKET_CARD_KEYS = ['ai', 'tech', 'resolved', 'other'] as const;
const CUSTOMER_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const;

/**
 * Inline skeleton bar, phrasing-valid (`<span>`) so it can live INSIDE the real
 * `<p>` / `<h1>` typography elements — mirrors the core `TitleBlock`'s own
 * `TitleTextSkeleton`. A `<Skeleton>` (which renders a `<div>`) nested in a `<p>`
 * is invalid HTML and a hydration error, hence the span. `align-middle` keeps it
 * centered on the text baseline; the surrounding element's line-box sets the height.
 */
function InlineSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block max-w-full animate-pulse rounded-md bg-ods-border align-middle', className)}
    />
  );
}

// Exact wrapper of the core `DashboardInfoCard` (its `baseClassName`).
const INFO_CARD_CLASS =
  'flex h-16 items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] transition-all md:h-[104px] md:gap-[var(--spacing-system-m)] md:p-[var(--spacing-system-m)]';

/**
 * One `DashboardInfoCard` in its loading state — a FULL skeleton. The card frame is
 * fixed-height (`h-16 md:h-[104px]`), so every part is a skeleton bar: the title/label
 * (in a `text-h5` line box so its height matches the loaded card's label / status tag),
 * the value, the optional percentage, and the optional progress ring.
 */
function InfoCardSkeleton({
  showProgress = false,
  showPercentage = false,
}: {
  showProgress?: boolean;
  showPercentage?: boolean;
}) {
  return (
    <div className={INFO_CARD_CLASS}>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title/label — skeleton bar in a text-h5 line box. */}
        <p className="text-h5 text-ods-text-secondary">
          <InlineSkeleton className="h-2.5 w-24 md:h-3" />
        </p>
        {/* Value (+ optional percentage) — the query-dependent part. Value typography
            mirrors the real card (`text-h3 md:text-h2`) so the line box matches at every breakpoint. */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className="text-h3 text-ods-text-primary md:text-h2">
            <InlineSkeleton className="h-4 w-8 md:h-6" />
          </p>
          {showPercentage && (
            <p className="text-h4 text-ods-text-secondary">
              <InlineSkeleton className="h-3 w-14" />
            </p>
          )}
        </div>
      </div>
      {/* Circular progress ring — responsive 24 → 56px, matching progressSize={{ base: 24, md: 56 }}. */}
      {showProgress && <Skeleton className="size-6 shrink-0 rounded-full md:size-14" />}
    </div>
  );
}

/**
 * Customer `DashboardInfoCard` skeleton — the whole card is per-customer data
 * (logo, name, device count, website), so it stays a skeleton. Mirrors the real
 * card's icon slot (32 → 56px tile) and the name/subtitle rows.
 */
function CustomerInfoCardSkeleton() {
  return (
    <div className={cn(INFO_CARD_CLASS, 'col-span-2')}>
      {/* logo tile — mirrors the DashboardInfoCard icon slot */}
      <Skeleton className="size-8 shrink-0 rounded-sm md:size-14" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-h3 text-ods-text-primary">
          <InlineSkeleton className="h-4 w-40" />
        </p>
        <p className="text-h6 text-ods-text-secondary">
          <InlineSkeleton className="h-3 w-24" />
        </p>
      </div>
    </div>
  );
}

/**
 * Overview section header in loading state — the REAL core `TitleBlock` with its
 * `loading` prop. That renders the title and subtitle as line-box-accurate skeleton
 * bars (a true skeleton, no real "Devices Overview" text) while staying pixel-identical
 * in height to the loaded header, since the section renders the same `TitleBlock` with
 * the real strings once data arrives. `[&_p]:hidden lg:[&_p]:block` matches the loaded
 * header — the subtitle line shows only from `lg` up.
 */
function OverviewHeaderSkeleton({ title, unit }: { title: string; unit: string }) {
  return <TitleBlock title={title} subtitle={unit} loading className="[&_p]:hidden lg:[&_p]:block" />;
}

/** Devices Overview loading state — skeleton header + 4 info-card skeletons with real titles. */
export function DevicesOverviewSkeleton() {
  return (
    <div>
      <OverviewHeaderSkeleton title="Devices Overview" unit="Devices in Total" />
      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] lg:grid-cols-4">
        {DEVICE_CARD_KEYS.map(key => (
          <InfoCardSkeleton key={key} showProgress showPercentage />
        ))}
      </div>
    </div>
  );
}

/** Tickets Overview loading state — skeleton header + 4 fully-skeleton ticket cards. */
export function TicketsOverviewSkeleton() {
  return (
    <div>
      <OverviewHeaderSkeleton title="Tickets Overview" unit="Tickets in Total" />
      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] md:grid-cols-2 lg:grid-cols-4">
        {TICKET_CARD_KEYS.map(key => (
          <InfoCardSkeleton key={key} />
        ))}
      </div>
    </div>
  );
}

/** The row list for Customers Overview — 3 rows of [customer card, 2 info cards with real titles]. */
function CustomersRowsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      {CUSTOMER_ROW_KEYS.map(key => (
        <div key={key} className="grid grid-cols-2 items-stretch gap-[var(--spacing-system-mf)] lg:grid-cols-4">
          <CustomerInfoCardSkeleton />
          <InfoCardSkeleton showProgress showPercentage />
          <InfoCardSkeleton showProgress showPercentage />
        </div>
      ))}
    </div>
  );
}

/** Customers Overview loading state — skeleton header + the row skeletons. */
export function CustomersOverviewSkeleton() {
  return (
    <div>
      <OverviewHeaderSkeleton title="Customers Overview" unit="Customers in Total" />
      <CustomersRowsSkeleton />
    </div>
  );
}
