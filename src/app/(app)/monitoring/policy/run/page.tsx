'use client';

import { useSearchParams } from 'next/navigation';
import { RunPolicyView } from '../components/run-policy-view';

export default function RunPolicyPage() {
  const paramId = useSearchParams().get('id');
  return <RunPolicyView policyId={paramId || ''} />;
}
