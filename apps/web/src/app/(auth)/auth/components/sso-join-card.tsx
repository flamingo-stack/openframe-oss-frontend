'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { SsoJoinForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentProps } from 'react';
import type { PendingSsoJoin } from '@/lib/auth-api-client';

/** Placeholder matching the default-size core `Button`. */
function ButtonSkeleton({ className }: { className?: string }) {
  return <UnifiedSkeleton className={`h-10 rounded-md md:h-12 ${className ?? ''}`} />;
}

/**
 * "One Last Step" while the pending identity is read: the header, the identity row, the consent block, back +
 * submit. The row mirrors `SsoJoinForm`'s own surface so the card does not change shape when the identity lands.
 */
export function SsoJoinCardSkeleton() {
  return (
    <LoadingRegion
      label="Loading your account"
      className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]"
    >
      <div className="flex flex-col">
        <UnifiedSkeleton className="my-1 h-6 w-56 md:h-8 md:w-80" />
        <UnifiedSkeleton className="my-0.5 h-4 w-72 max-w-full md:h-5 md:w-96" />
      </div>
      {/* Identity row: avatar, name + organization, role tag */}
      <div className="flex items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
        <UnifiedSkeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <UnifiedSkeleton className="h-5 w-40 max-w-full md:h-6" />
          <UnifiedSkeleton className="h-4 w-56 max-w-full md:h-5" />
        </div>
        <UnifiedSkeleton className="h-8 w-16 shrink-0 rounded-md" />
      </div>
      {/* Consent block, the height of a `CheckboxBlock` with no description */}
      <UnifiedSkeleton className="h-11 w-full rounded-md md:h-12" />
      {/* Back + submit */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <ButtonSkeleton className="flex-1" />
        <ButtonSkeleton className="flex-1" />
      </div>
    </LoadingRegion>
  );
}

type SsoJoinFormProps = ComponentProps<typeof SsoJoinForm>;

interface SsoJoinCardProps extends Omit<SsoJoinFormProps, 'name' | 'email' | 'organizationName' | 'roles'> {
  /** The identity the server holds for this flow; null while it is being read. */
  pending: PendingSsoJoin | null;
}

/** The "One Last Step" card over the pending identity; until it is read (or in a loading scope) its skeleton. */
export function SsoJoinCard({ pending, ...formProps }: SsoJoinCardProps) {
  const loading = useLoadingScope() || !pending;
  if (loading) return <SsoJoinCardSkeleton />;

  // Either name can be missing (Apple, or a provider that only asserts an address); the form falls
  // back to the email when both are.
  const name = [pending.firstName, pending.lastName].filter(Boolean).join(' ');

  return (
    <SsoJoinForm
      {...formProps}
      name={name}
      email={pending.email}
      organizationName={pending.tenantName}
      roles={pending.roles ?? []}
    />
  );
}
