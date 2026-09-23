'use client';

import {
  Label,
  type PageActionButton,
  PageLayout,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { InlineSkeleton } from '@/app/components/shared';
import { FIELD_GRID } from './tenant-form-fields';
import { TenantSummaryCardSkeleton } from './tenant-summary-card';

const PAGE_CLASSES = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]';

// The list page uses the shared `ListPageSkeleton` directly; these two are the
// module's own shapes. Each renders the REAL page chrome (`PageLayout` with the
// title bar and placeholder actions) and skeletons only what the record decides,
// so the loaded page lands on the same pixels (`billing-usage-skeleton.tsx` idiom).

const NOOP = () => {};

/** `/settings/tenant-management/details` while the record (and the role) are unknown. */
export function TenantDetailsSkeleton() {
  return (
    <PageLayout
      title="Tenant"
      loading
      loadingActions
      backButton={{ label: 'Back', onClick: NOOP }}
      actionsVariant="icon-buttons"
      className={PAGE_CLASSES}
    >
      <TenantSummaryCardSkeleton />
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <InlineSkeleton className="h-4 w-24" />
        <Skeleton className="h-[284px] w-full rounded-md" />
      </div>
    </PageLayout>
  );
}

type TenantFormSkeletonVariant = 'new' | 'edit' | 'reconnect';

const FORM_PAGES: Record<TenantFormSkeletonVariant, { title: string; backLabel: string }> = {
  new: { title: 'New Tenant Integration', backLabel: 'Back to Integrations' },
  edit: { title: 'Edit Tenant Integration', backLabel: 'Back to Integrations' },
  reconnect: { title: 'Reconnect Tenant Integration', backLabel: 'Back to Integrations' },
};

const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };

/** A field placeholder under its real label, on the same grid cell the field will take. */
function FieldSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <Label className="mb-1" variant="large">
        {label}
      </Label>
      <Skeleton className="h-11 w-full rounded-[6px] md:h-12" />
    </div>
  );
}

/**
 * The New / Edit / Reconnect pages while the role gate (or the record) is
 * unresolved — the same chrome, grid and static labels as the loaded page, so
 * the record landing changes pixels inside the fields and nothing else.
 */
export function TenantFormSkeleton({ variant }: { variant: TenantFormSkeletonVariant }) {
  const { title, backLabel } = FORM_PAGES[variant];
  return (
    <PageLayout
      title={title}
      backButton={{ label: backLabel, onClick: NOOP }}
      actions={[SAVE_PLACEHOLDER]}
      actionsVariant="primary-buttons"
      className={PAGE_CLASSES}
    >
      {variant === 'new' ? (
        <Skeleton className="h-[136px] w-full rounded-md" />
      ) : (
        <TenantSummaryCardSkeleton identityOnly />
      )}
      {variant !== 'reconnect' && (
        <div className={FIELD_GRID}>
          {variant === 'new' && <FieldSkeleton label="Domain Name" className="md:col-span-2" />}
          <FieldSkeleton label="Connection Name" />
          <FieldSkeleton label="Select Customer" />
        </div>
      )}
      {variant === 'new' && <Skeleton className="h-11 w-full rounded-md md:h-12 md:w-64" />}
      {variant === 'reconnect' && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <InlineSkeleton className="h-5 w-40" />
          <Skeleton className="h-[220px] w-full rounded-md" />
        </div>
      )}
    </PageLayout>
  );
}
