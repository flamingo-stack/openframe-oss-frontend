'use client';

import { SoftwareAction } from '@/generated/schema-enums';
import { SoftwareActionView } from '../components/action-form/software-action-view';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

export default function UpdateSoftwarePage() {
  const gate = useSoftwareManagementGate();
  return <SoftwareActionView action={SoftwareAction.UPDATE} loading={gate === 'loading'} />;
}
