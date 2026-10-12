'use client';

import { EmployeeDetailsView } from '@/app/(app)/settings/components/employee-details/employee-details-view';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function EmployeeDetailsPage() {
  const userId = useRequiredIdParam(routes.settings.employees);
  if (!userId) return null;
  return <EmployeeDetailsView userId={userId} />;
}
