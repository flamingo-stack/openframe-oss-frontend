'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditScriptPage } from '../script/components/edit-script-page';

export default function EditScriptPageWrapper() {
  const id = useRequiredIdParam('/scripts', routes.scripts.new);
  if (!id) return null;

  // No boundary here: the page paints its own chrome on the first render and
  // suspends only around the fields that read the script.
  return <EditScriptPage scriptId={id} />;
}
