'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwareAutoUpdateView } from '../components/auto-update/software-auto-update-view';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

export default function SoftwareAutoUpdatePage() {
  const gate = useSoftwareManagementGate();
  // A missing id is a truncated link: back to the list rather than a page about no software.
  const softwareId = useRequiredIdParam(routes.software.list);
  if (!softwareId) return null;
  return <SoftwareAutoUpdateView softwareId={softwareId} loading={gate === 'loading'} />;
}
