'use client';

import { Suspense } from 'react';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditScriptPage } from '../../scripts/v2/script/components/edit-script-page';
import { EditScriptSkeleton } from '../../scripts/v2/script/components/edit-script-skeleton';

export default function EditScriptV2PageWrapper() {
  const id = useRequiredIdParam('/scripts-v2', routes.scriptsV2.new);
  if (!id) return null;

  return (
    <Suspense fallback={<EditScriptSkeleton scriptId={id} />}>
      <EditScriptPage scriptId={id} />
    </Suspense>
  );
}
