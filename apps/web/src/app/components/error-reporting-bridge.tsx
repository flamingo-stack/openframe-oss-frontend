'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { initErrorReporting, setErrorReportingUser } from '@/lib/error-reporting';

/** Starts error reporting (a no-op outside SaaS) and keeps its user in step with the session. Renders nothing. */
export function ErrorReportingBridge() {
  useEffect(() => {
    initErrorReporting();
    let lastId: string | null = null;
    const sync = (id: string | null) => {
      if (id === lastId) return;
      lastId = id;
      setErrorReportingUser(id);
    };
    sync(useAuthStore.getState().user?.id ?? null);
    return useAuthStore.subscribe(state => sync(state.user?.id ?? null));
  }, []);

  return null;
}
