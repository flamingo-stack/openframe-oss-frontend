'use client';

import { useSearchParams } from 'next/navigation';
import { SoftwareAction } from '@/generated/schema-enums';
import { SoftwareActionView } from '../components/action-form/software-action-view';
import { SoftwareTitleUpdateView } from '../components/action-form/software-title-update-view';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

/** Update Software, or Update <software> when opened from a title's page (`routes.software.updateSoftware`). */
export default function UpdateSoftwarePage() {
  const gate = useSoftwareManagementGate();
  const softwareId = useSearchParams().get('softwareId');
  return softwareId ? (
    <SoftwareTitleUpdateView softwareId={softwareId} loading={gate === 'loading'} />
  ) : (
    <SoftwareActionView action={SoftwareAction.UPDATE} loading={gate === 'loading'} />
  );
}
