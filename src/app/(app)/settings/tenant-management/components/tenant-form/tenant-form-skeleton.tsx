'use client';

import {
  Label,
  type PageActionButton,
  PageLayout,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { InlineSkeleton } from '@/app/components/shared';
import { TenantSummaryCardSkeleton } from '../tenant-detail/tenant-summary-card';
import { FIELD_GRID } from './tenant-form-fields';

type TenantFormSkeletonVariant = 'new' | 'edit' | 'reconnect';

const FORM_TITLES: Record<TenantFormSkeletonVariant, string> = {
  new: 'New Tenant Integration',
  edit: 'Edit Tenant Integration',
  reconnect: 'Reconnect Tenant Integration',
};

const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };
const NOOP = () => {};

/** A field placeholder under its real label, on the same grid cell the field will take. */
function FieldSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <Label className="mb-[var(--spacing-system-xxs)]" variant="large">
        {label}
      </Label>
      <Skeleton className="h-11 w-full rounded-[6px] md:h-12" />
    </div>
  );
}

/** The New / Edit / Reconnect pages while the flag or the role is unknown: the real chrome, grid and labels. */
export function TenantFormSkeleton({ variant }: { variant: TenantFormSkeletonVariant }) {
  return (
    <PageLayout
      title={FORM_TITLES[variant]}
      backButton={{ label: 'Back to Integrations', onClick: NOOP }}
      actions={[SAVE_PLACEHOLDER]}
      actionsVariant="primary-buttons"
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
