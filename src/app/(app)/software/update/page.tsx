'use client';

import { SoftwareAction } from '@/generated/schema-enums';
import { SoftwareActionView } from '../components/action-form/software-action-view';

export default function UpdateSoftwarePage() {
  return <SoftwareActionView action={SoftwareAction.UPDATE} />;
}
