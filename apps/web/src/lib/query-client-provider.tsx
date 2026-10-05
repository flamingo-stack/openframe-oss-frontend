'use client';

import { QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { getQueryClient } from './query-client';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  // Seeded through `useState` so a server render still gets its own client (see
  // `query-client.ts`), while the browser reuses the one non-React callers hold.
  const [queryClient] = useState(getQueryClient);

  // A page restored from the browser's back-forward cache comes back with the
  // query cache it was frozen with, and nothing else refetches it: window focus
  // refetching is off (`query-client.ts`), and no query remounts. Anything
  // saved on the page navigated to in between (an edit page returning with
  // `router.back()`) would stay invisible, so every query is marked stale on
  // restore and the ones on screen refetch.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void queryClient.invalidateQueries();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [queryClient]);

  return <TanstackQueryClientProvider client={queryClient}>{children}</TanstackQueryClientProvider>;
}
