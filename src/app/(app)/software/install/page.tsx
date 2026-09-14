'use client';

import { SoftwareAction } from '@/generated/schema-enums';
import { SoftwareActionView } from '../components/software-action-view';

export default function InstallSoftwarePage() {
  return <SoftwareActionView action={SoftwareAction.INSTALL} />;
}
