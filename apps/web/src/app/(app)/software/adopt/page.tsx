'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwareAdoptView } from '../components/adopt/software-adopt-view';
import { useSoftwareAdoptGate } from '../components/adopt/use-software-adopt-gate';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

export default function SoftwareAdoptPage() {
  const gate = useSoftwareManagementGate();
  const adoptGate = useSoftwareAdoptGate();
  // A missing id is a truncated link: back to the list rather than a page about no software.
  const softwareId = useRequiredIdParam(routes.software.list);
  // Only a definitive "off" 404s, as the module's own gate does: throwing while the flag is unanswered is unrecoverable.
  if (adoptGate === 'off') notFound();
  if (!softwareId) return null;
  return <SoftwareAdoptView softwareId={softwareId} loading={gate === 'loading' || adoptGate === 'loading'} />;
}
