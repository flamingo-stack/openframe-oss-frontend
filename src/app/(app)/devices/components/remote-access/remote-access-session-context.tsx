'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { RemoteSession, RemoteSessionEnd } from '../../types/remote-access';

/**
 * What a mounted session surface runs under. `requestId` is the approval: the
 * remote-desktop session builds its MeshCentral relay ids as
 * `<requestId>.<p>.<nonce>` so the gateway can match the tunnel against the
 * grant. `session` is the backend record behind it (null until found, and
 * always on the mock), `ended` flips once the session is over, `endSession`
 * is the technician's own end. Everything empty = no approval in play (flag
 * off, legacy auto-start); the tunnel then keeps its random id.
 */
export interface RemoteAccessSessionContextValue {
  requestId: string | null;
  session: RemoteSession | null;
  ended: RemoteSessionEnd | null;
  endSession: () => void;
}

const NO_SESSION: RemoteAccessSessionContextValue = {
  requestId: null,
  session: null,
  ended: null,
  endSession: () => {},
};

const RemoteAccessSessionContext = createContext<RemoteAccessSessionContextValue>(NO_SESSION);

export function RemoteAccessSessionProvider({
  value,
  children,
}: {
  value: RemoteAccessSessionContextValue;
  children: ReactNode;
}) {
  return <RemoteAccessSessionContext.Provider value={value}>{children}</RemoteAccessSessionContext.Provider>;
}

export function useRemoteAccessSession(): RemoteAccessSessionContextValue {
  return useContext(RemoteAccessSessionContext);
}

/** The approved request id behind the current session surface, or null. */
export function useApprovedRemoteAccessRequestId(): string | null {
  return useRemoteAccessSession().requestId;
}
