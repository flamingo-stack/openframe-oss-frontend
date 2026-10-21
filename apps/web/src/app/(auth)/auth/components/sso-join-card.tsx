'use client';

import { SsoJoinForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ComponentProps } from 'react';
import { NO_ITEMS } from '@/app/components/shared';
import type { PendingSsoJoin } from '@/lib/auth-api-client';

type SsoJoinFormProps = ComponentProps<typeof SsoJoinForm>;

interface SsoJoinCardProps extends Omit<SsoJoinFormProps, 'name' | 'email' | 'organizationName' | 'roles'> {
  /** The identity the server holds for this flow; null while it is being read. */
  pending: PendingSsoJoin | null;
}

/**
 * The "One Last Step" card over the pending identity. Until it is read the form draws its identity row's values as
 * bars (`identityLoading`; a loading scope does the same), its static copy and controls real.
 */
export function SsoJoinCard({ pending, ...formProps }: SsoJoinCardProps) {
  // Either name can be missing (Apple, or a provider that only asserts an address); the form falls
  // back to the email when both are.
  const name = [pending?.firstName, pending?.lastName].filter(Boolean).join(' ');

  return (
    <SsoJoinForm
      {...formProps}
      identityLoading={!pending}
      name={name}
      email={pending?.email ?? ''}
      organizationName={pending?.tenantName ?? ''}
      roles={pending?.roles ?? NO_ITEMS}
    />
  );
}
