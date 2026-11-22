'use client';

import { Button, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useSyncExternalStore } from 'react';
import { isSaasSharedMode, isSharedAuthUi } from '@/lib/app-mode';
import { authHardeningQueryOptions } from '@/lib/auth-hardening';

const subscribeToShell = () => () => {};

/** Waits for the signup and sign-in contract before an interactive flow starts. */
export function AuthHardeningBoundary({ children }: { children: (enabled: boolean) => ReactNode }) {
  const sharedAuth = useSyncExternalStore(subscribeToShell, isSharedAuthUi, isSaasSharedMode);
  const mode = useQuery({ ...authHardeningQueryOptions(), enabled: sharedAuth });

  if (!sharedAuth) return children(false);
  if (mode.data !== undefined) return children(mode.data);

  if (!mode.isError)
    return (
      <LoadingWhen loading label="Loading sign-in options">
        {null}
      </LoadingWhen>
    );

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border border-ods-border bg-ods-card p-6">
      <p role="status" className="text-ods-text-primary text-h4">
        Could not load sign-in options.
      </p>
      <Button variant="outline" onClick={() => void mode.refetch()} disabled={mode.isFetching}>
        Try again
      </Button>
    </div>
  );
}
