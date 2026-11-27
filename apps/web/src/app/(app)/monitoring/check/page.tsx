'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { CheckPageView } from '../checks/components/check-page-view';
import { useChecksGate } from '../checks/hooks/use-checks-gate';

/** `/monitoring/check?id=<check key>`: one built-in check, its default and its overrides. */
export default function CheckPage() {
  const checkKey = useRequiredIdParam(routes.monitoring.checks);
  const gate = useChecksGate();
  if (!checkKey) return null;
  if (gate === 'off') return <NotFoundError message="Check not found" />;
  return (
    <LoadingWhen loading={gate === 'loading'}>
      <CheckPageView checkKey={checkKey} />
    </LoadingWhen>
  );
}
