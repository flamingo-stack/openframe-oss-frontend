'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';

/**
 * Software Update Details' own narrowing, beside the execution shell's search: the Status and Customer funnels
 * (`statuses`, `organizationIds`) and the Device Tags window (raw tag ids, `deviceTagIds`), all sent to the server.
 * Kept in the URL, so the toolbar's button and the logs below it read one state.
 */
export function useSoftwareLogParams() {
  const { params, setParam, setParams } = useApiParams({
    status: { type: 'array', default: [] },
    customer: { type: 'array', default: [] },
    deviceTags: { type: 'array', default: [] },
  });
  return {
    status: params.status,
    customer: params.customer,
    deviceTags: params.deviceTags,
    /**
     * The funnels, written in one go: the execution shell keeps `status` under the same name, and two writers in one
     * tick would each rebuild the URL from the stale one and drop the other's change.
     */
    setFunnels: (next: { status: string[]; customer: string[] }) => setParams(next),
    setDeviceTags: (tagIds: string[]) => setParam('deviceTags', tagIds),
  };
}
