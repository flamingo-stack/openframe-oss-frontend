'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ChecksList } from './components/checks-list';
import { useChecksGate } from './hooks/use-checks-gate';

/** `/monitoring/checks`: the built-in health checks, their defaults and how many exceptions change them. */
export default function ChecksPage() {
  const gate = useChecksGate();
  if (gate === 'off') return <NotFoundError message="Checks not found" />;
  return (
    <LoadingWhen loading={gate === 'loading'}>
      <ChecksList />
    </LoadingWhen>
  );
}
