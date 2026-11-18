'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwareAdoptView } from '../components/adopt/software-adopt-view';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

export default function SoftwareAdoptPage() {
  const gate = useSoftwareManagementGate();
  // A missing id is a truncated link: back to the list rather than a page about no software.
  const softwareId = useRequiredIdParam(routes.software.list);
  if (!softwareId) return null;
  return <SoftwareAdoptView softwareId={softwareId} loading={gate === 'loading'} />;
}
