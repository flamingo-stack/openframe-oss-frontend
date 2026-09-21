'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * The approval a mounted session surface runs under (CU-86ajx02gz): the
 * remote-desktop session builds its MeshCentral relay ids as
 * `<requestId>.<p>.<nonce>` so the gateway gate (CU-86ajx02x3) can match the
 * tunnel against the approval grant. `null` = no approval in play (flag off,
 * legacy auto-start), the tunnel keeps its random id.
 */
const RemoteAccessSessionContext = createContext<string | null>(null);

export function RemoteAccessSessionProvider({
  requestId,
  children,
}: {
  requestId: string | null;
  children: ReactNode;
}) {
  return <RemoteAccessSessionContext.Provider value={requestId}>{children}</RemoteAccessSessionContext.Provider>;
}

/** The approved request id behind the current session surface, or null. */
export function useApprovedRemoteAccessRequestId(): string | null {
  return useContext(RemoteAccessSessionContext);
}
